// Pure Steam Community Market helpers for Market Pro (quick/instant sell,
// my-listings check). Integer cents of the wallet currency throughout; "buyer"
// prices are what the market shows, "receive" what the seller gets after fees
// (see SE.marketFees in utils.js). No DOM, no chrome.* — unit-tested.
(function (global) {
  'use strict';
  const SE = global.SteamEnhancer || (global.SteamEnhancer = {});

  const cents = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100));

  SE.marketMath = {
    // Quick sell: one cent under the cheapest listing, never below the 3-cent
    // market minimum. null if there's no listing to undercut.
    quickSellBuyerCents(lowestBuyerCents) {
      if (!Number.isFinite(lowestBuyerCents) || lowestBuyerCents <= 0) return null;
      return Math.max(3, lowestBuyerCents - 1);
    },

    // Instant sell: list at exactly the highest buy order, which Steam fills
    // immediately. null if nobody has a buy order up.
    instantSellBuyerCents(highestBuyOrderCents) {
      const c = Number(highestBuyOrderCents);
      return Number.isFinite(c) && c >= 3 ? c : null;
    },

    // My listing vs the market's cheapest: 'lowest' when mine is (one of) the
    // cheapest, 'undercut' when someone lists below me, by `byCents`.
    listingStatus(myBuyerCents, lowestBuyerCents) {
      if (!Number.isFinite(myBuyerCents) || !Number.isFinite(lowestBuyerCents)) return { status: 'unknown', byCents: 0 };
      if (lowestBuyerCents < myBuyerCents) return { status: 'undercut', byCents: myBuyerCents - lowestBuyerCents };
      return { status: 'lowest', byCents: 0 };
    },

    // A "My listings" price cell reads like "$1.15 ($1.00)" or "1,15€ (1,00€)":
    // what the buyer pays, then in parentheses what you receive.
    parseMyListingPrice(text) {
      const s = String(text || '').replace(/\s+/g, ' ').trim();
      const m = s.match(/^(.*?)\((.*?)\)/);
      const buyer = SE.parsePrice(m ? m[1] : s);
      const receive = m ? SE.parsePrice(m[2]) : null;
      return { buyerCents: cents(buyer), receiveCents: cents(receive) };
    },

    // The order-book id Steam's own listing page passes to Market_LoadOrderSpread.
    itemNameIdFromHtml(html) {
      const m = String(html || '').match(/Market_LoadOrderSpread\(\s*(\d+)\s*\)/);
      return m ? m[1] : null;
    },

    // /market/pricehistory/ → [{ t, v }]. Verified signed in (2026): the
    // series is in `prices`, as ["Dec 11 2014 01: +0", 1.13, "1249"] (UTC
    // hour, median price in the wallet currency, units sold). 1.4.x read a
    // `price_history` field that doesn't exist, so the chart never drew.
    historyPoints(body) {
      const rows = (body && (body.prices || body.price_history)) || [];
      if (!Array.isArray(rows)) return [];
      return rows.map(([date, price]) => {
        const m = String(date).match(/^([A-Za-z]{3}) (\d{1,2}) (\d{4}) (\d{1,2})/);
        const t = m ? Date.parse(`${m[1]} ${m[2]} ${m[3]} ${m[4]}:00:00 UTC`) : NaN;
        return { t, v: Number(price) };
      }).filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v));
    },

    // /market/listings/<appid>/<market_hash_name> → { appid, name }
    listingFromUrl(url) {
      const m = String(url || '').match(/\/market\/listings\/(\d+)\/([^/?#]+)/);
      if (!m) return null;
      let name = m[2];
      try { name = decodeURIComponent(name); } catch {}
      return { appid: m[1], name };
    },

    cents
  };
})(globalThis);
