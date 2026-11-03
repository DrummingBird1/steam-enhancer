(function () {
  'use strict';
  const SE = window.SteamEnhancer;

  // Fetch the user's owned/wishlist/ignored app sets once per session and stash.
  async function loadCollections() {
    const settings = await SE.storage.getAll();
    if (!(settings.highlightOwned || settings.highlightWishlist || settings.highlightIgnored
          || settings.hideOwnedInSearch || settings.hideIgnoredInSearch)) return null;
    const cached = await SE.collections.get();
    if (cached?.ownedPackages && (Date.now() - (cached._ts || 0)) < 10 * 60_000) return cached;
    const resp = await SE.api.dynamicStore();
    if (!resp?.ok || !resp.data) return cached || null;
    const d = resp.data;
    // App ids and package (sub) ids are separate number spaces — until 1.4.x
    // they were merged into one set, so owning sub 12345 marked app 12345 as owned.
    const data = {
      owned: d.rgOwnedApps || [],
      ownedPackages: d.rgOwnedPackages || [],
      wishlist: d.rgWishlist || [],
      ignored: Object.keys(d.rgIgnoredApps || {}),
      followed: d.rgFollowedApps || []
    };
    await SE.collections.set(data);
    return { ...data, _ts: Date.now() };
  }

  // Remember the storefront country Steam reports on this page so community
  // pages and the background alarms price things for the same country.
  async function detectCountry() {
    const KEY = 'se_detected_country';
    const stored = (await new Promise((r) => chrome.storage.local.get([KEY], r)))[KEY] || null;
    const fromPage = SE.pageCountry();
    if (fromPage && fromPage !== stored) chrome.storage.local.set({ [KEY]: fromPage });
    return fromPage || stored;
  }

  // Normalize an Array-or-Set into a Set of strings.
  const toSet = (x) => x instanceof Set ? x : new Set((x || []).map(String));

  async function ready() {
    const settings = await SE.storage.getAll();
    const collsRaw = await loadCollections();
    // A cache written by 1.4.x has no ownedPackages and a polluted `owned` set.
    const stale = collsRaw && !collsRaw.ownedPackages;
    const colls = collsRaw && !stale ? {
      owned: toSet(collsRaw.owned),
      ownedPackages: toSet(collsRaw.ownedPackages),
      wishlist: toSet(collsRaw.wishlist),
      ignored: toSet(collsRaw.ignored),
      followed: toSet(collsRaw.followed)
    } : null;
    const country = SE.effectiveCountry(settings, await detectCountry());

    SE.ctx = { settings, colls, country };
    // Hebrew/Arabic/Persian UI: our own panels read right to left (CSS keys
    // off this class); Steam's page itself is left as it is.
    document.documentElement.classList.toggle('se-ui-rtl', SE.uiDir() === 'rtl');
    // Pages with g_rgWalletInfo (inventory, market home…) record the wallet
    // currency; the Market Beta item page has none and relies on it.
    if (location.hostname === 'steamcommunity.com') SE.safe('wallet', () => SE.walletCurrency());
    applyCustomCss(settings.customCss);
    SE.log('ready', { url: location.href, hasColls: !!colls });

    document.dispatchEvent(new CustomEvent('se-ready', { detail: SE.ctx }));
  }

  // Options → Advanced → custom CSS, applied to every Steam page. Updated in
  // place on SPA navigation; removed when cleared.
  function applyCustomCss(css) {
    let el = document.getElementById('se-custom-css');
    if (!css) { el?.remove(); return; }
    if (!el) {
      el = document.createElement('style');
      el.id = 'se-custom-css';
      (document.head || document.documentElement).appendChild(el);
    }
    if (el.textContent !== css) el.textContent = css;
  }

  // Steam is a single-page app on many routes; se-ready must re-fire on navigation
  // so per-page scripts re-decorate. Collections are cached, so this is cheap.
  // A change of only the #fragment (store pages jump to #app_reviews_hash,
  // the inventory switches games by hash) isn't a new page.
  function watchNavigation() {
    if (!SE.once('common:nav-watch')) return;
    const page = () => location.href.split('#')[0];
    let last = page();
    SE.onUrlChange(SE.debounce(() => {
      if (page() === last) return;
      last = page();
      SE.safe('re-ready', ready);
    }, 400));
  }

  // Generic page badge: floating control to open Options.
  function injectGlobalBadge() {
    if (document.getElementById('se-fab')) return;
    const fab = SE.el('div', {
      id: 'se-fab',
      title: SE.t('fabTitle'),
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

  // Where a one-time modal may pop up: the first Steam page after an update or
  // install (until 1.5.0 only the store front page, which people who go
  // straight to their inventory or the market might not open for weeks) —
  // but never over checkout, sign-in, account or trade pages.
  const MODAL_HOSTS = ['store.steampowered.com', 'steamcommunity.com'];
  const QUIET_PATHS = /^\/(checkout|cart|login|account|tradeoffer|mobileconf)/i;
  const modalAllowedHere = () => MODAL_HOSTS.includes(location.hostname) && !QUIET_PATHS.test(location.pathname);

  // Changelog modal — shown once after install/update.
  async function maybeShowChangelog() {
    const d = await new Promise((r) => chrome.storage.local.get(['se_show_changelog'], r));
    if (!d.se_show_changelog) return;
    // The flag stays set until a page that can show it (1.4.x cleared it on
    // whatever Steam page came first, and showed it only on the front page).
    if (!modalAllowedHere()) return;
    chrome.storage.local.set({ se_show_changelog: false });
    if (document.getElementById('se-changelog-modal')) return;
    const v = chrome.runtime.getManifest().version;
    const modal = SE.el('div', { id: 'se-changelog-modal', class: 'se-modal' },
      SE.el('div', { class: 'se-modal-box', dir: SE.uiDir() },
        SE.el('div', { class: 'se-modal-h' }, `Steam Enhancer v${v}`),
        SE.el('div', { class: 'se-modal-body' },
          SE.el('p', null, SE.t('thanksForUpdating')),
          SE.el('ul', null,
            SE.el('li', { style: { fontWeight: 'bold' } }, SE.t('changelogItadKey')),
            SE.el('li', null, SE.t('changelog150Wishlist')),
            SE.el('li', null, SE.t('changelog150Market')),
            SE.el('li', null, SE.t('changelog150Selling')),
            SE.el('li', null, SE.t('changelog150Alerts')),
            SE.el('li', null, SE.t('changelog150Options')),
            SE.el('li', null, SE.t('changelog150Country')),
            SE.el('li', null, SE.t('changelogShortcuts'))
          )
        ),
        SE.el('div', { class: 'se-modal-foot' },
          SE.el('button', { class: 'se-btn', onclick: () => modal.remove() }, SE.t('gotIt'))
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
    if (!modalAllowedHere()) return;
    chrome.storage.local.set({ se_show_onboarding: false });
    if (document.getElementById('se-onboard-modal')) return;

    const steps = [
      ['🏷️', SE.t('obStep1Title'), SE.t('obStep1Desc')],
      ['⭐', SE.t('obStep2Title'), SE.t('obStep2Desc')],
      ['💰', SE.t('obStep3Title'), SE.t('obStep3Desc')],
      ['⚙️', SE.t('obStep4Title'), SE.t('obStep4Desc')]
    ];
    const modal = SE.el('div', { id: 'se-onboard-modal', class: 'se-modal' },
      SE.el('div', { class: 'se-modal-box', dir: SE.uiDir() },
        SE.el('div', { class: 'se-modal-h' }, SE.t('welcomeTitle')),
        SE.el('div', { class: 'se-modal-body' },
          SE.el('div', { class: 'se-onboard-steps' },
            ...steps.map(([icon, title, desc]) => SE.el('div', { class: 'se-onboard-step' },
              SE.el('span', { class: 'se-onboard-icon' }, icon),
              SE.el('div', null, SE.el('strong', null, title), SE.el('div', { class: 'se-muted' }, desc))
            ))
          )
        ),
        SE.el('div', { class: 'se-modal-foot' },
          SE.el('button', { class: 'se-btn', onclick: () => modal.remove() }, SE.t('letsGo'))
        )
      )
    );
    document.body.appendChild(modal);
  }

  ready()
    .then(() => { injectGlobalBadge(); maybeShowChangelog(); maybeShowOnboarding(); watchNavigation(); })
    .catch((e) => SE.err('init failed', e));
})();
