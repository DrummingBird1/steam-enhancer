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
      SE.safe('reviewFilters', () => addReviewFilters());
      SE.safe('cardDrops', () => addCardDropsLink(appid));
      SE.safe('communityLinks', () => addCommunityLinks(appid));
      SE.safe('itadWaitlist', () => addItadWaitlistLink(appid));
      SE.safe('notes', () => addNotesBox(appid));
      SE.safe('priceChart', () => addPriceChart(appid));
      SE.safe('boosterCreator', () => addBoosterCreatorLink(appid));
      SE.safe('wishBtn', () => enhanceWishlistButton());
      SE.safe('priceDrop', () => trackPriceDrop(appid));
      SE.safe('bundleSavings', () => addBundleSavings(appid, settings));
    }

    if (subid) SE.safe('subContents', () => addSubContents(subid));
  }

  function insertEnhancerPanel(id) {
    const anchor = SE.$('.game_meta_data') || SE.$('.rightcol') || SE.$('.game_area_purchase');
    if (!anchor || SE.$('#se-panel')) return;
    const panel = SE.el('div', { id: 'se-panel', class: 'se-panel', dataset: { seFor: String(id || '') } },
      SE.el('div', { class: 'se-panel-h' }, 'Steam Enhancer'),
      SE.el('div', { id: 'se-panel-body', class: 'se-panel-body' },
        id ? SE.el('div', { class: 'se-row se-muted' }, `ID ${id}`) : null
      )
    );
    anchor.prepend(panel);
  }
  const panelBody = () => SE.$('#se-panel-body');

  async function addPriceBox(appid, settings) {
    const body = panelBody(); if (!body) return;
    const row = SE.el('div', { class: 'se-row se-price-row' }, SE.el('span', { class: 'se-muted' }, 'Checking deals…'));
    body.appendChild(row);
    const sum = await SE.priceSummary(appid, settings.country || 'us');
    row.innerHTML = '';
    if (!sum) { row.appendChild(SE.el('span', { class: 'se-muted' }, 'No deal data')); return; }
    const cur = sum.currentLow;
    if (cur) {
      const dispRow = SE.el('div', null,
        SE.el('span', { class: 'se-label' }, 'Lowest now: '),
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
        SE.el('span', { class: 'se-label' }, 'Historical low: '),
        `${SE.formatMoney(h.price, h.currency || 'USD')} @ ${h.shop}${h.cut ? ' (-' + h.cut + '%)' : ''}${date ? ' · ' + date : ''}`
      );
      row.appendChild(histRow);
      SE.fx.toDisplay(h.price, h.currency || 'USD').then((conv) => {
        if (conv) histRow.appendChild(SE.el('span', { class: 'se-muted' }, ` (≈ ${SE.formatMoney(conv.amount, conv.currency)})`));
      });
    }
    if (sum.slug) {
      row.appendChild(SE.el('div', null,
        SE.el('a', { href: `https://isthereanydeal.com/game/${sum.slug}/info/`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'View on ITAD →')
      ));
    }
  }

  function addExternalLinks(appid) {
    const body = panelBody(); if (!body) return;
    body.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, 'Links: '),
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
      SE.el('span', { class: 'se-label' }, 'Community: '),
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
        '🔔 Add to ITAD waitlist'),
      ' ',
      SE.el('span', { class: 'se-muted' }, '(set per-price alerts)')
    ));
  }

  async function addProtonDB(appid) {
    const body = panelBody(); if (!body) return;
    const r = await SE.api.protonDB(appid);
    if (!r?.ok || !r.data?.tier) return;
    body.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, 'ProtonDB: '),
      SE.el('a', { href: `https://www.protondb.com/app/${appid}`, target: '_blank', rel: 'noopener', class: `se-link se-proton-${r.data.tier}` }, r.data.tier.toUpperCase()),
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
        SE.el('span', { class: 'se-label' }, 'Playing now: '), n.toLocaleString()
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
      SE.el('span', { class: 'se-label' }, 'Achievements: '),
      `${list.length} · easiest ${easiest.name} (${Number(easiest.percent).toFixed(1)}%) · rarest ${rarest.name} (${Number(rarest.percent).toFixed(2)}%)`
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
      SE.el('span', { class: 'se-label' }, 'DLC owned: '), `${ownedCount} / ${dlcRows.length}`
    ));
  }

  async function addRegionalPricing(appid) {
    const body = panelBody(); if (!body) return;
    const regions = ['us', 'ar', 'tr', 'ru', 'in', 'br'];
    const wrap = SE.el('div', { class: 'se-row' }, SE.el('span', { class: 'se-label' }, 'Regional: '));
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
      SE.el('span', { class: 'se-label' }, 'Reviews: '),
      `${positive.toLocaleString()} positive · ${(total - positive).toLocaleString()} negative (${pct}%)`
    ));
  }

  function addCardSetValue(appid) {
    panelBody()?.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, 'Cards: '),
      SE.el('a', { href: `https://steamcommunity.com/market/search?appid=753&category_753_Game[]=tag_app_${appid}&category_753_item_class[]=tag_item_class_2`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'Cards market'),
      ' · ',
      SE.el('a', { href: `https://www.steamcardexchange.net/index.php?inventorygame-appid-${appid}`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'Card Exchange')
    ));
  }

  function addCardDropsLink(appid) {
    panelBody()?.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('a', { href: `https://steamcommunity.com/my/gamecards/${appid}/`, target: '_blank', rel: 'noopener', class: 'se-link' }, '🎴 Your remaining card drops →')
    ));
  }

  function addEarlyAccessBadge() {
    const isEA = !!SE.$('.early_access_header') || /early access/i.test(document.body.innerText.slice(0, 4000));
    const isComing = !!SE.$('.game_area_comingsoon') || /coming soon/i.test(document.querySelector('.release_date .date')?.textContent || '');
    if (isEA) panelBody()?.appendChild(SE.el('div', { class: 'se-row' }, SE.tag('EARLY ACCESS', 'wish'), ' This game is in active development.'));
    if (isComing) panelBody()?.appendChild(SE.el('div', { class: 'se-row' }, SE.tag('COMING SOON', 'info'), ' Not released yet.'));
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
    if (text.includes('3rd-party drm') && !drms.length) drms.push('3rd-party DRM');
    if (!drms.length) return;
    panelBody()?.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, 'DRM: '), SE.tag(drms.join(' · '), 'ignored')
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
    const tagsRow = SE.el('div', { class: 'se-row' }, SE.el('span', { class: 'se-label' }, 'Top tags: '));
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
      SE.el('span', { class: 'se-label' }, 'Reload with filter: '),
      SE.el('a', { class: 'se-btn', href: location.pathname + '?filter=summary&filterLanguage=all' }, 'All languages'),
      SE.el('a', { class: 'se-btn', href: location.pathname + '?filter=recent' }, 'Recent only'),
      SE.el('a', { class: 'se-btn', href: location.pathname + '?filter=summary&review_type=positive' }, 'Positive only'),
      SE.el('a', { class: 'se-btn', href: location.pathname + '?filter=summary&review_type=negative' }, 'Negative only')
    );

    // Live filters: apply instantly to whatever review cards are already
    // rendered, and to any more that load in via infinite scroll — no reload.
    // Best-effort against Steam's `.review_box` markup; if that markup ever
    // changes this silently finds zero cards and does nothing (SE.safe-guarded
    // by the caller).
    const minHours = SE.el('input', { type: 'number', min: '0', step: '1', placeholder: 'min hrs', class: 'se-input', style: { width: '70px' } });
    const minWords = SE.el('input', { type: 'number', min: '0', step: '5', placeholder: 'min words', class: 'se-input', style: { width: '80px' } });
    const recFilter = SE.el('select', { class: 'se-input' },
      SE.el('option', { value: '' }, 'Any recommendation'),
      SE.el('option', { value: 'yes' }, 'Recommended only'),
      SE.el('option', { value: 'no' }, 'Not recommended only')
    );
    const liveOut = SE.el('span', { class: 'se-muted' }, '');
    const liveBar = SE.el('div', { class: 'se-toolbar' },
      SE.el('span', { class: 'se-label' }, 'Live filter loaded reviews: '),
      minHours, minWords, recFilter,
      SE.el('button', { class: 'se-btn', onclick: applyLiveFilter }, 'Apply'),
      SE.el('button', { class: 'se-btn', onclick: resetLiveFilter }, 'Reset'),
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
      liveOut.textContent = cards.length ? `${shown}/${cards.length} shown` : 'No review cards found on this page yet.';
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
      placeholder: 'Private notes (saved locally)…'
    });
    ta.value = cur;
    let t;
    ta.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => SE.notes.set(appid, ta.value), 350);
    });
    body.appendChild(SE.el('div', { class: 'se-row' }, SE.el('span', { class: 'se-label' }, 'Your notes:')));
    body.appendChild(ta);
  }

  function enhanceWishlistButton() {
    const wishBtn = SE.$('#add_to_wishlist_area');
    if (!wishBtn || !SE.ctx.colls?.wishlist) return;
    if (SE.ctx.colls.wishlist.has(String(SE.extractAppId()))) {
      wishBtn.parentElement?.appendChild(SE.tag('On your wishlist', 'good'));
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
      SE.el('span', { class: 'se-label' }, 'Already owned in package: '), `${ownedCount} / ${total}`
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
      { labelLeft: `low ${minP.toFixed(2)}` }
    );
    const wrap = SE.el('div', { class: 'se-row', html: svg });
    body.appendChild(SE.el('div', { class: 'se-row se-label' }, 'Price history:'));
    body.appendChild(wrap);
  }

  function addBoosterCreatorLink(appid) {
    panelBody()?.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('a', { href: `https://steamcommunity.com/tradingcards/boostercreator/`, target: '_blank', rel: 'noopener', class: 'se-link' }, '🎁 Booster pack creator'),
      ' · ',
      SE.el('a', { href: `https://steamcommunity.com/my/gamecards/${appid}/?border=1`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'Foil cards')
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
        SE.el('span', { class: 'se-label' }, 'Bundle math: '),
        `${resolved} items separately ≈ ${sum.toFixed(2)} vs bundle ${bundlePrice.toFixed(2)} — `,
        diff > 0.01
          ? SE.tag(`SAVE ${diff.toFixed(2)} in bundle`, 'good')
          : SE.tag('bundle is not cheaper here', 'ignored')
      ));
      break; // one box is enough context
    }
  }

  async function trackPriceDrop(appid) {
    const priceEl = SE.$('.game_purchase_price, .discount_final_price');
    const cur = priceEl ? SE.parsePrice(priceEl.textContent) : null;
    if (cur == null) return;
    const prev = await SE.priceHistory.record(appid, cur);
    if (prev && prev.price > cur) {
      const drop = SE.fmtPercent(prev.price, cur);
      panelBody()?.appendChild(SE.el('div', { class: 'se-row' },
        SE.tag(`PRICE DROP -${drop}%`, 'good'),
        ` since your last visit (${prev.price.toFixed(2)} → ${cur.toFixed(2)})`
      ));
    }
  }
})();
