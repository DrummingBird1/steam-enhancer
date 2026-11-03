// Pure wishlist model: parsing Steam's wishlist + store-item API responses,
// joining them with ITAD price data, and the summary/sort/filter/export logic
// behind the wishlist panel. No DOM, no chrome.* — covered by
// scripts/unit-test.js. Attaches to globalThis so the service worker can
// share it.
//
// Shapes (verified live 2026-11):
//   IWishlistService/GetWishlist/v1     { response: { items: [ { appid, priority, date_added } ] } }
//                                        (private or empty wishlist: { response: {} })
//   IStoreBrowseService/GetItems/v1     { response: { store_items: [ { appid, success, name,
//                                          best_purchase_option: { final_price_in_cents, original_price_in_cents?,
//                                          discount_pct?, formatted_final_price }, reviews: { summary_filtered:
//                                          { percent_positive, review_count } }, platforms: { steam_deck_compat_category } } ] } }
(function (global) {
  'use strict';
  const SE = global.SteamEnhancer || (global.SteamEnhancer = {});

  const STEAMID = /^7656119\d{10}$/;

  SE.wishlistModel = {
    // Whose wishlist this page shows. /wishlist/profiles/<id>/ has it in the
    // URL; /wishlist/id/<vanity>/ only in the page's server-rendered state
    // (the #valve-ssr-data script), as the wishlist route's "steamid".
    ownerSteamId(pathname, ssrText) {
      const fromPath = String(pathname || '').match(/\/wishlist\/profiles\/(7656119\d{10})/);
      if (fromPath) return fromPath[1];
      const text = String(ssrText || '');
      const m = text.match(/\\?"steamid\\?"\s*:\s*\\?"(7656119\d{10})\\?"\s*,\s*\\?"sort\\?"/)
        || text.match(/\\?"PlayerLinkDetails\\?"\s*,\s*\\?"(7656119\d{10})/);
      return m && STEAMID.test(m[1]) ? m[1] : null;
    },

    // null = private/empty (Steam answers both the same way).
    items(body) {
      const list = body?.response?.items;
      if (!Array.isArray(list) || !list.length) return null;
      return list
        .filter((i) => i && i.appid)
        .map((i) => ({ appid: String(i.appid), priority: Number(i.priority) || 0, added: Number(i.date_added) || 0 }));
    },

    // → Map<appid, details>. Prices are integer cents of the requested country's currency.
    storeItems(body) {
      const out = new Map();
      for (const s of body?.response?.store_items || []) {
        if (!s || s.success !== 1 || !s.appid) continue;
        const po = s.best_purchase_option || null;
        const final = po ? Number(po.final_price_in_cents) : NaN;
        const original = po ? Number(po.original_price_in_cents || po.final_price_in_cents) : NaN;
        const rev = s.reviews?.summary_filtered || null;
        out.set(String(s.appid), {
          name: s.name || '',
          slug: s.store_url_path || `app/${s.appid}`,
          priceCents: Number.isFinite(final) ? final : null,
          regularCents: Number.isFinite(original) ? original : null,
          discount: po ? Number(po.discount_pct) || 0 : 0,
          formatted: po?.formatted_final_price || '',
          reviewPct: rev ? Number(rev.percent_positive) : null,
          reviewCount: rev ? Number(rev.review_count) : 0,
          deck: s.platforms?.steam_deck_compat_category || 0,
          released: Number(s.release?.steam_release_date) || 0
        });
      }
      return out;
    },

    // One row per wishlisted app. `itad` is the Map from SE.priceSummaryBatch
    // (may be empty), `targets` the appid → price map of price alerts.
    buildRows(items, store, itad, targets) {
      return (items || []).map((it) => {
        const s = store?.get(it.appid) || {};
        const sum = itad?.get?.(it.appid) || null;
        const price = s.priceCents != null ? s.priceCents / 100 : null;
        const low = sum?.historicalLow?.price ?? null;
        const vsLow = price != null && low != null && low > 0 ? Math.round(((price - low) / low) * 100) : null;
        const target = targets?.[it.appid] != null ? Number(targets[it.appid]) : null;
        return {
          appid: it.appid,
          name: s.name || `App ${it.appid}`,
          url: `https://store.steampowered.com/${s.slug || `app/${it.appid}`}/`,
          priority: it.priority,
          added: it.added,
          price,
          regular: s.regularCents != null ? s.regularCents / 100 : null,
          discount: s.discount || 0,
          formatted: s.formatted || '',
          low,
          vsLow,
          atLow: vsLow != null && vsLow <= 0,
          bestDeal: sum?.currentLow || null,
          target,
          atTarget: target != null && price != null && price <= target,
          reviewPct: s.reviewPct ?? null,
          reviewCount: s.reviewCount || 0,
          deck: s.deck || 0,
          released: s.released || 0
        };
      });
    },

    summary(rows) {
      const priced = rows.filter((r) => r.price != null);
      return {
        count: rows.length,
        priced: priced.length,
        total: priced.reduce((a, r) => a + r.price, 0),
        totalRegular: priced.reduce((a, r) => a + (r.regular ?? r.price), 0),
        onSale: rows.filter((r) => r.discount > 0).length,
        atLow: rows.filter((r) => r.atLow).length,
        atTarget: rows.filter((r) => r.atTarget).length
      };
    },

    // Unknown values always sort last, whatever the direction.
    sortRows(rows, key, dir = 1) {
      const val = {
        priority: (r) => r.priority,
        name: (r) => r.name.toLowerCase(),
        price: (r) => r.price,
        discount: (r) => -r.discount,
        vsLow: (r) => r.vsLow,
        reviews: (r) => (r.reviewPct == null ? null : -r.reviewPct),
        added: (r) => -r.added,
        released: (r) => -r.released
      }[key] || ((r) => r.priority);
      return [...rows].sort((a, b) => {
        const x = val(a), y = val(b);
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        return (x < y ? -1 : x > y ? 1 : 0) * dir;
      });
    },

    filterRows(rows, { text = '', onSale = false, atLow = false, atTarget = false, maxPrice = null } = {}) {
      const q = text.trim().toLowerCase();
      return rows.filter((r) =>
        (!q || r.name.toLowerCase().includes(q)) &&
        (!onSale || r.discount > 0) &&
        (!atLow || r.atLow) &&
        (!atTarget || r.atTarget) &&
        (maxPrice == null || (r.price != null && r.price <= maxPrice)));
    },

    toCsv(rows) {
      const esc = (v) => {
        const s = v == null ? '' : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const cols = ['appid', 'name', 'price', 'regular', 'discount', 'low', 'vsLow', 'target', 'reviewPct', 'priority', 'added'];
      const lines = rows.map((r) => cols.map((c) =>
        esc(c === 'added' ? (r.added ? new Date(r.added * 1000).toISOString().slice(0, 10) : '') : r[c])).join(','));
      return [cols.join(','), ...lines].join('\n');
    }
  };
})(globalThis);
