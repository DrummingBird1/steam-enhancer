const STORAGE_KEY = 'se_settings_v1';
// Defaults for the toggles shown in the popup — keep in sync with DEFAULTS in options.js / storage.js.
const POPUP_DEFAULTS = {
  showLowestPrice: true, highlightOwned: true, highlightWishlist: true,
  hideIgnoredInSearch: true, showProtonDB: true, showRegionalPricing: false,
  notifyWishlistDeals: false
};

async function load() {
  const data = await new Promise((r) => chrome.storage.sync.get([STORAGE_KEY], r));
  const cfg = { ...POPUP_DEFAULTS, ...(data[STORAGE_KEY] || {}) };
  document.querySelectorAll('input[data-setting]').forEach((el) => {
    el.checked = !!cfg[el.dataset.setting];
  });
}
async function save(key, value) {
  const data = await new Promise((r) => chrome.storage.sync.get([STORAGE_KEY], r));
  const cur = data[STORAGE_KEY] || {};
  cur[key] = value;
  await new Promise((r) => chrome.storage.sync.set({ [STORAGE_KEY]: cur }, r));
}

document.querySelectorAll('input[data-setting]').forEach((el) => {
  el.addEventListener('change', () => save(el.dataset.setting, el.checked));
});
document.querySelectorAll('button[data-go]').forEach((b) => {
  b.addEventListener('click', () => chrome.tabs.create({ url: b.dataset.go }));
});
document.getElementById('open-options').addEventListener('click', () => chrome.runtime.openOptionsPage());
document.getElementById('clear-cache').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'clearCache' }, () => {
    const btn = document.getElementById('clear-cache');
    btn.textContent = 'Cleared!';
    setTimeout(() => (btn.textContent = 'Clear cache'), 1200);
  });
});

function localize() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const msg = chrome.i18n.getMessage(el.dataset.i18n);
    if (msg) el.textContent = msg;
  });
  const ui = chrome.i18n.getUILanguage?.() || '';
  if (/^he|^ar|^fa/.test(ui)) document.documentElement.dir = 'rtl';
}

document.getElementById('version').textContent = 'v' + chrome.runtime.getManifest().version;
localize();
load();
