(function () {
  'use strict';
  const SE = window.SteamEnhancer;

  SE.onReady(() => init());

  async function init() {
    if (!SE.ctx?.settings.enableMarketTools) return;
    SE.safe('mkt:decorate', decorateListings);
    if (SE.once('mkt:observer')) {
      new MutationObserver(SE.throttle(() => SE.safe('mkt:decorate', decorateListings), 200))
        .observe(document.body, { childList: true, subtree: true });
    }
    if (/\/market\/listings\//.test(location.pathname)) SE.safe('mkt:itemTools', insertItemTools);
    SE.safe('mkt:fx', insertCurrencyConverter);
  }

  function decorateListings() {
    for (const it of SE.$$('.market_listing_row_link, .market_recent_listing_row, .market_listing_row')) {
      if (it.dataset.seDone) continue;
      it.dataset.seDone = '1';
      const priceEl = it.querySelector('.market_listing_price_with_fee, .market_listing_their_price, .market_listing_price');
      if (!priceEl) continue;
      const price = SE.parsePrice(priceEl.textContent);
      if (price == null) continue;
      const fee = Math.max(0.02, Math.round(price * 0.15 * 100) / 100);
      const net = Math.max(0.01, price - fee);
      priceEl.appendChild(SE.el('div', { class: 'se-market-net' }, `net ≈ ${net.toFixed(2)}`));
    }
  }

  async function insertItemTools() {
    const anchor = SE.$('#largeiteminfo_item_descriptors') || SE.$('#market_buyorder_info') || SE.$('.market_listing_largeimage');
    if (!anchor || SE.$('#se-mkt-tools')) return;
    const showBuyOrder = SE.ctx?.settings.showBuyOrderHelper;
    const box = SE.el('div', { id: 'se-mkt-tools', class: 'se-panel' },
      SE.el('div', { class: 'se-panel-h' }, 'Market quick tools'),
      SE.el('div', { class: 'se-panel-body' },
        SE.el('div', { class: 'se-row' },
          SE.el('button', { class: 'se-btn', onclick: undercut }, 'Undercut'),
          ' ',
          SE.el('button', { class: 'se-btn', onclick: copyHash }, 'Copy hash name'),
          ' ',
          SE.el('button', { class: 'se-btn', onclick: openSCMHistory }, 'Open SteamDB'),
          ' ',
          SE.el('button', { class: 'se-btn', onclick: salesSummary }, 'Sales summary'),
          showBuyOrder ? ' ' : null,
          showBuyOrder ? SE.el('button', { class: 'se-btn', onclick: buyOrderHelper }, 'Buy-order helper') : null
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
    if (p == null) { out.textContent = 'No listing found.'; return; }
    out.innerHTML = '';
    out.appendChild(SE.el('div', null, `Lowest listing: ${p.toFixed(2)}`));
    [0.01, 0.02, 0.05].forEach(c => {
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
    const parts = location.pathname.split('/').filter(Boolean);
    const appid = parts[parts.indexOf('listings') + 1];
    const name = parts[parts.indexOf('listings') + 2];
    window.open(`https://steamdb.info/app/${appid}/?market=${encodeURIComponent(name)}`, '_blank');
  }

  async function salesSummary() {
    const parts = location.pathname.split('/').filter(Boolean);
    const appid = parts[parts.indexOf('listings') + 1];
    const name = decodeURIComponent(parts[parts.indexOf('listings') + 2] || '');
    const out = SE.$('#se-mkt-out');
    out.textContent = 'Fetching…';
    const r = await SE.api.marketPriceOverview(appid, name);
    if (!r?.ok || !r.data?.success) { out.textContent = 'Could not fetch.'; return; }
    const d = r.data;
    out.innerHTML = '';
    out.appendChild(SE.el('div', null, `Lowest listed: ${d.lowest_price || '—'}`));
    out.appendChild(SE.el('div', null, `Median (24h): ${d.median_price || '—'}`));
    out.appendChild(SE.el('div', null, `Volume (24h): ${d.volume || '0'}`));
  }

  // Valve's own market page calls Market_LoadOrderSpread(item_nameid) from an
  // inline <script>. We reuse that same id against the public itemordershistogram
  // endpoint to read the current order book depth.
  function findItemNameId() {
    for (const s of document.scripts) {
      const m = s.textContent && s.textContent.match(/Market_LoadOrderSpread\(\s*(\d+)\s*\)/);
      if (m) return m[1];
    }
    return null;
  }

  async function buyOrderHelper() {
    const out = SE.$('#se-mkt-out');
    const itemNameId = findItemNameId();
    if (!itemNameId) { out.textContent = 'Could not find this listing\'s order book id on the page.'; return; }
    out.textContent = 'Fetching order book…';
    const r = await SE.api.itemOrdersHistogram(itemNameId);
    if (!r?.ok || !r.data?.success) { out.textContent = 'Could not fetch order book.'; return; }
    const d = r.data;
    const highestBuy = d.highest_buy_order != null ? Number(d.highest_buy_order) / 100 : null;
    const lowestSell = d.lowest_sell_order != null ? Number(d.lowest_sell_order) / 100 : null;
    out.innerHTML = '';
    out.appendChild(SE.el('div', null, `Highest buy order: ${highestBuy != null ? highestBuy.toFixed(2) : '—'} (${d.buy_order_count || 0} orders)`));
    out.appendChild(SE.el('div', null, `Lowest sell listing: ${lowestSell != null ? lowestSell.toFixed(2) : '—'} (${d.sell_order_count || 0} listings)`));
    if (highestBuy != null) {
      const suggested = highestBuy + 0.01;
      out.appendChild(SE.el('div', null,
        SE.tag(`Suggested: place buy order at ${suggested.toFixed(2)}`, 'info'),
        ' to lead the current queue by the minimum increment.'
      ));
    }
    if (highestBuy != null && lowestSell != null) {
      const spread = lowestSell - highestBuy;
      out.appendChild(SE.el('div', { class: 'se-muted' }, `Spread: ${spread.toFixed(2)}`));
    }
  }

  async function insertCurrencyConverter() {
    const target = SE.$('.market_search_sidebar') || SE.$('#searchResultsTable') || SE.$('#mainContents');
    if (!target || SE.$('#se-fx')) return;
    const box = SE.el('div', { id: 'se-fx', class: 'se-panel' },
      SE.el('div', { class: 'se-panel-h' }, 'Currency converter'),
      SE.el('div', { class: 'se-panel-body' },
        SE.el('div', { class: 'se-row' },
          SE.el('input', { type: 'number', step: '0.01', value: '1', id: 'se-fx-amt', class: 'se-input' }),
          ' ',
          SE.el('input', { type: 'text', maxlength: '3', value: 'USD', id: 'se-fx-from', class: 'se-input se-input-cur' }),
          ' → ',
          SE.el('input', { type: 'text', maxlength: '3', value: 'EUR', id: 'se-fx-to', class: 'se-input se-input-cur' }),
          ' ',
          SE.el('button', { class: 'se-btn', onclick: doFx }, 'Convert')
        ),
        SE.el('div', { id: 'se-fx-out', class: 'se-row se-muted' }, '')
      )
    );
    target.parentElement?.insertBefore(box, target);
  }
  async function doFx() {
    const amt = +SE.$('#se-fx-amt').value;
    const from = SE.$('#se-fx-from').value.trim().toUpperCase();
    const to = SE.$('#se-fx-to').value.trim().toUpperCase();
    const out = SE.$('#se-fx-out');
    out.textContent = 'Converting…';
    const v = await SE.fx.convert(amt, from, to);
    out.textContent = v != null ? `${amt} ${from} = ${v.toFixed(2)} ${to}` : 'Conversion failed (no rate).';
  }
})();
