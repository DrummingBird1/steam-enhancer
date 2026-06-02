(function () {
  'use strict';
  const SE = window.SteamEnhancer;

  document.addEventListener('se-ready', () => init(), { once: true });

  let blockSet = new Set();

  async function init() {
    blockSet = await SE.blocklist.get();
    decorateList();
    new MutationObserver(SE.throttle(decorateList, 150)).observe(document.body, { childList: true, subtree: true });
  }

  function decorateList() {
    const { settings, colls } = SE.ctx;
    const rows = SE.$$('a.search_result_row, .tab_item');
    for (const row of rows) {
      if (row.dataset.seDone) continue;
      row.dataset.seDone = '1';
      const appid = row.getAttribute('data-ds-appid')
        || row.querySelector('[data-ds-appid]')?.getAttribute('data-ds-appid')
        || (row.href || '').match(/\/app\/(\d+)/)?.[1];
      if (!appid) continue;

      if (blockSet.has(appid)) { row.style.display = 'none'; continue; }

      if (colls) {
        if (settings.highlightOwned && colls.owned.has(appid)) {
          row.classList.add('se-owned');
          row.appendChild(SE.tag('OWNED', 'owned'));
          if (settings.hideOwnedInSearch) row.style.display = 'none';
        }
        if (settings.highlightWishlist && colls.wishlist.has(appid)) {
          row.classList.add('se-wishlisted');
          row.appendChild(SE.tag('WISHLIST', 'wish'));
        }
        if (settings.highlightIgnored && colls.ignored.has(appid)) {
          row.classList.add('se-ignored');
          row.appendChild(SE.tag('IGNORED', 'ignored'));
          if (settings.hideIgnoredInSearch) row.style.display = 'none';
        }
      }

      // Hide-forever button
      const hideBtn = SE.el('button', {
        class: 'se-hide-btn',
        title: 'Hide forever (extension blocklist)',
        onclick: (e) => {
          e.preventDefault(); e.stopPropagation();
          SE.blocklist.add(appid).then(() => { blockSet.add(appid); row.style.display = 'none'; });
        }
      }, '✕');
      row.appendChild(hideBtn);

      if (settings.showLowestPrice) decoratePrice(row, appid, settings.country || 'us');
    }
  }

  async function decoratePrice(row, appid, country) {
    const priceEl = row.querySelector('.search_price, .discount_final_price');
    if (!priceEl) return;
    const sum = await SE.priceSummary(appid, country);
    if (!sum?.historicalLow) return;
    const cur = SE.parsePrice(priceEl.textContent);
    const low = sum.historicalLow.price;
    const isMatch = cur != null && low != null && Math.abs(cur - low) / Math.max(low, 0.01) < 0.02;
    priceEl.appendChild(SE.el('div', { class: 'se-row-tag ' + (isMatch ? 'se-row-tag-match' : '') },
      `low: ${SE.formatMoney(low, sum.historicalLow.currency || 'USD')}${isMatch ? ' ✓' : ''}`
    ));
  }
})();
