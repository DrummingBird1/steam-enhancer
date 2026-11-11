#!/usr/bin/env node
// Signed-in regression check — drives a real browser with the extension loaded
// through the pages the anonymous smoke test can't reach, and reports
// PASS / FAIL / SKIP per tool. Developer tooling: not shipped, not run by CI.
//
//   node scripts/signed-in-check.js [--no-wait] [--trade-url <tradeoffer url>]
//
// How it works: it launches a fresh Chromium/Chrome profile in a temp folder
// with this repo loaded as an unpacked extension and opens Steam's sign-in
// page. YOU sign in (the script never types credentials or touches the
// password field); press Enter in the terminal when done. It then visits the
// pages below, reads the DOM, and clicks only read-only buttons. It never
// clicks anything that sells, lists, removes, buys or confirms.
//
// At the end it asks you to sign out in that window, closes the browser and
// deletes the temp profile, so no session stays on disk.
//
// Needs `playwright-core` (not a dependency of this repo, so nothing to
// install for the extension itself): have it resolvable, or point
// PLAYWRIGHT_CORE at its folder. Set CHROME_PATH to a Chrome/Chromium
// executable if Playwright's own browser isn't installed.
//
//   PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core \
//   CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe" \
//   node scripts/signed-in-check.js
//
// Notes learned the hard way: a command-line-loaded extension is DISABLED if
// you reload it from chrome://extensions or chrome.runtime.reload(), so to
// test code changes run this script again (it starts a fresh browser). The
// Steam pages the checks target are described in docs/TESTING-1.5.0.md.
//
// --no-wait skips the sign-in prompt: checks that need a session are SKIPped
// and the rest run (useful for the anonymous part, or a quick sanity run).

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

function loadPlaywright() {
  const tries = [() => require('playwright-core'), () => require(process.env.PLAYWRIGHT_CORE)];
  for (const t of tries) { try { return t(); } catch { /* next */ } }
  console.error('playwright-core not found. Install it somewhere and set PLAYWRIGHT_CORE to its folder (see the header of this file).');
  process.exit(2);
}

const results = [];
const PASS = 'PASS', FAIL = 'FAIL', SKIP = 'SKIP';
class Skip extends Error {}
const skip = (why) => { throw new Skip(why); };
async function check(name, fn) {
  try {
    const note = await fn();
    results.push({ name, status: PASS, note: note || '' });
  } catch (e) {
    if (e instanceof Skip) results.push({ name, status: SKIP, note: e.message });
    else results.push({ name, status: FAIL, note: String(e.message || e).split('\n')[0] });
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const ask = (q) => new Promise((res) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(q, () => { rl.close(); res(); });
});

(async () => {
  const { chromium } = loadPlaywright();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'se-signed-in-'));
  const executablePath = process.env.CHROME_PATH || undefined;
  const ctx = await chromium.launchPersistentContext(profile, {
    executablePath, headless: false, viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${ROOT}`, `--load-extension=${ROOT}`, '--lang=en-US']
  });
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const page = ctx.pages()[0] || await ctx.newPage();
  const extMsgs = [];
  page.on('console', (m) => {
    const t = m.text();
    if ((m.type() === 'warning' || m.type() === 'error') && /SteamEnhancer|\[SE\]/.test(t)) extMsgs.push(t.slice(0, 160));
  });
  const go = async (url, wait = 7000) => { await page.goto(url, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(wait); };
  const ev = (fn, arg) => page.evaluate(fn, arg);

  let extId = null;
  let signedIn = false;
  try {
    await check('extension loads', async () => {
      let [sw] = ctx.serviceWorkers();
      if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
      extId = sw.url().split('/')[2];
      return `id ${extId.slice(0, 8)}…, manifest ${manifest.version}`;
    });

    if (!flag('--no-wait')) {
      await go('https://steamcommunity.com/login/home/', 1500);
      console.log('\nA browser window opened on Steam\'s sign-in page.');
      console.log('Sign in there yourself (the script never touches your credentials).');
      await ask('When you are signed in, press Enter here to start the checks… ');
    }

    await go('https://steamcommunity.com/my/inventory/', 7000);
    signedIn = await ev(() => !!window.g_steamID);
    await check('signed in to Steam', async () => (signedIn ? 'yes' : skip('not signed in — checks that need a session are skipped')));
    const needSession = () => { if (!signedIn) skip('needs a signed-in session'); };

    // ---- store game page (works anonymously) ----
    await check('store page panel (rows, no duplicates on #hash)', async () => {
      await go('https://store.steampowered.com/app/620/?cc=us', 9000);
      const rows = () => ev(() => document.querySelectorAll('#se-panel-body > .se-row').length);
      const before = await rows();
      assert(before >= 8, `only ${before} rows in the panel`);
      await ev(() => { location.hash = 'app_reviews_hash'; });
      await page.waitForTimeout(3000);
      const after = await rows();
      assert(after === before, `rows went ${before} → ${after} after a # change`);
      return `${before} rows`;
    });
    await check('store search rows decorated', async () => {
      await go('https://store.steampowered.com/search/?specials=1&cc=us', 8000);
      const n = await ev(() => document.querySelectorAll('.se-hide-btn').length);
      assert(n > 0, 'no result rows were decorated');
      return `${n} rows`;
    });

    // ---- inventory ----
    await check('inventory toolbar and item pane', async () => {
      needSession();
      await go('https://steamcommunity.com/my/inventory/', 7000);
      assert(await ev(() => !!document.getElementById('se-inv-toolbar')), 'no toolbar');
      const info = await ev(async () => {
        const tile = [...document.querySelectorAll('.itemHolder .item')].find((t) => t.offsetParent);
        if (!tile) return null;
        tile.click();
        await new Promise((r) => setTimeout(r, 3000));
        const pane = [document.getElementById('iteminfo0'), document.getElementById('iteminfo1')].find((p) => p && p.offsetParent);
        return { link: pane?.querySelector('a.se-quicksell')?.href || null };
      });
      if (!info) skip('inventory is empty');
      assert(info.link && /\/market\/listings\/\d+\//.test(info.link), 'item pane has no "View on Market" link');
      return 'toolbar + pane link';
    });

    // ---- market ----
    await check('market search rows: one "you receive" label each', async () => {
      needSession();
      await go('https://steamcommunity.com/market/', 7000);
      const { net, dup } = await ev(() => ({
        net: document.querySelectorAll('.se-market-net').length,
        dup: [...document.querySelectorAll('.market_listing_price')].filter((p) => p.querySelectorAll('.se-market-net').length > 1).length
      }));
      assert(net > 0, 'no labels');
      assert(dup === 0, `${dup} cells have the label twice`);
      return `${net} labels`;
    });
    await check('market item page tools + price chart', async () => {
      needSession();
      await go('https://steamcommunity.com/market/listings/753/753-Sack%20of%20Gems', 9000);
      const kind = await ev(() => (document.getElementById('se-mkt-tools') ? (document.querySelector('.se-market-float') ? 'beta' : 'classic') : null));
      assert(kind, 'no tools panel (Steam changed the item page?)');
      const chart = await ev(async () => {
        const btn = [...document.querySelectorAll('#se-mkt-tools button')].find((b) => /history|היסטוריית|Preisverlauf/i.test(b.textContent)) || document.querySelector('#se-mkt-tools button');
        btn.click();
        for (let i = 0; i < 20; i++) { await new Promise((r) => setTimeout(r, 1000)); if (document.querySelector('#se-mkt-out svg')) return true; }
        return false;
      });
      assert(chart, 'price-history chart did not draw');
      return `${kind} page, chart drawn`;
    });

    // ---- wishlist, library, badges ----
    await check('wishlist panel with rows', async () => {
      needSession();
      await go('https://store.steampowered.com/wishlist/', 14000);
      const r = await ev(() => ({ panel: !!document.getElementById('se-wl-panel'), rows: document.querySelectorAll('#se-wl-panel tbody tr').length }));
      assert(r.panel, 'no panel');
      if (!r.rows) skip('wishlist is empty or private');
      return `${r.rows} rows`;
    });
    await check('library bar (game count)', async () => {
      needSession();
      await go('https://steamcommunity.com/my/games/?tab=all', 12000);
      const t = await ev(() => document.getElementById('se-library-toolbar')?.textContent || null);
      assert(t, 'no library bar');
      return t.slice(0, 40);
    });
    await check('badges summary', async () => {
      needSession();
      await go('https://steamcommunity.com/my/badges/', 6000);
      assert(await ev(() => !!document.getElementById('se-badge-summary')), 'no summary');
    });

    // ---- trade offer (needs a partner; pass --trade-url) ----
    await check('trade offer summary panel', async () => {
      needSession();
      const url = opt('--trade-url');
      if (!url) skip('pass --trade-url <a tradeoffer/new/?partner=… link> to check it');
      await go(url, 9000);
      assert(await ev(() => !!document.getElementById('se-trade-summary')), 'no summary panel');
    });

    // ---- extension pages ----
    await check('options page + help report', async () => {
      await go(`chrome-extension://${extId}/src/options/options.html#help`, 2000);
      const v = await ev(() => document.querySelector('textarea.report')?.value || '');
      assert(v.includes(`Steam Enhancer ${manifest.version}`), 'report missing the version');
      assert(!/key|secret/i.test(v.replace(/key set: (yes|no)/gi, '')), 'report text mentions a key');
      return 'report built';
    });
    await check('popup opens', async () => {
      await go(`chrome-extension://${extId}/src/popup/popup.html`, 1500);
      assert(await ev(() => document.querySelectorAll('input[type=checkbox]').length >= 5), 'toggles missing');
    });
    await check('no extension warnings on the pages visited', async () => {
      assert(extMsgs.length === 0, `${extMsgs.length} warnings, first: ${extMsgs[0]}`);
    });
  } finally {
    const w = Math.max(...results.map((r) => r.name.length));
    console.log('');
    for (const r of results) console.log(`${r.status.padEnd(4)}  ${r.name.padEnd(w)}  ${r.note}`);
    const c = (s) => results.filter((r) => r.status === s).length;
    console.log(`\n${c(PASS)} passed, ${c(FAIL)} failed, ${c(SKIP)} skipped`);
    if (signedIn && !flag('--no-wait')) await ask('\nSign out in the browser window (your name, top right → Sign out), then press Enter to close and delete the temp profile… ');
    await ctx.close().catch(() => {});
    fs.rmSync(profile, { recursive: true, force: true });
    process.exitCode = results.some((r) => r.status === FAIL) ? 1 : 0;
  }
})().catch((e) => { console.error(e); process.exit(2); });
