(function (global) {
  'use strict';
  const SE = global.SteamEnhancer || (global.SteamEnhancer = {});

  const DEFAULTS = {
    // Storefront country for price lookups. Empty = use the country Steam
    // itself reports (see SE.effectiveCountry); set to override.
    countryOverride: '',
    // When set, price panels additionally show the amount converted into this
    // currency (via SE.fx), independent of the Steam storefront's own currency.
    displayCurrency: '',
    // Required for all price/ITAD features as of v1.4.0 — IsThereAnyDeal's v2
    // API now requires a key on every endpoint this extension calls. Free,
    // registered per-application (not a personal credential) at
    // isthereanydeal.com/apps/my/ — we still route it through this field
    // rather than baking one in, since we can't register on your behalf.
    itadApiKey: '',
    showLowestPrice: true,
    showPriceHistory: true,
    showSteamDBLink: true,
    showProtonDB: true,
    showDeckBadge: true,
    showHowLongToBeat: true,
    highlightOwned: true,
    highlightWishlist: true,
    highlightIgnored: true,
    hideOwnedInSearch: false,
    hideIgnoredInSearch: true,
    showReviewBreakdown: true,
    enableMarketTools: true,
    enableInventoryTools: true,
    enableTradeOfferTools: true,
    enableWishlistExport: true,
    enableQuickSell: true,
    showCardSetValue: true,
    showAchievementStats: true,
    showDlcCheck: true,
    showPlayersOnline: true,
    showRegionalPricing: false,
    notifyWishlistDeals: false,
    wishlistDealThreshold: 25,

    // v1.3.0 additions — granular per-feature toggles for things that used to be
    // always-on whenever their parent area (enableMarketTools etc.) was enabled.
    showBundleSavings: true,
    showLiveReviewFilters: true,
    showBestReview: true,
    showReviewBombDetector: true,
    showBuyOrderHelper: true,
    showTradeHistory: true,
    showTileSortGroup: true,
    showStorePriceAlerts: true,
    showFriendsOwnership: false,     // opt-in: needs steamWebApiKey
    showLibraryValue: true,
    showBadgeTracker: true,
    showMediaShortcuts: true,
    notifyFreePromos: false,
    notifyStorePriceAlerts: false,
    // Your own Steam Web API key (https://steamcommunity.com/dev/apikey), used
    // only for the opt-in "owned by friends" lookup. Never baked into the
    // extension, never sent anywhere but api.steampowered.com from your browser.
    steamWebApiKey: '',
    // v1.5.0: alerts during these hours ("HH:MM", may wrap past midnight) go
    // only to the popup's history, without a system notification.
    quietHoursStart: '',
    quietHoursEnd: '',
    // v1.6.0: also alert when a wishlisted game's price is within this many
    // percent of its Steam historical low (0 = off).
    alertNearLowPct: 0,
    // v1.6.0: the regions to compare in "Regional prices" ("us, de, pl"…);
    // empty = the built-in set of twelve.
    regionalCountries: '',
    // Applied to every Steam page (common.js). Kept in chrome.storage.local,
    // not sync — see LOCAL_KEYS.
    customCss: ''
  };

  const STORAGE_KEY = 'se_settings_v1';

  // Settings too big for chrome.storage.sync's 8KB-per-item quota live in
  // local storage instead (not synced between browsers). Everything else
  // is one synced object under STORAGE_KEY.
  const LOCAL_KEY = 'se_settings_local_v1';
  const LOCAL_KEYS = ['customCss'];
  const split = (obj) => {
    const synced = { ...obj }, local = {};
    for (const k of LOCAL_KEYS) if (k in synced) { local[k] = synced[k]; delete synced[k]; }
    return { synced, local };
  };
  const syncGet = () => new Promise((res) => chrome.storage.sync.get([STORAGE_KEY], (d) => res(d[STORAGE_KEY] || {})));
  const localGet = () => new Promise((res) => chrome.storage.local.get([LOCAL_KEY], (d) => res(d[LOCAL_KEY] || {})));
  const write = (synced, local) => new Promise((res, rej) => chrome.storage.sync.set({ [STORAGE_KEY]: synced }, () => {
    // Surface quota errors instead of failing silently.
    if (chrome.runtime.lastError) { rej(new Error(chrome.runtime.lastError.message)); return; }
    chrome.storage.local.set({ [LOCAL_KEY]: local }, () => res());
  }));

  SE.storage = {
    async getAll() {
      // 1.4.x kept customCss in sync; a value still there counts until the next save moves it.
      const [synced, local] = await Promise.all([syncGet(), localGet()]);
      return { ...DEFAULTS, ...synced, ...local };
    },
    async get(key) {
      const all = await SE.storage.getAll();
      return key ? all[key] : all;
    },
    async set(patch) {
      const next = { ...(await SE.storage.getAll()), ...patch };
      const { synced, local } = split(next);
      await write(synced, local);
      return next;
    },
    async reset() {
      const { synced, local } = split(DEFAULTS);
      await write(synced, local);
      return { ...DEFAULTS };
    },
    DEFAULTS,
    LOCAL_KEYS
  };

  // User collections (owned/wishlist/ignored caches built from the dynamic store).
  SE.collections = {
    async set(data) {
      return new Promise((res) => chrome.storage.local.set({ se_collections: { ...data, _ts: Date.now() } }, res));
    },
    async get() {
      return new Promise((res) => chrome.storage.local.get(['se_collections'], (d) => res(d.se_collections || null)));
    }
  };

})(window);
