// Store /app/, /sub/, /bundle/ pages: decides which panels run. The panels
// themselves live in src/content/app/ (loaded first, see manifest.json).
(function () {
  'use strict';
  const SE = window.SteamEnhancer;

  SE.onReady(() => init());

  async function init() {
    const appid = SE.extractAppId();
    const subid = SE.extractSubId();
    const bundleid = SE.extractBundleId();
    if (!SE.ctx) return;
    const {
      addPriceBox, addRegionalPricing, addPriceChart, addBundleSavings, addStorePriceAlert,
      trackPriceDrop, addExternalLinks, addCommunityLinks, addItadWaitlistLink, addProtonDB,
      addHowLongToBeat, addPlayersOnline, addAchievementStats, addDlcOwnership, addCardSetValue,
      addCardDropsLink, addEarlyAccessBadge, addDrmInfo, addCommunityTags, addNotesBox,
      enhanceWishlistButton, addSubContents, addBoosterCreatorLink, addReviewBreakdown, addReviewFilters,
      addBestReview, addReviewBombDetector, addFriendsOwnership, addDeckStatus
    } = SE.storePage.panels;
    const { insertEnhancerPanel } = SE.storePage;
    const { settings } = SE.ctx;

    // se-ready can fire again on the same page: keep a panel already built
    // for it (rebuilding appended every row a second time), drop one left from
    // a previous SPA route.
    const existing = SE.$('#se-panel');
    if (existing) {
      if (existing.dataset.seFor === String(appid || subid || bundleid)) return;
      existing.remove();
    }

    SE.safe('panel', () => insertEnhancerPanel(appid || subid || bundleid));

    if (appid) {
      if (settings.showLowestPrice || settings.showPriceHistory) SE.safe('priceBox', () => addPriceBox(appid, settings));
      if (settings.showSteamDBLink) SE.safe('externalLinks', () => addExternalLinks(appid));
      if (settings.showProtonDB) SE.safe('protonDB', () => addProtonDB(appid));
      if (settings.showDeckBadge) SE.safe('deck', () => addDeckStatus(appid));
      if (settings.showHowLongToBeat) SE.safe('hltb', () => addHowLongToBeat());
      if (settings.showPlayersOnline) SE.safe('players', () => addPlayersOnline(appid));
      if (settings.showAchievementStats) SE.safe('achievements', () => addAchievementStats(appid));
      if (settings.showDlcCheck) SE.safe('dlc', () => addDlcOwnership(appid));
      if (settings.showRegionalPricing) SE.safe('regional', () => addRegionalPricing(appid, settings));
      if (settings.showReviewBreakdown) SE.safe('reviewBreakdown', () => addReviewBreakdown());
      if (settings.showCardSetValue) SE.safe('cards', () => addCardSetValue(appid));
      SE.safe('earlyAccess', () => addEarlyAccessBadge());
      SE.safe('drm', () => addDrmInfo());
      SE.safe('communityTags', () => addCommunityTags(appid));
      if (settings.showLiveReviewFilters) SE.safe('reviewFilters', () => addReviewFilters());
      SE.safe('cardDrops', () => addCardDropsLink(appid));
      SE.safe('communityLinks', () => addCommunityLinks(appid));
      SE.safe('itadWaitlist', () => addItadWaitlistLink(appid));
      SE.safe('notes', () => addNotesBox(appid));
      if (settings.showPriceHistory) SE.safe('priceChart', () => addPriceChart(appid));
      SE.safe('boosterCreator', () => addBoosterCreatorLink(appid));
      SE.safe('wishBtn', () => enhanceWishlistButton());
      SE.safe('priceDrop', () => trackPriceDrop(appid));
      if (settings.showBundleSavings) SE.safe('bundleSavings', () => addBundleSavings(appid, settings));
      if (settings.showStorePriceAlerts) SE.safe('priceAlert', () => addStorePriceAlert(appid));
      if (settings.showBestReview) SE.safe('bestReview', () => addBestReview());
      if (settings.showReviewBombDetector) SE.safe('reviewBomb', () => addReviewBombDetector(appid));
      if (settings.showFriendsOwnership && settings.steamWebApiKey) SE.safe('friendsOwn', () => addFriendsOwnership(appid, settings));
    }

    if (subid) SE.safe('subContents', () => addSubContents(subid));
  }
})();
