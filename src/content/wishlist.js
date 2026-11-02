// Wishlist page panel. Steam's wishlist is a React app (since late 2024) with
// none of the markup 1.4.x decorated, so this reads the data from Steam's own
// APIs instead — the wishlist (IWishlistService) and store details
// (IStoreBrowseService) — joins in ITAD's historical lows, and renders one
// sortable, filterable table above Steam's list. Parsing, sorting and export
// live in src/lib/wishlist.js (unit-tested).
(function () {
  'use strict';
  const SE = window.SteamEnhancer;
  const W = SE.wishlistModel;
  const PAGE_SIZE = 100;
  const COLLAPSED_KEY = 'se_wl_collapsed';

  // Steam's language names for the store API, from the page's <html lang>.
  const STEAM_LANG = {
    de: 'german', fr: 'french', es: 'spanish', it: 'italian', ru: 'russian', pl: 'polish',
    'pt-br': 'brazilian', pt: 'portuguese', tr: 'turkish', ja: 'japanese', ko: 'koreana',
    'zh-cn': 'schinese', 'zh-tw': 'tchinese', uk: 'ukrainian', nl: 'dutch', sv: 'swedish'
  };
  const steamLanguage = () => {
    const l = (document.documentElement.lang || 'en').toLowerCase();
    return STEAM_LANG[l] || STEAM_LANG[l.split('-')[0]] || 'english';
  };

  const state = {
    steamid: null, items: null, store: new Map(), itad: new Map(), targets: {},
    rows: [], sort: 'priority', dir: 1, shown: PAGE_SIZE,
    filter: { text: '', onSale: false, atLow: false, atTarget: false, maxPrice: null }
  };
  let els = null;

  SE.onReady(() => SE.safe('wl:init', init));

  async function init() {
    if (!/^\/wishlist\//.test(location.pathname)) return;
    if (!SE.ctx?.settings.enableWishlistExport) return;
    const ssr = document.getElementById('valve-ssr-data')?.textContent || '';
    const steamid = W.ownerSteamId(location.pathname, ssr);
    if (state.steamid === steamid && SE.$('#se-wl-panel')) return;
    state.steamid = steamid;

    insertPanel();
    if (!steamid) { setStatus(SE.t('wlNoOwner')); return; }

    setStatus(SE.t('wlLoading'));
    const wl = await SE.api.wishlist(steamid);
    state.items = W.items(wl?.ok ? wl.data : null);
    if (!state.items) { setStatus(SE.t('wlPrivateOrEmpty')); return; }

    const appids = state.items.map((i) => i.appid);
    for (let i = 0; i < appids.length; i += 100) {
      setStatus(SE.t('wlLoadingDetails', Math.min(i + 100, appids.length), appids.length));
      const r = await SE.api.storeItems(appids.slice(i, i + 100), SE.ctx.country, steamLanguage());
      W.storeItems(r?.ok ? r.data : null).forEach((v, k) => state.store.set(k, v));
    }
    state.targets = await getTargets();
    rebuild();

    // Historical lows come second: they need an ITAD key and can take a while
    // on a big wishlist the first time (each lookup is then cached for a day).
    if (SE.ctx.settings.showLowestPrice) {
      setStatus(SE.t('wlLoadingPrices'));
      try {
        const sums = await SE.priceSummaryBatch(appids, SE.ctx.country);
        if (sums === 'needsItadKey') showKeyNotice();
        else if (sums instanceof Map) { state.itad = sums; rebuild(); }
      } catch (e) {
        SE.warn('wishlist: historical lows failed', e); // the table is still useful without them
      }
    }
    setStatus('');
  }

  function rebuild() {
    state.rows = W.buildRows(state.items, state.store, state.itad, state.targets);
    render();
  }

  // ---- DOM -----------------------------------------------------------------

  function insertPanel() {
    SE.$('#se-wl-panel')?.remove();
    const anchor = SE.$('#StoreTemplate') || document.body;
    const collapsed = localStorageGet(COLLAPSED_KEY) === '1';

    const search = SE.el('input', { type: 'search', class: 'se-input', placeholder: SE.t('wlSearch') });
    search.addEventListener('input', SE.debounce(() => { state.filter.text = search.value; state.shown = PAGE_SIZE; render(); }, 150));

    const sortSel = SE.el('select', { class: 'se-input' },
      ...[['priority', 'wlSortPriority'], ['price', 'wlSortPrice'], ['discount', 'wlSortDiscount'],
        ['vsLow', 'wlSortVsLow'], ['reviews', 'wlSortReviews'], ['added', 'wlSortAdded'],
        ['released', 'wlSortReleased'], ['name', 'wlSortName']]
        .map(([v, k]) => SE.el('option', { value: v }, SE.t(k))));
    sortSel.addEventListener('change', () => { state.sort = sortSel.value; render(); });
    const dirBtn = SE.el('button', { class: 'se-btn', title: SE.t('wlReverse'), onclick: () => { state.dir *= -1; render(); } }, '⇅');

    const check = (key, label) => {
      const cb = SE.el('input', { type: 'checkbox' });
      cb.addEventListener('change', () => { state.filter[key] = cb.checked; state.shown = PAGE_SIZE; render(); });
      return SE.el('label', { class: 'se-wl-check' }, cb, ' ', SE.t(label));
    };
    const maxPrice = SE.el('input', { type: 'number', min: '0', step: '1', class: 'se-input', style: { width: '80px' }, placeholder: SE.t('wlMaxPrice') });
    maxPrice.addEventListener('input', SE.debounce(() => {
      const v = parseFloat(maxPrice.value);
      state.filter.maxPrice = Number.isFinite(v) ? v : null;
      state.shown = PAGE_SIZE; render();
    }, 200));

    const body = SE.el('div', { class: 'se-wl-body', style: { display: collapsed ? 'none' : '' } },
      SE.el('div', { class: 'se-toolbar' },
        search, sortSel, dirBtn,
        check('onSale', 'wlOnSaleOnly'), check('atLow', 'wlAtLowOnly'), check('atTarget', 'wlAtTargetOnly'), maxPrice,
        SE.el('button', { class: 'se-btn', onclick: exportCsv }, SE.t('exportCsv')),
        SE.el('button', { class: 'se-btn', onclick: exportJson }, SE.t('exportJson')),
        SE.el('button', { class: 'se-btn', onclick: copyList }, SE.t('copyAsText'))
      ),
      SE.el('div', { class: 'se-wl-table-wrap' }, SE.el('table', { class: 'se-wl-table' })),
      SE.el('div', { class: 'se-wl-more' })
    );
    const toggle = SE.el('button', { class: 'se-btn se-wl-toggle' }, collapsed ? '▸' : '▾');
    toggle.addEventListener('click', () => {
      const hide = body.style.display !== 'none';
      body.style.display = hide ? 'none' : '';
      toggle.textContent = hide ? '▸' : '▾';
      localStorageSet(COLLAPSED_KEY, hide ? '1' : '0');
    });

    const panel = SE.el('div', { id: 'se-wl-panel', class: 'se-panel se-wl-panel' },
      SE.el('div', { class: 'se-panel-h' }, toggle, ' ', SE.t('wlPanelTitle')),
      SE.el('div', { class: 'se-wl-summary' }),
      SE.el('div', { class: 'se-wl-status se-muted' }),
      body
    );
    // Beside the React tree, never inside it: React owns its children and
    // would drop (or fail to hydrate around) a foreign node.
    if (anchor === document.body) anchor.prepend(panel);
    else anchor.parentElement.insertBefore(panel, anchor);
    els = {
      panel, body,
      summary: panel.querySelector('.se-wl-summary'),
      status: panel.querySelector('.se-wl-status'),
      table: panel.querySelector('.se-wl-table'),
      more: panel.querySelector('.se-wl-more')
    };
  }

  function setStatus(text) { if (els) els.status.textContent = text; }

  const currency = () => SE.currency.forCountry(SE.ctx.country);
  const money = (v) => (v == null ? '—' : SE.formatMoney(v, currency()));

  function render() {
    if (!els) return;
    const s = W.summary(state.rows);
    els.summary.textContent = '';
    els.summary.append(
      SE.t('wlSummary', s.count, money(s.total), money(s.totalRegular)),
      ' · ', SE.tag(SE.t('wlOnSale', s.onSale), 'wish'),
      ' ', SE.tag(SE.t('wlAtLow', s.atLow), 'good'),
      s.atTarget ? ' ' : '', s.atTarget ? SE.tag(SE.t('wlAtTarget', s.atTarget), 'good') : ''
    );

    const visible = W.sortRows(W.filterRows(state.rows, state.filter), state.sort, state.dir);
    const table = els.table;
    table.textContent = '';
    table.appendChild(SE.el('tr', null,
      ...['wlColGame', 'wlColPrice', 'wlColDiscount', 'wlColLow', 'wlColVsLow', 'wlColReviews', 'wlColDeck', 'wlColTarget', 'wlColAdded']
        .map((k) => SE.el('th', null, SE.t(k)))));
    for (const r of visible.slice(0, state.shown)) table.appendChild(renderRow(r));
    if (!visible.length) table.appendChild(SE.el('tr', null, SE.el('td', { colspan: '9', class: 'se-muted' }, SE.t('wlNoMatches'))));

    els.more.textContent = '';
    if (visible.length > state.shown) {
      els.more.append(
        SE.el('span', { class: 'se-muted' }, SE.t('wlShowing', state.shown, visible.length) + ' '),
        SE.el('button', { class: 'se-btn', onclick: () => { state.shown += PAGE_SIZE; render(); } },
          SE.t('wlShowMore', Math.min(PAGE_SIZE, visible.length - state.shown)))
      );
    }
  }

  function renderRow(r) {
    const deck = SE.deckLabel(r.deck);
    const target = SE.el('input', {
      type: 'number', step: '0.01', min: '0', class: 'se-input', style: { width: '80px' },
      placeholder: SE.t('alertMeAtPlaceholder')
    });
    target.value = r.target != null ? String(r.target) : '';
    target.addEventListener('change', async () => {
      const v = parseFloat(target.value);
      state.targets = await setTarget(r.appid, Number.isFinite(v) && v > 0 ? v : null);
      rebuild();
    });
    const tr = SE.el('tr', { class: r.atTarget ? 'se-wl-hit' : '' },
      SE.el('td', null, SE.el('a', { href: r.url, class: 'se-link' }, r.name)),
      SE.el('td', null, r.price == null ? '—' : (r.price === 0 ? SE.t('wlFree') : money(r.price))),
      SE.el('td', null, r.discount ? SE.tag(`-${r.discount}%`, 'good') : ''),
      SE.el('td', null, money(r.low)),
      SE.el('td', null, r.vsLow == null ? '—' : (r.atLow ? SE.tag(SE.t('wlLowNow'), 'good') : `+${r.vsLow}%`)),
      SE.el('td', null, r.reviewPct == null ? '—' : `${r.reviewPct}%`),
      SE.el('td', null, deck ? SE.tag(SE.t(deck[0]), deck[1]) : ''),
      SE.el('td', null, target),
      SE.el('td', null, r.added ? new Date(r.added * 1000).toISOString().slice(0, 10) : '')
    );
    return tr;
  }

  function showKeyNotice() {
    if (!els || els.panel.querySelector('#se-itad-key-notice')) return;
    els.status.after(SE.el('div', { id: 'se-itad-key-notice', class: 'se-row' },
      SE.el('span', { class: 'se-muted' }, SE.t('needsItadKeyMsg') + ' '),
      SE.el('a', {
        href: 'javascript:void 0', class: 'se-link',
        onclick: (e) => { e.preventDefault(); SE.bg({ type: 'openOptions' }); }
      }, SE.t('openOptionsLink'))
    ));
  }

  // ---- export --------------------------------------------------------------

  const currentRows = () => W.sortRows(W.filterRows(state.rows, state.filter), state.sort, state.dir);

  function download(name, content, mime) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function exportCsv() { download('steam-wishlist.csv', W.toCsv(currentRows()), 'text/csv'); }
  function exportJson() { download('steam-wishlist.json', JSON.stringify(currentRows(), null, 2), 'application/json'); }
  function copyList() {
    const text = currentRows().map((r) => `- ${r.name} (${r.price == null ? '—' : money(r.price)})`).join('\n');
    navigator.clipboard.writeText(text).then(() => setStatus(SE.t('copiedToClipboard')));
  }

  // ---- storage -------------------------------------------------------------

  // Shared with the store-page "alert me at" field and the background price-alert alarm.
  function getTargets() {
    return new Promise((r) => chrome.storage.local.get(['se_wishlist_targets'], (d) => r(d.se_wishlist_targets || {})));
  }
  async function setTarget(appid, v) {
    const cur = await getTargets();
    if (v == null) delete cur[appid]; else cur[appid] = v;
    await new Promise((r) => chrome.storage.local.set({ se_wishlist_targets: cur }, r));
    return cur;
  }

  function localStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch {} }
})();
