(function () {
  'use strict';
  const SE = window.SteamEnhancer;

  document.addEventListener('se-ready', () => init(), { once: true });

  async function init() {
    const { settings, colls } = SE.ctx;
    decorateList();
    // Steam adds rows dynamically when scrolling.
    const obs = new MutationObserver(SE.throttle(decorateList, 150));
    obs.observe(document.body, { childList: true, subtree: true });

    function decorateList() {
      const rows = SE.$$('a.search_result_row, .tab_item, .home_marketing_message');
      for (const row of rows) {
        if (row.dataset.seDone) continue;
        row.dataset.seDone = '1';
        const appid = row.getAttribute('data-ds-appid')
          || row.querySelector('[data-ds-appid]')?.getAttribute('data-ds-appid')
          || (row.href || '').match(/\/app\/(\d+)/)?.[1];
        if (!appid) continue;

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

        if (settings.showLowestPrice) decoratePrice(row, appid, settings.country || 'us');
      }
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
    const tag = SE.el('div', { class: 'se-row-tag ' + (isMatch ? 'se-row-tag-match' : '') },
      `low: ${SE.formatMoney(low, sum.historicalLow.currency || 'USD')}` + (isMatch ? ' ✓' : '')
    );
    priceEl.appendChild(tag);
  }
})();
