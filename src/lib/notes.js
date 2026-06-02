// Per-app user notes + extension-local blocklist. Loaded into every content script.
(function (global) {
  'use strict';
  const SE = global.SteamEnhancer || (global.SteamEnhancer = {});

  const NOTES_KEY = 'se_notes_v1';
  const BLOCK_KEY = 'se_blocklist_v1';
  const PRICEHIST_KEY = 'se_price_history_v1';

  SE.notes = {
    async get(appid) {
      return new Promise((r) => chrome.storage.local.get([NOTES_KEY], (d) => {
        r((d[NOTES_KEY] || {})[appid] || '');
      }));
    },
    async set(appid, text) {
      return new Promise((r) => chrome.storage.local.get([NOTES_KEY], (d) => {
        const all = d[NOTES_KEY] || {};
        if (text) all[appid] = text; else delete all[appid];
        chrome.storage.local.set({ [NOTES_KEY]: all }, () => r(all));
      }));
    },
    async all() {
      return new Promise((r) => chrome.storage.local.get([NOTES_KEY], (d) => r(d[NOTES_KEY] || {})));
    }
  };

  SE.blocklist = {
    async get() {
      return new Promise((r) => chrome.storage.local.get([BLOCK_KEY], (d) => {
        r(new Set(d[BLOCK_KEY] || []));
      }));
    },
    async add(appid) {
      const cur = await SE.blocklist.get();
      cur.add(String(appid));
      return new Promise((r) => chrome.storage.local.set({ [BLOCK_KEY]: [...cur] }, () => r(cur)));
    },
    async remove(appid) {
      const cur = await SE.blocklist.get();
      cur.delete(String(appid));
      return new Promise((r) => chrome.storage.local.set({ [BLOCK_KEY]: [...cur] }, () => r(cur)));
    },
    async clear() {
      return new Promise((r) => chrome.storage.local.set({ [BLOCK_KEY]: [] }, r));
    }
  };

  // Track last-seen price per app to detect price drops between visits.
  SE.priceHistory = {
    async record(appid, price) {
      if (!appid || price == null) return null;
      return new Promise((r) => chrome.storage.local.get([PRICEHIST_KEY], (d) => {
        const all = d[PRICEHIST_KEY] || {};
        const prev = all[appid];
        all[appid] = { price, ts: Date.now() };
        chrome.storage.local.set({ [PRICEHIST_KEY]: all }, () => r(prev));
      }));
    },
    async get(appid) {
      return new Promise((r) => chrome.storage.local.get([PRICEHIST_KEY], (d) => {
        r((d[PRICEHIST_KEY] || {})[appid] || null);
      }));
    }
  };

  // Currency conversion via exchangerate.host (no key required). Falls back to no-op.
  SE.fx = {
    async rates(base = 'USD') {
      const key = `fx:${base}`;
      const cached = await new Promise((r) => chrome.storage.local.get([key], (d) => r(d[key] || null)));
      if (cached && Date.now() - cached.ts < 24 * 3600_000) return cached.rates;
      const resp = await SE.bg({
        type: 'fetchJson',
        url: `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`,
        cacheKey: `fx:${base}:raw`, ttl: 60 * 12
      });
      const rates = resp?.data?.rates;
      if (!rates) return null;
      chrome.storage.local.set({ [key]: { ts: Date.now(), rates } });
      return rates;
    },
    async convert(amount, from, to) {
      if (!amount || !from || !to || from === to) return amount;
      const rates = await SE.fx.rates(from);
      const r = rates?.[to];
      return r ? amount * r : null;
    }
  };

})(window);
