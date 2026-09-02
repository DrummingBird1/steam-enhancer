(function () {
  'use strict';
  const SE = window.SteamEnhancer;

  SE.onReady(() => init());

  let blockSet = new Set();
  let keyNoticeShown = false;

  async function init() {
    blockSet = await SE.blocklist.get();
    SE.safe('search:decorate', decorateList);
    if (SE.once('search:observer')) {
      new MutationObserver(SE.throttle(() => SE.safe('search:decorate', decorateList), 150))
        .observe(document.body, { childList: true, subtree: true });
    }
  }

  function decorateList() {
    const { settings, colls } = SE.ctx;
    const rows = SE.$$('a.search_result_row, .tab_item');
    const pending = [];

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
          row.appendChild(SE.tag(SE.t('owned'), 'owned'));
          if (settings.hideOwnedInSearch) row.style.display = 'none';
        }
        if (settings.highlightWishlist && colls.wishlist.has(appid)) {
          row.classList.add('se-wishlisted');
          row.appendChild(SE.tag(SE.t('wishlist'), 'wish'));
        }
        if (settings.highlightIgnored && colls.ignored.has(appid)) {
          row.classList.add('se-ignored');
          row.appendChild(SE.tag(SE.t('ignored'), 'ignored'));
          if (settings.hideIgnoredInSearch) row.style.display = 'none';
        }
      }

      // Hide-forever button
      const hideBtn = SE.el('button', {
        class: 'se-hide-btn',
        title: SE.t('hideForeverTitle'),
        onclick: (e) => {
          e.preventDefault(); e.stopPropagation();
          SE.blocklist.add(appid).then(() => { blockSet.add(appid); row.style.display = 'none'; });
        }
      }, '✕');
      row.appendChild(hideBtn);

      if (settings.showLowestPrice) {
        const priceEl = row.querySelector('.search_price, .discount_final_price');
        if (priceEl) pending.push({ appid, priceEl, curText: priceEl.textContent });
      }
    }

    if (pending.length) SE.safe('search:prices', () => decoratePrices(pending, settings.country || 'us'));
  }

  // Batched: one ITAD prices call + one storelow call for every visible,
  // not-yet-decorated row, instead of one pair of calls per row.
  async function decoratePrices(pending, country) {
    const summaries = await SE.priceSummaryBatch(pending.map((p) => p.appid), country);
    if (summaries === 'needsItadKey') {
      if (!keyNoticeShown) { keyNoticeShown = true; showKeyNotice(); }
      return;
    }
    for (const { appid, priceEl, curText } of pending) {
      const sum = summaries.get(appid);
      if (!sum?.historicalLow) continue;
      const cur = SE.parsePrice(curText);
      const low = sum.historicalLow.price;
      const isMatch = cur != null && low != null && Math.abs(cur - low) / Math.max(low, 0.01) < 0.02;
      priceEl.appendChild(SE.el('div', { class: 'se-row-tag ' + (isMatch ? 'se-row-tag-match' : '') },
        `${SE.t('lowWord')}: ${SE.formatMoney(low, sum.historicalLow.currency || 'USD')}${isMatch ? ' ✓' : ''}`
      ));
    }
  }

  function showKeyNotice() {
    const anchor = SE.$('#search_results') || SE.$('.search_results_container') || document.body;
    if (!anchor || SE.$('#se-itad-key-notice')) return;
    const notice = SE.el('div', { id: 'se-itad-key-notice', class: 'se-toolbar' },
      SE.el('span', { class: 'se-muted' }, SE.t('needsItadKeyMsg') + ' '),
      SE.el('a', {
        href: 'javascript:void 0', class: 'se-link',
        onclick: (e) => { e.preventDefault(); SE.bg({ type: 'openOptions' }); }
      }, SE.t('openOptionsLink'))
    );
    anchor.parentElement?.insertBefore(notice, anchor);
  }
})();
