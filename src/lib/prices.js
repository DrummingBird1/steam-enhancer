(function (global) {
  'use strict';
  const SE = global.SteamEnhancer || (global.SteamEnhancer = {});

  // Resolve a Steam appid → an ITAD price summary (current low + Steam's own
  // historical low). Returns null on any failure, or the string 'needsItadKey'
  // specifically when no IsThereAnyDeal API key is configured (Options → Region)
  // — callers use that to show a helpful "add a free key" message instead of
  // just going quiet. Response parsing lives in itad.js (unit-tested).
  SE.priceSummary = async (appid, country = 'us') => {
    if (!appid) return null;
    try {
      const lookup = await SE.api.itadLookup(appid);
      if (lookup?.needsItadKey) return 'needsItadKey';
      const game = lookup?.ok ? SE.itad.gameFromLookup(lookup.data) : null;
      if (!game) return null;
      const [prices, low] = await Promise.all([
        SE.api.itadPrices(game.id, country),
        SE.api.itadHistoryLow(game.id, country)
      ]);
      return {
        itadId: game.id,
        slug: game.slug,
        currentLow: SE.itad.bestDeal(prices?.data, game.id),
        historicalLow: SE.itad.storeLow(low?.data, game.id)
      };
    } catch (e) {
      SE.warn('priceSummary failed', e);
      return null;
    }
  };

  // Batched variant for list pages (search/wishlist): resolves many appids'
  // ITAD ids in parallel (each cached 24h individually, so repeat visits are
  // cheap), then makes ONE prices call and ONE storelow call covering all of
  // them, instead of 2N separate calls. Returns a Map<appid, summary> (missing
  // keys mean "couldn't resolve"), or the string 'needsItadKey'.
  SE.priceSummaryBatch = async (appids, country = 'us') => {
    const uniqueIds = [...new Set(appids)].filter(Boolean);
    if (!uniqueIds.length) return new Map();

    const lookups = await Promise.all(uniqueIds.map(async (appid) => {
      const r = await SE.api.itadLookup(appid);
      if (r?.needsItadKey) return { appid, needsItadKey: true };
      const game = r?.ok ? SE.itad.gameFromLookup(r.data) : null;
      return { appid, itadId: game?.id || null, slug: game?.slug || null };
    }));
    if (lookups.some((l) => l.needsItadKey)) return 'needsItadKey';

    const resolved = lookups.filter((l) => l.itadId);
    if (!resolved.length) return new Map();

    const ids = resolved.map((l) => l.itadId);
    const [pricesResp, lowResp] = await Promise.all([
      SE.api.itadPricesBatch(ids, country),
      SE.api.itadHistoryLowBatch(ids, country)
    ]);
    if (pricesResp?.needsItadKey || lowResp?.needsItadKey) return 'needsItadKey';

    const out = new Map();
    for (const { appid, itadId, slug } of resolved) {
      out.set(appid, {
        itadId, slug,
        currentLow: SE.itad.bestDeal(pricesResp?.data, itadId),
        historicalLow: SE.itad.storeLow(lowResp?.data, itadId)
      });
    }
    return out;
  };

})(window);
