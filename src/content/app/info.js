// Store app/sub/bundle pages — Info panels: links, ProtonDB, players, achievements, DLC/sub ownership,
// DRM, tags, cards, notes.
// Registers into SE.storePage.panels; src/content/app.js decides which run.
(function () {
  'use strict';
  const SE = window.SteamEnhancer;
  const { panelBody } = SE.storePage;

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
    // 404 = no reports for this game (stay quiet); anything else = ProtonDB isn't answering.
    if (!r?.ok && r?.status !== 404) {
      body.appendChild(SE.el('div', { class: 'se-row se-muted' }, SE.t('protonDbLabel'), ' ', SE.t('protonUnavailable')));
      return;
    }
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
    const r = await SE.api.achievementPercentages(appid, SE.steamLanguage());
    const list = (r?.data?.response?.achievements || [])
      .map((a) => ({ name: a.localized_name || a.internal_name, desc: a.localized_desc || '', hidden: !!a.hidden, percent: Number(a.player_percent_unlocked) }))
      .filter((a) => a.name && Number.isFinite(a.percent))
      .sort((a, b) => b.percent - a.percent);
    if (!list.length) return;
    const easiest = list[0], rarest = list[list.length - 1];
    const row = SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, SE.t('achievements')),
      `${list.length} · ${SE.t('easiestWord')} ${easiest.name} (${Number(easiest.percent).toFixed(1)}%) · ${SE.t('rarestWord')} ${rarest.name} (${Number(rarest.percent).toFixed(2)}%)`
    );
    body.appendChild(row);
    SE.safe('myAchievements', () => addMyAchievements(appid, row));
    body.appendChild(achievementList(list));
  }

  // Every achievement with its global unlock percentage, easiest first. Built
  // when opened, and capped, so a game with a thousand of them stays cheap.
  function achievementList(list) {
    const MAX_ROWS = 300;
    const details = SE.el('details', { class: 'se-ach-details' }, SE.el('summary', null, SE.t('achAllList', list.length)));
    details.addEventListener('toggle', () => {
      if (!details.open || details.dataset.seBuilt) return;
      details.dataset.seBuilt = '1';
      details.appendChild(SE.el('table', { class: 'se-ach-table' },
        ...list.slice(0, MAX_ROWS).map((a) => SE.el('tr', null,
          SE.el('td', { class: 'se-ach-pct' }, `${a.percent.toFixed(1)}%`),
          SE.el('td', null,
            SE.el('strong', null, a.name),
            a.hidden ? SE.tag(SE.t('achHidden'), 'ignored') : null,
            a.desc ? SE.el('div', { class: 'se-muted' }, a.desc) : null)))));
      if (list.length > MAX_ROWS) details.appendChild(SE.el('div', { class: 'se-muted' }, SE.t('achShowingFirst', MAX_ROWS, list.length)));
    });
    return details;
  }

  // Your own progress, for a game you own — only with your Steam Web API key
  // (Options), since Steam's API won't say without one.
  async function addMyAchievements(appid, row) {
    const key = SE.ctx.settings.steamWebApiKey;
    if (!key || !SE.ctx.colls?.owned?.has(String(appid))) return;
    const me = await SE.storePage.ownSteamId(key);
    if (!me) return;
    const r = await SE.api.playerAchievements(appid, me, key);
    const list = r?.data?.playerstats?.achievements;
    if (!Array.isArray(list) || !list.length) return;
    const done = list.filter((a) => a.achieved === 1).length;
    const pct = Math.round((done / list.length) * 100);
    const bar = SE.el('span', { class: 'se-progress' }, SE.el('span', { style: { width: `${pct}%` } }));
    row.after(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, SE.t('myAchievements')), bar, ` ${done}/${list.length} (${pct}%)`,
      done === list.length ? SE.tag(SE.t('perfectGame'), 'good') : ''));
  }

  // Steam Deck compatibility from Steam's store API.
  async function addDeckStatus(appid) {
    const r = await SE.api.storeItems([appid], SE.ctx.country);
    const cat = (r?.data?.response?.store_items || []).find((s) => String(s.appid) === String(appid))?.platforms?.steam_deck_compat_category;
    const deck = SE.deckLabel(cat);
    if (!deck) return;
    panelBody()?.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, 'Steam Deck:'), SE.tag(SE.t(deck[0]), deck[1])));
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
      SE.el('a', { href: `https://steamcommunity.com/my/gamecards/${appid}/`, target: '_blank', rel: 'noopener', class: 'se-link' }, '🎴 ' + SE.t('remainingCardDrops') + ' ' + SE.arrow())
    ));
  }

  function addEarlyAccessBadge() {
    // Markup only: the old text checks only worked in English and matched the
    // store's own "Early Access" navigation links.
    const isEA = !!SE.$('.early_access_header, #earlyAccessHeader');
    const isComing = !!SE.$('.game_area_comingsoon');
    if (isEA) panelBody()?.appendChild(SE.el('div', { class: 'se-row' }, SE.tag(SE.t('earlyAccess'), 'wish'), ' ' + SE.t('earlyAccessDesc')));
    if (isComing) panelBody()?.appendChild(SE.el('div', { class: 'se-row' }, SE.tag(SE.t('comingSoon'), 'info'), ' ' + SE.t('comingSoonDesc')));
  }

  function addDrmInfo() {
    // Only look where Steam states DRM/account requirements: the DRM notices,
    // the purchase-area notes and the system requirements — not the whole page,
    // where game descriptions mention launchers and words like "original".
    const text = SE.$$('.DRM_notice').map((el) => el.textContent).join(' ').toLowerCase();
    const haystack = (text + ' ' + SE.$$('.game_area_purchase .game_area_purchase_platform, .game_area_sys_req, .game_meta_data')
      .map((el) => el.textContent).join(' ')).toLowerCase();
    const has = (re) => re.test(haystack);
    const drms = [];
    if (has(/\bdenuvo\b/)) drms.push('Denuvo');
    if (has(/\brockstar games launcher\b/)) drms.push('Rockstar');
    if (has(/\bepic online services\b/) && has(/\b(account|login)\b/)) drms.push('Epic OS account');
    if (has(/\bubisoft connect\b|\buplay\b/)) drms.push('Ubisoft Connect');
    if (has(/\bea app\b|\bea account\b|\borigin client\b/)) drms.push('EA App');
    if (has(/\bbattle\.net\b/)) drms.push('Battle.net');
    if (/3rd-party drm/.test(text) && !drms.length) drms.push(SE.t('thirdPartyDrm'));
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

  function addBoosterCreatorLink(appid) {
    panelBody()?.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('a', { href: `https://steamcommunity.com/tradingcards/boostercreator/`, target: '_blank', rel: 'noopener', class: 'se-link' }, '🎁 ' + SE.t('boosterPackCreator')),
      ' · ',
      SE.el('a', { href: `https://steamcommunity.com/my/gamecards/${appid}/?border=1`, target: '_blank', rel: 'noopener', class: 'se-link' }, SE.t('foilCards'))
    ));
  }

  Object.assign(SE.storePage.panels, { addExternalLinks, addCommunityLinks, addItadWaitlistLink, addProtonDB, addHowLongToBeat, addPlayersOnline, addAchievementStats, addDlcOwnership, addCardSetValue, addCardDropsLink, addEarlyAccessBadge, addDrmInfo, addCommunityTags, addNotesBox, enhanceWishlistButton, addSubContents, addBoosterCreatorLink, addDeckStatus });
})();
