(function () {
  'use strict';
  const SE = window.SteamEnhancer;

  SE.onReady(() => init());

  async function init() {
    const appid = SE.extractAppId();
    const subid = SE.extractSubId();
    const bundleid = SE.extractBundleId();
    if (!SE.ctx) return;
    const { settings } = SE.ctx;

    // If a panel from a previous SPA route is stale, drop it so we rebuild fresh.
    const stale = SE.$('#se-panel');
    if (stale && stale.dataset.seFor && stale.dataset.seFor !== String(appid || subid || bundleid)) {
      stale.remove();
    }

    SE.safe('panel', () => insertEnhancerPanel(appid || subid || bundleid));

    if (appid) {
      if (settings.showLowestPrice || settings.showPriceHistory) SE.safe('priceBox', () => addPriceBox(appid, settings));
      if (settings.showSteamDBLink) SE.safe('externalLinks', () => addExternalLinks(appid));
      if (settings.showProtonDB) SE.safe('protonDB', () => addProtonDB(appid));
      if (settings.showHowLongToBeat) SE.safe('hltb', () => addHowLongToBeat());
      if (settings.showPlayersOnline) SE.safe('players', () => addPlayersOnline(appid));
      if (settings.showAchievementStats) SE.safe('achievements', () => addAchievementStats(appid));
      if (settings.showDlcCheck) SE.safe('dlc', () => addDlcOwnership(appid));
      if (settings.showRegionalPricing) SE.safe('regional', () => addRegionalPricing(appid));
      if (settings.showReviewBreakdown) SE.safe('reviewBreakdown', () => addReviewBreakdown());
      if (settings.showCardSetValue) SE.safe('cards', () => addCardSetValue(appid));
      SE.safe('earlyAccess', () => addEarlyAccessBadge());
      SE.safe('drm', () => addDrmInfo());
      SE.safe('communityTags', () => addCommunityTags(appid));
      if (settings.showLiveReviewFilters) SE.safe('reviewFilters', () => addReviewFilters());
      SE.safe('cardDrops', () => addCardDropsLink(appid));
      SE.safe('communityLinks', () => addCommunityLinks(appid));
      SE.safe('itadWaitlist', () => addItadWaitlistLink(appid));
      SE.safe('notes', () => addNotesBox(appid));
      SE.safe('priceChart', () => addPriceChart(appid));
      SE.safe('boosterCreator', () => addBoosterCreatorLink(appid));
      SE.safe('wishBtn', () => enhanceWishlistButton());
      SE.safe('priceDrop', () => trackPriceDrop(appid));
      if (settings.showBundleSavings) SE.safe('bundleSavings', () => addBundleSavings(appid, settings));
      if (settings.showStorePriceAlerts) SE.safe('priceAlert', () => addStorePriceAlert(appid));
      if (settings.showBestReview) SE.safe('bestReview', () => addBestReview());
      if (settings.showReviewBombDetector) SE.safe('reviewBomb', () => addReviewBombDetector(appid));
      if (settings.showFriendsOwnership && settings.steamWebApiKey) SE.safe('friendsOwn', () => addFriendsOwnership(appid, settings));
    }

    if (subid) SE.safe('subContents', () => addSubContents(subid));
  }

  function insertEnhancerPanel(id) {
    const anchor = SE.$('.game_meta_data') || SE.$('.rightcol') || SE.$('.game_area_purchase');
    if (!anchor || SE.$('#se-panel')) return;
    const panel = SE.el('div', { id: 'se-panel', class: 'se-panel', dataset: { seFor: String(id || '') } },
      SE.el('div', { class: 'se-panel-h' }, SE.t('panelTitle')),
      SE.el('div', { id: 'se-panel-body', class: 'se-panel-body' },
        id ? SE.el('div', { class: 'se-row se-muted' }, `ID ${id}`) : null
      )
    );
    anchor.prepend(panel);
  }
  const panelBody = () => SE.$('#se-panel-body');

  // Shown wherever an ITAD-backed feature has nothing to render because no key
  // is configured (see service-worker.js's withItadKey / prices.js). Opens
  // Options directly rather than just linking generically.
  function itadKeyNotice() {
    return SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-muted' }, SE.t('needsItadKeyMsg') + ' '),
      SE.el('a', {
        href: 'javascript:void 0', class: 'se-link',
        onclick: (e) => { e.preventDefault(); SE.bg({ type: 'openOptions' }); }
      }, SE.t('openOptionsLink'))
    );
  }

  async function addPriceBox(appid, settings) {
    const body = panelBody(); if (!body) return;
    const row = SE.el('div', { class: 'se-row se-price-row' }, SE.el('span', { class: 'se-muted' }, SE.t('checkingDeals')));
    body.appendChild(row);
    const sum = await SE.priceSummary(appid, settings.country || 'us');
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

  function addExternalLinks(appid) {
    const body = panelBody(); if (!body) return;
    body.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, SE.t('links')),
      SE.el('a', { href: `https://steamdb.info/app/${appid}/`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'SteamDB'),
      ' · ',
      SE.el('a', { href: `https://barter.vg/steam/app/${appid}/`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'Barter.vg'),
      ' · ',
      SE.el('a', { href: `https://steamcharts.com/app/${appid}`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'SteamCharts'),
      ' · ',
      SE.el('a', { href: `https://steamspy.com/app/${appid}`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'SteamSpy')
    ));
  }

  function addCommunityLinks(appid) {
    const body = panelBody(); if (!body) return;
    const title = (SE.$('.apphub_AppName')?.textContent || '').trim();
    body.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, SE.t('community')),
      SE.el('a', { href: `https://www.steamgifts.com/giveaways/search?q=${encodeURIComponent(title)}`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'SteamGifts'),
      ' · ',
      SE.el('a', { href: `https://www.steamtrades.com/trades/search?q=${encodeURIComponent(title)}`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'SteamTrades'),
      ' · ',
      SE.el('a', { href: `https://steamcommunity.com/app/${appid}/discussions/`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'Discussions')
    ));
  }

  function addItadWaitlistLink(appid) {
    const body = panelBody(); if (!body) return;
    body.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('a', { href: `https://isthereanydeal.com/wait/?ids=app%2F${appid}`, target: '_blank', rel: 'noopener', class: 'se-link' },
        '🔔 ' + SE.t('addToWaitlist')),
      ' ',
      SE.el('span', { class: 'se-muted' }, `(${SE.t('setPricePerAlerts')})`)
    ));
  }

  async function addProtonDB(appid) {
    const body = panelBody(); if (!body) return;
    const r = await SE.api.protonDB(appid);
    if (!r?.ok || !r.data?.tier) return;
    body.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, SE.t('protonDbLabel')),
      SE.el('a', { href: `https://www.protondb.com/app/${appid}`, target: '_blank', rel: 'noopener', class: `se-link se-proton-${r.data.tier}` }, r.data.tier.toUpperCase()),
      r.data.total ? ` (${r.data.total} ${SE.t('reportsWord')})` : ''
    ));
  }

  function addHowLongToBeat() {
    const body = panelBody(); if (!body) return;
    const title = (SE.$('.apphub_AppName')?.textContent || '').trim();
    if (!title) return;
    body.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, SE.t('hltbLabel')),
      SE.el('a', { href: `https://howlongtobeat.com/?q=${encodeURIComponent(title)}`, target: '_blank', rel: 'noopener', class: 'se-link' }, SE.t('searchWord'))
    ));
  }

  async function addPlayersOnline(appid) {
    const body = panelBody(); if (!body) return;
    const r = await SE.api.numPlayers(appid);
    const n = r?.data?.response?.player_count;
    if (typeof n === 'number') {
      body.appendChild(SE.el('div', { class: 'se-row' },
        SE.el('span', { class: 'se-label' }, SE.t('playingNow')), n.toLocaleString()
      ));
    }
  }

  async function addAchievementStats(appid) {
    const body = panelBody(); if (!body) return;
    const r = await SE.api.achievementPercentages(appid);
    const list = r?.data?.achievementpercentages?.achievements;
    if (!Array.isArray(list) || !list.length) return;
    const easiest = list[0], rarest = list[list.length - 1];
    body.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, SE.t('achievements')),
      `${list.length} · ${SE.t('easiestWord')} ${easiest.name} (${Number(easiest.percent).toFixed(1)}%) · ${SE.t('rarestWord')} ${rarest.name} (${Number(rarest.percent).toFixed(2)}%)`
    ));
  }

  function addDlcOwnership(appid) {
    const dlcRows = SE.$$('.game_area_dlc_row');
    if (!dlcRows.length || !SE.ctx.colls?.owned) return;
    const owned = SE.ctx.colls.owned;
    let ownedCount = 0;
    for (const row of dlcRows) {
      const href = row.querySelector('a[href*="/app/"]')?.href || row.getAttribute('data-ds-appid');
      const id = href && (href.match(/\/app\/(\d+)/)?.[1] || href);
      if (id && owned.has(String(id))) {
        ownedCount++;
        row.style.outline = '1px solid #5c7e10';
        row.style.background = 'rgba(92,126,16,0.12)';
      }
    }
    panelBody()?.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, SE.t('dlcOwned')), `${ownedCount} / ${dlcRows.length}`
    ));
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

  function addReviewBreakdown() {
    const tooltip = SE.$('[data-tooltip-html*="reviews"]')?.getAttribute('data-tooltip-html');
    if (!tooltip) return;
    const m = tooltip.match(/(\d+)%[^<]*<br>([\d,]+)\s*user reviews/i);
    if (!m) return;
    const pct = +m[1], total = +m[2].replace(/,/g, '');
    const positive = Math.round(total * pct / 100);
    panelBody()?.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, SE.t('reviews')),
      `${positive.toLocaleString()} ${SE.t('positiveWord')} · ${(total - positive).toLocaleString()} ${SE.t('negativeWord')} (${pct}%)`
    ));
  }

  function addCardSetValue(appid) {
    panelBody()?.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, SE.t('cards')),
      SE.el('a', { href: `https://steamcommunity.com/market/search?appid=753&category_753_Game[]=tag_app_${appid}&category_753_item_class[]=tag_item_class_2`, target: '_blank', rel: 'noopener', class: 'se-link' }, SE.t('cardsMarket')),
      ' · ',
      SE.el('a', { href: `https://www.steamcardexchange.net/index.php?inventorygame-appid-${appid}`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'Card Exchange')
    ));
  }

  function addCardDropsLink(appid) {
    panelBody()?.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('a', { href: `https://steamcommunity.com/my/gamecards/${appid}/`, target: '_blank', rel: 'noopener', class: 'se-link' }, '🎴 ' + SE.t('remainingCardDrops') + ' →')
    ));
  }

  function addEarlyAccessBadge() {
    const isEA = !!SE.$('.early_access_header') || /early access/i.test(document.body.innerText.slice(0, 4000));
    const isComing = !!SE.$('.game_area_comingsoon') || /coming soon/i.test(document.querySelector('.release_date .date')?.textContent || '');
    if (isEA) panelBody()?.appendChild(SE.el('div', { class: 'se-row' }, SE.tag(SE.t('earlyAccess'), 'wish'), ' ' + SE.t('earlyAccessDesc')));
    if (isComing) panelBody()?.appendChild(SE.el('div', { class: 'se-row' }, SE.tag(SE.t('comingSoon'), 'info'), ' ' + SE.t('comingSoonDesc')));
  }

  function addDrmInfo() {
    const text = (document.querySelector('.DRM_notice')?.textContent || '').toLowerCase();
    const haystack = document.body.innerText.slice(0, 6000).toLowerCase();
    const drms = [];
    if (text.includes('3rd-party drm') || haystack.includes('denuvo')) drms.push('Denuvo');
    if (haystack.includes('rockstar games launcher')) drms.push('Rockstar');
    if (haystack.includes('epic online services') && haystack.includes('login')) drms.push('Epic OS account');
    if (haystack.includes('ubisoft connect')) drms.push('Ubisoft Connect');
    if (haystack.includes('ea app') || haystack.includes('origin')) drms.push('EA App');
    if (haystack.includes('battle.net')) drms.push('Battle.net');
    if (text.includes('3rd-party drm') && !drms.length) drms.push(SE.t('thirdPartyDrm'));
    if (!drms.length) return;
    panelBody()?.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, SE.t('drm')), SE.tag(drms.join(' · '), 'ignored')
    ));
  }

  function addCommunityTags(appid) {
    // Read the tags Steam already rendered into the DOM rather than scraping an
    // HTML endpoint — robust to API changes and needs no network call.
    const tagEls = SE.$$('.glance_tags .app_tag, .popular_tags .app_tag');
    const names = tagEls
      .map(el => el.textContent.trim())
      .filter(t => t && t !== '+');
    if (!names.length) return;
    const tagsRow = SE.el('div', { class: 'se-row' }, SE.el('span', { class: 'se-label' }, SE.t('topTags')));
    names.slice(0, 10).forEach((name) => {
      tagsRow.appendChild(SE.el('a', {
        href: `https://store.steampowered.com/tags/en/${encodeURIComponent(name)}/`,
        target: '_blank', rel: 'noopener', class: 'se-link se-region'
      }, name));
    });
    panelBody()?.appendChild(tagsRow);
  }

  function addReviewFilters() {
    const reviewSection = SE.$('#Reviews_summary') || SE.$('#app_reviews_hash');
    if (!reviewSection) return;
    if (SE.$('#se-review-filters')) return;

    // Reload-based filters: these hand off to Steam's own server-side filtering,
    // so they're reliable but only take effect after a page load.
    const reloadBar = SE.el('div', { class: 'se-toolbar' },
      SE.el('span', { class: 'se-label' }, SE.t('reloadWithFilter')),
      SE.el('a', { class: 'se-btn', href: location.pathname + '?filter=summary&filterLanguage=all' }, SE.t('allLanguages')),
      SE.el('a', { class: 'se-btn', href: location.pathname + '?filter=recent' }, SE.t('recentOnly')),
      SE.el('a', { class: 'se-btn', href: location.pathname + '?filter=summary&review_type=positive' }, SE.t('positiveOnly')),
      SE.el('a', { class: 'se-btn', href: location.pathname + '?filter=summary&review_type=negative' }, SE.t('negativeOnly'))
    );

    // Live filters: apply instantly to whatever review cards are already
    // rendered, and to any more that load in via infinite scroll — no reload.
    // Best-effort against Steam's `.review_box` markup; if that markup ever
    // changes this silently finds zero cards and does nothing (SE.safe-guarded
    // by the caller).
    const minHours = SE.el('input', { type: 'number', min: '0', step: '1', placeholder: SE.t('minHrsPlaceholder'), class: 'se-input', style: { width: '70px' } });
    const minWords = SE.el('input', { type: 'number', min: '0', step: '5', placeholder: SE.t('minWordsPlaceholder'), class: 'se-input', style: { width: '80px' } });
    const recFilter = SE.el('select', { class: 'se-input' },
      SE.el('option', { value: '' }, SE.t('anyRecommendation')),
      SE.el('option', { value: 'yes' }, SE.t('recommendedOnly')),
      SE.el('option', { value: 'no' }, SE.t('notRecommendedOnly'))
    );
    const liveOut = SE.el('span', { class: 'se-muted' }, '');
    const liveBar = SE.el('div', { class: 'se-toolbar' },
      SE.el('span', { class: 'se-label' }, SE.t('liveFilterLabel')),
      minHours, minWords, recFilter,
      SE.el('button', { class: 'se-btn', onclick: applyLiveFilter }, SE.t('applyWord')),
      SE.el('button', { class: 'se-btn', onclick: resetLiveFilter }, SE.t('resetWord')),
      liveOut
    );

    reviewSection.parentElement?.insertBefore(liveBar, reviewSection);
    reviewSection.parentElement?.insertBefore(reloadBar, liveBar);

    let activeFilter = null;

    function cardMatches(card) {
      if (!activeFilter) return true;
      if (activeFilter.minHours > 0) {
        const hTxt = card.querySelector('.hours')?.textContent || '';
        const h = parseFloat((hTxt.match(/([\d,.]+)\s*hrs?/i) || [])[1]?.replace(',', ''));
        if (!isFinite(h) || h < activeFilter.minHours) return false;
      }
      if (activeFilter.minWords > 0) {
        const words = (card.querySelector('.content')?.textContent || '').trim().split(/\s+/).filter(Boolean).length;
        if (words < activeFilter.minWords) return false;
      }
      if (activeFilter.rec) {
        const title = (card.querySelector('.title')?.textContent || '').trim().toLowerCase();
        const isRec = title.includes('recommended') && !title.includes('not recommended');
        if (activeFilter.rec === 'yes' && !isRec) return false;
        if (activeFilter.rec === 'no' && isRec) return false;
      }
      return true;
    }

    function applyToAll() {
      const cards = SE.$$('.review_box');
      let shown = 0;
      for (const card of cards) {
        const match = cardMatches(card);
        card.style.display = match ? '' : 'none';
        if (match) shown++;
      }
      liveOut.textContent = cards.length ? `${shown}/${cards.length} ${SE.t('shownWord')}` : SE.t('noReviewCardsYet');
    }

    function applyLiveFilter() {
      activeFilter = {
        minHours: parseFloat(minHours.value) || 0,
        minWords: parseFloat(minWords.value) || 0,
        rec: recFilter.value
      };
      applyToAll();
    }
    function resetLiveFilter() {
      activeFilter = null;
      minHours.value = ''; minWords.value = ''; recFilter.value = '';
      applyToAll();
    }

    // Re-apply to newly-loaded cards (infinite scroll) without re-scanning the whole page each time.
    if (SE.once('app:review-observer')) {
      new MutationObserver(SE.throttle(() => SE.safe('reviewFilterReapply', applyToAll), 300))
        .observe(document.body, { childList: true, subtree: true });
    }
  }

  async function addNotesBox(appid) {
    const body = panelBody(); if (!body) return;
    const cur = await SE.notes.get(appid);
    const ta = SE.el('textarea', {
      class: 'se-notes', rows: '2',
      placeholder: SE.t('notesPlaceholder')
    });
    ta.value = cur;
    let t;
    ta.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => SE.notes.set(appid, ta.value), 350);
    });
    body.appendChild(SE.el('div', { class: 'se-row' }, SE.el('span', { class: 'se-label' }, SE.t('yourNotes'))));
    body.appendChild(ta);
  }

  function enhanceWishlistButton() {
    const wishBtn = SE.$('#add_to_wishlist_area');
    if (!wishBtn || !SE.ctx.colls?.wishlist) return;
    if (SE.ctx.colls.wishlist.has(String(SE.extractAppId()))) {
      wishBtn.parentElement?.appendChild(SE.tag(SE.t('onWishlist'), 'good'));
    }
  }

  async function addSubContents(subid) {
    // sub/bundle pages already list contents but don't mark owned. Highlight owned items.
    const owned = SE.ctx.colls?.owned;
    if (!owned) return;
    const items = SE.$$('.tab_item, .package_contents li, .bundle_contents li, a[href*="/app/"]');
    let ownedCount = 0, total = 0;
    for (const it of items) {
      const id = it.getAttribute('data-ds-appid') || (it.href || it.innerHTML).match(/\/app\/(\d+)/)?.[1];
      if (!id) continue;
      total++;
      if (owned.has(String(id))) {
        ownedCount++;
        it.style.outline = '1px solid #5c7e10';
        it.style.background = 'rgba(92,126,16,0.12)';
      }
    }
    if (total) panelBody()?.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, SE.t('alreadyOwnedInPackage')), `${ownedCount} / ${total}`
    ));
  }

  async function addPriceChart(appid) {
    const body = panelBody(); if (!body) return;
    const country = SE.ctx.settings.country || 'us';
    // ITAD overview returns price history points; sketch a small SVG sparkline.
    const r = await SE.api.itadOverview((await SE.api.itadLookup(appid))?.data?.game?.id, country);
    // Fallback: get historical low + current as 2-point line if no overview.
    const points = [];
    if (r?.data?.[0]?.lows) {
      for (const p of r.data[0].lows.slice(0, 20).reverse()) {
        if (p.price?.amount && p.timestamp) points.push({ t: new Date(p.timestamp).getTime(), p: p.price.amount });
      }
    }
    if (points.length < 2) return;

    const minP = Math.min(...points.map(p => p.p));
    const svg = SE.sparklineSvg(
      points.map(p => ({ t: p.t, v: p.p })),
      { labelLeft: `${SE.t('lowWord')} ${minP.toFixed(2)}` }
    );
    const wrap = SE.el('div', { class: 'se-row', html: svg });
    body.appendChild(SE.el('div', { class: 'se-row se-label' }, SE.t('priceHistoryLabel')));
    body.appendChild(wrap);
  }

  function addBoosterCreatorLink(appid) {
    panelBody()?.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('a', { href: `https://steamcommunity.com/tradingcards/boostercreator/`, target: '_blank', rel: 'noopener', class: 'se-link' }, '🎁 ' + SE.t('boosterPackCreator')),
      ' · ',
      SE.el('a', { href: `https://steamcommunity.com/my/gamecards/${appid}/?border=1`, target: '_blank', rel: 'noopener', class: 'se-link' }, SE.t('foilCards'))
    ));
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
    const country = settings.country || 'us';

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

  // Surfaces the single most-helpful review already on the page as a quoted
  // snippet, so you don't have to scroll to find it. Reads whatever helpfulness
  // count Steam renders per card ("N people found this review helpful"); if that
  // text pattern isn't present (Steam changed markup), this just finds nothing.
  async function addBestReview() {
    const first = await SE.waitFor('.review_box', { timeout: 3000 });
    if (!first) return;
    let best = null, bestCount = -1;
    for (const card of SE.$$('.review_box')) {
      const m = (card.innerText || '').match(/([\d,]+)\s+people found this review helpful/i);
      const count = m ? parseInt(m[1].replace(/,/g, ''), 10) : 0;
      if (count > bestCount) { bestCount = count; best = card; }
    }
    if (!best || bestCount <= 0) return;
    const snippet = (best.querySelector('.content')?.textContent || '').trim().slice(0, 300);
    if (!snippet) return;
    panelBody()?.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, `${SE.t('mostHelpfulReview')} (${bestCount.toLocaleString()} ${SE.t('foundHelpfulWord')}): `),
      SE.el('div', { class: 'se-quote' }, snippet + (snippet.length >= 300 ? '…' : ''))
    ));
  }

  // Heuristic review-bomb flag: compares the last 3 days' negative ratio
  // (from Steam's own review-graph histogram endpoint) against the longer-run
  // monthly baseline. Flags only when both windows have enough volume to be
  // meaningful and the swing is large, to avoid crying wolf on quiet games.
  async function addReviewBombDetector(appid) {
    const r = await SE.api.reviewHistogram(appid);
    const rollups = r?.data?.results?.rollups;
    const recent = r?.data?.results?.recent;
    if (!Array.isArray(rollups) || !rollups.length || !Array.isArray(recent) || !recent.length) return;

    const stats = (arr) => {
      let up = 0, down = 0;
      for (const p of arr) { up += p.recommendations_up || 0; down += p.recommendations_down || 0; }
      const total = up + down;
      return { total, negRatio: total > 0 ? down / total : 0 };
    };
    const recentStats = stats(recent.slice(-3));
    const baselineStats = stats(rollups.slice(0, -1)); // exclude current partial month
    if (recentStats.total < 20 || baselineStats.total < 50) return;

    const spike = recentStats.negRatio - baselineStats.negRatio;
    if (spike >= 0.25) {
      panelBody()?.appendChild(SE.el('div', { class: 'se-row' },
        SE.tag(SE.t('possibleReviewBomb'), 'ignored'),
        ` ${SE.t('last3Days')} ${Math.round(recentStats.negRatio * 100)}% ${SE.t('negativeVs')} ${Math.round(baselineStats.negRatio * 100)}% ${SE.t('baselineWord')}`
      ));
    }
  }

  // Opt-in: "N of your friends own this game". Requires a user-supplied Steam
  // Web API key (Options). Samples the first 30 friends to stay rate-limit
  // friendly; friends with private profiles simply won't show as owning it.
  async function resolveOwnSteamId64(key) {
    const r = await SE.injectPage(() => window.g_steamID || null);
    if (r?.ok && r.result) return String(r.result);
    const navLinks = SE.$$('#global_actions a, .header_actions_ctn a, a[href*="steamcommunity.com/id/"], a[href*="steamcommunity.com/profiles/"]');
    for (const el of navLinks) {
      const href = el.href;
      if (!href) continue;
      const idMatch = href.match(/\/profiles\/(\d+)/);
      if (idMatch) return idMatch[1];
      const vanityMatch = href.match(/\/id\/([^/]+)/);
      if (vanityMatch) {
        const resolved = await SE.api.resolveVanityUrl(vanityMatch[1], key);
        if (resolved?.data?.response?.success === 1 && resolved.data.response.steamid) return resolved.data.response.steamid;
      }
    }
    return null;
  }

  async function addFriendsOwnership(appid, settings) {
    const key = settings.steamWebApiKey;
    const ownId = await resolveOwnSteamId64(key);
    if (!ownId) return;
    const friendsResp = await SE.api.friendsList(ownId, key);
    const friends = friendsResp?.data?.friendslist?.friends || [];
    if (!friends.length) return;

    const sample = friends.slice(0, 30);
    let ownCount = 0, checked = 0;
    for (const f of sample) {
      const owned = await SE.api.ownedGames(f.steamid, key);
      const games = owned?.data?.response?.games || [];
      checked++;
      if (games.some((g) => String(g.appid) === String(appid))) ownCount++;
    }
    if (!checked) return;
    panelBody()?.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, SE.t('ownedByFriends')),
      `${ownCount} ${SE.t('ofWord')} ${checked} ${SE.t('friendsCheckedSampled')}`
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
})();
