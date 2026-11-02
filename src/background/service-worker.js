// MV3 service worker. Handles network proxying (with cache), wishlist deal polling, context menus.

import '../lib/itad.js';

const SE = globalThis.SteamEnhancer;
const SETTINGS_KEY = 'se_settings_v1';
const DETECTED_COUNTRY_KEY = 'se_detected_country';

// Cache: one chrome.storage.local key per entry ("c:<cacheKey>"). Until 1.4.x
// the whole cache was a single object under se_bg_cache_v1, read-modified-
// written on every fetch — so parallel requests (a batched search page fires
// dozens) overwrote each other's entries and most results were never cached.
const CACHE_PREFIX = 'c:';
const LEGACY_CACHE_KEY = 'se_bg_cache_v1';
const CACHE_MAX_ENTRIES = 3000;

const localGet = (keys) => new Promise((res) => chrome.storage.local.get(keys, res));

async function cacheGet(key) {
  const k = CACHE_PREFIX + key;
  const e = (await localGet([k]))[k];
  if (!e || (e.expires && e.expires < Date.now())) return null;
  return e.value;
}
async function cachePut(key, value, ttlMin) {
  await chrome.storage.local.set({
    [CACHE_PREFIX + key]: { value, expires: Date.now() + (ttlMin || 60) * 60_000 }
  });
}
async function cacheClear() {
  const all = await localGet(null);
  const keys = Object.keys(all).filter((k) => k.startsWith(CACHE_PREFIX));
  await chrome.storage.local.remove([...keys, LEGACY_CACHE_KEY]);
}
// Run from an alarm, not on every write: drop expired entries, then the
// soonest-expiring ones if we're still over the cap.
async function cachePrune() {
  const all = await localGet(null);
  const now = Date.now();
  const entries = Object.entries(all).filter(([k]) => k.startsWith(CACHE_PREFIX));
  const expired = entries.filter(([, e]) => !e?.expires || e.expires < now).map(([k]) => k);
  let live = entries.filter(([k]) => !expired.includes(k));
  const overflow = [];
  if (live.length > CACHE_MAX_ENTRIES) {
    live.sort((a, b) => a[1].expires - b[1].expires);
    overflow.push(...live.slice(0, live.length - CACHE_MAX_ENTRIES).map(([k]) => k));
  }
  if (expired.length || overflow.length) await chrome.storage.local.remove([...expired, ...overflow]);
}

async function getSettings() {
  return new Promise((res) => chrome.storage.sync.get([SETTINGS_KEY], (d) => res(d[SETTINGS_KEY] || {})));
}
// Same rule as SE.effectiveCountry in currency.js: Options override, else the
// country Steam last reported to a content script, else 'us'.
async function getCountry(settings) {
  const detected = (await localGet([DETECTED_COUNTRY_KEY]))[DETECTED_COUNTRY_KEY];
  return String(settings.countryOverride || '').trim().toLowerCase() || detected || 'us';
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
        await cacheClear();
        sendResponse({ ok: true });
      } else if (msg?.type === 'getSettings') {
        sendResponse(await getSettings());
      } else if (msg?.type === 'openOptions') {
        chrome.runtime.openOptionsPage();
        sendResponse({ ok: true });
      } else if (msg?.type === 'notify') {
        notify('', msg.title || 'Steam Enhancer', msg.message || '');
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

// Notification ids of the form "se-app-<appid>-<n>" open that store page on click.
function notify(id, title, message) {
  chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title, message, priority: 1
  });
}
let notifySeq = 0;
const appNotificationId = (appid) => `se-app-${appid}-${Date.now()}-${notifySeq++}`;
chrome.notifications.onClicked.addListener((id) => {
  const m = id.match(/^se-app-(\d+)-/);
  if (m) chrome.tabs.create({ url: `https://store.steampowered.com/app/${m[1]}/` });
  chrome.notifications.clear(id);
});

// Alarms survive restarts in practice, but Chrome doesn't promise it — so
// (re)create them on every startup as well as on install. create() with an
// existing name just replaces it.
function ensureAlarms() {
  chrome.alarms.create('se-wishlist-poll', { periodInMinutes: 60 });
  chrome.alarms.create('se-freepromo-poll', { periodInMinutes: 120 });
  chrome.alarms.create('se-pricealert-poll', { periodInMinutes: 60 });
  chrome.alarms.create('se-cache-prune', { periodInMinutes: 60 * 6 });
}
chrome.runtime.onStartup.addListener(ensureAlarms);

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
  ensureAlarms();
  // The pre-1.5.0 single-object cache is dead weight now.
  chrome.storage.local.remove([LEGACY_CACHE_KEY, 'se_cache_v1']);

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
  if (alarm.name === 'se-wishlist-poll') return handleWishlistPoll();
  if (alarm.name === 'se-cache-prune') return cachePrune();
});

// appid → ITAD game id for each appid (each lookup cached 24h), then ONE
// prices call for all of them. Returns Map<appid, deal|null> or null when no
// ITAD key is configured.
async function bestDealsFor(appids, country, { nondeals }) {
  const lookups = await Promise.all(appids.map(async (appid) => {
    const r = await doFetchJson({
      url: `https://api.isthereanydeal.com/games/lookup/v1?appid=${encodeURIComponent(appid)}`,
      cacheKey: `itadlookup:${appid}`, ttl: 60 * 24
    });
    if (r?.needsItadKey) return { appid, needsKey: true };
    return { appid, id: r?.ok ? SE.itad.gameFromLookup(r.data)?.id : null };
  }));
  if (lookups.some((l) => l.needsKey)) return null;
  const resolved = lookups.filter((l) => l.id);
  const out = new Map();
  if (!resolved.length) return out;
  const prices = await doFetchJson({
    url: `https://api.isthereanydeal.com/games/prices/v3?country=${encodeURIComponent(country)}&capacity=4&nondeals=${nondeals}`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(resolved.map((l) => l.id))
  });
  for (const { appid, id } of resolved) out.set(appid, SE.itad.bestDeal(prices?.data, id));
  return out;
}

// Best-effort: the wishlist appids come from the dynamic-store ids the content
// script captured into se_collections. Sampled to the first 50 to stay polite to ITAD.
async function handleWishlistPoll() {
  const settings = await getSettings();
  if (!settings.notifyWishlistDeals) return;
  try {
    const coll = (await localGet(['se_collections'])).se_collections;
    if (!coll?.wishlist?.length) return;
    const country = await getCountry(settings);
    const threshold = Number(settings.wishlistDealThreshold || 25);
    const deals = await bestDealsFor(coll.wishlist.slice(0, 50).map(String), country, { nondeals: false });
    if (!deals) return;
    let found = 0;
    for (const [appid, deal] of deals) {
      if (!deal || !(deal.cut >= threshold)) continue;
      if (++found > 3) break;
      notify(appNotificationId(appid), `Wishlist deal: -${deal.cut}%`, `${deal.shop || 'Store'}: ${deal.price} ${deal.currency || ''}`);
    }
  } catch (e) {
    console.warn('[SE] wishlist poll failed', e);
  }
}

// Free-for-a-limited-time promo tracker. Uses Steam's own featuredcategories
// feed (the same one the store front page itself reads) and looks for fully
// free (100%-off) items in the specials list. We remember which promo ids
// we've already notified about so re-running the alarm doesn't repeat itself.
async function handleFreePromoPoll() {
  const settings = await getSettings();
  if (!settings.notifyFreePromos) return;
  try {
    const country = await getCountry(settings);
    const r = await doFetchJson({
      url: `https://store.steampowered.com/api/featuredcategories?cc=${country}&l=english`,
      cacheKey: `featured:${country}`, ttl: 60
    });
    const items = r?.data?.specials?.items || [];
    const freebies = items.filter((i) => i.discount_percent === 100);
    if (!freebies.length) return;

    const SEEN_KEY = 'se_seen_free_promos';
    const seen = new Set((await localGet([SEEN_KEY]))[SEEN_KEY] || []);
    let notified = 0;
    for (const item of freebies) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      if (notified < 3) {
        notify(appNotificationId(item.id), 'Free for a limited time!', item.name);
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
    const targets = (await localGet(['se_wishlist_targets'])).se_wishlist_targets || {};
    const appids = Object.keys(targets).filter((a) => Number(targets[a]) > 0).slice(0, 50);
    if (!appids.length) return;

    const country = await getCountry(settings);
    const deals = await bestDealsFor(appids, country, { nondeals: true });
    if (!deals) return;
    const NOTIFIED_KEY = 'se_price_alert_notified';
    const notifiedState = (await localGet([NOTIFIED_KEY]))[NOTIFIED_KEY] || {};
    let sent = 0;

    for (const [appid, deal] of deals) {
      if (deal?.price == null) continue;
      const target = Number(targets[appid]);
      if (deal.price <= target) {
        if (!notifiedState[appid]) {
          // Over this run's cap: leave it un-flagged so the next run reports it.
          if (sent >= 3) continue;
          notify(appNotificationId(appid), 'Price alert hit',
            `${deal.price} ${deal.currency || ''} @ ${deal.shop || 'store'} (your target: ${target})`);
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
