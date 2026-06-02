(function () {
  'use strict';
  const SE = window.SteamEnhancer;

  document.addEventListener('se-ready', () => init(), { once: true });

  async function init() {
    if (!SE.ctx.settings.enableMarketTools) return;

    decorateListings();
    new MutationObserver(SE.throttle(decorateListings, 200)).observe(document.body, { childList: true, subtree: true });

    // Item page: insert quick-buy ladder.
    if (/\/market\/listings\//.test(location.pathname)) insertItemTools();
  }

  function decorateListings() {
    const items = SE.$$('.market_listing_row_link, .market_recent_listing_row, .market_listing_row');
    for (const it of items) {
      if (it.dataset.seDone) continue;
      it.dataset.seDone = '1';
      const priceEl = it.querySelector('.market_listing_price_with_fee, .market_listing_their_price, .market_listing_price');
      if (!priceEl) continue;
      const price = SE.parsePrice(priceEl.textContent);
      if (price == null) continue;
      const fee = Math.max(0.02, Math.round(price * 0.15 * 100) / 100);
      const net = Math.max(0.01, price - fee);
      const note = SE.el('div', { class: 'se-market-net' }, `net ≈ ${net.toFixed(2)}`);
      priceEl.appendChild(note);
    }
  }

  function insertItemTools() {
    const anchor = SE.$('#largeiteminfo_item_descriptors') || SE.$('#market_buyorder_info') || SE.$('.market_listing_largeimage');
    if (!anchor || SE.$('#se-mkt-tools')) return;
    const box = SE.el('div', { id: 'se-mkt-tools', class: 'se-panel' },
      SE.el('div', { class: 'se-panel-h' }, 'Market quick tools'),
      SE.el('div', { class: 'se-panel-body' },
        SE.el('div', { class: 'se-row' },
          SE.el('button', { class: 'se-btn', onclick: undercut }, 'Compute undercut prices'),
          ' ',
          SE.el('button', { class: 'se-btn', onclick: copyHash }, 'Copy hash name'),
          ' ',
          SE.el('button', { class: 'se-btn', onclick: openSCMHistory }, 'Open price history')
        ),
        SE.el('div', { id: 'se-mkt-out', class: 'se-row se-muted' }, '')
      )
    );
    anchor.parentElement?.insertBefore(box, anchor);
  }

  function undercut() {
    const first = SE.$('.market_listing_price_with_fee, .market_listing_price');
    const p = first ? SE.parsePrice(first.textContent) : null;
    const out = SE.$('#se-mkt-out');
    if (p == null) { out.textContent = 'No listing found on page.'; return; }
    const cuts = [0.01, 0.02, 0.05];
    out.innerHTML = '';
    out.appendChild(SE.el('div', null, `Lowest listing: ${p.toFixed(2)}`));
    cuts.forEach(c => {
      const np = Math.max(0.03, +(p - c).toFixed(2));
      const net = Math.max(0.01, +(np * 0.87).toFixed(2));
      out.appendChild(SE.el('div', null, `-${c.toFixed(2)} → list ${np.toFixed(2)} (you get ~${net.toFixed(2)})`));
    });
  }
  function copyHash() {
    const name = decodeURIComponent(location.pathname.split('/').pop());
    navigator.clipboard.writeText(name).then(() => { SE.$('#se-mkt-out').textContent = 'Copied: ' + name; });
  }
  function openSCMHistory() {
    // Steam already shows the chart; we add a SteamDB shortcut.
    const parts = location.pathname.split('/').filter(Boolean);
    const appid = parts[parts.indexOf('listings') + 1];
    const name = parts[parts.indexOf('listings') + 2];
    window.open(`https://steamdb.info/app/${appid}/?market=${encodeURIComponent(name)}`, '_blank');
  }
})();
