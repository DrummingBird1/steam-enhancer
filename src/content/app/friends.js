// Store app/sub/bundle pages — Opt-in "owned by friends" panel (needs the user's own Steam Web API key).
// Registers into SE.storePage.panels; src/content/app.js decides which run.
(function () {
  'use strict';
  const SE = window.SteamEnhancer;
  const { panelBody } = SE.storePage;

  // Opt-in: "N of your friends own this game". Requires a user-supplied Steam
  // Web API key (Options). Checks the first `friendsToCheck` friends (30 by
  // default, up to 100; each answer is cached for 6 hours and the requests are
  // spaced out by the service worker); friends with private profiles simply
  // won't show as owning it.

  async function addFriendsOwnership(appid, settings) {
    const key = settings.steamWebApiKey;
    const ownId = await SE.storePage.ownSteamId(key);
    if (!ownId) return;
    const friendsResp = await SE.api.friendsList(ownId, key);
    const friends = friendsResp?.data?.friendslist?.friends || [];
    if (!friends.length) return;

    const n = Math.max(5, Math.min(100, Math.floor(Number(settings.friendsToCheck) || 30)));
    const sample = friends.slice(0, n);
    const status = SE.el('span', { class: 'se-muted' }, SE.t('friendsChecking', 0, sample.length));
    panelBody()?.appendChild(SE.el('div', { class: 'se-row' },
      SE.el('span', { class: 'se-label' }, SE.t('ownedByFriends')), status));
    let ownCount = 0, checked = 0;
    for (const f of sample) {
      const owned = await SE.api.ownedGames(f.steamid, key);
      const games = owned?.data?.response?.games || [];
      checked++;
      if (games.some((g) => String(g.appid) === String(appid))) ownCount++;
      if (checked % 5 === 0 && checked < sample.length) status.textContent = SE.t('friendsChecking', checked, sample.length);
    }
    status.className = '';
    status.textContent = `${ownCount} ${SE.t('ofWord')} ${checked} ${SE.t('friendsCheckedSampled')}`;
  }

  Object.assign(SE.storePage.panels, { addFriendsOwnership });
})();
