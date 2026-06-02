(function () {
  'use strict';
  const SE = window.SteamEnhancer;

  document.addEventListener('se-ready', () => init(), { once: true });

  function init() {
    addProfileLinks();
  }

  function addProfileLinks() {
    const profileLink = (SE.$('.actual_persona_name')?.closest('a')?.href) || location.href;
    const steamIdMatch = profileLink.match(/profiles\/(\d+)/);
    const vanityMatch = profileLink.match(/\/id\/([^/]+)/);
    const id = steamIdMatch?.[1] || vanityMatch?.[1];
    if (!id) return;
    const target = SE.$('.profile_header_centered_persona') || SE.$('.profile_header') || SE.$('.responsive_status_info');
    if (!target || SE.$('#se-profile-links')) return;

    const links = SE.el('div', { id: 'se-profile-links', class: 'se-panel' },
      SE.el('div', { class: 'se-panel-h' }, 'Steam Enhancer — profile links'),
      SE.el('div', { class: 'se-panel-body se-row' },
        SE.el('a', { href: `https://steamdb.info/calculator/?player=${id}`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'SteamDB calculator'),
        ' · ',
        SE.el('a', { href: `https://steamladder.com/profile/${id}`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'SteamLadder'),
        ' · ',
        SE.el('a', { href: `https://www.backpack.tf/profiles/${id}`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'Backpack.tf'),
        ' · ',
        SE.el('a', { href: `https://steamrep.com/profiles/${id}`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'SteamRep')
      )
    );
    target.appendChild(links);
  }
})();
