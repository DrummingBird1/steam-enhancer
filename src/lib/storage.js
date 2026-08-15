(function (global) {
  'use strict';
  const SE = global.SteamEnhancer || (global.SteamEnhancer = {});

  const DEFAULTS = {
    currency: 'USD',
    country: 'us',
    locale: undefined,
    // When set, price panels additionally show the amount converted into this
    // currency (via SE.fx), independent of the Steam storefront's own currency.
    displayCurrency: '',
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
    customCss: ''
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
      return new Promise((res) => chrome.storage.sync.set({ [STORAGE_KEY]: next }, () => res(next)));
    },
    async reset() {
      return new Promise((res) => chrome.storage.sync.set({ [STORAGE_KEY]: DEFAULTS }, () => res(DEFAULTS)));
    },
    DEFAULTS
  };

  // Cache (local, not synced) — used for price/info lookups.
  const CACHE_KEY = 'se_cache_v1';
  SE.cache = {
    async get(key) {
      return new Promise((res) => chrome.storage.local.get([CACHE_KEY], (data) => {
        const cache = data[CACHE_KEY] || {};
        const entry = cache[key];
        if (!entry) return res(null);
        if (entry.expires && entry.expires < Date.now()) return res(null);
        res(entry.value);
      }));
    },
    async set(key, value, ttlMin = 60) {
      return new Promise((res) => chrome.storage.local.get([CACHE_KEY], (data) => {
        const cache = data[CACHE_KEY] || {};
        cache[key] = { value, expires: Date.now() + ttlMin * 60_000 };
        // Prune if too big.
        const keys = Object.keys(cache);
        if (keys.length > 2000) {
          keys.sort((a, b) => (cache[a].expires || 0) - (cache[b].expires || 0));
          for (let i = 0; i < 500; i++) delete cache[keys[i]];
        }
        chrome.storage.local.set({ [CACHE_KEY]: cache }, () => res(value));
      }));
    },
    async clear() {
      return new Promise((res) => chrome.storage.local.remove([CACHE_KEY], res));
    }
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
