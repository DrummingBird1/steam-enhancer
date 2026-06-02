(function (global) {
  'use strict';
  const SE = global.SteamEnhancer || (global.SteamEnhancer = {});

  // Resolve a Steam appid → an ITAD price summary (current low + historical low + deal store).
  SE.priceSummary = async (appid, country = 'us') => {
    if (!appid) return null;
    try {
      const lookup = await SE.api.itadLookup(appid);
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

})(window);
