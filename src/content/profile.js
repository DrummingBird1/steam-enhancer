(function () {
  'use strict';
  const SE = window.SteamEnhancer;

  SE.onReady(() => init());

  function init() {
    const settings = SE.ctx?.settings || {};
    SE.safe('profile:links', addProfileLinks);
    if (settings.showLibraryValue) SE.safe('profile:library', addLibrarySnapshot);
    if (settings.showBadgeTracker) SE.safe('profile:badges', addBadgeCount);
    if (settings.showMediaShortcuts) SE.safe('profile:media', addMediaShortcuts);
  }

  function resolveId() {
    const profileLink = (SE.$('.actual_persona_name')?.closest('a')?.href) || location.href;
    const steamIdMatch = profileLink.match(/profiles\/(\d+)/);
    const vanityMatch = profileLink.match(/\/id\/([^/]+)/);
    return steamIdMatch?.[1] || vanityMatch?.[1] || null;
  }

  function panelBody() {
    let body = SE.$('#se-profile-panel-body');
    if (body) return body;
    const id = resolveId();
    if (!id) return null;
    const target = SE.$('.profile_header_centered_persona') || SE.$('.profile_header') || SE.$('.responsive_status_info');
    if (!target) return null;
    const panel = SE.el('div', { id: 'se-profile-panel', class: 'se-panel' },
      SE.el('div', { class: 'se-panel-h' }, 'Steam Enhancer'),
      SE.el('div', { id: 'se-profile-panel-body', class: 'se-panel-body' })
    );
    target.appendChild(panel);
    return SE.$('#se-profile-panel-body');
  }

  function addProfileLinks() {
    const id = resolveId();
    const body = panelBody();
    if (!id || !body) return;
    body.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('a', { href: `https://steamdb.info/calculator/?player=${id}`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'SteamDB calculator'),
      ' · ',
      SE.el('a', { href: `https://steamladder.com/profile/${id}`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'SteamLadder'),
      ' · ',
      SE.el('a', { href: `https://www.backpack.tf/profiles/${id}`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'Backpack.tf'),
      ' · ',
      SE.el('a', { href: `https://steamrep.com/profiles/${id}`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'SteamRep')
    ));
  }

  // Shows the last library-page snapshot (game count / total hours) captured
  // by library.js, so the profile page doesn't need its own scrape. Best-effort:
  // only present if you've visited that person's /games page through this
  // browser before, and only if the /id or /profiles slug matches exactly.
  const SNAPSHOT_KEY = 'se_library_snapshot_v1';
  async function addLibrarySnapshot() {
    const key = SE.profileKeyFromPath();
    const body = panelBody();
    if (!key || !body) return;
    const all = await new Promise((r) => chrome.storage.local.get([SNAPSHOT_KEY], (d) => r(d[SNAPSHOT_KEY] || {})));
    const snap = all[key];
    if (!snap) return;
    const daysAgo = Math.round((Date.now() - snap.ts) / 86400000);
    body.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, 'Library (last seen): '),
      `${snap.gameCount} games · ${Math.round(snap.totalMinutes / 60).toLocaleString()} hours total`,
      snap.value != null ? ` · ≈ ${snap.value.toFixed(2)} at current prices` : '',
      daysAgo > 0 ? SE.el('span', { class: 'se-muted' }, ` (${daysAgo}d ago)`) : ''
    ));
  }

  // Shortcut links to a profile's Screenshots / Artwork / Videos community
  // hub sections, with counts if Steam already renders them nearby. No batch
  // download here — that would need the "downloads" host permission for
  // marginal benefit, so this stays a lightweight link panel like the rest of
  // the profile shortcuts.
  function addMediaShortcuts() {
    const id = resolveId();
    const body = panelBody();
    if (!id || !body) return;
    const base = `https://steamcommunity.com/profiles/${id}`;
    body.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, 'Media: ' ),
      SE.el('a', { href: `${base}/screenshots/`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'Screenshots'),
      ' · ',
      SE.el('a', { href: `${base}/videos/`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'Videos'),
      ' · ',
      SE.el('a', { href: `${base}/images/`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'Artwork'),
      ' · ',
      SE.el('a', { href: `${base}/myworkshopfiles/`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'Workshop')
    ));
  }

  // Light badge-count readout: reads what Steam already renders on the profile
  // page (no extra request). Deep per-game achievement tracking would need an
  // authenticated Steam Web API key, which this project intentionally doesn't ship.
  function addBadgeCount() {
    const body = panelBody();
    if (!body) return;
    const badgeLink = SE.$('a[href*="/badges"]');
    const text = badgeLink?.textContent?.trim();
    const m = text && text.match(/(\d+)/);
    if (!m) return;
    body.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, 'Badges: '),
      SE.el('a', { href: badgeLink.href, target: '_blank', rel: 'noopener', class: 'se-link' }, `${m[1]} badges →`)
    ));
  }
})();
