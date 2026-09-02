(function (global) {
  'use strict';
  const SE = global.SteamEnhancer || (global.SteamEnhancer = {});

  // Resolve a Steam appid → an ITAD price summary (current low + historical low + deal store).
  // Returns null on any failure, or the string 'needsItadKey' specifically when
  // no IsThereAnyDeal API key is configured (Options → Region) — callers use
  // that to show a helpful "add a free key" message instead of just going quiet.
  SE.priceSummary = async (appid, country = 'us') => {
    if (!appid) return null;
    try {
      const lookup = await SE.api.itadLookup(appid);
      if (lookup?.needsItadKey) return 'needsItadKey';
      if (!lookup?.ok || !lookup.data?.game?.id) return null;
      const id = lookup.data.game.id;
      const [prices, low] = await Promise.all([
        SE.api.itadPrices(id, country),
        SE.api.itadHistoryLow(id, country)
      ]);
      const priceEntry = prices?.data?.[0];
      const current = priceEntry?.deals?.[0];
      const histLow = low?.data?.[0]?.low;
      return {
        itadId: id,
        slug: lookup.data.game.slug,
        currentLow: current ? {
          price: current.price?.amount,
          regular: current.regular?.amount,
          cut: current.cut,
          shop: current.shop?.name,
          url: current.url,
          currency: current.price?.currency
        } : null,
        historicalLow: histLow ? {
          price: histLow.price?.amount,
          cut: histLow.cut,
          shop: histLow.shop?.name,
          timestamp: histLow.timestamp,
          currency: histLow.price?.currency
        } : null
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
      return { appid, itadId: r?.ok ? r.data?.game?.id : null, slug: r?.ok ? r.data?.game?.slug : null };
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

    const pricesById = new Map((pricesResp?.data || []).map((p) => [p.id, p]));
    const lowById = new Map((lowResp?.data || []).map((p) => [p.id, p]));

    const out = new Map();
    for (const { appid, itadId, slug } of resolved) {
      const priceEntry = pricesById.get(itadId);
      const current = priceEntry?.deals?.[0];
      const histLow = lowById.get(itadId)?.low;
      out.set(appid, {
        itadId, slug,
        currentLow: current ? {
          price: current.price?.amount, regular: current.regular?.amount, cut: current.cut,
          shop: current.shop?.name, url: current.url, currency: current.price?.currency
        } : null,
        historicalLow: histLow ? {
          price: histLow.price?.amount, cut: histLow.cut, shop: histLow.shop?.name,
          timestamp: histLow.timestamp, currency: histLow.price?.currency
        } : null
      });
    }
    return out;
  };

})(window);
