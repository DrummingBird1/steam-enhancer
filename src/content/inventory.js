(function () {
  'use strict';
  const SE = window.SteamEnhancer;

  SE.onReady(() => init());

  let cachedItems = null;
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
      SE.el('button', { class: 'se-btn', onclick: showValue }, 'Estimate value'),
      SE.el('button', { class: 'se-btn', onclick: showValueHistory }, 'Value history'),
      SE.el('button', { class: 'se-btn', onclick: findDuplicates }, 'Find duplicates'),
      SE.el('button', { class: 'se-btn', onclick: selectDuplicatesUI }, 'Mark duplicates'),
      SE.el('button', { class: 'se-btn', onclick: cardSetProgress }, 'Card set progress'),
      showSortGroup ? SE.el('button', { class: 'se-btn', onclick: sortTilesByValue }, 'Sort by value ↓') : null,
      showSortGroup ? SE.el('button', { class: 'se-btn', onclick: groupTilesByType }, 'Group by type') : null,
      showSortGroup ? SE.el('button', { class: 'se-btn', onclick: rarityBreakdown }, 'Rarity/quality breakdown') : null,
      SE.el('button', { class: 'se-btn', onclick: massListMedian }, 'Mass-list at median…'),
      SE.el('button', { class: 'se-btn', id: 'se-inv-selmode', onclick: toggleSelectMode }, 'Select items to sell'),
      SE.el('button', { class: 'se-btn', onclick: prepareSelectedListing }, 'List selected…'),
      SE.el('button', { class: 'se-btn', onclick: openBoosterCreator }, 'Booster creator'),
      SE.el('button', { class: 'se-btn', onclick: stickerHelper }, 'CS2 sticker prices'),
      SE.el('button', { class: 'se-btn', onclick: exportInventory }, 'Export JSON'),
      SE.el('input', { type: 'search', id: 'se-inv-filter', placeholder: 'Filter by name…', class: 'se-input' }),
      SE.el('span', { id: 'se-inv-out', class: 'se-muted' }, '')
    );
    anchor.parentElement?.insertBefore(bar, anchor);
    SE.$('#se-inv-filter').addEventListener('input', SE.debounce((e) => {
      const q = e.target.value.toLowerCase().trim();
      for (const tile of SE.$$('.itemHolder, .inventory_item_link')) {
        const name = (tile.querySelector('.hover_item_name')?.textContent || tile.innerText || '').toLowerCase();
        tile.style.display = (!q || name.includes(q)) ? '' : 'none';
      }
    }, 150));
  }

  function tileContainer() {
    const anyTile = SE.$('.itemHolder, .inventory_item_link');
    return anyTile?.parentElement || null;
  }

  function assetIdFromTile(tile) {
    // Steam inventory tile ids look like "160_2_10995123456" (appid_contextid_assetid).
    const m = (tile.id || '').match(/(\d+)_(\d+)_(\d+)$/);
    return m ? m[3] : null;
  }

  async function getItems(force = false) {
    if (cachedItems && !force) return cachedItems;
    const r = await SE.injectPage(() => {
      try {
        const inv = window.g_ActiveInventory;
        if (!inv?.rgInventory) return null;
        const items = Object.values(inv.rgInventory).map(it => {
          const d = inv.rgDescriptions[it.classid + '_' + it.instanceid] || {};
          return {
            id: it.id, classid: it.classid, instanceid: it.instanceid,
            amount: it.amount, appid: inv.appid,
            market_hash_name: d.market_hash_name, name: d.name,
            tradable: d.tradable, marketable: d.marketable,
            tags: (d.tags || []).map(t => ({ category: t.category, name: t.localized_tag_name || t.name })),
            actions: d.actions || []
          };
        });
        return { items, owner: inv.m_owner && inv.m_owner.strSteamId };
      } catch { return null; }
    });
    if (r?.ok && r.result) {
      cachedItems = r.result.items;
      cachedOwnerId = r.result.owner || cachedOwnerId;
    } else {
      cachedItems = null;
    }
    return cachedItems;
  }

  async function showValue() {
    const out = SE.$('#se-inv-out');
    out.textContent = 'Sampling first 25 marketable items…';
    const items = await getItems(true);
    if (!items) { out.textContent = 'Could not read inventory.'; return; }
    const marketable = items.filter(i => i.marketable);
    let total = 0, counted = 0;
    for (const it of marketable.slice(0, 25)) {
      const p = await SE.api.marketPriceOverview(it.appid, it.market_hash_name);
      const val = SE.parsePrice(p?.data?.median_price || p?.data?.lowest_price);
      if (val != null) { total += val * (it.amount || 1); counted++; }
    }
    const avg = counted ? total / counted : 0;
    const estimate = avg * marketable.length;
    out.textContent = `Sampled ${counted}/25 · avg ≈ ${avg.toFixed(2)} · ${marketable.length} marketable · estimate ≈ ${estimate.toFixed(2)}`;
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
    if (!dups.length) { out.textContent = 'No duplicates.'; return; }
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
    for (const tile of SE.$$('.itemHolder, .inventory_item_link')) {
      const name = tile.querySelector('.hover_item_name')?.textContent
                 || tile.querySelector('img')?.alt
                 || '';
      if (name && counts.get(name) > 1) {
        tile.style.outline = '2px solid #b07a1f';
        marked++;
      }
    }
    SE.$('#se-inv-out').textContent = `Marked ${marked} duplicate tiles in amber.`;
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
    if (!byGame.size) { out.textContent = 'No trading cards in current inventory view.'; return; }
    [...byGame.entries()].slice(0, 12).forEach(([game, info]) => {
      out.appendChild(SE.el('div', null, `${game}: ${info.unique.size} unique (${info.total} total)`));
    });
  }

  // --- Sort / group tiles -------------------------------------------------

  async function sortTilesByValue() {
    const out = SE.$('#se-inv-out');
    const container = tileContainer();
    if (!container) { out.textContent = 'No inventory tiles found.'; return; }
    const items = await getItems();
    if (!items) { out.textContent = 'Could not read inventory.'; return; }
    const byName = new Map(items.map(i => [i.name, i]));

    out.textContent = 'Pricing tiles for sort (first 60)…';
    const tiles = SE.$$('.itemHolder, .inventory_item_link').slice(0, 60);
    const valueCache = new Map();
    for (const tile of tiles) {
      const name = tile.querySelector('img')?.alt || tile.querySelector('.hover_item_name')?.textContent;
      const it = name && byName.get(name);
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
    out.textContent = `Sorted ${sorted.length} tiles by estimated value (highest first).`;
  }

  async function groupTilesByType() {
    const out = SE.$('#se-inv-out');
    const container = tileContainer();
    if (!container) { out.textContent = 'No inventory tiles found.'; return; }
    const items = await getItems();
    if (!items) { out.textContent = 'Could not read inventory.'; return; }
    const byName = new Map(items.map(i => [i.name, i]));

    const groupOf = (it) => it?.tags?.find(t => t.category === 'Type')?.name
      || it?.tags?.[0]?.name
      || 'Other';

    const tiles = SE.$$('.itemHolder, .inventory_item_link');
    const groups = new Map();
    for (const tile of tiles) {
      const name = tile.querySelector('img')?.alt || tile.querySelector('.hover_item_name')?.textContent;
      const group = groupOf(byName.get(name));
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(tile);
    }
    [...groups.keys()].sort().forEach(g => groups.get(g).forEach(t => container.appendChild(t)));
    out.textContent = `Grouped ${tiles.length} tiles into ${groups.size} type(s): ${[...groups.keys()].slice(0, 6).join(', ')}${groups.size > 6 ? '…' : ''}`;
  }

  // Report-only (doesn't reorder tiles): counts items by Rarity/Quality tag
  // category — the categories CS2/TF2/Dota use for wear tiers, rarities, etc.
  async function rarityBreakdown() {
    const out = SE.$('#se-inv-out');
    const items = await getItems();
    if (!items) { out.textContent = 'Could not read inventory.'; return; }
    const counts = new Map();
    for (const it of items) {
      const tier = it.tags?.find(t => t.category === 'Rarity' || t.category === 'Quality')?.name || 'Unknown';
      counts.set(tier, (counts.get(tier) || 0) + (it.amount || 1));
    }
    out.innerHTML = '';
    if (!counts.size) { out.textContent = 'No rarity/quality tags found on items in this inventory.'; return; }
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
    if (btn) btn.textContent = selectMode ? 'Selecting… (click to stop)' : 'Select items to sell';
    if (!selectMode) SE.$$('.se-select-checkbox').forEach(cb => cb.remove());
    else renderSelectionOverlays();
    SE.$('#se-inv-out').textContent = selectMode ? `Selection mode on — ${selectedIds.size} selected` : '';
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
          if (out) out.textContent = `Selection mode on — ${selectedIds.size} selected`;
        }
      }));
    }
  }

  async function prepareSelectedListing() {
    const out = SE.$('#se-inv-out');
    if (!selectedIds.size) { out.textContent = 'No items selected. Click "Select items to sell", then click checkboxes on tiles.'; return; }
    const items = await getItems(true);
    if (!items) { out.textContent = 'Could not read inventory.'; return; }
    const chosen = items.filter(i => selectedIds.has(String(i.id)) && i.marketable && i.market_hash_name);
    if (!chosen.length) { out.textContent = 'None of the selected items are marketable.'; return; }

    out.innerHTML = '';
    out.appendChild(SE.el('div', { class: 'se-label' }, `Pricing ${chosen.length} selected item(s) — edit prices below, nothing listed yet.`));

    const plan = [];
    for (const it of chosen) {
      const p = await SE.api.marketPriceOverview(it.appid, it.market_hash_name);
      const med = SE.parsePrice(p?.data?.median_price) || SE.parsePrice(p?.data?.lowest_price) || 0;
      const priceInput = SE.el('input', {
        type: 'number', step: '0.01', min: '0.03', class: 'se-input', style: { width: '70px' },
        value: med > 0.03 ? (med - 0.01).toFixed(2) : '0.03'
      });
      plan.push({ it, priceInput });
      out.appendChild(SE.el('div', { class: 'se-row' },
        `${it.market_hash_name} (median ${med ? med.toFixed(2) : '—'}) → `, priceInput
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
            priceCents: Math.max(3, Math.round((parseFloat(p.priceInput.value) || 0) * 100))
          }));
          executeListing(finalPlan, out);
          selectedIds.clear();
          selectMode = false;
          SE.$$('.se-select-checkbox').forEach(cb => cb.remove());
          const btn = SE.$('#se-inv-selmode');
          if (btn) btn.textContent = 'Select items to sell';
        }
      }, `⚠ Confirm: list these ${plan.length} selected items`)
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
    if (list.length < 2) { out.textContent = `Only ${list.length} snapshot(s) so far — click "Estimate value" a few more times over the coming days to build a trend.`; return; }
    const svg = SE.sparklineSvg(list.map(p => ({ t: p.ts, v: p.v })), { labelLeft: `${list[0].v.toFixed(2)}` });
    out.appendChild(SE.el('div', { html: svg }));
    out.appendChild(SE.el('div', { class: 'se-muted' }, `${list.length} snapshots recorded from your own "Estimate value" clicks on this page.`));
  }

  function openBoosterCreator() {
    window.open('https://steamcommunity.com/tradingcards/boostercreator/', '_blank');
  }
  function stickerHelper() {
    const items = SE.$$('.itemHolder img').map(i => i.alt).filter(n => /\bSticker\b/i.test(n));
    const out = SE.$('#se-inv-out');
    if (!items.length) { out.textContent = 'No stickers visible (open your CS2 inventory).'; return; }
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
    if (!items) { out.textContent = 'Could not read inventory.'; return; }
    const marketable = items.filter(i => i.marketable && i.market_hash_name && i.id);
    const candidates = marketable.slice(0, 10);
    if (!candidates.length) { out.textContent = 'No marketable items in current view.'; return; }

    out.innerHTML = '';
    out.appendChild(SE.el('div', { class: 'se-label' }, `Dry run — pricing ${candidates.length} items (nothing listed yet)…`));

    const plan = [];
    for (const it of candidates) {
      const p = await SE.api.marketPriceOverview(it.appid, it.market_hash_name);
      const med = SE.parsePrice(p?.data?.median_price);
      if (med == null || med <= 0.03) continue;
      const priceCents = Math.max(3, Math.round((med - 0.01) * 100));
      plan.push({ it, med, priceCents });
      out.appendChild(SE.el('div', null,
        `• ${it.market_hash_name} (app ${it.appid}, asset ${it.id}) → list at ${(priceCents / 100).toFixed(2)} (median ${med.toFixed(2)})`
      ));
    }

    if (!plan.length) { out.appendChild(SE.el('div', { class: 'se-muted' }, 'No items had a usable median price.')); return; }

    out.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('button', {
        class: 'se-btn',
        style: { background: 'linear-gradient(to bottom,#c25555 5%,#7a3434 95%)' },
        onclick: (e) => { e.target.disabled = true; executeListing(plan, out); }
      }, `⚠ Confirm: actually list these ${plan.length} items for sale`)
    ));
    out.appendChild(SE.el('div', { class: 'se-muted' }, 'You can cancel any listing from the Market page. Listings still need mobile-authenticator confirmation.'));
  }

  async function executeListing(plan, out) {
    let listed = 0;
    const status = SE.el('div', null, 'Listing…');
    out.appendChild(status);
    for (const { it, priceCents } of plan) {
      const r = await SE.injectPage((appid, contextid, assetid, amount, price) => {
        return fetch('/market/sellitem/', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: `sessionid=${encodeURIComponent(g_sessionID)}&appid=${appid}&contextid=${contextid}&assetid=${assetid}&amount=${amount}&price=${price}`
        }).then(r => r.json()).catch(e => ({ error: String(e) }));
      }, [it.appid, 2, it.id, it.amount || 1, priceCents]);
      if (r?.result?.success) listed++;
      await SE.sleep(1500); // rate-limit-friendly
    }
    status.textContent = `Listed ${listed}/${plan.length}. Check the Market page and confirm via mobile authenticator.`;
  }

  async function exportInventory() {
    const items = await getItems(true);
    if (!items) return alert('Could not read inventory.');
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'steam-inventory.json'; a.click();
  }

  async function decorateTiles() {
    // Throttle: only do a few uncached lookups per pass.
    const tiles = SE.$$('.itemHolder:not([data-se-priced])').slice(0, 6);
    if (!tiles.length) return;
    const items = await getItems();
    if (!items) return;
    for (const tile of tiles) {
      tile.setAttribute('data-se-priced', '1');
      const name = tile.querySelector('img')?.alt;
      const it = items.find(x => x.name === name);
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
    const sel = SE.$('.inventory_iteminfo.activeInfo, #iteminfo1, #iteminfo0');
    if (!sel) return;
    const stamp = sel.id + (sel.querySelector('.hover_item_name')?.textContent || '');
    if (sel.dataset.seDone === stamp) return;
    sel.dataset.seDone = stamp;

    const name = sel.querySelector('.hover_item_name')?.textContent?.trim();
    if (!name) return;
    const appidMatch = location.hash.match(/inventory_[^_]+_(\d+)/)
      || sel.querySelector('a[href*="/market/listings/"]')?.href.match(/listings\/(\d+)\//);
    const appid = appidMatch?.[1];
    if (!appid) return;
    if (sel.querySelector('.se-quicksell')) return;

    sel.appendChild(SE.el('a', {
      class: 'se-btn se-quicksell',
      href: `https://steamcommunity.com/market/listings/${appid}/${encodeURIComponent(name)}`,
      target: '_blank', rel: 'noopener'
    }, 'View on Market'));

    // CSGO-specific inspect link / float lookup helper. Prefer the exact
    // per-item inspect link (Steam embeds one per asset) so CSFloat opens the
    // precise item rather than a generic name search.
    if (appid === '730') {
      const items = await getItems();
      const it = items?.find(x => x.name === name);
      const inspectAction = it?.actions?.find(a => /inspect/i.test(a.name || ''));
      if (inspectAction?.link && cachedOwnerId && it?.id) {
        const inspectLink = inspectAction.link
          .replace('%owner_steamid%', cachedOwnerId)
          .replace('%assetid%', it.id);
        sel.appendChild(SE.el('a', {
          class: 'se-btn',
          href: `https://csfloat.com/checkout/inspect?url=${encodeURIComponent(inspectLink)}`,
          target: '_blank', rel: 'noopener'
        }, 'CSFloat (this exact item)'));
      } else {
        sel.appendChild(SE.el('a', {
          class: 'se-btn',
          href: `https://csfloat.com/search?market_hash_name=${encodeURIComponent(name)}`,
          target: '_blank', rel: 'noopener'
        }, 'CSFloat'));
      }
    }

    // Backpack.tf for TF2.
    if (appid === '440') {
      sel.appendChild(SE.el('a', {
        class: 'se-btn',
        href: `https://backpack.tf/stats/Unique/${encodeURIComponent(name)}/Tradable/Craftable`,
        target: '_blank', rel: 'noopener'
      }, 'Backpack.tf'));
    }
  }
})();
