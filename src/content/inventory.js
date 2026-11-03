(function () {
  'use strict';
  const SE = window.SteamEnhancer;

  SE.onReady(() => init());

  let cachedItems = null;
  let cachedFor = null;
  let cachedOwnerId = null;

  async function init() {
    if (!SE.ctx?.settings.enableInventoryTools) return;
    SE.safe('inv:toolbar', insertToolbar);
    SE.safe('inv:prewarm', () => getItems());
    // Guard the polling loops so SPA re-ready doesn't stack duplicate intervals.
    if (SE.once('inv:intervals')) {
      setInterval(() => SE.safe('inv:selected', decorateSelected), 1000);
      setInterval(() => SE.safe('inv:tiles', decorateTiles), 4000);
      setInterval(() => SE.safe('inv:selOverlay', renderSelectionOverlays), 1500);
    }
  }

  function insertToolbar() {
    if (SE.$('#se-inv-toolbar')) return;
    const anchor = SE.$('#inventory_pagecontrols') || SE.$('#tabcontent_inventory') || SE.$('#inventories');
    if (!anchor) return;
    const showSortGroup = SE.ctx?.settings.showTileSortGroup;
    const bar = SE.el('div', { id: 'se-inv-toolbar', class: 'se-toolbar' },
      SE.el('button', { class: 'se-btn', onclick: showValue }, SE.t('estimateValue')),
      SE.el('button', { class: 'se-btn', onclick: showValueHistory }, SE.t('valueHistoryBtn')),
      SE.el('button', { class: 'se-btn', onclick: findDuplicates }, SE.t('findDuplicates')),
      SE.el('button', { class: 'se-btn', onclick: selectDuplicatesUI }, SE.t('markDuplicates')),
      SE.el('button', { class: 'se-btn', onclick: cardSetProgress }, SE.t('cardSetProgress')),
      showSortGroup ? SE.el('button', { class: 'se-btn', onclick: sortTilesByValue }, SE.t('sortByValueBtn')) : null,
      showSortGroup ? SE.el('button', { class: 'se-btn', onclick: groupTilesByType }, SE.t('groupByTypeBtn')) : null,
      showSortGroup ? SE.el('button', { class: 'se-btn', onclick: rarityBreakdown }, SE.t('rarityBreakdownBtn')) : null,
      SE.el('button', { class: 'se-btn', onclick: massListMedian }, SE.t('massListBtn')),
      SE.el('button', { class: 'se-btn', id: 'se-inv-selmode', onclick: toggleSelectMode }, SE.t('selectItemsBtn')),
      SE.el('button', { class: 'se-btn', onclick: prepareSelectedListing }, SE.t('listSelectedBtn')),
      SE.el('button', { class: 'se-btn', onclick: openBoosterCreator }, SE.t('boosterPackCreator')),
      SE.el('button', { class: 'se-btn', onclick: stickerHelper }, SE.t('cs2StickerBtn')),
      SE.el('button', { class: 'se-btn', onclick: exportInventory }, SE.t('exportJsonBtn')),
      SE.el('input', { type: 'search', id: 'se-inv-filter', placeholder: SE.t('filterByName'), class: 'se-input' }),
      SE.el('span', { id: 'se-inv-out', class: 'se-muted' }, '')
    );
    anchor.parentElement?.insertBefore(bar, anchor);
    SE.$('#se-inv-filter').addEventListener('input', SE.debounce(async (e) => {
      const q = e.target.value.toLowerCase().trim();
      const items = q ? await getItems() : null;
      for (const tile of SE.$$('.itemHolder')) {
        if (!assetIdFromTile(tile)) continue; // empty slot
        const name = ((items && itemForTile(tile, items)?.name) || '').toLowerCase();
        tile.style.display = (!q || name.includes(q)) ? '' : 'none';
      }
    }, 150));
  }

  function tileContainer() {
    const anyTile = SE.$('.itemHolder, .inventory_item_link');
    return anyTile?.parentElement || null;
  }

  function assetIdFromTile(tile) {
    // Steam inventory tile ids look like "160_2_10995123456" (appid_contextid_assetid),
    // on the tile itself or on the .item inside an .itemHolder.
    const id = tile.id || tile.querySelector('.item')?.id || '';
    const m = id.match(/(\d+)_(\d+)_(\d+)$/);
    return m ? m[3] : null;
  }

  // The item behind a tile, by asset id. (Tile images used to carry the item
  // name as alt text; they don't any more, so names can't be matched.)
  function itemForTile(tile, items) {
    const id = assetIdFromTile(tile);
    return id ? items.find((i) => String(i.id) === id) || null : null;
  }

  // The item-detail pane Steam is showing: it alternates between #iteminfo0
  // and #iteminfo1 and hides the other one. The pane's content is now React,
  // with the item name in its <h1>.
  function visibleInfoPane() {
    return [SE.$('#iteminfo0'), SE.$('#iteminfo1')].find((p) => p && p.offsetParent !== null)
      || SE.$('.inventory_iteminfo.activeInfo');
  }
  const paneItemName = (pane) =>
    (pane.querySelector('h1')?.textContent || pane.querySelector('.hover_item_name')?.textContent || '').trim();

  async function getItems(force = false) {
    // Switching games (#730 → #753) is only a hash change: the items read
    // before belong to the previous game's inventory.
    if (cachedItems && !force && cachedFor === location.hash) return cachedItems;
    // Each item carries its own contextid (Steam items are context 6, not 2) —
    // see inventoryItems in page-bridge.js.
    const r = await SE.pageCall('inventoryItems');
    if (r?.ok && r.result) {
      cachedItems = r.result.items;
      cachedFor = location.hash;
      cachedOwnerId = r.result.owner || cachedOwnerId;
    } else {
      cachedItems = null;
    }
    return cachedItems;
  }

  async function showValue() {
    const out = SE.$('#se-inv-out');
    out.textContent = SE.t('invSampling');
    const items = await getItems(true);
    if (!items) { out.textContent = SE.t('invReadFailed'); return; }
    const marketable = items.filter(i => i.marketable);
    let total = 0, counted = 0;
    for (const it of marketable.slice(0, 25)) {
      const p = await SE.api.marketPriceOverview(it.appid, it.market_hash_name);
      const val = SE.parsePrice(p?.data?.median_price || p?.data?.lowest_price);
      if (val != null) { total += val * (it.amount || 1); counted++; }
    }
    const avg = counted ? total / counted : 0;
    const estimate = avg * marketable.length;
    out.textContent = SE.t('invValueResult', counted, avg.toFixed(2), marketable.length, estimate.toFixed(2));
    if (counted) SE.safe('inv:valueSnapshot', () => recordValueSnapshot(estimate));
  }

  async function findDuplicates() {
    const items = await getItems();
    if (!items) return;
    const map = new Map();
    for (const it of items) {
      const k = it.market_hash_name || it.name;
      if (!k) continue;
      map.set(k, (map.get(k) || 0) + (it.amount || 1));
    }
    const dups = [...map.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 25);
    const out = SE.$('#se-inv-out');
    out.innerHTML = '';
    if (!dups.length) { out.textContent = SE.t('invNoDuplicates'); return; }
    dups.forEach(([k, n]) => out.appendChild(SE.el('div', null, `${n}× ${k}`)));
  }

  async function selectDuplicatesUI() {
    const items = await getItems();
    if (!items) return;
    const counts = new Map();
    items.forEach(it => {
      const k = it.market_hash_name || it.name;
      if (k) counts.set(k, (counts.get(k) || 0) + 1);
    });
    let marked = 0;
    for (const tile of SE.$$('.itemHolder')) {
      const it = itemForTile(tile, items);
      const name = it && (it.market_hash_name || it.name);
      if (name && counts.get(name) > 1) {
        tile.style.outline = '2px solid #b07a1f';
        marked++;
      }
    }
    SE.$('#se-inv-out').textContent = SE.t('invMarkedDuplicates', marked);
  }

  async function cardSetProgress() {
    const items = await getItems();
    if (!items) return;
    const cards = items.filter(i => (i.tags || []).some(t => /trading card/i.test(t.name)));
    const byGame = new Map();
    for (const c of cards) {
      const game = (c.tags || []).find(t => !/trading card|foil|series/i.test(t.name))?.name || c.market_hash_name?.split(' - ')[0] || 'Unknown';
      const entry = byGame.get(game) || { unique: new Set(), total: 0 };
      entry.unique.add(c.market_hash_name);
      entry.total += (c.amount || 1);
      byGame.set(game, entry);
    }
    const out = SE.$('#se-inv-out');
    out.innerHTML = '';
    if (!byGame.size) { out.textContent = SE.t('invNoCards'); return; }
    [...byGame.entries()].slice(0, 12).forEach(([game, info]) => {
      out.appendChild(SE.el('div', null, `${game}: ${info.unique.size} unique (${info.total} total)`));
    });
  }

  // --- Sort / group tiles -------------------------------------------------

  async function sortTilesByValue() {
    const out = SE.$('#se-inv-out');
    const container = tileContainer();
    if (!container) { out.textContent = SE.t('invNoTiles'); return; }
    const items = await getItems();
    if (!items) { out.textContent = SE.t('invReadFailed'); return; }
    out.textContent = SE.t('invPricingForSort');
    const tiles = SE.$$('.itemHolder').filter((t) => assetIdFromTile(t)).slice(0, 60);
    const valueCache = new Map();
    for (const tile of tiles) {
      const it = itemForTile(tile, items);
      let val = 0;
      if (it?.marketable && it.market_hash_name) {
        const key = it.appid + ':' + it.market_hash_name;
        val = valueCache.get(key);
        if (val == null) {
          const p = await SE.api.marketPriceOverview(it.appid, it.market_hash_name);
          val = SE.parsePrice(p?.data?.median_price || p?.data?.lowest_price) || 0;
          valueCache.set(key, val);
        }
      }
      tile.dataset.seValue = String(val);
    }
    const sorted = tiles.slice().sort((a, b) => (+b.dataset.seValue || 0) - (+a.dataset.seValue || 0));
    sorted.forEach(t => container.appendChild(t));
    out.textContent = SE.t('invSorted', sorted.length);
  }

  async function groupTilesByType() {
    const out = SE.$('#se-inv-out');
    const container = tileContainer();
    if (!container) { out.textContent = SE.t('invNoTiles'); return; }
    const items = await getItems();
    if (!items) { out.textContent = SE.t('invReadFailed'); return; }
    const groupOf = (it) => it?.tags?.find(t => t.category === 'Type')?.name
      || it?.tags?.[0]?.name
      || 'Other';

    const tiles = SE.$$('.itemHolder').filter((t) => assetIdFromTile(t));
    const groups = new Map();
    for (const tile of tiles) {
      const group = groupOf(itemForTile(tile, items));
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(tile);
    }
    [...groups.keys()].sort().forEach(g => groups.get(g).forEach(t => container.appendChild(t)));
    out.textContent = SE.t('invGrouped', tiles.length, groups.size, [...groups.keys()].slice(0, 6).join(', ') + (groups.size > 6 ? '…' : ''));
  }

  // Report-only (doesn't reorder tiles): counts items by Rarity/Quality tag
  // category — the categories CS2/TF2/Dota use for wear tiers, rarities, etc.
  async function rarityBreakdown() {
    const out = SE.$('#se-inv-out');
    const items = await getItems();
    if (!items) { out.textContent = SE.t('invReadFailed'); return; }
    const counts = new Map();
    for (const it of items) {
      const tier = it.tags?.find(t => t.category === 'Rarity' || t.category === 'Quality')?.name || 'Unknown';
      counts.set(tier, (counts.get(tier) || 0) + (it.amount || 1));
    }
    out.innerHTML = '';
    if (!counts.size) { out.textContent = SE.t('invNoRarity'); return; }
    [...counts.entries()].sort((a, b) => b[1] - a[1]).forEach(([tier, n]) => {
      out.appendChild(SE.el('div', null, `${tier}: ${n}`));
    });
  }

  // --- Manual multi-select for listing ------------------------------------

  let selectMode = false;
  const selectedIds = new Set();

  function toggleSelectMode() {
    selectMode = !selectMode;
    const btn = SE.$('#se-inv-selmode');
    if (btn) btn.textContent = selectMode ? SE.t('selectingBtn') : SE.t('selectItemsBtn');
    if (!selectMode) SE.$$('.se-select-checkbox').forEach(cb => cb.remove());
    else renderSelectionOverlays();
    SE.$('#se-inv-out').textContent = selectMode ? SE.t('invSelectionOn', selectedIds.size) : '';
  }

  function renderSelectionOverlays() {
    if (!selectMode) return;
    for (const tile of SE.$$('.itemHolder, .inventory_item_link')) {
      if (tile.querySelector('.se-select-checkbox')) continue;
      const assetid = assetIdFromTile(tile);
      if (!assetid) continue;
      tile.style.position = tile.style.position || 'relative';
      tile.appendChild(SE.el('input', {
        type: 'checkbox', class: 'se-select-checkbox',
        checked: selectedIds.has(assetid),
        onclick: (e) => {
          e.stopPropagation();
          if (e.target.checked) selectedIds.add(assetid); else selectedIds.delete(assetid);
          const out = SE.$('#se-inv-out');
          if (out) out.textContent = SE.t('invSelectionOn', selectedIds.size);
        }
      }));
    }
  }

  async function prepareSelectedListing() {
    const out = SE.$('#se-inv-out');
    if (!selectedIds.size) { out.textContent = SE.t('invNoneSelected'); return; }
    const items = await getItems(true);
    if (!items) { out.textContent = SE.t('invReadFailed'); return; }
    const chosen = items.filter(i => selectedIds.has(String(i.id)) && i.marketable && i.market_hash_name);
    if (!chosen.length) { out.textContent = SE.t('invNoneMarketableSelected'); return; }
    const wallet = await requireWallet(out);
    if (!wallet) return;

    out.innerHTML = '';
    out.appendChild(SE.el('div', { class: 'se-label' }, SE.t('invPricingSelected', chosen.length)));

    const plan = [];
    for (const it of chosen) {
      const p = await SE.api.marketPriceOverview(it.appid, it.market_hash_name, 'US', wallet.id);
      const med = SE.parsePrice(p?.data?.median_price) || SE.parsePrice(p?.data?.lowest_price) || 0;
      // The input is the buyer price, like every price on the market; the
      // label next to it shows what you'd actually receive.
      const priceInput = SE.el('input', {
        type: 'number', step: '0.01', min: '0.03', class: 'se-input', style: { width: '70px' },
        value: med > 0.03 ? (med - 0.01).toFixed(2) : '0.03'
      });
      const receive = SE.el('span', { class: 'se-muted' });
      const update = () => { receive.textContent = ' ' + receiveLabel(Math.round((parseFloat(priceInput.value) || 0) * 100), wallet.iso); };
      priceInput.addEventListener('input', update);
      update();
      plan.push({ it, priceInput });
      out.appendChild(SE.el('div', { class: 'se-row' },
        `${it.market_hash_name} (${SE.t('medianWord')} ${med ? SE.formatMoney(med, wallet.iso) : '—'}) → `, priceInput, receive
      ));
    }

    out.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('button', {
        class: 'se-btn',
        style: { background: 'linear-gradient(to bottom,#c25555 5%,#7a3434 95%)' },
        onclick: (e) => {
          e.target.disabled = true;
          const finalPlan = plan.map(p => ({
            it: p.it,
            buyerCents: Math.max(3, Math.round((parseFloat(p.priceInput.value) || 0) * 100))
          }));
          executeListing(finalPlan, out);
          selectedIds.clear();
          selectMode = false;
          SE.$$('.se-select-checkbox').forEach(cb => cb.remove());
          const btn = SE.$('#se-inv-selmode');
          if (btn) btn.textContent = SE.t('selectItemsBtn');
        }
      }, SE.t('invConfirmSelected', plan.length))
    ));
  }

  // --- Value-over-time -----------------------------------------------------

  const VALUE_HISTORY_KEY = 'se_inventory_value_history_v1';

  async function recordValueSnapshot(estimate) {
    const key = location.pathname;
    const all = await new Promise((r) => chrome.storage.local.get([VALUE_HISTORY_KEY], (d) => r(d[VALUE_HISTORY_KEY] || {})));
    const list = [...(all[key] || []), { ts: Date.now(), v: estimate }].slice(-30);
    all[key] = list;
    chrome.storage.local.set({ [VALUE_HISTORY_KEY]: all });
  }

  async function showValueHistory() {
    const out = SE.$('#se-inv-out');
    const key = location.pathname;
    const all = await new Promise((r) => chrome.storage.local.get([VALUE_HISTORY_KEY], (d) => r(d[VALUE_HISTORY_KEY] || {})));
    const list = all[key] || [];
    out.innerHTML = '';
    if (list.length < 2) { out.textContent = SE.t('invFewSnapshots', list.length); return; }
    const wallet = await SE.walletCurrency();
    out.appendChild(SE.priceChart(list.map(p => ({ t: p.ts, v: p.v })), { currency: wallet.iso, step: false }));
    out.appendChild(SE.el('div', { class: 'se-muted' }, SE.t('invSnapshotsRecorded', list.length)));
  }

  function openBoosterCreator() {
    window.open('https://steamcommunity.com/tradingcards/boostercreator/', '_blank');
  }
  async function stickerHelper() {
    const items = [...new Set((await getItems() || []).map((i) => i.market_hash_name || i.name)
      .filter((n) => n && /\bSticker\b/i.test(n)))];
    const out = SE.$('#se-inv-out');
    if (!items.length) { out.textContent = SE.t('invNoStickers'); return; }
    out.innerHTML = '';
    items.slice(0, 12).forEach(name => {
      out.appendChild(SE.el('div', null,
        SE.el('a', { href: `https://steamcommunity.com/market/listings/730/${encodeURIComponent(name)}`, target: '_blank', rel: 'noopener', class: 'se-link' }, name)
      ));
    });
  }

  // Two-phase by design: phase 1 is a DRY RUN that only fetches prices and shows
  // a preview table. Nothing is sold until the user clicks the explicit confirm
  // button rendered after the preview. This prevents an accidental bulk sale if a
  // selector (asset id / appid) is wrong.
  async function massListMedian() {
    const out = SE.$('#se-inv-out');
    const items = await getItems(true);
    if (!items) { out.textContent = SE.t('invReadFailed'); return; }
    const marketable = items.filter(i => i.marketable && i.market_hash_name && i.id && i.contextid);
    const candidates = marketable.slice(0, 10);
    if (!candidates.length) { out.textContent = SE.t('invNoMarketable'); return; }
    const wallet = await requireWallet(out);
    if (!wallet) return;

    out.innerHTML = '';
    out.appendChild(SE.el('div', { class: 'se-label' }, SE.t('invDryRun', candidates.length)));

    const plan = [];
    for (const it of candidates) {
      // Median in the wallet currency (marketPriceOverview defaults to it).
      const p = await SE.api.marketPriceOverview(it.appid, it.market_hash_name, 'US', wallet.id);
      const med = SE.parsePrice(p?.data?.median_price);
      if (med == null || med <= 0.03) continue;
      // One cent under the median, as the buyer sees it.
      const buyerCents = Math.max(3, Math.round(med * 100) - 1);
      plan.push({ it, buyerCents });
      out.appendChild(SE.el('div', null,
        `• ${it.amount > 1 ? `${it.amount}× ` : ''}${it.market_hash_name} (${SE.t('medianWord')} ${SE.formatMoney(med, wallet.iso)}) → ${receiveLabel(buyerCents, wallet.iso)}${it.amount > 1 ? ` ${SE.t('perItemWord')}` : ''}`
      ));
    }

    if (!plan.length) { out.appendChild(SE.el('div', { class: 'se-muted' }, SE.t('invNoMedian'))); return; }

    out.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('button', {
        class: 'se-btn',
        style: { background: 'linear-gradient(to bottom,#c25555 5%,#7a3434 95%)' },
        onclick: (e) => { e.target.disabled = true; executeListing(plan, out); }
      }, SE.t('invConfirmMassList', plan.length))
    ));
    out.appendChild(SE.el('div', { class: 'se-muted' }, SE.t('invCancelHint')));
  }

  // Quick sell (one cent under the cheapest listing) and instant sell (at the
  // highest buy order, which fills right away) for the item open in the detail
  // pane. Each shows "buyer pays / you receive" and needs a second click.
  async function addQuickSell(sel) {
    const r = await SE.pageCall('selectedItem');
    const it = r?.ok ? r.result : null;
    if (!it?.marketable || !it.market_hash_name || !it.contextid) return;
    if (sel.querySelector('.se-qs')) return;
    const out = SE.el('div', { class: 'se-qs-out se-muted' });
    const box = SE.el('div', { class: 'se-qs se-inv-added' },
      SE.el('button', { class: 'se-btn', onclick: () => prepare('quick') }, SE.t('quickSellBtn')),
      ' ',
      SE.el('button', { class: 'se-btn', onclick: () => prepare('instant') }, SE.t('instantSellBtn')),
      out);
    sel.appendChild(box);

    async function prepare(kind) {
      out.textContent = SE.t('mktFetching');
      const wallet = await requireWallet(out);
      if (!wallet) return;
      let buyerCents = null;
      if (kind === 'quick') {
        const p = await SE.api.marketPriceOverview(it.appid, it.market_hash_name, 'US', wallet.id);
        buyerCents = SE.marketMath.quickSellBuyerCents(SE.marketMath.cents(SE.parsePrice(p?.data?.lowest_price)));
      } else {
        const nameId = await SE.api.itemNameId(it.appid, it.market_hash_name);
        // Steam's Market Beta item page doesn't carry the order-book id.
        if (!nameId) { out.textContent = SE.t('qsNoOrderBook'); return; }
        const h = await SE.api.itemOrdersHistogram(nameId, 'US', wallet.id);
        buyerCents = SE.marketMath.instantSellBuyerCents(h?.data?.highest_buy_order);
      }
      if (buyerCents == null) { out.textContent = SE.t(kind === 'quick' ? 'qsNoListings' : 'qsNoBuyOrders'); return; }
      out.textContent = '';
      const confirm = SE.el('button', { class: 'se-btn se-btn-danger' }, SE.t('qsConfirm'));
      confirm.addEventListener('click', async () => {
        confirm.disabled = true;
        // Sell what's selected now — another copy of the same item is fine (the
        // price is per item), anything else means the selection moved on.
        const cur = (await SE.pageCall('selectedItem'))?.result;
        if (!cur || cur.market_hash_name !== it.market_hash_name || cur.appid !== it.appid || cur.contextid !== it.contextid) {
          out.textContent = SE.t('qsSelectionChanged');
          return;
        }
        const res = await SE.pageCall('sellItem', {
          appid: cur.appid, contextid: cur.contextid, assetid: cur.id, amount: 1,
          price: SE.marketFees.sellerReceives(buyerCents)
        });
        out.textContent = res?.result?.success
          ? SE.t(res.result.requires_confirmation ? 'qsListedConfirm' : 'qsListed')
          : SE.t('qsFailed', res?.result?.message || res?.error || '?');
      });
      out.append(
        SE.el('div', null, `${it.name || it.market_hash_name}: ${receiveLabel(buyerCents, wallet.iso)}`),
        confirm, ' ',
        SE.el('button', { class: 'se-btn', onclick: () => { out.textContent = ''; } }, SE.t('cancelWord'))
      );
    }
  }

  // Selling moves real money, so refuse outright unless we've actually seen the
  // wallet currency (g_rgWalletInfo) — never list using a guessed currency.
  async function requireWallet(out) {
    const wallet = await SE.walletCurrency();
    if (!wallet.known) { out.textContent = SE.t('walletUnknown'); return null; }
    return wallet;
  }

  function receiveLabel(buyerCents, iso) {
    const receive = SE.marketFees.sellerReceives(buyerCents);
    return `${SE.t('buyerPaysWord')} ${SE.formatMoney(buyerCents / 100, iso)} · ${SE.t('youReceiveWord')} ${SE.formatMoney(receive / 100, iso)}`;
  }

  // Plan entries carry the price the BUYER pays (what the market shows). The
  // sellitem endpoint takes what the SELLER receives, after fees — 1.4.x sent
  // the buyer price there, listing everything ~15% above what was shown.
  async function executeListing(plan, out) {
    let listed = 0;
    const status = SE.el('div', null, SE.t('invListing'));
    out.appendChild(status);
    for (const { it, buyerCents } of plan) {
      const receiveCents = SE.marketFees.sellerReceives(buyerCents);
      if (receiveCents < 1 || !it.contextid) continue;
      const r = await SE.pageCall('sellItem', {
        appid: it.appid, contextid: it.contextid, assetid: it.id, amount: it.amount || 1, price: receiveCents
      });
      if (r?.result?.success) listed++;
      await SE.sleep(1500); // rate-limit-friendly
    }
    status.textContent = SE.t('invListedResult', listed, plan.length);
  }

  async function exportInventory() {
    const items = await getItems(true);
    if (!items) return alert(SE.t('invReadFailed'));
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'steam-inventory.json'; a.click();
  }

  let tilesBusy = false;
  async function decorateTiles() {
    if (tilesBusy) return;
    // Only tiles on the visible page, a few per pass. The market endpoint
    // allows one request every 2.5 s (service worker), so pricing every tile
    // of a big inventory would queue minutes of requests ahead of a quick sell.
    const tiles = SE.$$('.itemHolder:not([data-se-priced])').filter((t) => t.offsetParent !== null).slice(0, 6);
    if (!tiles.length) return;
    tilesBusy = true;
    try { await priceTiles(tiles); } finally { tilesBusy = false; }
  }
  async function priceTiles(tiles) {
    const items = await getItems();
    if (!items) return;
    for (const tile of tiles) {
      tile.setAttribute('data-se-priced', '1');
      const it = itemForTile(tile, items);
      if (!it?.marketable) continue;
      const p = await SE.api.marketPriceOverview(it.appid, it.market_hash_name);
      const v = p?.data?.median_price || p?.data?.lowest_price;
      if (v) {
        const lbl = SE.el('div', { class: 'se-tile-price' }, v);
        tile.style.position = 'relative';
        tile.appendChild(lbl);
      }
    }
  }

  async function decorateSelected() {
    const sel = visibleInfoPane();
    if (!sel) return;
    const stamp = sel.id + paneItemName(sel);
    if (sel.dataset.seDone === stamp) return;
    sel.dataset.seDone = stamp;
    // Steam alternates between two info panes and refills them in place, so
    // the buttons added for the item shown here before are still in it — and
    // the quick-sell box would sell THAT item. Start clean.
    sel.querySelectorAll('.se-inv-added').forEach((n) => n.remove());

    const name = paneItemName(sel);
    if (!name) return;
    // The hash is "#730" or "#753_6" (game, context), and empty on first load,
    // when the selected game tab says it; older pages used
    // "#inventory_<steamid>_<appid>".
    const appidMatch = location.hash.match(/^#(\d+)/)
      || location.hash.match(/inventory_[^_]+_(\d+)/)
      || SE.$('.games_list_tab.active')?.id.match(/inventory_link_(\d+)/)
      || sel.querySelector('a[href*="/market/listings/"]')?.href.match(/listings\/(\d+)\//);
    const appid = appidMatch?.[1];
    if (!appid) return;
    // The market page is keyed by market_hash_name, which can differ from the
    // display name (CS2 wear, item renames).
    const selected = (await SE.pageCall('selectedItem'))?.result;
    const hashName = (selected?.name === name && selected.market_hash_name) || name;
    sel.appendChild(SE.el('a', {
      class: 'se-btn se-quicksell se-inv-added',
      href: `https://steamcommunity.com/market/listings/${appid}/${encodeURIComponent(hashName)}`,
      target: '_blank', rel: 'noopener'
    }, SE.t('viewOnMarket')));
    if (SE.ctx?.settings.enableQuickSell) SE.safe('inv:quickSell', () => addQuickSell(sel));

    // CSGO-specific inspect link / float lookup helper. Prefer the exact
    // per-item inspect link (Steam embeds one per asset) so CSFloat opens the
    // precise item rather than a generic name search.
    if (appid === '730') {
      // The selected asset itself — several items can share a name.
      const selected = (await SE.pageCall('selectedItem'))?.result;
      const items = await getItems();
      const it = items?.find(x => String(x.id) === String(selected?.id)) || items?.find(x => x.name === name);
      const inspectAction = it?.actions?.find(a => /inspect/i.test(a.name || ''));
      if (inspectAction?.link && cachedOwnerId && it?.id) {
        const inspectLink = inspectAction.link
          .replace('%owner_steamid%', cachedOwnerId)
          .replace('%assetid%', it.id);
        sel.appendChild(SE.el('a', {
          class: 'se-btn se-inv-added',
          href: `https://csfloat.com/checkout/inspect?url=${encodeURIComponent(inspectLink)}`,
          target: '_blank', rel: 'noopener'
        }, 'CSFloat (this exact item)'));
      } else {
        sel.appendChild(SE.el('a', {
          class: 'se-btn se-inv-added',
          href: `https://csfloat.com/search?market_hash_name=${encodeURIComponent(name)}`,
          target: '_blank', rel: 'noopener'
        }, 'CSFloat'));
      }
    }

    // Backpack.tf for TF2.
    if (appid === '440') {
      sel.appendChild(SE.el('a', {
        class: 'se-btn se-inv-added',
        href: `https://backpack.tf/stats/Unique/${encodeURIComponent(name)}/Tradable/Craftable`,
        target: '_blank', rel: 'noopener'
      }, 'Backpack.tf'));
    }
  }
})();
