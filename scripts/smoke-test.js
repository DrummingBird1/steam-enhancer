#!/usr/bin/env node
// Standalone regression check — NOT loaded by the extension itself.
//
// This codebase leans on a lot of best-effort CSS selectors and undocumented
// Steam endpoints (documented per-feature in code comments and in
// CHANGELOG.md), because there's no way to unit-test against Steam's real
// markup without a browser. This script is the next best thing: it makes
// real, read-only requests to live Steam pages/endpoints and checks that the
// patterns each feature depends on are still present. It has zero
// dependencies (just Node's built-in fetch, Node 18+) and never touches your
// account — everything it hits is public.
//
// Run manually before a release, or whenever Steam does one of its periodic
// redesigns and things "just stop working":
//
//   node scripts/smoke-test.js
//
// A failing check means the corresponding feature likely needs updating —
// it does NOT mean this script itself is broken.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SteamEnhancer-SmokeTest/1.0';

const checks = [];
function check(name, fn) { checks.push({ name, fn, warnOnly: false }); }
// For checks that can only ever be fully validated with a logged-in Steam
// session (this script is intentionally anonymous/cookie-free) — a failure
// here is a signal to re-check manually while logged in, not a hard failure.
function checkAuthOnly(name, fn) { checks.push({ name, fn, warnOnly: true }); }

check('Store app page: purchase/DLC/tags markup (app.js selectors)', async () => {
  // Portal 2 (appid 620) — stable, always-available, always on sale sometimes.
  const html = await (await fetch('https://store.steampowered.com/app/620/Portal_2/?l=english', { headers: { 'User-Agent': UA } })).text();
  assertIncludes(html, 'game_area_purchase', 'no .game_area_purchase block (used by DRM/price-drop tracking)');
  assertIncludes(html, 'glance_tags', 'no .glance_tags block (used by addCommunityTags)');
  assertIncludes(html, 'apphub_AppName', 'no .apphub_AppName (used by HLTB/community links titles)');
});

check('Store search page: result row markup (search.js selectors)', async () => {
  const html = await (await fetch('https://store.steampowered.com/search/?term=portal', { headers: { 'User-Agent': UA } })).text();
  assertIncludes(html, 'search_result_row', 'no .search_result_row (used to decorate search results)');
});

check('Steam Web API: GetNumberOfCurrentPlayers', async () => {
  const j = await (await fetch('https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=620')).json();
  assertTruthy(typeof j?.response?.player_count === 'number', 'response.player_count missing/not a number');
});

check('Storefront API: appdetails price_overview shape', async () => {
  const j = await (await fetch('https://store.steampowered.com/api/appdetails/?appids=620&cc=us&filters=price_overview,basic')).json();
  assertTruthy(j?.['620']?.success === true, 'appdetails success flag missing');
});

check('Storefront API: featuredcategories (free-promo tracker)', async () => {
  const j = await (await fetch('https://store.steampowered.com/api/featuredcategories?cc=us&l=english')).json();
  assertTruthy(Array.isArray(j?.specials?.items), 'specials.items is not an array');
  if (j.specials.items.length) assertTruthy('discount_percent' in j.specials.items[0], 'item missing discount_percent');
});

check('Storefront API: appreviewhistogram (review-bomb detector)', async () => {
  const j = await (await fetch('https://store.steampowered.com/appreviewhistogram/620?l=english&review_score_preference=0')).json();
  assertTruthy(Array.isArray(j?.results?.rollups), 'results.rollups is not an array');
  assertTruthy(Array.isArray(j?.results?.recent), 'results.recent is not an array');
});

check('Community market: priceoverview endpoint', async () => {
  // Mann Co. Supply Crate Key — near-always listed, good canary item.
  const url = 'https://steamcommunity.com/market/priceoverview/?appid=440&country=US&currency=1&market_hash_name=' + encodeURIComponent('Mann Co. Supply Crate Key');
  const j = await (await fetch(url)).json();
  assertTruthy(j?.success === true, 'priceoverview success flag missing');
  assertTruthy(typeof j.lowest_price === 'string', 'lowest_price missing');
});

checkAuthOnly('Community market: listing page order-book script (market.js buy-order helper)', async () => {
  // NOTE: verified (2026) that Steam does not render Market_LoadOrderSpread(...)
  // for logged-out requests at all (no account_pulldown/login markers either —
  // it looks like a different anonymous template, not a broken selector). This
  // check can only give a real answer with a logged-in session, which this
  // anonymous script intentionally doesn't have. Re-run this specific check
  // manually (DevTools console, logged in, on any market listing page) with:
  //   [...document.scripts].some(s => s.textContent.includes('Market_LoadOrderSpread'))
  const url = 'https://steamcommunity.com/market/listings/440/' + encodeURIComponent('Mann Co. Supply Crate Key');
  const html = await (await fetch(url, { headers: { 'User-Agent': UA } })).text();
  assertIncludes(html, 'Market_LoadOrderSpread(', 'not present in the anonymous page (expected — needs a logged-in check, see note above)');
});

function assertIncludes(haystack, needle, msg) {
  if (!String(haystack).includes(needle)) throw new Error(msg);
}
function assertTruthy(value, msg) {
  if (!value) throw new Error(msg);
}

async function main() {
  let failed = 0, warned = 0;
  for (const { name, fn, warnOnly } of checks) {
    process.stdout.write(`- ${name} ... `);
    try {
      await fn();
      console.log('OK');
    } catch (e) {
      if (warnOnly) { warned++; console.log('WARN (needs a logged-in session to fully verify)'); }
      else { failed++; console.log('FAIL'); }
      console.log(`  ${e.message}`);
    }
  }
  const hardChecks = checks.length - checks.filter((c) => c.warnOnly).length;
  console.log(`\n${hardChecks - failed}/${hardChecks} checks passed` + (warned ? `, ${warned} need manual verification (see WARN above).` : '.'));
  process.exit(failed ? 1 : 0);
}

main();
