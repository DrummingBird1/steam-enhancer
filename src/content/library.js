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
    const showValue = SE.ctx?.settings.showLibraryValue;
    const bar = SE.el('div', { id: 'se-library-toolbar', class: 'se-toolbar' },
      SE.el('span', { class: 'se-label' }, `Library: ${games.length} games`),
      SE.el('button', { class: 'se-btn', onclick: () => sort('playtime', 'desc') }, 'Sort: playtime ↓'),
      SE.el('button', { class: 'se-btn', onclick: () => sort('playtime', 'asc') }, 'Never played first'),
      SE.el('button', { class: 'se-btn', onclick: () => sort('name', 'asc') }, 'A → Z'),
      SE.el('button', { class: 'se-btn', onclick: filterUnplayed }, 'Show unplayed only'),
      SE.el('button', { class: 'se-btn', onclick: clearFilters }, 'Reset'),
      showValue ? SE.el('button', { class: 'se-btn', onclick: estimateLibraryValue }, 'Estimate library value') : null,
      SE.el('span', { id: 'se-library-out', class: 'se-muted' }, '')
    );
    anchor.parentElement?.insertBefore(bar, anchor);

    // Total hours
    const total = games.reduce((s, g) => s + g.playtime, 0);
    SE.$('#se-library-out').textContent = `Total: ${Math.round(total / 60).toLocaleString()} hours`;

    // Persist a snapshot so profile.js can show "last known library size" even
    // when you're not on the /games page.
    SE.safe('lib:snapshot', () => saveSnapshot({ gameCount: games.length, totalMinutes: total }));
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
  async function estimateLibraryValue() {
    const out = SE.$('#se-library-out');
    const games = readGames();
    const sample = games.slice(0, 60);
    out.textContent = `Pricing ${sample.length}/${games.length} games (sampled)…`;
    const country = (await SE.storage.getAll()).country || 'us';
    let sum = 0, priced = 0;
    for (const g of sample) {
      const r = await SE.api.appDetails(g.appid, country);
      const po = r?.data?.[g.appid]?.data?.price_overview;
      if (po?.final != null) { sum += po.final / 100; priced++; }
    }
    const avg = priced ? sum / priced : 0;
    const estimate = avg * games.length;
    out.textContent = priced
      ? `Sampled ${priced}/${sample.length} · avg ${avg.toFixed(2)} · estimate ≈ ${estimate.toFixed(2)} at CURRENT prices across ${games.length} games (not what you paid — Steam doesn't expose purchase history)`
      : `Could not price any sampled games (all free-to-play or unavailable in ${country.toUpperCase()}?).`;
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
