(function () {
  'use strict';
  const SE = window.SteamEnhancer;

  SE.onReady(() => init());

  function init() {
    if (!SE.ctx?.settings.showBadgeTracker) return;
    SE.safe('badges:summary', insertSummary);
  }

  // Best-effort against Steam's badges-page markup (.badge_row / .badge_title /
  // .badge_info_description). The badges page is paginated, so this only ever
  // summarizes badges on the currently-loaded page — that's stated explicitly
  // in the output rather than implying it's your full collection.
  function readBadges() {
    return SE.$$('.badge_row').map((row) => {
      const titleEl = row.querySelector('.badge_title');
      const title = titleEl ? (titleEl.childNodes[0]?.textContent || titleEl.textContent || '').trim() : '';
      const desc = row.querySelector('.badge_info_description')?.textContent || '';
      const levelMatch = desc.match(/Level\s+(\d+)/i);
      const xpMatch = desc.match(/([\d,]+)\s*XP/i);
      const remainingMatch = desc.match(/(\d+)\s+more\b/i);
      return {
        title,
        level: levelMatch ? parseInt(levelMatch[1], 10) : 0,
        xp: xpMatch ? parseInt(xpMatch[1].replace(/,/g, ''), 10) : 0,
        remaining: remainingMatch ? parseInt(remainingMatch[1], 10) : null
      };
    }).filter((b) => b.title);
  }

  function insertSummary() {
    if (SE.$('#se-badge-summary')) return;
    const badges = readBadges();
    if (!badges.length) return;
    const anchor = SE.$('.maincontent') || SE.$('#responsive_page_template_content') || document.body;
    if (!anchor) return;

    const totalXp = badges.reduce((s, b) => s + b.xp, 0);
    const owned = badges.filter((b) => b.level > 0);
    const closeToNext = badges
      .filter((b) => b.remaining != null && b.remaining > 0)
      .sort((a, b) => a.remaining - b.remaining)
      .slice(0, 5);

    const panel = SE.el('div', { id: 'se-badge-summary', class: 'se-panel' },
      SE.el('div', { class: 'se-panel-h' }, 'Steam Enhancer — badge summary (this page)'),
      SE.el('div', { class: 'se-panel-body' },
        SE.el('div', { class: 'se-row' },
          `${badges.length} badges shown · ${owned.length} with progress · ${totalXp.toLocaleString()} XP total`
        ),
        closeToNext.length ? SE.el('div', { class: 'se-row' },
          SE.el('span', { class: 'se-label' }, 'Closest to next level: '),
          closeToNext.map((b) => `${b.title} (${b.remaining} more)`).join(' · ')
        ) : null
      )
    );
    anchor.prepend(panel);
  }
})();
