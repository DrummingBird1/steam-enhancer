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
document.getElementById('report').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL('src/options/options.html#help') });
});
document.getElementById('clear-cache').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'clearCache' }, () => {
    const btn = document.getElementById('clear-cache');
    const label = btn.textContent;
    btn.textContent = chrome.i18n.getMessage('cacheCleared') || 'Cleared!';
    setTimeout(() => (btn.textContent = label), 1200);
  });
});

// Recent alerts (wishlist deals, price alerts, free promos) from the
// background's history. Unread ones are highlighted this time, then marked
// read, which clears the toolbar badge.
async function renderAlerts() {
  const A = window.SteamEnhancer.alerts;
  const list = (await chrome.storage.local.get([A.KEY]))[A.KEY] || [];
  if (!list.length) return;
  const ul = document.getElementById('alerts');
  ul.textContent = '';
  for (const e of list.slice(0, 15)) {
    const li = document.createElement('li');
    if (!e.read) li.classList.add('unread');
    const body = document.createElement('div');
    body.className = 'a-body';
    const title = document.createElement('div');
    title.className = 'a-title';
    title.textContent = e.title;
    const msg = document.createElement('div');
    msg.className = 'a-msg';
    msg.textContent = e.message;
    msg.title = e.message;
    body.append(title, msg);
    const age = document.createElement('span');
    age.className = 'a-age';
    age.textContent = A.age(e.ts);
    li.append(body, age);
    if (e.appid) {
      li.classList.add('link');
      li.addEventListener('click', () => chrome.tabs.create({ url: `https://store.steampowered.com/app/${e.appid}/` }));
    }
    ul.appendChild(li);
  }
  document.getElementById('alerts-section').hidden = false;
  if (A.unreadCount(list)) chrome.runtime.sendMessage({ type: 'alertsMarkRead' });
}

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
renderAlerts();
