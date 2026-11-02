(function (global) {
  'use strict';
  const SE = global.SteamEnhancer || (global.SteamEnhancer = {});

  const DEFAULTS = {
    currency: 'USD',
    // Storefront country for price lookups. Empty = use the country Steam
    // itself reports (see SE.effectiveCountry); set to override.
    countryOverride: '',
    locale: undefined,
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
    showHowLongToBeat: true,
    highlightOwned: true,
    highlightWishlist: true,
    highlightIgnored: true,
    hideOwnedInSearch: false,
    hideIgnoredInSearch: true,
    showReviewBreakdown: true,
    autoExpandReviews: false,
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
    cacheTTLMinutes: 60,
    itadEnabled: true,
    customCss: '',

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
    onboardingSeen: false
  };

  const STORAGE_KEY = 'se_settings_v1';

  SE.storage = {
    async getAll() {
      return new Promise((res) => chrome.storage.sync.get([STORAGE_KEY], (data) => {
        res({ ...DEFAULTS, ...(data[STORAGE_KEY] || {}) });
      }));
    },
    async get(key) {
      const all = await SE.storage.getAll();
      return key ? all[key] : all;
    },
    async set(patch) {
      const cur = await SE.storage.getAll();
      const next = { ...cur, ...patch };
      // chrome.storage.sync has an 8KB-per-item quota (QUOTA_BYTES_PER_ITEM) and
      // we store all settings under one key, so a large customCss/steamWebApiKey
      // could in principle overflow it. Surface that instead of failing silently.
      return new Promise((res, rej) => chrome.storage.sync.set({ [STORAGE_KEY]: next }, () => {
        if (chrome.runtime.lastError) { rej(new Error(chrome.runtime.lastError.message)); return; }
        res(next);
      }));
    },
    async reset() {
      return new Promise((res) => chrome.storage.sync.set({ [STORAGE_KEY]: DEFAULTS }, () => res(DEFAULTS)));
    },
    DEFAULTS
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
