// Options page. Every setting is described once in SECTIONS below and the
// page is generated from it: side navigation, search, rows, presets. Changes
// save as you make them. Defaults and the read/merge/write logic live in
// src/lib/storage.js (loaded first by options.html).
const store = window.SteamEnhancer.storage;
const t = (key, ...subs) => (chrome.i18n.getMessage(key) || key)
  .replace(/\{(\d)\}/g, (m, i) => (subs[i] != null ? String(subs[i]) : m));

// Row types: toggle (checkbox), text, number, time, textarea, html (static
// content), actions (buttons). `label`/`hint` are i18n keys; a toggle's label
// defaults to `opt_<key>`.
const toggles = (...keys) => keys.map((key) => ({ type: 'toggle', key }));
const SECTIONS = [
  {
    id: 'prices', title: 'optSecPrices', items: [
      { type: 'text', key: 'itadApiKey', label: 'optItadKey', hint: 'optItadKeyHint', highlight: true, placeholder: 'optItadKeyPlaceholder', secret: true },
      { type: 'text', key: 'countryOverride', label: 'optCountry', hint: 'optCountryHint', maxlength: 2, placeholder: 'optAuto', lower: true },
      { type: 'text', key: 'displayCurrency', label: 'optDisplayCurrency', hint: 'optDisplayCurrencyHint', maxlength: 3, upper: true },
      ...toggles('showLowestPrice', 'showPriceHistory', 'showRegionalPricing', 'showStorePriceAlerts', 'showBundleSavings')
    ]
  },
  {
    id: 'store', title: 'optSecStore', items: toggles(
      'showSteamDBLink', 'showProtonDB', 'showHowLongToBeat', 'showPlayersOnline', 'showAchievementStats',
      'showDlcCheck', 'showCardSetValue', 'showReviewBreakdown', 'showLiveReviewFilters', 'showBestReview',
      'showReviewBombDetector')
  },
  {
    id: 'lists', title: 'optSecLists', items: toggles(
      'highlightOwned', 'highlightWishlist', 'highlightIgnored', 'hideOwnedInSearch', 'hideIgnoredInSearch',
      'enableWishlistExport')
  },
  {
    id: 'market', title: 'optSecMarket', items: toggles(
      'enableMarketTools', 'showBuyOrderHelper', 'enableInventoryTools', 'enableQuickSell', 'showTileSortGroup',
      'enableTradeOfferTools', 'showTradeHistory')
  },
  {
    id: 'community', title: 'optSecCommunity', items: [
      ...toggles('showLibraryValue', 'showBadgeTracker', 'showMediaShortcuts', 'showFriendsOwnership'),
      { type: 'text', key: 'steamWebApiKey', label: 'optSteamKey', hint: 'optSteamKeyHint', secret: true }
    ]
  },
  {
    id: 'notify', title: 'optSecNotify', items: [
      ...toggles('notifyWishlistDeals', 'notifyStorePriceAlerts', 'notifyFreePromos'),
      { type: 'number', key: 'wishlistDealThreshold', label: 'optDealThreshold', min: 1, max: 99 },
      { type: 'time', key: 'quietHoursStart', label: 'optQuietFrom', hint: 'optQuietHint' },
      { type: 'time', key: 'quietHoursEnd', label: 'optQuietTo' }
    ]
  },
  {
    id: 'advanced', title: 'optSecAdvanced', items: [
      { type: 'textarea', key: 'customCss', label: 'optCustomCss', hint: 'optCustomCssHint' }
    ]
  },
  {
    id: 'presets', title: 'optSecPresets', items: [
      { type: 'html', hint: 'optPresetsHint' },
      { type: 'actions', buttons: [['presetMinimal', () => applyPreset('minimal')], ['presetDeals', () => applyPreset('deals')],
        ['presetTrader', () => applyPreset('trader')], ['presetEverything', () => applyPreset('everything')]] }
    ]
  },
  {
    id: 'backup', title: 'optSecBackup', items: [
      { type: 'html', hint: 'optBackupHint' },
      { type: 'actions', buttons: [['optExport', exportAll], ['optImport', () => document.getElementById('import-file').click()],
        ['optClearCache', clearCache], ['optClearBlocklist', clearBlocklist], ['optReset', resetAll, 'danger']] }
    ]
  }
];

const ALL_TOGGLES = SECTIONS.flatMap((s) => s.items.filter((i) => i.type === 'toggle').map((i) => i.key));

// Presets only flip toggles; keys, country and the like are left alone.
const PRESETS = {
  minimal: ['showLowestPrice', 'showPriceHistory', 'highlightOwned', 'highlightWishlist', 'highlightIgnored',
    'hideIgnoredInSearch', 'showProtonDB', 'enableWishlistExport'],
  deals: ['showLowestPrice', 'showPriceHistory', 'showRegionalPricing', 'showStorePriceAlerts', 'showBundleSavings',
    'highlightOwned', 'highlightWishlist', 'highlightIgnored', 'hideOwnedInSearch', 'hideIgnoredInSearch',
    'enableWishlistExport', 'notifyWishlistDeals', 'notifyStorePriceAlerts', 'notifyFreePromos', 'showReviewBreakdown',
    'showReviewBombDetector', 'showProtonDB', 'showSteamDBLink'],
  trader: ['showLowestPrice', 'showPriceHistory', 'highlightOwned', 'highlightWishlist', 'enableMarketTools',
    'showBuyOrderHelper', 'enableInventoryTools', 'enableQuickSell', 'showTileSortGroup', 'enableTradeOfferTools',
    'showTradeHistory', 'showCardSetValue', 'showBadgeTracker'],
  // Everything except what needs your own Steam Web API key.
  everything: ALL_TOGGLES.filter((k) => k !== 'showFriendsOwnership')
};

// ---- rendering --------------------------------------------------------------

const el = (tag, attrs, ...kids) => {
  const n = document.createElement(tag);
  // `attrs || {}`, not a default parameter: callers pass null, which defaults don't cover.
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, '');
    else if (v != null && v !== false) n.setAttribute(k, v);
  }
  n.append(...kids.filter((x) => x != null));
  return n;
};

// Hints may contain a link: "…at [isthereanydeal.com/apps/my/](https://…) and…"
function hintNode(key) {
  const text = t(key);
  const p = el('p', { class: 'hint' });
  let last = 0;
  for (const m of text.matchAll(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g)) {
    p.append(text.slice(last, m.index), el('a', { href: m[2], target: '_blank', rel: 'noopener' }, m[1]));
    last = m.index + m[0].length;
  }
  p.append(text.slice(last));
  return p;
}

const inputs = new Map();

function renderRow(item) {
  if (item.type === 'html') return el('div', { class: 'row-static' }, hintNode(item.hint));
  if (item.type === 'actions') {
    return el('div', { class: 'actions' }, ...item.buttons.map(([label, fn, cls]) =>
      el('button', { class: cls || null, onclick: fn }, t(label))));
  }
  const label = t(item.label || `opt_${item.key}`);
  let input;
  if (item.type === 'toggle') {
    input = el('input', { type: 'checkbox' });
    input.addEventListener('change', () => save({ [item.key]: input.checked }));
    const row = el('label', { class: 'row toggle' }, input, el('span', null, label));
    row.dataset.search = `${label} ${item.key}`.toLowerCase();
    inputs.set(item.key, input);
    return row;
  }
  if (item.type === 'textarea') input = el('textarea', { rows: 6, spellcheck: 'false' });
  else {
    input = el('input', {
      type: item.type === 'number' ? 'number' : item.type === 'time' ? 'time' : (item.secret ? 'password' : 'text'),
      maxlength: item.maxlength, min: item.min, max: item.max,
      placeholder: item.placeholder ? t(item.placeholder) : null, autocomplete: 'off', spellcheck: 'false'
    });
  }
  const read = () => {
    let v = input.value.trim();
    if (item.type === 'number') return Number(v) || store.DEFAULTS[item.key];
    if (item.type === 'textarea') return input.value;
    if (item.lower) v = v.toLowerCase();
    if (item.upper) v = v.toUpperCase();
    return v;
  };
  let timer;
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => save({ [item.key]: read() }), 500); });
  input.addEventListener('change', () => { clearTimeout(timer); save({ [item.key]: read() }); });
  inputs.set(item.key, input);

  const field = [input];
  if (item.secret) {
    const show = el('button', { class: 'ghost', type: 'button' }, t('optShow'));
    show.addEventListener('click', () => {
      input.type = input.type === 'password' ? 'text' : 'password';
      show.textContent = t(input.type === 'password' ? 'optShow' : 'optHide');
    });
    field.push(show);
  }
  const row = el('div', { class: `row field${item.highlight ? ' highlight' : ''}` },
    el('label', null, el('span', { class: 'field-label' }, label), el('span', { class: 'field-input' }, ...field)),
    item.hint ? hintNode(item.hint) : null);
  row.dataset.search = `${label} ${item.hint ? t(item.hint) : ''} ${item.key}`.toLowerCase();
  return row;
}

function render() {
  const nav = document.getElementById('nav');
  const main = document.getElementById('sections');
  for (const s of SECTIONS) {
    nav.appendChild(el('a', { href: `#${s.id}`, 'data-section': s.id }, t(s.title)));
    main.appendChild(el('section', { id: s.id },
      el('h2', null, t(s.title)),
      ...s.items.map(renderRow)));
  }
}

async function load() {
  const cfg = await store.getAll();
  for (const [key, input] of inputs) {
    if (input.type === 'checkbox') input.checked = !!cfg[key];
    else input.value = cfg[key] ?? '';
  }
}

// ---- saving -------------------------------------------------------------------

let statusTimer;
function flash(msg, isError) {
  const s = document.getElementById('status');
  s.textContent = msg;
  s.classList.toggle('error', !!isError);
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { s.textContent = ''; }, isError ? 6000 : 1500);
}

async function save(patch) {
  try {
    await store.set(patch);
    flash(t('optSaved'));
  } catch (err) {
    // chrome.storage.sync has an 8KB-per-item quota for the synced settings.
    flash(t('optSaveFailed', err.message), true);
  }
}

async function applyPreset(name) {
  const on = new Set(PRESETS[name]);
  if (!window.confirm(t('optPresetConfirm', t(`preset${name[0].toUpperCase()}${name.slice(1)}`)))) return;
  await save(Object.fromEntries(ALL_TOGGLES.map((k) => [k, on.has(k)])));
  await load();
}

async function resetAll() {
  if (!window.confirm(t('optResetConfirm'))) return;
  const { itadApiKey, steamWebApiKey } = await store.getAll();
  await store.reset();
  await store.set({ itadApiKey, steamWebApiKey });
  await load();
  flash(t('optResetDone'));
}

function clearCache() {
  chrome.runtime.sendMessage({ type: 'clearCache' }, () => flash(t('optCacheCleared')));
}

async function clearBlocklist() {
  if (!window.confirm(t('optClearBlocklistConfirm'))) return;
  await chrome.storage.local.set({ se_blocklist_v1: [] });
  flash(t('optBlocklistCleared'));
}

// ---- backup -------------------------------------------------------------------

// Everything the user made: settings plus notes, alert prices, blocklist,
// price/trade/inventory history, alert history. Not the network cache
// ("c:" keys) or per-browser bookkeeping, which rebuild themselves.
const NOT_BACKED_UP = /^(c:|se_show_|se_last_seen_version$|se_detected_country$|se_wallet_currency$|se_collections$|se_item_nameids$|se_bg_cache_v1$|se_cache_v1$|fx:)/;

async function exportAll() {
  const sync = await chrome.storage.sync.get(null);
  const local = Object.fromEntries(Object.entries(await chrome.storage.local.get(null))
    .filter(([k]) => !NOT_BACKED_UP.test(k)));
  const payload = { __steam_enhancer: 2, version: chrome.runtime.getManifest().version, exported: new Date().toISOString(), sync, local };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  a.download = `steam-enhancer-backup-${payload.exported.slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  flash(t('optExported'));
}

document.getElementById('import-file').addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  try {
    const obj = JSON.parse(await f.text());
    if (!obj.__steam_enhancer) throw new Error(t('optNotABackup'));
    if (!window.confirm(t('optImportConfirm'))) return;
    // Works for 1.4.x exports too (same sync/local shape, fewer local keys).
    if (obj.sync) await chrome.storage.sync.set(obj.sync);
    if (obj.local) {
      const local = Object.fromEntries(Object.entries(obj.local).filter(([k]) => !NOT_BACKED_UP.test(k)));
      await chrome.storage.local.set(local);
    }
    await load();
    flash(t('optImported'));
  } catch (err) {
    flash(t('optImportFailed', err.message), true);
  }
});

// ---- search & navigation ------------------------------------------------------

function applySearch(q) {
  q = q.trim().toLowerCase();
  for (const section of document.querySelectorAll('main section')) {
    let any = false;
    for (const row of section.querySelectorAll('.row')) {
      const hit = !q || row.dataset.search.includes(q);
      row.hidden = !hit;
      any = any || hit;
    }
    const titleHit = q && section.querySelector('h2').textContent.toLowerCase().includes(q);
    if (titleHit) section.querySelectorAll('.row').forEach((r) => { r.hidden = false; });
    section.hidden = !!q && !any && !titleHit;
    section.querySelectorAll('.row-static, .actions').forEach((r) => { r.hidden = !!q && !titleHit; });
  }
}

function trackActiveSection() {
  const links = [...document.querySelectorAll('#nav a')];
  const obs = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      links.forEach((a) => a.classList.toggle('active', a.dataset.section === e.target.id));
    }
  }, { rootMargin: '-20% 0px -70% 0px' });
  document.querySelectorAll('main section').forEach((s) => obs.observe(s));
}

function localize() {
  document.querySelectorAll('[data-i18n]').forEach((n) => {
    const msg = chrome.i18n.getMessage(n.dataset.i18n);
    if (msg) n.textContent = msg;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((n) => {
    const msg = chrome.i18n.getMessage(n.dataset.i18nPlaceholder);
    if (msg) n.placeholder = msg;
  });
  const ui = chrome.i18n.getUILanguage?.() || '';
  if (/^(he|ar|fa)/.test(ui)) document.documentElement.dir = 'rtl';
  document.documentElement.lang = ui || 'en';
}

document.getElementById('version').textContent = 'v' + chrome.runtime.getManifest().version;
localize();
render();
load();
trackActiveSection();
document.getElementById('search').addEventListener('input', (e) => applySearch(e.target.value));
