// Store app/sub/bundle pages — shared panel scaffolding. Loaded before the
// panel files in src/content/app/ and the orchestrator in src/content/app.js.
(function () {
  'use strict';
  const SE = window.SteamEnhancer;

  function insertEnhancerPanel(id) {
    const anchor = SE.$('.game_meta_data') || SE.$('.rightcol') || SE.$('.game_area_purchase');
    if (SE.$('#se-panel')) return;
    if (!anchor) {
      // The app's title is there but none of the places we attach to: Steam
      // changed the page (an age gate or a removed app has no title either).
      if (SE.$('#appHubAppName, .apphub_AppName')) SE.health.miss('storePanel', 'healthFeatureStorePanel');
      return;
    }
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

  // The signed-in user's SteamID64: Steam's page global, else a profile link
  // in the header (resolving a vanity URL needs the user's Web API key).
  async function ownSteamId(key) {
    const r = await SE.pageCall('steamId');
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

  SE.storePage = { panels: {}, insertEnhancerPanel, panelBody, itadKeyNotice, ownSteamId };
})();
