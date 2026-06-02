(function () {
  'use strict';
  const SE = window.SteamEnhancer;

  document.addEventListener('se-ready', () => init(), { once: true });

  async function init() {
    if (!SE.ctx.settings.enableInventoryTools) return;
    insertToolbar();
    // Listen for inventory swaps and re-decorate.
    setInterval(decorateSelected, 1000);
  }

  function insertToolbar() {
    if (SE.$('#se-inv-toolbar')) return;
    const anchor = SE.$('#inventory_pagecontrols') || SE.$('#tabcontent_inventory') || SE.$('#inventories');
    if (!anchor) return;
    const bar = SE.el('div', { id: 'se-inv-toolbar', class: 'se-toolbar' },
      SE.el('button', { class: 'se-btn', onclick: showValue }, 'Estimate inventory value'),
      SE.el('button', { class: 'se-btn', onclick: findDuplicates }, 'Find duplicates'),
      SE.el('button', { class: 'se-btn', onclick: exportInventory }, 'Export inventory JSON'),
      SE.el('button', { class: 'se-btn', onclick: openTradeCalc }, 'Trade calculator'),
      SE.el('span', { id: 'se-inv-out', class: 'se-muted' }, '')
    );
    anchor.parentElement?.insertBefore(bar, anchor);
  }

  function getActiveInventoryItems() {
    // Steam stores inventories on `g_ActiveInventory` in the page context.
    return SE.injectPage(() => {
      try {
        const inv = window.g_ActiveInventory;
        if (!inv?.rgInventory) return null;
        return Object.values(inv.rgInventory).map(it => ({
          id: it.id, classid: it.classid, instanceid: it.instanceid, amount: it.amount,
          market_hash_name: it.market_hash_name || (inv.rgDescriptions[it.classid + '_' + it.instanceid]?.market_hash_name),
          name: inv.rgDescriptions[it.classid + '_' + it.instanceid]?.name,
          tradable: inv.rgDescriptions[it.classid + '_' + it.instanceid]?.tradable,
          marketable: inv.rgDescriptions[it.classid + '_' + it.instanceid]?.marketable,
          appid: inv.appid
        }));
      } catch (e) { return null; }
    });
  }

  async function showValue() {
    const out = SE.$('#se-inv-out');
    out.textContent = 'Estimating (sampling first 25 marketable items)…';
    const r = await getActiveInventoryItems();
    if (!r?.ok || !r.result) { out.textContent = 'Could not read inventory.'; return; }
    const items = r.result.filter(i => i.marketable);
    const sample = items.slice(0, 25);
    let total = 0, counted = 0;
    for (const it of sample) {
      const p = await SE.api.marketPriceOverview(it.appid, it.market_hash_name);
      const median = p?.data?.median_price || p?.data?.lowest_price;
      const val = SE.parsePrice(median);
      if (val != null) { total += val * (it.amount || 1); counted++; }
    }
    const avg = counted ? total / counted : 0;
    const estimate = avg * items.length;
    out.textContent = `Sampled ${counted}/${sample.length}. Avg ≈ ${avg.toFixed(2)} · ${items.length} marketable items · estimate ≈ ${estimate.toFixed(2)}`;
  }

  async function findDuplicates() {
    const out = SE.$('#se-inv-out');
    const r = await getActiveInventoryItems();
    if (!r?.ok || !r.result) { out.textContent = 'Could not read inventory.'; return; }
    const map = new Map();
    for (const it of r.result) {
      const k = it.market_hash_name || it.name;
      if (!k) continue;
      map.set(k, (map.get(k) || 0) + (it.amount || 1));
    }
    const dups = [...map.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 20);
    out.innerHTML = '';
    if (!dups.length) { out.textContent = 'No duplicates found.'; return; }
    dups.forEach(([k, n]) => out.appendChild(SE.el('div', null, `${n}× ${k}`)));
  }

  async function exportInventory() {
    const r = await getActiveInventoryItems();
    if (!r?.ok || !r.result) return alert('Could not read inventory.');
    const blob = new Blob([JSON.stringify(r.result, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'steam-inventory.json'; a.click();
  }

  function openTradeCalc() {
    window.open('https://steamcommunity.com/tradeoffer/new/', '_blank');
  }

  async function decorateSelected() {
    const sel = SE.$('.inventory_iteminfo.activeInfo, #iteminfo1, #iteminfo0');
    if (!sel || sel.dataset.seDone === sel.id + (sel.querySelector('.hover_item_name')?.textContent || '')) return;
    sel.dataset.seDone = sel.id + (sel.querySelector('.hover_item_name')?.textContent || '');
    const name = sel.querySelector('.hover_item_name')?.textContent?.trim();
    if (!name) return;
    const appidMatch = location.hash.match(/inventory_[^_]+_(\d+)/) || sel.querySelector('a[href*="/market/listings/"]')?.href.match(/listings\/(\d+)\//);
    const appid = appidMatch?.[1];
    if (!appid) return;
    if (sel.querySelector('.se-quicksell')) return;
    const btn = SE.el('a', {
      class: 'se-btn se-quicksell',
      href: `https://steamcommunity.com/market/listings/${appid}/${encodeURIComponent(name)}`,
      target: '_blank', rel: 'noopener'
    }, 'View on Market');
    sel.appendChild(btn);
  }
})();
