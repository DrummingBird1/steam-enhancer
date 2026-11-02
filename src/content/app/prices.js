// Store app/sub/bundle pages — Price panels: lowest/historical price, Steam price chart, regional prices,
// bundle math, price alerts and the since-last-visit price-drop tag.
// Registers into SE.storePage.panels; src/content/app.js decides which run.
(function () {
  'use strict';
  const SE = window.SteamEnhancer;
  const { panelBody, itadKeyNotice } = SE.storePage;

  async function addPriceBox(appid, settings) {
    const body = panelBody(); if (!body) return;
    const row = SE.el('div', { class: 'se-row se-price-row' }, SE.el('span', { class: 'se-muted' }, SE.t('checkingDeals')));
    body.appendChild(row);
    const sum = await SE.priceSummary(appid, SE.ctx.country);
    row.innerHTML = '';
    if (sum === 'needsItadKey') { row.appendChild(itadKeyNotice()); return; }
    if (!sum) { row.appendChild(SE.el('span', { class: 'se-muted' }, SE.t('noDealData'))); return; }
    const cur = sum.currentLow;
    if (cur) {
      const dispRow = SE.el('div', null,
        SE.el('span', { class: 'se-label' }, SE.t('lowestNow')),
        SE.el('a', { href: cur.url, target: '_blank', rel: 'noopener', class: 'se-link' },
          `${SE.formatMoney(cur.price, cur.currency || 'USD')} @ ${cur.shop}` + (cur.cut ? ` (-${cur.cut}%)` : ''))
      );
      row.appendChild(dispRow);
      SE.fx.toDisplay(cur.price, cur.currency || 'USD').then((conv) => {
        if (conv) dispRow.appendChild(SE.el('span', { class: 'se-muted' }, ` (≈ ${SE.formatMoney(conv.amount, conv.currency)})`));
      });
    }
    if (sum.historicalLow) {
      const h = sum.historicalLow;
      const date = h.timestamp ? new Date(h.timestamp).toISOString().slice(0, 10) : '';
      const histRow = SE.el('div', null,
        SE.el('span', { class: 'se-label' }, SE.t('historicalLow')),
        `${SE.formatMoney(h.price, h.currency || 'USD')} @ ${h.shop}${h.cut ? ' (-' + h.cut + '%)' : ''}${date ? ' · ' + date : ''}`
      );
      row.appendChild(histRow);
      SE.fx.toDisplay(h.price, h.currency || 'USD').then((conv) => {
        if (conv) histRow.appendChild(SE.el('span', { class: 'se-muted' }, ` (≈ ${SE.formatMoney(conv.amount, conv.currency)})`));
      });
    }
    if (sum.slug) {
      row.appendChild(SE.el('div', null,
        SE.el('a', { href: `https://isthereanydeal.com/game/${sum.slug}/info/`, target: '_blank', rel: 'noopener', class: 'se-link' }, SE.t('viewOnItad'))
      ));
    }
  }

  async function addRegionalPricing(appid) {
    const body = panelBody(); if (!body) return;
    const regions = ['us', 'ar', 'tr', 'ru', 'in', 'br'];
    const wrap = SE.el('div', { class: 'se-row' }, SE.el('span', { class: 'se-label' }, SE.t('regional')));
    body.appendChild(wrap);
    for (const cc of regions) {
      const r = await SE.api.appDetails(appid, cc);
      const po = r?.data?.[appid]?.data?.price_overview;
      if (po?.final_formatted) wrap.appendChild(SE.el('span', { class: 'se-region' }, `${cc.toUpperCase()}: ${po.final_formatted}`));
    }
  }

  async function addPriceChart(appid) {
    const body = panelBody(); if (!body) return;
    // Steam's own price over the last year, from ITAD's history log. (Until
    // 1.4.x this read a `lows` field the overview endpoint doesn't have, so the
    // chart never rendered.)
    const lookup = await SE.api.itadLookup(appid);
    const game = lookup?.ok ? SE.itad.gameFromLookup(lookup.data) : null;
    if (!game) return;
    const r = await SE.api.itadHistory(game.id, SE.ctx.country);
    const points = SE.itad.historyPoints(r?.ok ? r.data : null);
    if (!points.length) return;
    // History only logs changes; extend the last price to today so the line
    // reaches the present.
    points.push({ t: Date.now(), v: points[points.length - 1].v });
    if (points.length < 2) return;

    const minP = Math.min(...points.map(p => p.v));
    const svg = SE.sparklineSvg(points, { labelLeft: `${SE.t('lowWord')} ${minP.toFixed(2)}` });
    const wrap = SE.el('div', { class: 'se-row', html: svg });
    body.appendChild(SE.el('div', { class: 'se-row se-label' }, SE.t('priceHistoryLabel')));
    body.appendChild(wrap);
  }

  // Steam shows "Buy as a bundle" boxes on the app page when this game is part
  // of a relevant bundle. Best-effort: extract the bundle's listed apps and its
  // discounted total, then compare against those apps' own current prices to
  // show whether buying separately would actually be cheaper. Selectors are
  // guesses at Steam's bundle-purchase markup; if Steam's DOM differs this
  // silently finds nothing (SE.safe-guarded by the caller).
  async function addBundleSavings(appid, settings) {
    const bundleBoxes = SE.$$('.game_area_purchase_bundle, .game_area_purchase_game[data-ds-bundleid], .bundle_base_page_content');
    if (!bundleBoxes.length) return;
    const country = SE.ctx.country;

    for (const box of bundleBoxes.slice(0, 2)) {
      const bundlePriceEl = box.querySelector('.discount_final_price, .price, .game_purchase_price');
      const bundlePrice = bundlePriceEl ? SE.parsePrice(bundlePriceEl.textContent) : null;
      if (bundlePrice == null) continue;

      const subIds = SE.$$('[data-ds-appid]', box)
        .map(el => el.getAttribute('data-ds-appid'))
        .filter((id, i, arr) => id && arr.indexOf(id) === i);
      if (subIds.length < 2) continue;

      let sum = 0, resolved = 0;
      for (const id of subIds.slice(0, 12)) {
        const r = await SE.api.appDetails(id, country);
        const po = r?.data?.[id]?.data?.price_overview;
        if (po?.final) { sum += po.final / 100; resolved++; }
      }
      if (resolved < 2) continue;

      const diff = sum - bundlePrice;
      panelBody()?.appendChild(SE.el('div', { class: 'se-row' },
        SE.el('span', { class: 'se-label' }, SE.t('bundleMath')),
        `${resolved} ${SE.t('itemsSeparately')} ≈ ${sum.toFixed(2)} ${SE.t('vsBundle')} ${bundlePrice.toFixed(2)} — `,
        diff > 0.01
          ? SE.tag(`${SE.t('saveWord')} ${diff.toFixed(2)} ${SE.t('inBundle')}`, 'good')
          : SE.tag(SE.t('bundleNotCheaper'), 'ignored')
      ));
      break; // one box is enough context
    }
  }

  // Store-page-level price alert. Writes into the same se_wishlist_targets map
  // that wishlist.js's per-row inputs use, so a target set here also shows up
  // there and vice versa, and the background alarm (handlePriceAlertPoll) checks
  // both the same way.
  async function addStorePriceAlert(appid) {
    const body = panelBody(); if (!body) return;
    const targets = await new Promise((r) => chrome.storage.local.get(['se_wishlist_targets'], (d) => r(d.se_wishlist_targets || {})));
    const input = SE.el('input', { type: 'number', step: '0.01', min: '0', class: 'se-input', style: { width: '90px' }, placeholder: 'e.g. 9.99' });
    input.value = targets[appid] != null ? String(targets[appid]) : '';
    input.addEventListener('change', async () => {
      const v = parseFloat(input.value);
      const all = await new Promise((r) => chrome.storage.local.get(['se_wishlist_targets'], (d) => r(d.se_wishlist_targets || {})));
      if (isFinite(v) && v > 0) all[appid] = v; else delete all[appid];
      chrome.storage.local.set({ se_wishlist_targets: all });
    });
    body.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, SE.t('alertMeAt')), input,
      SE.el('span', { class: 'se-muted' }, ` (${SE.t('alertCheckedHourly')})`)
    ));
  }

  async function trackPriceDrop(appid) {
    const priceEl = SE.$('.game_purchase_price, .discount_final_price');
    const cur = priceEl ? SE.parsePrice(priceEl.textContent) : null;
    if (cur == null) return;
    const prev = await SE.priceHistory.record(appid, cur);
    if (prev && prev.price > cur) {
      const drop = SE.fmtPercent(prev.price, cur);
      panelBody()?.appendChild(SE.el('div', { class: 'se-row' },
        SE.tag(`${SE.t('priceDrop')} -${drop}%`, 'good'),
        ` ${SE.t('sinceLastVisit')} (${prev.price.toFixed(2)} → ${cur.toFixed(2)})`
      ));
    }
  }

  Object.assign(SE.storePage.panels, { addPriceBox, addRegionalPricing, addPriceChart, addBundleSavings, addStorePriceAlert, trackPriceDrop });
})();
