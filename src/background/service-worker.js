// MV3 service worker. Handles network proxying (with cache), wishlist deal polling, context menus.

const CACHE_KEY = 'se_bg_cache_v1';
const SETTINGS_KEY = 'se_settings_v1';

async function getCache() {
  return new Promise((res) => chrome.storage.local.get([CACHE_KEY], (d) => res(d[CACHE_KEY] || {})));
}
async function setCache(c) {
  return new Promise((res) => chrome.storage.local.set({ [CACHE_KEY]: c }, res));
}
async function cacheGet(key) {
  const c = await getCache();
  const e = c[key];
  if (!e) return null;
  if (e.expires && e.expires < Date.now()) return null;
  return e.value;
}
async function cachePut(key, value, ttlMin) {
  const c = await getCache();
  c[key] = { value, expires: Date.now() + (ttlMin || 60) * 60_000 };
  const keys = Object.keys(c);
  if (keys.length > 2500) {
    keys.sort((a, b) => (c[a].expires || 0) - (c[b].expires || 0));
    for (let i = 0; i < 500; i++) delete c[keys[i]];
  }
  await setCache(c);
}

async function getSettings() {
  return new Promise((res) => chrome.storage.sync.get([SETTINGS_KEY], (d) => res(d[SETTINGS_KEY] || {})));
}

async function doFetchJson({ url, method = 'GET', headers, body, cacheKey, ttl }) {
  if (cacheKey) {
    const cached = await cacheGet(cacheKey);
    if (cached !== null) return { ok: true, data: cached, cached: true };
  }
  try {
    const resp = await fetch(url, {
      method, headers, body,
      credentials: url.includes('steampowered.com') || url.includes('steamcommunity.com') ? 'include' : 'omit'
    });
    const ct = resp.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await resp.json() : await resp.text();
    if (resp.ok && cacheKey) await cachePut(cacheKey, data, ttl);
    return { ok: resp.ok, status: resp.status, data };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === 'fetchJson') {
        sendResponse(await doFetchJson(msg));
      } else if (msg?.type === 'clearCache') {
        await setCache({});
        sendResponse({ ok: true });
      } else if (msg?.type === 'getSettings') {
        sendResponse(await getSettings());
      } else if (msg?.type === 'openOptions') {
        chrome.runtime.openOptionsPage();
        sendResponse({ ok: true });
      } else if (msg?.type === 'notify') {
        chrome.notifications.create('', {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon128.png'),
          title: msg.title || 'Steam Enhancer',
          message: msg.message || '',
          priority: 1
        });
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, error: 'unknown message' });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true; // async
});

chrome.runtime.onInstalled.addListener(async (details) => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'se-search-itad',
      title: 'Find lowest price on IsThereAnyDeal',
      contexts: ['selection', 'link']
    });
    chrome.contextMenus.create({
      id: 'se-search-steamdb',
      title: 'Search on SteamDB',
      contexts: ['selection', 'link']
    });
    chrome.contextMenus.create({
      id: 'se-search-protondb',
      title: 'Check ProtonDB rating',
      contexts: ['selection', 'link']
    });
  });
  chrome.alarms.create('se-wishlist-poll', { periodInMinutes: 60 });

  // Show changelog when version changes (incl. fresh install).
  if (details.reason === 'install' || details.reason === 'update') {
    const v = chrome.runtime.getManifest().version;
    chrome.storage.local.set({ se_last_seen_version: v, se_show_changelog: true });
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  if (command === 'toggle-panel') {
    chrome.tabs.sendMessage(tab.id, { type: 'togglePanel' });
  } else if (command === 'open-wishlist') {
    chrome.tabs.create({ url: 'https://store.steampowered.com/wishlist/' });
  } else if (command === 'open-itad') {
    const url = tab.url || '';
    const m = url.match(/\/app\/(\d+)/);
    if (m) chrome.tabs.create({ url: `https://isthereanydeal.com/search/?q=${m[1]}` });
    else chrome.tabs.create({ url: 'https://isthereanydeal.com/' });
  }
});

chrome.contextMenus.onClicked.addListener((info) => {
  const q = encodeURIComponent((info.selectionText || info.linkUrl || '').slice(0, 200));
  if (!q) return;
  let url = '';
  if (info.menuItemId === 'se-search-itad') url = `https://isthereanydeal.com/search/?q=${q}`;
  else if (info.menuItemId === 'se-search-steamdb') url = `https://steamdb.info/search/?a=app&q=${q}`;
  else if (info.menuItemId === 'se-search-protondb') url = `https://www.protondb.com/search?q=${q}`;
  if (url) chrome.tabs.create({ url });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'se-wishlist-poll') return;
  const settings = await getSettings();
  if (!settings.notifyWishlistDeals) return;
  // Best-effort: fetch the user's wishlist via Steam's public endpoint requires steamId,
  // which we don't have here without scraping. We rely on the dynamic store ids
  // captured by the content script and stored in se_collections, plus per-app cached prices.
  try {
    const coll = await new Promise((r) => chrome.storage.local.get(['se_collections'], (d) => r(d.se_collections || null)));
    if (!coll?.wishlist?.length) return;
    const country = settings.country || 'us';
    const threshold = Number(settings.wishlistDealThreshold || 25);
    const sample = coll.wishlist.slice(0, 50); // rate-limit-friendly
    let found = 0;
    for (const appid of sample) {
      const lookup = await doFetchJson({
        url: `https://api.isthereanydeal.com/games/lookup/v1?appid=${appid}`,
        cacheKey: `itadlookup:${appid}`, ttl: 60 * 24
      });
      const id = lookup?.data?.data?.game?.id;
      if (!id) continue;
      const prices = await doFetchJson({
        url: `https://api.isthereanydeal.com/games/prices/v3?country=${country}&capacity=4&nondeals=false`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([id]),
        cacheKey: `itadprices:${id}:${country}`, ttl: 60
      });
      const deal = prices?.data?.data?.[0]?.deals?.[0];
      if (deal && deal.cut >= threshold) {
        found++;
        if (found <= 3) {
          chrome.notifications.create('', {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon128.png'),
            title: `Wishlist deal: -${deal.cut}%`,
            message: `${deal.shop?.name || 'Store'}: ${deal.price?.amount} ${deal.price?.currency || ''}`,
            priority: 1
          });
        }
      }
    }
  } catch (e) {
    console.warn('[SE] wishlist poll failed', e);
  }
});
