// Store app/sub/bundle pages — Review panels: breakdown, reload/live filters, most-helpful snippet,
// review-bomb heuristic.
// Registers into SE.storePage.panels; src/content/app.js decides which run.
(function () {
  'use strict';
  const SE = window.SteamEnhancer;
  const { panelBody } = SE.storePage;

  function addReviewBreakdown() {
    // The all-time summary row carries itemprop="aggregateRating"; its tooltip
    // is localized ("98% of the 174,783 user reviews…", "99 % der 8.757 …"),
    // so only the numbers are read. Until 1.4.x this matched an English
    // pattern with a <br> the tooltip no longer has, and never showed.
    const row = SE.$('.user_reviews_summary_row[itemprop="aggregateRating"]') || SE.$('.user_reviews_summary_row');
    const summary = SE.parseReviewSummary(
      row?.getAttribute('data-tooltip-html'),
      SE.$('meta[itemprop="reviewCount"]')?.getAttribute('content')
    );
    if (!summary) return;
    const { pct, total } = summary;
    const positive = Math.round(total * pct / 100);
    panelBody()?.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, SE.t('reviews')),
      `${positive.toLocaleString()} ${SE.t('positiveWord')} · ${(total - positive).toLocaleString()} ${SE.t('negativeWord')} (${pct}%)`
    ));
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
        // "1,234.5 hrs on record", "1.234,5 Std. insgesamt", … — the first number.
        const h = SE.parsePrice(card.querySelector('.hours')?.textContent);
        if (!isFinite(h) || h < activeFilter.minHours) return false;
      }
      if (activeFilter.minWords > 0) {
        const words = (card.querySelector('.content')?.textContent || '').trim().split(/\s+/).filter(Boolean).length;
        if (words < activeFilter.minWords) return false;
      }
      if (activeFilter.rec) {
        const isRec = isRecommended(card);
        if (isRec == null) return false;
        if (activeFilter.rec === 'yes' && !isRec) return false;
        if (activeFilter.rec === 'no' && isRec) return false;
      }
      return true;
    }

    let filterWasActive = false;
    function applyToAll() {
      // Nothing to do (and nothing to undo) while no filter has been applied —
      // this runs on every DOM change via the observer below.
      if (!activeFilter && !filterWasActive) return;
      filterWasActive = !!activeFilter;
      const cards = SE.$$('.review_box');
      let shown = 0;
      for (const card of cards) {
        const match = cardMatches(card);
        card.style.display = match ? '' : 'none';
        if (match) shown++;
      }
      // Only touch the label when it changes: writing it is itself a DOM
      // mutation, which would otherwise re-trigger the observer forever.
      const label = cards.length ? `${shown}/${cards.length} ${SE.t('shownWord')}` : SE.t('noReviewCardsYet');
      if (liveOut.textContent !== label) liveOut.textContent = label;
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

  // Thumbs icon, not the localized "Recommended" title: true/false, or null if
  // the card has no thumb icon at all.
  function isRecommended(card) {
    const src = card.querySelector('.thumb img')?.getAttribute('src') || '';
    if (/thumbsUp/i.test(src)) return true;
    if (/thumbsDown/i.test(src)) return false;
    return null;
  }

  // Surfaces the single most-helpful review already on the page as a quoted
  // snippet, so you don't have to scroll to find it. Reads the first number of
  // each card's vote line ("N people found this review helpful", in any
  // language); if Steam changes that markup, this just finds nothing.
  async function addBestReview() {
    const first = await SE.waitFor('.review_box', { timeout: 3000 });
    if (!first) return;
    let best = null, bestCount = -1;
    for (const card of SE.$$('.review_box')) {
      const count = Math.round(SE.parsePrice(card.querySelector('.vote_info')?.textContent) || 0);
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

  Object.assign(SE.storePage.panels, { addReviewBreakdown, addReviewFilters, addBestReview, addReviewBombDetector });
})();
