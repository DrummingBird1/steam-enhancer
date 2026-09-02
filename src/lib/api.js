(function (global) {
  'use strict';
  const SE = global.SteamEnhancer || (global.SteamEnhancer = {});

  // All network calls go through the background service worker so we can centralize caching/CORS.

  SE.api = {
    // IsThereAnyDeal v2 endpoints — as of v1.4.0 these all require a free,
    // per-application API key (Options → Region). The background service
    // worker attaches it automatically (see withItadKey in service-worker.js);
    // callers just get back { needsItadKey: true } if none is configured.
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

    // Batch variants for list pages: same endpoints, but take an array of ITAD
    // ids and cover them all in one request. Not individually cached (the
    // composition varies per page) — the per-id itadLookup cache upstream is
    // what keeps repeat visits cheap.
    async itadPricesBatch(ids, country = 'us') {
      if (!ids?.length) return { ok: true, data: [] };
      return SE.bg({
        type: 'fetchJson',
        url: `https://api.isthereanydeal.com/games/prices/v3?country=${encodeURIComponent(country)}&capacity=8&nondeals=true&vouchers=true`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids)
      });
    },
    async itadHistoryLowBatch(ids, country = 'us') {
      if (!ids?.length) return { ok: true, data: [] };
      return SE.bg({
        type: 'fetchJson',
        url: `https://api.isthereanydeal.com/games/storelow/v2?country=${encodeURIComponent(country)}&shops=61`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids)
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

    // Order-book depth for a single listing (Valve's own market page calls this
    // via Market_LoadOrderSpread(item_nameid)). Short TTL: the book moves fast.
    async itemOrdersHistogram(itemNameId, country = 'US', currency = 1) {
      const url = `https://steamcommunity.com/market/itemordershistogram?country=${encodeURIComponent(country)}&language=english&currency=${encodeURIComponent(currency)}&item_nameid=${encodeURIComponent(itemNameId)}&two_factor=0`;
      return SE.bg({ type: 'fetchJson', url, cacheKey: `histogram:${itemNameId}:${currency}`, ttl: 2 });
    },

    // Full price-history graph for a market item. Verified live: returns 400
    // with an empty body for anonymous requests — this endpoint only returns
    // real data with a logged-in Steam session (your normal browser cookies,
    // sent automatically since this goes through the background SW). Not an
    // ITAD/key issue — just needs you to be signed in to Steam.
    async marketPriceHistory(appid, market_hash_name) {
      const url = `https://steamcommunity.com/market/pricehistory/?appid=${encodeURIComponent(appid)}&market_hash_name=${encodeURIComponent(market_hash_name)}`;
      return SE.bg({ type: 'fetchJson', url, cacheKey: `pricehist:${appid}:${market_hash_name}`, ttl: 120 });
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

    // Steam's own "specials" feed — includes 100%-off (free-for-a-limited-time)
    // promos alongside regular discounts. Verified live: returns
    // { specials: { items: [{ id, name, discount_percent, ... }] } }.
    async featuredSpecials(country = 'us') {
      return SE.bg({
        type: 'fetchJson',
        url: `https://store.steampowered.com/api/featuredcategories?cc=${encodeURIComponent(country)}&l=english`,
        cacheKey: `featured:${country}`, ttl: 60
      });
    },

    // Monthly/daily recommendation-count rollups Steam uses for its own review
    // graph. Verified live: { results: { rollups: [...], recent: [...] } },
    // each point has { date, recommendations_up, recommendations_down }.
    async reviewHistogram(appid) {
      return SE.bg({
        type: 'fetchJson',
        url: `https://store.steampowered.com/appreviewhistogram/${encodeURIComponent(appid)}?l=english&review_score_preference=0`,
        cacheKey: `reviewhist:${appid}`, ttl: 60 * 6
      });
    },

    // Steam Web API — requires the user's own key (Options → "Your Steam Web
    // API key"). Never called unless a key is present.
    async friendsList(steamid64, key) {
      return SE.bg({
        type: 'fetchJson',
        url: `https://api.steampowered.com/ISteamUser/GetFriendList/v1/?key=${encodeURIComponent(key)}&steamid=${encodeURIComponent(steamid64)}&relationship=friend`,
        cacheKey: `friends:${steamid64}`, ttl: 60 * 12
      });
    },
    async resolveVanityUrl(vanity, key) {
      return SE.bg({
        type: 'fetchJson',
        url: `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${encodeURIComponent(key)}&vanityurl=${encodeURIComponent(vanity)}`,
        cacheKey: `vanity:${vanity}`, ttl: 60 * 24 * 7
      });
    },
    async ownedGames(steamid64, key) {
      return SE.bg({
        type: 'fetchJson',
        url: `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${encodeURIComponent(key)}&steamid=${encodeURIComponent(steamid64)}&include_appids=true&include_played_free_games=true`,
        cacheKey: `ownedgames:${steamid64}`, ttl: 60 * 6
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
