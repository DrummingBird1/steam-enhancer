(function () {
  'use strict';
  const SE = window.SteamEnhancer;

  document.addEventListener('se-ready', () => init(), { once: true });

  async function init() {
    const appid = SE.extractAppId();
    if (!appid) return;
    const { settings } = SE.ctx;

    insertEnhancerPanel(appid);

    if (settings.showLowestPrice || settings.showPriceHistory) addPriceBox(appid, settings);
    if (settings.showSteamDBLink) addExternalLinks(appid);
    if (settings.showProtonDB) addProtonDB(appid);
    if (settings.showHowLongToBeat) addHowLongToBeat();
    if (settings.showPlayersOnline) addPlayersOnline(appid);
    if (settings.showAchievementStats) addAchievementStats(appid);
    if (settings.showDlcCheck) addDlcOwnership(appid);
    if (settings.showRegionalPricing) addRegionalPricing(appid);
    if (settings.showReviewBreakdown) addReviewBreakdown();
    if (settings.showCardSetValue) addCardSetValue(appid);

    enhanceWishlistButton();
  }

  function insertEnhancerPanel(appid) {
    const anchor = SE.$('.game_meta_data') || SE.$('.rightcol') || SE.$('.game_area_purchase');
    if (!anchor) return;
    if (SE.$('#se-panel')) return;
    const panel = SE.el('div', { id: 'se-panel', class: 'se-panel' },
      SE.el('div', { class: 'se-panel-h' }, 'Steam Enhancer'),
      SE.el('div', { id: 'se-panel-body', class: 'se-panel-body' },
        SE.el('div', { class: 'se-row se-muted' }, `App ${appid}`)
      )
    );
    anchor.prepend(panel);
  }

  function panelBody() { return SE.$('#se-panel-body'); }

  async function addPriceBox(appid, settings) {
    const body = panelBody(); if (!body) return;
    const row = SE.el('div', { class: 'se-row se-price-row' }, SE.el('span', { class: 'se-muted' }, 'Checking deals…'));
    body.appendChild(row);
    const sum = await SE.priceSummary(appid, settings.country || 'us');
    row.innerHTML = '';
    if (!sum) { row.appendChild(SE.el('span', { class: 'se-muted' }, 'No deal data')); return; }
    const cur = sum.currentLow;
    if (cur) {
      const link = SE.el('a', { href: cur.url, target: '_blank', rel: 'noopener', class: 'se-link' },
        `${SE.formatMoney(cur.price, cur.currency || 'USD')} @ ${cur.shop}` + (cur.cut ? ` (-${cur.cut}%)` : ''));
      row.appendChild(SE.el('div', null, SE.el('span', { class: 'se-label' }, 'Lowest now: '), link));
    }
    if (sum.historicalLow) {
      const h = sum.historicalLow;
      const date = h.timestamp ? new Date(h.timestamp).toISOString().slice(0, 10) : '';
      row.appendChild(SE.el('div', null,
        SE.el('span', { class: 'se-label' }, 'Historical low: '),
        `${SE.formatMoney(h.price, h.currency || 'USD')} @ ${h.shop}${h.cut ? ' (-' + h.cut + '%)' : ''}${date ? ' · ' + date : ''}`
      ));
    }
    if (sum.slug) {
      row.appendChild(SE.el('div', null,
        SE.el('a', { href: `https://isthereanydeal.com/game/${sum.slug}/info/`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'View on ITAD →')
      ));
    }
  }

  function addExternalLinks(appid) {
    const body = panelBody(); if (!body) return;
    const row = SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, 'Links: '),
      SE.el('a', { href: `https://steamdb.info/app/${appid}/`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'SteamDB'),
      ' · ',
      SE.el('a', { href: `https://barter.vg/steam/app/${appid}/`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'Barter.vg'),
      ' · ',
      SE.el('a', { href: `https://steamcharts.com/app/${appid}`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'SteamCharts')
    );
    body.appendChild(row);
  }

  async function addProtonDB(appid) {
    const body = panelBody(); if (!body) return;
    const r = await SE.api.protonDB(appid);
    if (!r?.ok || !r.data?.tier) return;
    const tier = r.data.tier;
    const tierClass = `se-proton-${tier}`;
    body.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, 'ProtonDB: '),
      SE.el('a', { href: `https://www.protondb.com/app/${appid}`, target: '_blank', rel: 'noopener', class: `se-link ${tierClass}` }, tier.toUpperCase()),
      r.data.total ? ` (${r.data.total} reports)` : ''
    ));
  }

  function addHowLongToBeat() {
    const body = panelBody(); if (!body) return;
    const title = (SE.$('.apphub_AppName')?.textContent || '').trim();
    if (!title) return;
    body.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, 'HowLongToBeat: '),
      SE.el('a', { href: `https://howlongtobeat.com/?q=${encodeURIComponent(title)}`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'Search')
    ));
  }

  async function addPlayersOnline(appid) {
    const body = panelBody(); if (!body) return;
    const r = await SE.api.numPlayers(appid);
    const n = r?.data?.response?.player_count;
    if (typeof n === 'number') {
      body.appendChild(SE.el('div', { class: 'se-row' },
        SE.el('span', { class: 'se-label' }, 'Playing now: '),
        n.toLocaleString()
      ));
    }
  }

  async function addAchievementStats(appid) {
    const body = panelBody(); if (!body) return;
    const r = await SE.api.achievementPercentages(appid);
    const list = r?.data?.achievementpercentages?.achievements;
    if (!Array.isArray(list) || !list.length) return;
    const easiest = list[0];
    const rarest = list[list.length - 1];
    body.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, 'Achievements: '),
      `${list.length} · easiest ${easiest.name} (${Number(easiest.percent).toFixed(1)}%) · rarest ${rarest.name} (${Number(rarest.percent).toFixed(2)}%)`
    ));
  }

  function addDlcOwnership(appid) {
    const dlcRows = SE.$$('.game_area_dlc_row');
    if (!dlcRows.length) return;
    const owned = SE.ctx.colls?.owned;
    if (!owned) return;
    let ownedCount = 0;
    for (const row of dlcRows) {
      const href = row.querySelector('a[href*="/app/"]')?.href || row.getAttribute('data-ds-appid')
                  || row.closest('[data-ds-appid]')?.getAttribute('data-ds-appid');
      const id = href && (href.match(/\/app\/(\d+)/)?.[1] || href);
      if (id && owned.has(String(id))) {
        ownedCount++;
        row.style.outline = '1px solid #5c7e10';
        row.style.background = 'rgba(92,126,16,0.12)';
      }
    }
    const body = panelBody();
    if (body) body.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, 'DLC owned: '),
      `${ownedCount} / ${dlcRows.length}`
    ));
  }

  async function addRegionalPricing(appid) {
    const body = panelBody(); if (!body) return;
    const regions = ['us', 'ar', 'tr', 'ru', 'in', 'br'];
    const wrap = SE.el('div', { class: 'se-row' }, SE.el('span', { class: 'se-label' }, 'Regional: '));
    body.appendChild(wrap);
    for (const cc of regions) {
      const r = await SE.api.appDetails(appid, cc);
      const node = r?.data?.[appid];
      const po = node?.data?.price_overview;
      if (po?.final_formatted) {
        wrap.appendChild(SE.el('span', { class: 'se-region' }, `${cc.toUpperCase()}: ${po.final_formatted}`));
      }
    }
  }

  function addReviewBreakdown() {
    const sub = SE.$('.user_reviews_summary_row .summary.column');
    const tooltip = SE.$('[data-tooltip-html*="reviews"]')?.getAttribute('data-tooltip-html');
    if (!tooltip) return;
    const m = tooltip.match(/(\d+)%[^<]*<br>([\d,]+)\s*user reviews/i);
    if (m) {
      const pct = +m[1], total = +m[2].replace(/,/g, '');
      const positive = Math.round(total * pct / 100);
      const negative = total - positive;
      const body = panelBody();
      body && body.appendChild(SE.el('div', { class: 'se-row' },
        SE.el('span', { class: 'se-label' }, 'Reviews: '),
        `${positive.toLocaleString()} positive · ${negative.toLocaleString()} negative (${pct}%)`
      ));
    }
  }

  async function addCardSetValue(appid) {
    // Heuristic: link out to the badge & market page; computing exact set value requires market scraping.
    const body = panelBody(); if (!body) return;
    body.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, 'Cards: '),
      SE.el('a', { href: `https://steamcommunity.com/market/search?appid=753&category_753_Game[]=tag_app_${appid}&category_753_item_class[]=tag_item_class_2`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'Trading cards market'),
      ' · ',
      SE.el('a', { href: `https://www.steamcardexchange.net/index.php?inventorygame-appid-${appid}`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'Card Exchange')
    ));
  }

  function enhanceWishlistButton() {
    const wishBtn = SE.$('#add_to_wishlist_area');
    if (!wishBtn) return;
    if (!SE.ctx.colls?.wishlist) return;
    const appid = SE.extractAppId();
    if (SE.ctx.colls.wishlist.has(String(appid))) {
      wishBtn.parentElement?.appendChild(SE.tag('On your wishlist', 'good'));
    }
  }
})();
