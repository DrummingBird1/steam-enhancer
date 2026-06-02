(function () {
  'use strict';
  const SE = window.SteamEnhancer;

  document.addEventListener('se-ready', () => init(), { once: true });

  async function init() {
    if (!SE.ctx.settings.enableTradeOfferTools) return;
    insertSummaryBox();
    setInterval(refresh, 2000);
  }

  function insertSummaryBox() {
    if (SE.$('#se-trade-summary')) return;
    const anchor = SE.$('#trade_box') || SE.$('.trade_partner_headline') || document.body;
    anchor.parentElement?.insertBefore(SE.el('div', { id: 'se-trade-summary', class: 'se-panel' },
      SE.el('div', { class: 'se-panel-h' }, 'Trade summary (estimated)'),
      SE.el('div', { class: 'se-panel-body', id: 'se-trade-body' },
        SE.el('div', { class: 'se-row se-muted' }, 'Counting items…')
      )
    ), anchor);
  }

  async function refresh() {
    const r = await SE.injectPage(() => {
      try {
        const collect = (id) => {
          const items = [];
          document.querySelectorAll(`#${id} .item`).forEach(node => {
            // Resolve description via UserYou/UserThem item lookup.
            const elemId = node.id; // item123_456_789
            const m = elemId && elemId.match(/item(\d+)_(\d+)_(\d+)/);
            if (!m) return;
            const [, appid, , inventoryid] = m;
            const u = id === 'your_slots' ? window.UserYou : window.UserThem;
            const inv = u && u.getInventory && u.getInventory(appid, 2);
            const desc = inv && inv.rgInventory && inv.rgInventory[inventoryid]
              ? inv.rgDescriptions[inv.rgInventory[inventoryid].classid + '_' + inv.rgInventory[inventoryid].instanceid]
              : null;
            items.push({
              appid,
              name: desc?.name || '',
              market_hash_name: desc?.market_hash_name || '',
              marketable: !!desc?.marketable
            });
          });
          return items;
        };
        return { your: collect('your_slots'), their: collect('their_slots') };
      } catch { return null; }
    });

    if (!r?.ok || !r.result) return;
    const body = SE.$('#se-trade-body'); if (!body) return;

    const yourVal = await sumValue(r.result.your);
    const theirVal = await sumValue(r.result.their);
    const diff = yourVal - theirVal;
    const pct = (Math.max(yourVal, theirVal) > 0) ? Math.abs(diff) / Math.max(yourVal, theirVal) * 100 : 0;

    body.innerHTML = '';
    body.appendChild(SE.el('div', { class: 'se-row' }, `You offer: ${r.result.your.length} items · est. ≈ ${yourVal.toFixed(2)}`));
    body.appendChild(SE.el('div', { class: 'se-row' }, `They offer: ${r.result.their.length} items · est. ≈ ${theirVal.toFixed(2)}`));
    body.appendChild(SE.el('div', { class: 'se-row' }, `Difference: ${diff >= 0 ? '+' : ''}${diff.toFixed(2)} (${pct.toFixed(0)}%)`));
    if (pct >= 20 && (yourVal + theirVal) > 1) {
      body.appendChild(SE.el('div', { class: 'se-row' }, SE.tag('VALUE MISMATCH', 'ignored'), ` Review carefully before accepting.`));
    }
  }

  const cache = new Map();
  async function sumValue(items) {
    let total = 0;
    for (const it of items) {
      if (!it.marketable || !it.market_hash_name) continue;
      const key = it.appid + ':' + it.market_hash_name;
      let val = cache.get(key);
      if (val == null) {
        const p = await SE.api.marketPriceOverview(it.appid, it.market_hash_name);
        val = SE.parsePrice(p?.data?.median_price || p?.data?.lowest_price) || 0;
        cache.set(key, val);
      }
      total += val;
    }
    return total;
  }
})();
