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
    if (/^\/market\/?$/.test(location.pathname)) SE.safe('mkt:myListings', insertMyListingsTools);
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
      const net = SE.marketFees.sellerReceives(Math.round(price * 100)) / 100;
      if (net <= 0) continue;
      priceEl.appendChild(SE.el('div', { class: 'se-market-net' }, `${SE.t('netWord')} ≈ ${net.toFixed(2)}`));
    }
  }

  // ---- My listings (market home page) -------------------------------------
  // Checks each of your active sell listings against the cheapest listing of
  // the same item, tags it LOWEST or UNDERCUT, and lets you remove a
  // selection in one go. Rows are Steam's own "My listings" table
  // (#tabContentsMyListings .market_listing_row[id^="mylisting_"]).
  const myListingRows = () => SE.$$('#tabContentsMyListings .market_listing_row[id^="mylisting_"]');

  function insertMyListingsTools() {
    const anchor = SE.$('#tabContentsMyListings');
    if (!anchor || SE.$('#se-mylistings') || !myListingRows().length) return;
    const out = SE.el('span', { class: 'se-muted' });
    const bar = SE.el('div', { id: 'se-mylistings', class: 'se-toolbar' },
      SE.el('span', { class: 'se-label' }, SE.t('myListingsTitle')),
      SE.el('button', { class: 'se-btn', onclick: checkListings }, SE.t('checkListingsBtn')),
      SE.el('button', { class: 'se-btn', onclick: () => selectRows((row) => row.dataset.seStatus === 'undercut') }, SE.t('selectUndercutBtn')),
      SE.el('button', { class: 'se-btn', onclick: () => selectRows(() => false) }, SE.t('selectNoneBtn')),
      SE.el('button', { class: 'se-btn se-btn-danger', onclick: removeSelected }, SE.t('removeSelectedBtn')),
      out);
    anchor.prepend(bar);
    summarize(out);
  }

  function rowInfo(row) {
    const link = row.querySelector('.market_listing_item_name_link, a[href*="/market/listings/"]');
    const item = SE.marketMath.listingFromUrl(link?.href);
    const price = SE.marketMath.parseMyListingPrice(row.querySelector('.market_listing_price')?.textContent);
    return { listingid: row.id.replace('mylisting_', ''), item, ...price };
  }

  function rowCheckbox(row) {
    let cb = row.querySelector('.se-ml-check');
    if (!cb) {
      cb = SE.el('input', { type: 'checkbox', class: 'se-ml-check' });
      row.prepend(cb);
    }
    return cb;
  }
  function selectRows(pred) { myListingRows().forEach((row) => { rowCheckbox(row).checked = pred(row); }); }

  async function summarize(out) {
    const rows = myListingRows();
    const wallet = await SE.walletCurrency();
    const receive = rows.reduce((a, row) => a + (rowInfo(row).receiveCents || 0), 0);
    out.textContent = SE.t('myListingsSummary', rows.length, SE.formatMoney(receive / 100, wallet.iso));
  }

  async function checkListings() {
    const out = SE.$('#se-mylistings .se-muted');
    const wallet = await SE.walletCurrency();
    const rows = myListingRows().slice(0, 100);
    let undercut = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      rowCheckbox(row);
      out.textContent = SE.t('checkingListings', i + 1, rows.length);
      const info = rowInfo(row);
      if (!info.item) continue;
      const p = await SE.api.marketPriceOverview(info.item.appid, info.item.name, 'US', wallet.id);
      const lowest = SE.marketMath.cents(SE.parsePrice(p?.data?.lowest_price));
      const st = SE.marketMath.listingStatus(info.buyerCents, lowest);
      row.dataset.seStatus = st.status;
      row.querySelector('.se-ml-tag')?.remove();
      const tag = st.status === 'lowest' ? SE.tag(SE.t('listingLowest'), 'good')
        : st.status === 'undercut' ? SE.tag(SE.t('listingUndercut', SE.formatMoney(st.byCents / 100, wallet.iso)), 'ignored')
        : null;
      if (tag) {
        tag.classList.add('se-ml-tag');
        row.querySelector('.market_listing_price')?.appendChild(tag);
      }
      if (st.status === 'undercut') undercut++;
    }
    out.textContent = SE.t('listingsChecked', rows.length, undercut);
  }

  async function removeSelected() {
    const out = SE.$('#se-mylistings .se-muted');
    const rows = myListingRows().filter((row) => row.querySelector('.se-ml-check')?.checked);
    if (!rows.length) { out.textContent = SE.t('noneSelectedListings'); return; }
    if (!window.confirm(SE.t('confirmRemoveListings', rows.length))) return;
    let removed = 0;
    for (const row of rows) {
      const { listingid } = rowInfo(row);
      const r = await SE.pageCall('removeListing', { listingid });
      if (r?.ok && r.result?.ok) { removed++; row.style.opacity = '0.35'; row.querySelector('.se-ml-check')?.remove(); }
      out.textContent = SE.t('removingListings', removed, rows.length);
      await SE.sleep(800);
    }
    out.textContent = SE.t('removedListings', removed, rows.length);
  }

  async function insertItemTools() {
    const anchor = SE.$('#largeiteminfo_item_descriptors') || SE.$('#market_buyorder_info') || SE.$('.market_listing_largeimage');
    if (!anchor || SE.$('#se-mkt-tools')) return;
    const showBuyOrder = SE.ctx?.settings.showBuyOrderHelper;
    const box = SE.el('div', { id: 'se-mkt-tools', class: 'se-panel' },
      SE.el('div', { class: 'se-panel-h' }, SE.t('marketQuickTools')),
      SE.el('div', { class: 'se-panel-body' },
        SE.el('div', { class: 'se-row' },
          SE.el('button', { class: 'se-btn', onclick: undercut }, SE.t('undercutBtn')),
          ' ',
          SE.el('button', { class: 'se-btn', onclick: copyHash }, SE.t('copyHashBtn')),
          ' ',
          SE.el('button', { class: 'se-btn', onclick: openSCMHistory }, SE.t('openSteamDbBtn')),
          ' ',
          SE.el('button', { class: 'se-btn', onclick: salesSummary }, SE.t('salesSummaryBtn')),
          showBuyOrder ? ' ' : null,
          showBuyOrder ? SE.el('button', { class: 'se-btn', onclick: buyOrderHelper }, SE.t('buyOrderHelperBtn')) : null,
          ' ',
          SE.el('button', { class: 'se-btn', onclick: showPriceHistoryChart }, SE.t('priceHistoryChart'))
        ),
        SE.el('div', { id: 'se-mkt-out', class: 'se-row se-muted' }, '')
      )
    );
    anchor.parentElement?.insertBefore(box, anchor);
  }

  function listingNameFromUrl() {
    const parts = location.pathname.split('/').filter(Boolean);
    const appid = parts[parts.indexOf('listings') + 1];
    const name = decodeURIComponent(parts[parts.indexOf('listings') + 2] || '');
    return { appid, name };
  }

  async function showPriceHistoryChart() {
    const out = SE.$('#se-mkt-out');
    const { appid, name } = listingNameFromUrl();
    if (!appid || !name) return;
    out.textContent = '…';
    const r = await SE.api.marketPriceHistory(appid, name);
    const raw = r?.data?.price_history;
    if (!r?.ok || !Array.isArray(raw) || !raw.length) {
      out.textContent = SE.t('needsLoginForChart');
      return;
    }
    const points = raw
      .map(([dateStr, price]) => ({ t: new Date(dateStr).getTime(), v: Number(price) }))
      .filter((p) => isFinite(p.t) && isFinite(p.v));
    if (points.length < 2) { out.textContent = SE.t('needsLoginForChart'); return; }
    // Sample down to ~300 points so the SVG path stays cheap on items with years of history.
    const step = Math.max(1, Math.floor(points.length / 300));
    const sampled = points.filter((_, i) => i % step === 0 || i === points.length - 1);
    // Sale medians per hour/day, not a price that holds — so a plain line, not steps.
    const wallet = await SE.walletCurrency();
    out.innerHTML = '';
    out.appendChild(SE.el('div', { class: 'se-label' }, SE.t('priceHistoryChart') + ':'));
    out.appendChild(SE.priceChart(sampled, { currency: wallet.iso, step: false, w: 420, h: 150 }));
  }

  function undercut() {
    const first = SE.$('.market_listing_price_with_fee, .market_listing_price');
    const p = first ? SE.parsePrice(first.textContent) : null;
    const out = SE.$('#se-mkt-out');
    if (p == null) { out.textContent = SE.t('mktNoListing'); return; }
    out.innerHTML = '';
    out.appendChild(SE.el('div', null, SE.t('mktLowestListing', p.toFixed(2))));
    [0.01, 0.02, 0.05].forEach(c => {
      const np = Math.max(0.03, +(p - c).toFixed(2));
      const net = SE.marketFees.sellerReceives(Math.round(np * 100)) / 100;
      out.appendChild(SE.el('div', null, SE.t('mktUndercutRow', c.toFixed(2), np.toFixed(2), net.toFixed(2))));
    });
  }
  function copyHash() {
    const name = decodeURIComponent(location.pathname.split('/').pop());
    navigator.clipboard.writeText(name).then(() => { SE.$('#se-mkt-out').textContent = SE.t('mktCopied', name); });
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
    out.textContent = SE.t('mktFetching');
    const r = await SE.api.marketPriceOverview(appid, name);
    if (!r?.ok || !r.data?.success) { out.textContent = SE.t('mktFetchFailed'); return; }
    const d = r.data;
    out.innerHTML = '';
    out.appendChild(SE.el('div', null, SE.t('mktLowestListed', d.lowest_price || '—')));
    out.appendChild(SE.el('div', null, SE.t('mktMedian24', d.median_price || '—')));
    out.appendChild(SE.el('div', null, SE.t('mktVolume24', d.volume || '0')));
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
    if (!itemNameId) { out.textContent = SE.t('mktNoOrderBookId'); return; }
    out.textContent = SE.t('mktFetchingOrderBook');
    const r = await SE.api.itemOrdersHistogram(itemNameId);
    if (!r?.ok || !r.data?.success) { out.textContent = SE.t('mktOrderBookFailed'); return; }
    const d = r.data;
    const highestBuy = d.highest_buy_order != null ? Number(d.highest_buy_order) / 100 : null;
    const lowestSell = d.lowest_sell_order != null ? Number(d.lowest_sell_order) / 100 : null;
    out.innerHTML = '';
    out.appendChild(SE.el('div', null, SE.t('mktHighestBuy', highestBuy != null ? highestBuy.toFixed(2) : '—', d.buy_order_count || 0)));
    out.appendChild(SE.el('div', null, SE.t('mktLowestSell', lowestSell != null ? lowestSell.toFixed(2) : '—', d.sell_order_count || 0)));
    if (highestBuy != null) {
      const suggested = highestBuy + 0.01;
      out.appendChild(SE.el('div', null,
        SE.tag(SE.t('mktSuggestedBuy', suggested.toFixed(2)), 'info'),
        SE.t('mktSuggestedBuyWhy')
      ));
    }
    if (highestBuy != null && lowestSell != null) {
      const spread = lowestSell - highestBuy;
      out.appendChild(SE.el('div', { class: 'se-muted' }, SE.t('mktSpread', spread.toFixed(2))));
    }
  }

  async function insertCurrencyConverter() {
    const target = SE.$('.market_search_sidebar') || SE.$('#searchResultsTable') || SE.$('#mainContents');
    if (!target || SE.$('#se-fx')) return;
    const box = SE.el('div', { id: 'se-fx', class: 'se-panel' },
      SE.el('div', { class: 'se-panel-h' }, SE.t('currencyConverter')),
      SE.el('div', { class: 'se-panel-body' },
        SE.el('div', { class: 'se-row' },
          SE.el('input', { type: 'number', step: '0.01', value: '1', id: 'se-fx-amt', class: 'se-input' }),
          ' ',
          SE.el('input', { type: 'text', maxlength: '3', value: 'USD', id: 'se-fx-from', class: 'se-input se-input-cur' }),
          ' → ',
          SE.el('input', { type: 'text', maxlength: '3', value: 'EUR', id: 'se-fx-to', class: 'se-input se-input-cur' }),
          ' ',
          SE.el('button', { class: 'se-btn', onclick: doFx }, SE.t('convertBtn'))
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
    out.textContent = SE.t('mktConverting');
    const v = await SE.fx.convert(amt, from, to);
    out.textContent = v != null ? `${amt} ${from} = ${v.toFixed(2)} ${to}` : SE.t('mktConvertFailed');
  }
})();
