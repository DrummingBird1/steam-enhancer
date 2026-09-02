const STORAGE_KEY = 'se_settings_v1';

const DEFAULTS = {
  currency: 'USD', country: 'us', displayCurrency: '',
  showLowestPrice: true, showPriceHistory: true, showSteamDBLink: true,
  showProtonDB: true, showHowLongToBeat: true, showRegionalPricing: false,
  showPlayersOnline: true, showAchievementStats: true, showDlcCheck: true,
  showCardSetValue: true, showReviewBreakdown: true, autoExpandReviews: false,
  highlightOwned: true, highlightWishlist: true, highlightIgnored: true,
  hideOwnedInSearch: false, hideIgnoredInSearch: true,
  enableMarketTools: true, enableInventoryTools: true, enableTradeOfferTools: true,
  enableWishlistExport: true, enableQuickSell: true,
  notifyWishlistDeals: false, wishlistDealThreshold: 25,
  cacheTTLMinutes: 60, itadEnabled: true, customCss: '',
  showBundleSavings: true, showLiveReviewFilters: true, showBestReview: true,
  showReviewBombDetector: true, showBuyOrderHelper: true, showTradeHistory: true,
  showTileSortGroup: true, showStorePriceAlerts: true, showFriendsOwnership: false,
  showLibraryValue: true, showBadgeTracker: true, showMediaShortcuts: true,
  notifyFreePromos: false, notifyStorePriceAlerts: false, steamWebApiKey: '',
  onboardingSeen: false
};

const GROUPS = {
  'grid-store': [
    ['showLowestPrice', 'Show lowest current price'],
    ['showPriceHistory', 'Show historical low'],
    ['showSteamDBLink', 'Add SteamDB/Barter/Charts links'],
    ['showProtonDB', 'Show ProtonDB rating (Linux)'],
    ['showHowLongToBeat', 'Show HowLongToBeat link'],
    ['showRegionalPricing', 'Show regional pricing (slow)'],
    ['showPlayersOnline', 'Show current player count'],
    ['showAchievementStats', 'Show achievement stats'],
    ['showDlcCheck', 'Highlight owned DLC'],
    ['showCardSetValue', 'Add trading card links'],
    ['showReviewBreakdown', 'Show review breakdown'],
    ['showLiveReviewFilters', 'Live (no-reload) review filter bar'],
    ['showBestReview', 'Show most-helpful review snippet'],
    ['showReviewBombDetector', 'Flag possible review-bomb spikes'],
    ['showBundleSavings', 'Show bundle vs. standalone savings'],
    ['showStorePriceAlerts', 'Show "alert me at" price field on store pages'],
    ['showFriendsOwnership', 'Show how many friends own this game (needs API key below)']
  ],
  'grid-search': [
    ['highlightOwned', 'Highlight owned games'],
    ['highlightWishlist', 'Highlight wishlisted games'],
    ['highlightIgnored', 'Highlight ignored games'],
    ['hideOwnedInSearch', 'Hide owned in search results'],
    ['hideIgnoredInSearch', 'Hide ignored in search results']
  ],
  'grid-mkt': [
    ['enableMarketTools', 'Market listing helpers'],
    ['enableInventoryTools', 'Inventory tools'],
    ['enableTradeOfferTools', 'Trade offer summary'],
    ['enableWishlistExport', 'Wishlist export buttons'],
    ['enableQuickSell', 'Quick-sell shortcuts'],
    ['showBuyOrderHelper', 'Market buy-order helper'],
    ['showTradeHistory', 'Local trade history per partner'],
    ['showTileSortGroup', 'Inventory sort/group tile tools'],
    ['showLibraryValue', 'Estimate library value on /games page'],
    ['showBadgeTracker', 'Badge completion tracker on /badges page'],
    ['showMediaShortcuts', 'Screenshots/artwork shortcuts on profile']
  ],
  'grid-notify': [
    ['notifyWishlistDeals', 'Notify on wishlist deals (hourly check)'],
    ['notifyStorePriceAlerts', 'Notify when a store-page price alert is hit'],
    ['notifyFreePromos', 'Notify when a game goes fully free for a limited time']
  ]
};

function renderGroups() {
  for (const [gridId, items] of Object.entries(GROUPS)) {
    const root = document.getElementById(gridId);
    items.forEach(([key, label]) => {
      const lbl = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.dataset.setting = key;
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(' ' + label));
      root.appendChild(lbl);
    });
  }
}

async function load() {
  const data = await new Promise((r) => chrome.storage.sync.get([STORAGE_KEY], r));
  const cfg = { ...DEFAULTS, ...(data[STORAGE_KEY] || {}) };
  document.querySelectorAll('input[data-setting]').forEach((el) => {
    el.checked = !!cfg[el.dataset.setting];
  });
  document.getElementById('country').value = cfg.country || 'us';
  document.getElementById('currency').value = cfg.currency || 'USD';
  document.getElementById('displayCurrency').value = cfg.displayCurrency || '';
  document.getElementById('wishlistDealThreshold').value = cfg.wishlistDealThreshold;
  document.getElementById('cacheTTLMinutes').value = cfg.cacheTTLMinutes;
  document.getElementById('customCss').value = cfg.customCss || '';
  document.getElementById('steamWebApiKey').value = cfg.steamWebApiKey || '';
  document.getElementById('itadApiKey').value = cfg.itadApiKey || '';
}

async function save() {
  const cur = {};
  document.querySelectorAll('input[data-setting]').forEach((el) => {
    cur[el.dataset.setting] = el.checked;
  });
  cur.country = document.getElementById('country').value.trim().toLowerCase() || 'us';
  cur.currency = document.getElementById('currency').value.trim().toUpperCase() || 'USD';
  cur.displayCurrency = document.getElementById('displayCurrency').value.trim().toUpperCase();
  cur.wishlistDealThreshold = +document.getElementById('wishlistDealThreshold').value || 25;
  cur.cacheTTLMinutes = +document.getElementById('cacheTTLMinutes').value || 60;
  cur.customCss = document.getElementById('customCss').value;
  cur.steamWebApiKey = document.getElementById('steamWebApiKey').value.trim();
  cur.itadApiKey = document.getElementById('itadApiKey').value.trim();
  try {
    await new Promise((r, rej) => chrome.storage.sync.set({ [STORAGE_KEY]: cur }, () => {
      if (chrome.runtime.lastError) { rej(new Error(chrome.runtime.lastError.message)); return; }
      r();
    }));
    flash('Saved.');
  } catch (err) {
    // Most likely cause: chrome.storage.sync's ~8KB-per-item quota (we store
    // everything under one key) — customCss is the field most likely to hit it.
    flash('Save failed: ' + err.message + ' (try shortening Custom CSS)');
  }
}

function flash(msg) {
  const el = document.getElementById('status');
  el.textContent = msg;
  setTimeout(() => (el.textContent = ''), 1500);
}

function localize() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const msg = chrome.i18n.getMessage(el.dataset.i18n);
    if (msg) el.textContent = msg;
  });
  const ui = chrome.i18n.getUILanguage?.() || '';
  if (/^he|^ar|^fa/.test(ui)) document.documentElement.dir = 'rtl';
}

renderGroups();
localize();
load();

document.getElementById('save').addEventListener('click', save);
document.getElementById('reset').addEventListener('click', async () => {
  if (!confirm('Reset all settings to defaults?')) return;
  await new Promise((r) => chrome.storage.sync.set({ [STORAGE_KEY]: DEFAULTS }, r));
  load(); flash('Reset.');
});
document.getElementById('clear-cache').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'clearCache' }, () => flash('Cache cleared.'));
});

document.getElementById('export-settings').addEventListener('click', async () => {
  const sync = await new Promise((r) => chrome.storage.sync.get(null, r));
  const local = await new Promise((r) => chrome.storage.local.get(['se_notes_v1', 'se_blocklist_v1', 'se_price_history_v1'], r));
  const payload = { __steam_enhancer: 1, version: chrome.runtime.getManifest().version, sync, local };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'steam-enhancer-settings.json'; a.click();
  flash('Exported.');
});
document.getElementById('import-settings').addEventListener('click', () => {
  document.getElementById('import-file').click();
});
document.getElementById('import-file').addEventListener('change', async (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  try {
    const txt = await f.text();
    const obj = JSON.parse(txt);
    if (!obj.__steam_enhancer) throw new Error('Not a Steam Enhancer export.');
    if (obj.sync) await new Promise((r) => chrome.storage.sync.set(obj.sync, r));
    if (obj.local) await new Promise((r) => chrome.storage.local.set(obj.local, r));
    await load(); flash('Imported. Reload Steam tabs to apply.');
  } catch (err) {
    flash('Import failed: ' + err.message);
  }
});
document.getElementById('clear-blocklist').addEventListener('click', async () => {
  if (!confirm('Clear the extension blocklist (games you marked "hide forever")?')) return;
  await new Promise((r) => chrome.storage.local.set({ se_blocklist_v1: [] }, r));
  flash('Blocklist cleared.');
});
