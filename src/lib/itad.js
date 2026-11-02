// Pure parsers for IsThereAnyDeal v2 response bodies. Shared by content
// scripts (loaded as a classic script) and the background service worker
// (imported for its side effect), so it attaches to globalThis rather than
// window. No DOM, no chrome.* — covered by scripts/unit-test.js.
//
// Shapes per docs.isthereanydeal.com (verified 2026-11):
//   lookup/v1    { found, game: { id, slug, title } }
//   prices/v3    [ { id, historyLow: { all, y1, m3 }, deals: [ { shop, price, regular, cut, url } ] } ]
//   storelow/v2  [ { id, lows: [ { shop, price, regular, cut, timestamp } ] } ]
//   history/v2   [ { timestamp, shop, deal: { price, regular, cut } } ] → [{ t, v, shop, currency }]
(function (global) {
  'use strict';
  const SE = global.SteamEnhancer || (global.SteamEnhancer = {});

  const byId = (list, id) => (Array.isArray(list) ? list : []).find((e) => e && e.id === id) || null;

  SE.itad = {
    // `body` is the ITAD JSON itself, i.e. the `.data` of an SE.bg fetchJson reply.
    gameFromLookup(body) {
      if (!body || body.found === false || !body.game?.id) return null;
      return { id: body.game.id, slug: body.game.slug || null, title: body.game.title || null };
    },

    // Cheapest current deal for one game. Doesn't rely on ITAD's ordering of
    // `deals`, which the docs don't promise.
    bestDeal(pricesBody, id) {
      const deals = byId(pricesBody, id)?.deals;
      if (!Array.isArray(deals) || !deals.length) return null;
      let best = null;
      for (const d of deals) {
        const amt = d?.price?.amount;
        if (typeof amt !== 'number') continue;
        if (!best || amt < best.price.amount) best = d;
      }
      if (!best) return null;
      return {
        price: best.price.amount, regular: best.regular?.amount, cut: best.cut,
        shop: best.shop?.name, url: best.url, currency: best.price.currency
      };
    },

    // Lowest price ever recorded on the requested shop(s) (storelow/v2).
    storeLow(lowBody, id) {
      const lows = byId(lowBody, id)?.lows;
      if (!Array.isArray(lows) || !lows.length) return null;
      let best = null;
      for (const l of lows) {
        if (typeof l?.price?.amount !== 'number') continue;
        if (!best || l.price.amount < best.price.amount) best = l;
      }
      if (!best) return null;
      return {
        price: best.price.amount, cut: best.cut, shop: best.shop?.name,
        timestamp: best.timestamp, currency: best.price.currency
      };
    },

    // history/v2 → [{ t, v, shop, currency }] sorted oldest first.
    historyPoints(historyBody) {
      if (!Array.isArray(historyBody)) return [];
      return historyBody
        .map((e) => ({ t: Date.parse(e?.timestamp), v: e?.deal?.price?.amount, shop: e?.shop?.name, currency: e?.deal?.price?.currency }))
        .filter((p) => Number.isFinite(p.t) && typeof p.v === 'number')
        .sort((a, b) => a.t - b.t);
    }
  };
})(globalThis);
