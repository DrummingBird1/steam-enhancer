// Pure helpers for Steam Web API answers. Shared with the service worker
// (attaches to globalThis); no DOM, no chrome.* — unit-tested.
(function (global) {
  'use strict';
  const SE = global.SteamEnhancer || (global.SteamEnhancer = {});

  SE.steamData = {
    // GetOwnedGames answers with every game's name, playtime and icon, tens of
    // KB per friend — far too much to cache for each of up to 100 friends in
    // chrome.storage.local's 10 MB. "Does this friend own X?" needs only the
    // app ids, so that is all that is kept (same shape, fewer fields).
    ownedAppIds(body) {
      const games = body && body.response && Array.isArray(body.response.games) ? body.response.games : [];
      const kept = games.filter((g) => g && g.appid != null).map((g) => ({ appid: g.appid }));
      return { response: { game_count: kept.length, games: kept } };
    }
  };
})(globalThis);
