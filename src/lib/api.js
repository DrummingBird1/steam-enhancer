(function (global) {
  'use strict';
  const SE = global.SteamEnhancer || (global.SteamEnhancer = {});

  // All network calls go through the background service worker so we can centralize caching/CORS.

  SE.api = {
    // IsThereAnyDeal v2 public endpoints (no key required for /games/prices/v3 lookup via /games/lookup/v1).
    async itadLookup(appid) {
      return SE.bg({ type: 'fetchJson', url: `https://api.isthereanydeal.com/games/lookup/v1?appid=${encodeURIComponent(appid)}` , cacheKey: `itadlookup:${appid}`, ttl: 60 * 24 });
    },

    async itadPrices(itadId, country = 'us') {
      const body = JSON.stringify([itadId]);
      return SE.bg({
        type: 'fetchJson',
        url: `https://api.isthereanydeal.com/games/prices/v3?country=${encodeURIComponent(country)}&capacity=8&nondeals=true&vouchers=true`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        cacheKey: `itadprices:${itadId}:${country}`,
        ttl: 60
      });
    },

    async itadHistoryLow(itadId, country = 'us') {
      const body = JSON.stringify([itadId]);
      return SE.bg({
        type: 'fetchJson',
        url: `https://api.isthereanydeal.com/games/storelow/v2?country=${encodeURIComponent(country)}&shops=61`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        cacheKey: `itadlow:${itadId}:${country}`,
        ttl: 60 * 6
      });
    },

    async itadOverview(itadId, country = 'us') {
      const body = JSON.stringify([itadId]);
      return SE.bg({
        type: 'fetchJson',
        url: `https://api.isthereanydeal.com/games/overview/v2?country=${encodeURIComponent(country)}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        cacheKey: `itadov:${itadId}:${country}`,
        ttl: 60
      });
    },

    // Steam storefront app details (the cheapest source for regional pricing).
    async appDetails(appid, cc = 'us', filters = 'price_overview,basic') {
      return SE.bg({
        type: 'fetchJson',
        url: `https://store.steampowered.com/api/appdetails/?appids=${encodeURIComponent(appid)}&cc=${encodeURIComponent(cc)}&l=en&filters=${encodeURIComponent(filters)}`,
        cacheKey: `appdetails:${appid}:${cc}:${filters}`,
        ttl: 30
      });
    },

    async numPlayers(appid) {
      return SE.bg({
        type: 'fetchJson',
        url: `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${encodeURIComponent(appid)}`,
        cacheKey: `players:${appid}`,
        ttl: 5
      });
    },

    async achievementPercentages(appid) {
      return SE.bg({
        type: 'fetchJson',
        url: `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=${encodeURIComponent(appid)}`,
        cacheKey: `achv:${appid}`,
        ttl: 60 * 24
      });
    },

    async marketPriceOverview(appid, market_hash_name, country = 'US', currency = 1) {
      const url = `https://steamcommunity.com/market/priceoverview/?appid=${encodeURIComponent(appid)}&country=${encodeURIComponent(country)}&currency=${encodeURIComponent(currency)}&market_hash_name=${encodeURIComponent(market_hash_name)}`;
      return SE.bg({ type: 'fetchJson', url, cacheKey: `mkt:${appid}:${market_hash_name}:${currency}`, ttl: 30 });
    },

    async dynamicStore() {
      // Returns owned/wishlist/ignored app ids; requires being logged in to Steam.
      return SE.bg({ type: 'fetchJson', url: 'https://store.steampowered.com/dynamicstore/userdata/', cacheKey: 'dynstore', ttl: 5 });
    },

    async protonDB(appid) {
      return SE.bg({
        type: 'fetchJson',
        url: `https://www.protondb.com/api/v1/reports/summaries/${encodeURIComponent(appid)}.json`,
        cacheKey: `proton:${appid}`,
        ttl: 60 * 12
      });
    },

    async hltb(query) {
      // HLTB search endpoint is anti-bot; fall back to a link if request fails.
      return SE.bg({
        type: 'fetchJson',
        url: `https://howlongtobeat.com/api/search`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Referer': 'https://howlongtobeat.com/', 'Origin': 'https://howlongtobeat.com' },
        body: JSON.stringify({ searchType: 'games', searchTerms: [query], searchPage: 1, size: 5 }),
        cacheKey: `hltb:${query}`,
        ttl: 60 * 24
      });
    }
  };

})(window);
