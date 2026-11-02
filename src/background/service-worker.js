// MV3 service worker. Handles network proxying (with cache), wishlist deal polling, context menus.

import '../lib/itad.js';
import '../lib/alerts.js';

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

// Per-endpoint pacing. Requests matching a rule run one at a time, at least
// `gapMs` apart, across every tab. The market endpoints are the strict ones —
// Steam answers 429 after a couple dozen quick priceoverview calls and then
// blocks them for a while — so a 429 pauses that lane for a minute instead of
// letting every queued request fail too.
const RATE_RULES = [
  { lane: 'scm-market', gapMs: 2500, match: /^https:\/\/steamcommunity\.com\/market\/(priceoverview|pricehistory|itemordershistogram)/ },
  { lane: 'store-appdetails', gapMs: 1500, match: /^https:\/\/store\.steampowered\.com\/api\/appdetails/ },
  { lane: 'itad', gapMs: 200, match: /^https:\/\/api\.isthereanydeal\.com\// }
];
const RATE_LIMIT_PAUSE_MS = 60_000;
const lanes = new Map();

function paced(url, run) {
  const rule = RATE_RULES.find((r) => r.match.test(url));
  if (!rule) return run();
  let lane = lanes.get(rule.lane);
  if (!lane) lanes.set(rule.lane, (lane = { next: 0, tail: Promise.resolve() }));
  const result = lane.tail.then(async () => {
    const wait = lane.next - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    const resp = await run();
    lane.next = Date.now() + (resp.status === 429 ? RATE_LIMIT_PAUSE_MS : rule.gapMs);
    return resp;
  });
  lane.tail = result.catch(() => {});
  return result;
}

// The user's Steam cookies go only to Steam's own hosts, decided by the
// parsed hostname over https — not a substring of the URL, which another
// host could carry in its path or query.
const STEAM_COOKIE_HOSTS = ['steampowered.com', 'steamcommunity.com'];
function sendsSteamCookies(url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  return u.protocol === 'https:' &&
    STEAM_COOKIE_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
}

// Identical cacheable requests already on their way share one fetch (e.g. two
// tabs, or a list page that shows the same game twice).
const inflight = new Map();

function doFetchJson(req) {
  if (!req.cacheKey) return fetchJsonUncached(req);
  if (inflight.has(req.cacheKey)) return inflight.get(req.cacheKey);
  const p = fetchJsonUncached(req).finally(() => inflight.delete(req.cacheKey));
  inflight.set(req.cacheKey, p);
  return p;
}

async function fetchJsonUncached({ url, method = 'GET', headers, body, cacheKey, ttl }) {
  if (cacheKey) {
    const cached = await cacheGet(cacheKey);
    if (cached !== null) return { ok: true, data: cached, cached: true };
  }
  if (url.startsWith('https://api.isthereanydeal.com/')) {
    const keyedUrl = await withItadKey(url);
    if (!keyedUrl) return { ok: false, needsItadKey: true, error: 'No IsThereAnyDeal API key configured (Options → Region)' };
    url = keyedUrl;
  }
  return paced(url, async () => {
    try {
      const resp = await fetch(url, {
        method, headers, body,
        credentials: sendsSteamCookies(url) ? 'include' : 'omit'
      });
      const ct = resp.headers.get('content-type') || '';
      const data = ct.includes('application/json') ? await resp.json() : await resp.text();
      if (resp.ok && cacheKey) await cachePut(cacheKey, data, ttl);
      return { ok: resp.ok, status: resp.status, data, rateLimited: resp.status === 429 };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });
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
      } else if (msg?.type === 'alertsMarkRead') {
        // Queued behind any history write in progress.
        historyWrite = historyWrite.then(async () => {
          const list = SE.alerts.markAllRead((await localGet([SE.alerts.KEY]))[SE.alerts.KEY]);
          await chrome.storage.local.set({ [SE.alerts.KEY]: list });
          updateBadge(list);
        });
        await historyWrite;
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

// Every alert goes into the history the popup shows (and the unread badge on
// the toolbar icon); a system notification pops up too unless it's quiet
// hours (Options). Ids of the form "se-app-<appid>-<n>" open that store page
// on click. History writes are queued so alerts from one run don't overwrite
// each other.
// Same {0}-placeholder convention as SE.t in content scripts (src/lib/i18n.js).
const t = (key, ...subs) => (chrome.i18n.getMessage(key) || key)
  .replace(/\{(\d)\}/g, (m, i) => (subs[i] != null ? String(subs[i]) : m));
const money = (amount, currency) => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount).replace(/[\u200e\u200f\u061c]/g, '');
  } catch { return `${amount} ${currency || ''}`.trim(); }
};

// "Hades II · Steam: $14.99" — the notification (and the popup's history)
// has to say which game it's about.
const withGameName = (name, text) => (name ? `${name} · ${text}` : text);

let historyWrite = Promise.resolve();
function notify(id, title, message) {
  const appid = id.match(/^se-app-(\d+)-/)?.[1] || null;
  historyWrite = historyWrite.then(async () => {
    const settings = await getSettings();
    const list = (await localGet([SE.alerts.KEY]))[SE.alerts.KEY];
    const next = SE.alerts.add(list, { appid, title, message });
    await chrome.storage.local.set({ [SE.alerts.KEY]: next });
    updateBadge(next);
    if (SE.alerts.inQuietHours(new Date(), settings.quietHoursStart, settings.quietHoursEnd)) return;
    chrome.notifications.create(id, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title, message, priority: 1
    });
  }).catch((e) => console.warn('[SE] notify failed', e));
  return historyWrite;
}
function updateBadge(list) {
  const n = SE.alerts.unreadCount(list);
  chrome.action.setBadgeBackgroundColor({ color: '#5c7e10' });
  chrome.action.setBadgeText({ text: n ? String(Math.min(n, 99)) : '' });
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
    const game = r?.ok ? SE.itad.gameFromLookup(r.data) : null;
    return { appid, id: game?.id || null, title: game?.title || null };
  }));
  if (lookups.some((l) => l.needsKey)) return null;
  const resolved = lookups.filter((l) => l.id);
  const out = new Map();
  // ITAD's prices endpoint takes at most 200 ids per call.
  for (let i = 0; i < resolved.length; i += 200) {
    const chunk = resolved.slice(i, i + 200);
    const prices = await doFetchJson({
      url: `https://api.isthereanydeal.com/games/prices/v3?country=${encodeURIComponent(country)}&capacity=4&nondeals=${nondeals}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk.map((l) => l.id))
    });
    for (const { appid, id, title } of chunk) {
      const deal = SE.itad.bestDeal(prices?.data, id);
      out.set(appid, deal && { ...deal, title });
    }
  }
  return out;
}

// Upper bound on how many apps one alarm run checks. ITAD lookups are cached
// for a day and the prices call is batched (200 per request), so after the
// first run this is ~1 lookup-free request per 200 games.
const MAX_POLLED_APPS = 500;

// The whole wishlist (up to MAX_POLLED_APPS), from the dynamic-store ids the
// content script captured into se_collections. Each deal is announced once:
// again only if it gets deeper, and forgotten once it ends, so the hourly
// alarm doesn't repeat the same sale every hour (as 1.4.x did).
async function handleWishlistPoll() {
  const settings = await getSettings();
  if (!settings.notifyWishlistDeals) return;
  try {
    const coll = (await localGet(['se_collections'])).se_collections;
    if (!coll?.wishlist?.length) return;
    const country = await getCountry(settings);
    const threshold = Number(settings.wishlistDealThreshold || 25);
    const deals = await bestDealsFor(coll.wishlist.slice(0, MAX_POLLED_APPS).map(String), country, { nondeals: false });
    if (!deals) return;

    const SEEN_KEY = 'se_wishlist_deal_notified';
    const seen = (await localGet([SEEN_KEY]))[SEEN_KEY] || {};
    const fresh = [];
    for (const [appid, deal] of deals) {
      if (!deal || !(deal.cut >= threshold)) { delete seen[appid]; continue; }
      if (deal.cut > (seen[appid] || 0)) fresh.push([appid, deal]);
    }
    // Deepest cuts first; at most 3 notifications per run, the rest wait for the next one.
    fresh.sort((a, b) => b[1].cut - a[1].cut);
    for (const [appid, deal] of fresh.slice(0, 3)) {
      notify(appNotificationId(appid), t('notifWishlistDeal', deal.cut),
        withGameName(deal.title, `${deal.shop || 'Steam'}: ${money(deal.price, deal.currency)}`));
      seen[appid] = deal.cut;
    }
    chrome.storage.local.set({ [SEEN_KEY]: seen });
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
        notify(appNotificationId(item.id), t('notifFreePromo'), item.name);
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
    const appids = Object.keys(targets).filter((a) => Number(targets[a]) > 0).slice(0, MAX_POLLED_APPS);
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
          notify(appNotificationId(appid), t('notifPriceAlert'),
            withGameName(deal.title, t('notifPriceAlertMsg', money(deal.price, deal.currency), deal.shop || 'Steam', target)));
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
