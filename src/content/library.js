(function () {
  'use strict';
  const SE = window.SteamEnhancer;

  SE.onReady(() => init());

  async function init() {
    if (!/\/games\/?(\?|$)/.test(location.pathname)) return;
    SE.safe('lib:toolbar', insertToolbar);
    // se-ready already re-fires on SPA navigation (common.js), so no extra watcher needed.
  }

  function insertToolbar() {
    if (SE.$('#se-library-toolbar')) return;
    const games = readGames();
    if (!games.length) { setTimeout(insertToolbar, 500); return; }
    const anchor = SE.$('.profile_small_header_text') || SE.$('#mainContents') || document.body;
    const bar = SE.el('div', { id: 'se-library-toolbar', class: 'se-toolbar' },
      SE.el('span', { class: 'se-label' }, `Library: ${games.length} games`),
      SE.el('button', { class: 'se-btn', onclick: () => sort('playtime', 'desc') }, 'Sort: playtime ↓'),
      SE.el('button', { class: 'se-btn', onclick: () => sort('playtime', 'asc') }, 'Never played first'),
      SE.el('button', { class: 'se-btn', onclick: () => sort('name', 'asc') }, 'A → Z'),
      SE.el('button', { class: 'se-btn', onclick: filterUnplayed }, 'Show unplayed only'),
      SE.el('button', { class: 'se-btn', onclick: clearFilters }, 'Reset'),
      SE.el('span', { id: 'se-library-out', class: 'se-muted' }, '')
    );
    anchor.parentElement?.insertBefore(bar, anchor);

    // Total hours
    const total = games.reduce((s, g) => s + g.playtime, 0);
    SE.$('#se-library-out').textContent = `Total: ${Math.round(total / 60).toLocaleString()} hours`;

    // Persist a snapshot so profile.js can show "last known library size" even
    // when you're not on the /games page.
    SE.safe('lib:snapshot', () => saveSnapshot(games.length, total));
  }

  const SNAPSHOT_KEY = 'se_library_snapshot_v1';
  async function saveSnapshot(gameCount, totalMinutes) {
    const key = SE.profileKeyFromPath();
    if (!key) return;
    const all = await new Promise((r) => chrome.storage.local.get([SNAPSHOT_KEY], (d) => r(d[SNAPSHOT_KEY] || {})));
    all[key] = { gameCount, totalMinutes, ts: Date.now() };
    chrome.storage.local.set({ [SNAPSHOT_KEY]: all });
  }

  function readGames() {
    return SE.$$('.gameListRow, .game_list_row, [data-appid]').map((row) => {
      const appid = row.getAttribute('data-appid') || row.id?.replace(/^game_/, '') || '';
      const name = row.querySelector('.gameListRowItemName, .game_name')?.textContent?.trim() || '';
      const hoursMatch = row.textContent.match(/([\d.]+)\s*hrs?/i);
      const playtime = hoursMatch ? Math.round(parseFloat(hoursMatch[1]) * 60) : 0;
      return { node: row, appid, name, playtime };
    }).filter(g => g.appid);
  }

  function sort(key, dir) {
    const games = readGames();
    if (!games.length) return;
    games.sort((a, b) => {
      const va = key === 'name' ? a.name.toLowerCase() : a.playtime;
      const vb = key === 'name' ? b.name.toLowerCase() : b.playtime;
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    const parent = games[0].node.parentElement;
    games.forEach(g => parent.appendChild(g.node));
  }

  function filterUnplayed() {
    for (const g of readGames()) g.node.style.display = g.playtime > 0 ? 'none' : '';
  }
  function clearFilters() {
    for (const g of readGames()) g.node.style.display = '';
  }
})();
