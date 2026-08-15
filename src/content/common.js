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

  // Steam is a single-page app on many routes; se-ready must re-fire on navigation
  // so per-page scripts re-decorate. Collections are cached, so this is cheap.
  function watchNavigation() {
    if (!SE.once('common:nav-watch')) return;
    SE.onUrlChange(SE.debounce(() => {
      SE.safe('re-ready', ready);
    }, 400));
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

  // Listen for keyboard-shortcut messages from the background.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'togglePanel') {
      const p = document.getElementById('se-panel');
      if (p) p.style.display = (p.style.display === 'none') ? '' : 'none';
    }
  });

  // Changelog modal — shown once after install/update.
  async function maybeShowChangelog() {
    const d = await new Promise((r) => chrome.storage.local.get(['se_show_changelog'], r));
    if (!d.se_show_changelog) return;
    chrome.storage.local.set({ se_show_changelog: false });
    if (location.hostname !== 'store.steampowered.com' || location.pathname !== '/') return;
    if (document.getElementById('se-changelog-modal')) return;
    const v = chrome.runtime.getManifest().version;
    const modal = SE.el('div', { id: 'se-changelog-modal', class: 'se-modal' },
      SE.el('div', { class: 'se-modal-box' },
        SE.el('div', { class: 'se-modal-h' }, `Steam Enhancer v${v}`),
        SE.el('div', { class: 'se-modal-body' },
          SE.el('p', null, 'Thanks for updating!'),
          SE.el('ul', null,
            SE.el('li', null, 'New: trade item-value tables + local trade history, inventory multi-select selling, sort/group tiles, buy-order helper, live review filters, free-promo & price alerts, badge tracker.'),
            SE.el('li', null, 'See the options page (gear icon) — most new features have their own on/off toggle now.'),
            SE.el('li', null, 'Try Ctrl+Shift+S to toggle the panel, Ctrl+Shift+W for wishlist.')
          )
        ),
        SE.el('div', { class: 'se-modal-foot' },
          SE.el('button', { class: 'se-btn', onclick: () => modal.remove() }, 'Got it')
        )
      )
    );
    document.body.appendChild(modal);
  }

  // First-run onboarding tour — shown once, on the store front page, right
  // after a fresh install (not on updates — those get the changelog modal).
  async function maybeShowOnboarding() {
    const d = await new Promise((r) => chrome.storage.local.get(['se_show_onboarding'], r));
    if (!d.se_show_onboarding) return;
    chrome.storage.local.set({ se_show_onboarding: false });
    if (location.hostname !== 'store.steampowered.com' || location.pathname !== '/') return;
    if (document.getElementById('se-onboard-modal')) return;

    const steps = [
      ['🏷️', 'Browse any game page', 'Lowest price, historical low, ProtonDB rating, DLC ownership and more show up automatically in a panel.'],
      ['⭐', 'Highlight owned/wishlisted games', 'Search and store lists mark games you own, have wishlisted, or are ignoring — with an option to hide any of them.'],
      ['💰', 'Market & inventory tools', 'Open your Steam Market or Inventory page for net-after-fee pricing, value estimates, sort/group tiles, and more.'],
      ['⚙️', 'Everything is toggleable', 'Click the floating "SE" badge (bottom-right of any Steam page) any time to open full settings.']
    ];
    const modal = SE.el('div', { id: 'se-onboard-modal', class: 'se-modal' },
      SE.el('div', { class: 'se-modal-box' },
        SE.el('div', { class: 'se-modal-h' }, 'Welcome to Steam Enhancer'),
        SE.el('div', { class: 'se-modal-body' },
          SE.el('div', { class: 'se-onboard-steps' },
            ...steps.map(([icon, title, desc]) => SE.el('div', { class: 'se-onboard-step' },
              SE.el('span', { class: 'se-onboard-icon' }, icon),
              SE.el('div', null, SE.el('strong', null, title), SE.el('div', { class: 'se-muted' }, desc))
            ))
          )
        ),
        SE.el('div', { class: 'se-modal-foot' },
          SE.el('button', { class: 'se-btn', onclick: () => modal.remove() }, "Let's go")
        )
      )
    );
    document.body.appendChild(modal);
  }

  ready()
    .then(() => { injectGlobalBadge(); maybeShowChangelog(); maybeShowOnboarding(); watchNavigation(); })
    .catch((e) => SE.err('init failed', e));
})();
