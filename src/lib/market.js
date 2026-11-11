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

    // Mass-list with "keep N of each": which items, and how many of each
    // stack, to list so that `keep` copies of every item name stay in the
    // inventory. items: [{ market_hash_name, amount, … }]. The copies held back
    // come from the first stacks seen. Returns [{ item, amount }], amount > 0.
    selectForListing(items, keep) {
      const hold = new Map(); // name → copies still to hold back
      const want = Math.max(0, Math.floor(Number(keep) || 0));
      const out = [];
      for (const item of items || []) {
        const name = item.market_hash_name;
        const have = Math.max(1, Math.floor(Number(item.amount) || 1));
        if (!hold.has(name)) hold.set(name, want);
        const held = Math.min(hold.get(name), have);
        hold.set(name, hold.get(name) - held);
        if (have - held > 0) out.push({ item, amount: have - held });
      }
      return out;
    },

    // The Market Beta item page's own order-book call,
    //   /market/orderbook?q=Load&qp=[appid,"market_hash_name"]
    // answers { data: { success, data: { amtMaxBuyOrder, amtMinSellOrder,
    // eCurrency, cBuyOrders, cSellOrders, rgCompactBuyOrders, … } } } — by
    // name, so no order-book id is needed (verified live, 2026-11). Reduced to
    // the few numbers anything here uses, in cents of `currency` (a Steam
    // currency id): the full book is hundreds of entries and not worth caching.
    orderBookSummary(body) {
      const d = body && body.data && body.data.success ? body.data.data : null;
      if (!d || !Number.isFinite(Number(d.eCurrency))) return null;
      const n = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : null);
      return {
        currency: Number(d.eCurrency),
        highestBuy: n(d.amtMaxBuyOrder), lowestSell: n(d.amtMinSellOrder),
        buyCount: Number(d.cBuyOrders) || 0, sellCount: Number(d.cSellOrders) || 0
      };
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
