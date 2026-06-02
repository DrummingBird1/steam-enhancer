(function () {
  'use strict';
  const SE = window.SteamEnhancer;

  // Fetch the user's owned/wishlist/ignored app sets once per session and stash.
  async function loadCollections() {
    const settings = await SE.storage.getAll();
    if (!(settings.highlightOwned || settings.highlightWishlist || settings.highlightIgnored
          || settings.hideOwnedInSearch || settings.hideIgnoredInSearch)) return null;
    const cached = await SE.collections.get();
    if (cached && (Date.now() - (cached._ts || 0)) < 10 * 60_000) return cached;
    const resp = await SE.api.dynamicStore();
    if (!resp?.ok || !resp.data) return cached || null;
    const d = resp.data;
    const data = {
      owned: new Set([...(d.rgOwnedApps || []), ...(d.rgOwnedPackages || [])]),
      wishlist: new Set(d.rgWishlist || []),
      ignored: new Set(Object.keys(d.rgIgnoredApps || {})),
      followed: new Set(d.rgFollowedApps || [])
    };
    await SE.collections.set({
      owned: [...data.owned], wishlist: [...data.wishlist],
      ignored: [...data.ignored], followed: [...data.followed]
    });
    return {
      owned: data.owned, wishlist: data.wishlist,
      ignored: data.ignored, followed: data.followed
    };
  }

  // Normalize an Array-or-Set into a Set of strings.
  const toSet = (x) => x instanceof Set ? x : new Set((x || []).map(String));

  async function ready() {
    const settings = await SE.storage.getAll();
    const collsRaw = await loadCollections();
    const colls = collsRaw ? {
      owned: toSet(collsRaw.owned),
      wishlist: toSet(collsRaw.wishlist),
      ignored: toSet(collsRaw.ignored),
      followed: toSet(collsRaw.followed)
    } : null;

    SE.ctx = { settings, colls };
    SE.log('ready', { url: location.href, hasColls: !!colls });

    document.dispatchEvent(new CustomEvent('se-ready', { detail: SE.ctx }));
  }

  // Generic page badge: floating control to open Options.
  function injectGlobalBadge() {
    if (document.getElementById('se-fab')) return;
    const fab = SE.el('div', {
      id: 'se-fab',
      title: 'Steam Enhancer settings',
      onclick: () => SE.bg({ type: 'openOptions' })
    }, 'SE');
    document.body && document.body.appendChild(fab);
  }

  ready().then(injectGlobalBadge).catch((e) => SE.err('init failed', e));
})();
