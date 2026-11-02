// Defaults come from src/lib/storage.js (loaded first by popup.html).
const store = window.SteamEnhancer.storage;

async function load() {
  const cfg = await store.getAll();
  document.querySelectorAll('input[data-setting]').forEach((el) => {
    el.checked = !!cfg[el.dataset.setting];
  });
}
async function save(key, value) {
  await store.set({ [key]: value });
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
