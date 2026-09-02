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

// IsThereAnyDeal's v2 API requires an API key on every endpoint this codebase
// uses (verified live — /games/lookup/v1, /games/prices/v3, /games/storelow/v2,
// /games/overview/v2 all return 403 "Missing api key" with none). The key is
// registered per-*application* (isthereanydeal.com/apps/my/, free), not a
// personal credential — but we still route it through a user-supplied Options
// field rather than baking one in, per this project's "no baked-in keys"
// convention, since we can't register an app on the user's behalf. Centralized
// here so every call site (content scripts via api.js, and this file's own
// alarm handlers) gets it automatically without passing it around.
async function withItadKey(url) {
  if (!url.startsWith('https://api.isthereanydeal.com/')) return url;
  const settings = await getSettings();
  const key = settings.itadApiKey;
  if (!key) return null; // signals "no key configured" to the caller
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}key=${encodeURIComponent(key)}`;
}

async function doFetchJson({ url, method = 'GET', headers, body, cacheKey, ttl }) {
  if (cacheKey) {
    const cached = await cacheGet(cacheKey);
    if (cached !== null) return { ok: true, data: cached, cached: true };
  }
  if (url.startsWith('https://api.isthereanydeal.com/')) {
    const keyedUrl = await withItadKey(url);
    if (!keyedUrl) return { ok: false, needsItadKey: true, error: 'No IsThereAnyDeal API key configured (Options → Region)' };
    url = keyedUrl;
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
  chrome.alarms.create('se-freepromo-poll', { periodInMinutes: 120 });
  chrome.alarms.create('se-pricealert-poll', { periodInMinutes: 60 });

  const v = chrome.runtime.getManifest().version;
  if (details.reason === 'install') {
    // First-ever install: show the onboarding tour, not a changelog (there's
    // nothing to "change" yet from the user's perspective).
    chrome.storage.local.set({ se_last_seen_version: v, se_show_onboarding: true });
  } else if (details.reason === 'update') {
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
  if (alarm.name === 'se-freepromo-poll') return handleFreePromoPoll();
  if (alarm.name === 'se-pricealert-poll') return handlePriceAlertPoll();
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

// Free-for-a-limited-time promo tracker. Uses Steam's own featuredcategories
// feed (the same one the store front page itself reads) and looks for fully
// free (100%-off) items in the specials list. We remember which promo ids
// we've already notified about so re-running the alarm doesn't repeat itself.
async function handleFreePromoPoll() {
  const settings = await getSettings();
  if (!settings.notifyFreePromos) return;
  try {
    const country = settings.country || 'us';
    const r = await doFetchJson({
      url: `https://store.steampowered.com/api/featuredcategories?cc=${country}&l=english`,
      cacheKey: `featured:${country}`, ttl: 60
    });
    const items = r?.data?.specials?.items || [];
    const freebies = items.filter((i) => i.discount_percent === 100);
    if (!freebies.length) return;

    const SEEN_KEY = 'se_seen_free_promos';
    const seen = new Set((await new Promise((res) => chrome.storage.local.get([SEEN_KEY], (d) => res(d[SEEN_KEY] || [])))));
    let notified = 0;
    for (const item of freebies) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      if (notified < 3) {
        chrome.notifications.create('', {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon128.png'),
          title: 'Free for a limited time!',
          message: item.name,
          priority: 1
        });
        notified++;
      }
    }
    chrome.storage.local.set({ [SEEN_KEY]: [...seen].slice(-300) });
  } catch (e) {
    console.warn('[SE] free-promo poll failed', e);
  }
}

// Store-page price alerts. Reuses the same se_wishlist_targets map that
// wishlist.js's per-row "alert me at" inputs write to — app.js also writes
// into it now, so a target set from either the wishlist or a store page works
// the same way. We track a per-appid "already notified" flag so we only
// notify once per dip below target, resetting it once the price rises again.
async function handlePriceAlertPoll() {
  const settings = await getSettings();
  if (!settings.notifyStorePriceAlerts) return;
  try {
    const targets = await new Promise((res) => chrome.storage.local.get(['se_wishlist_targets'], (d) => res(d.se_wishlist_targets || {})));
    const appids = Object.keys(targets).slice(0, 50);
    if (!appids.length) return;

    const country = settings.country || 'us';
    const NOTIFIED_KEY = 'se_price_alert_notified';
    const notifiedState = await new Promise((res) => chrome.storage.local.get([NOTIFIED_KEY], (d) => res(d[NOTIFIED_KEY] || {})));
    let sent = 0;

    for (const appid of appids) {
      const target = Number(targets[appid]);
      if (!isFinite(target) || target <= 0) continue;

      const lookup = await doFetchJson({
        url: `https://api.isthereanydeal.com/games/lookup/v1?appid=${appid}`,
        cacheKey: `itadlookup:${appid}`, ttl: 60 * 24
      });
      const id = lookup?.data?.data?.game?.id;
      if (!id) continue;

      const prices = await doFetchJson({
        url: `https://api.isthereanydeal.com/games/prices/v3?country=${country}&capacity=4&nondeals=true`,
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([id]), cacheKey: `itadprices:${id}:${country}`, ttl: 60
      });
      const deal = prices?.data?.data?.[0]?.deals?.[0];
      const cur = deal?.price?.amount;
      if (cur == null) continue;

      if (cur <= target) {
        if (!notifiedState[appid] && sent < 3) {
          chrome.notifications.create('', {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon128.png'),
            title: 'Price alert hit',
            message: `${deal.price.amount} ${deal.price.currency || ''} @ ${deal.shop?.name || 'store'} (your target: ${target})`,
            priority: 1
          });
          sent++;
        }
        notifiedState[appid] = true;
      } else {
        notifiedState[appid] = false;
      }
    }
    chrome.storage.local.set({ [NOTIFIED_KEY]: notifiedState });
  } catch (e) {
    console.warn('[SE] price-alert poll failed', e);
  }
}
