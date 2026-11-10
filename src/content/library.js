(function () {
  'use strict';
  const SE = window.SteamEnhancer;

  SE.onReady(() => init());

  async function init() {
    if (!/\/games\/?(\?|$)/.test(location.pathname)) return;
    SE.safe('lib:toolbar', insertToolbar);
    // se-ready already re-fires on SPA navigation (common.js), so no extra watcher needed.
  }

  function insertToolbar(tries = 0) {
    if (SE.$('#se-library-toolbar')) return;
    const games = readGames();
    if (!games.length && reactGameIds().length) { insertReactBarWhenLoaded(); return; }
    // The list renders after load; give up after ~10 s (private or empty
    // library, or markup we don't recognize) instead of polling forever.
    if (!games.length) { if (tries < 20) setTimeout(() => insertToolbar(tries + 1), 500); return; }
    const anchor = SE.$('.profile_small_header_text') || SE.$('#mainContents') || document.body;
    const showValue = SE.ctx?.settings.showLibraryValue;
    const bar = SE.el('div', { id: 'se-library-toolbar', class: 'se-toolbar' },
      SE.el('span', { class: 'se-label' }, `${SE.t('libraryWord')}: ${games.length} ${SE.t('gamesWord')}`),
      SE.el('button', { class: 'se-btn', onclick: () => sort('playtime', 'desc') }, SE.t('sortPlaytimeDesc')),
      SE.el('button', { class: 'se-btn', onclick: () => sort('playtime', 'asc') }, SE.t('neverPlayedFirst')),
      SE.el('button', { class: 'se-btn', onclick: () => sort('name', 'asc') }, SE.t('sortAZ')),
      SE.el('button', { class: 'se-btn', onclick: filterUnplayed }, SE.t('showUnplayedOnly')),
      SE.el('button', { class: 'se-btn', onclick: clearFilters }, SE.t('resetWord')),
      showValue ? SE.el('button', { class: 'se-btn', onclick: estimateLibraryValue }, SE.t('estimateLibraryValue')) : null,
      SE.el('span', { id: 'se-library-out', class: 'se-muted' }, '')
    );
    anchor.parentElement?.insertBefore(bar, anchor);

    // Total hours
    const total = games.reduce((s, g) => s + g.playtime, 0);
    SE.$('#se-library-out').textContent = SE.t('libTotalHours', Math.round(total / 60).toLocaleString());

    // Persist a snapshot so profile.js can show "last known library size" even
    // when you're not on the /games page.
    SE.safe('lib:snapshot', () => saveSnapshot({ gameCount: games.length, totalMinutes: total }));
  }

  // Steam's current games page is a React app with its own sort, filter and
  // playtime, and its markup is generated class names we can't rearrange
  // safely. So there we add only what it lacks — the game count and the value
  // estimate — in a small floating bar outside its tree (never inside it).
  // Every game row links to its store page, which gives the app ids.
  function reactGameIds() {
    return SE.appIdsFromHrefs(SE.$$('a[href*="store.steampowered.com/app/"]').map((a) => a.href));
  }
  // The list fills in over a few seconds: wait until the count holds still.
  function insertReactBarWhenLoaded(last = -1, tries = 0) {
    if (SE.$('#se-library-toolbar')) return;
    const n = reactGameIds().length;
    if ((n !== last || n === 0) && tries < 20) {
      setTimeout(() => insertReactBarWhenLoaded(n, tries + 1), 1000);
      return;
    }
    if (n) insertReactBar();
  }
  function insertReactBar() {
    const ids = reactGameIds();
    const bar = SE.el('div', { id: 'se-library-toolbar', class: 'se-toolbar se-library-float', dir: 'auto' },
      SE.el('span', { class: 'se-label' }, `${SE.t('libraryWord')}: ${ids.length} ${SE.t('gamesWord')}`),
      SE.ctx?.settings.showLibraryValue
        ? SE.el('button', { class: 'se-btn', onclick: () => estimateLibraryValue(reactGameIds()) }, SE.t('estimateLibraryValue'))
        : null,
      SE.el('span', { id: 'se-library-out', class: 'se-muted' }, '')
    );
    document.body.appendChild(bar);
    SE.safe('lib:snapshot', () => saveSnapshot({ gameCount: ids.length }));
  }

  const SNAPSHOT_KEY = 'se_library_snapshot_v1';
  async function saveSnapshot(patch) {
    const key = SE.profileKeyFromPath();
    if (!key) return;
    const all = await new Promise((r) => chrome.storage.local.get([SNAPSHOT_KEY], (d) => r(d[SNAPSHOT_KEY] || {})));
    all[key] = { ...(all[key] || {}), ...patch, ts: Date.now() };
    chrome.storage.local.set({ [SNAPSHOT_KEY]: all });
  }

  // Sums each owned game's CURRENT storefront price (not what you actually
  // paid — Steam doesn't expose purchase history to extensions) across a
  // sample of the library, then extrapolates. Rate-limit-friendly: first 60
  // games only, same "sample and extrapolate" pattern used elsewhere in the
  // extension (inventory value estimate, etc.).
  async function estimateLibraryValue(appids) {
    const out = SE.$('#se-library-out');
    const games = Array.isArray(appids) ? appids.map((appid) => ({ appid })) : readGames();
    const sample = games.slice(0, 60);
    out.textContent = SE.t('libPricing', sample.length, games.length);
    const country = SE.ctx?.country || 'us';
    let sum = 0, priced = 0, currency = null;
    for (const g of sample) {
      const r = await SE.api.appDetails(g.appid, country);
      const po = r?.data?.[g.appid]?.data?.price_overview;
      if (po?.final != null) { sum += po.final / 100; priced++; currency = currency || po.currency; }
    }
    const avg = priced ? sum / priced : 0;
    const estimate = avg * games.length;
    const money = (v) => (currency ? SE.formatMoney(v, currency) : v.toFixed(2));
    out.textContent = priced
      ? SE.t('libValueResult', priced, sample.length, money(avg), money(estimate), games.length)
      : SE.t('libValueFailed', country.toUpperCase());
    if (priced) SE.safe('lib:valueSnapshot', () => saveSnapshot({ value: estimate, valueSampledGames: priced }));
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
