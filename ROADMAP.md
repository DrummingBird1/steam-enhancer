# Roadmap

**🌐 עברית: ראו את [README.he.md](README.he.md) לסקירת הפרויקט. מפת הדרכים כתובה באנגלית.**

This is an informal, best-effort list of what Steam Enhancer may work on next. It is not a commitment and has no dates. Priorities follow what breaks, what users ask for, and the maintainer's free time. Current version: **1.5.0** (see [CHANGELOG.md](CHANGELOG.md); how it was planned: [docs/PLAN-1.5.0.md](docs/PLAN-1.5.0.md)).

> Unofficial. Not affiliated with Valve, Augmented Steam, or Steam Inventory Helper.

## Shipped so far

- Store pages: lowest/historical price, regional pricing, bundle savings, ProtonDB, HowLongToBeat link, price alerts, free-promo and review-bomb detection.
- Search, wishlist, library and badges tooling.
- Market and inventory helpers, trade-offer summaries and local trade history.
- Wishlist dashboard built on Steam's own wishlist API; whole-wishlist deal checks.
- Interactive price-history chart, regional prices in your currency, Steam Deck status.
- Market Pro: quick / instant sell, my-listings check, correct fees and wallet currency everywhere.
- Notification center with quiet hours; searchable settings with presets and full backup.
- Works with the pages Steam rebuilt in React: the wishlist, the inventory item pane, the library (game count and value estimate) and the Market Beta item page (price chart and summary).
- Five languages (English, Hebrew with RTL, Russian, German, Portuguese-Brazil).
- Zero-dependency unit tests, a live smoke test, and CI on every pull request.

## Next release candidates (1.6.0)

The shape of the next release, in the suggested order. Nothing here is promised.

- **Trade Guard.** Warnings inside trade offers: new or private accounts, trade holds, large value gaps, look-alike item names. *Needs real trade offers to tune before it ships.*
- **A reusable signed-in test run.** Steam keeps rebuilding pages in React, and every break so far was found by looking at a signed-in page. Turn that manual run (Chromium with the extension loaded, you sign in yourself, a script drives it) into something in `scripts/`, so a regression check takes minutes.
- **Say so when Steam changed a page.** Today a feature whose selectors stopped matching just does nothing. A small "this tool couldn't find its part of the page" note, with the page type, would turn silent breakage into a useful bug report.
- **A "report a problem" button.** Copies a short diagnostic summary (extension version, language, which features ran, page type) to the clipboard to paste into an issue. Nothing is sent anywhere; there is still no telemetry.
- **Market Beta parity.** Undercut and the buy-order helper still need the classic item page, because the Beta page has no order-book id. *Needs a different, verified source for it.*

## Ideas

Grouped by area. Each one is a possibility, not a plan; the notes say what it would need.

### Keeping up with Steam
- Smoke-test markers for the React pages (inventory pane, Market Beta, library), as far as an anonymous request can reach them.
- Move more of the inventory, market and trade-offer logic into unit-tested helpers (the DOM-free parts), so fewer fixes depend on a manual run.
- Graceful degradation when ITAD, ProtonDB or the exchange-rate service is down or rate-limited: a clear one-line status instead of an empty row.

### Market and inventory
- **Keep-N mass-list**: list duplicates while keeping a chosen number of copies.
- **Stale-listing check in the background**: notify when one of your listings has been undercut. *Needs care: it reads the market page with your session on a timer, so it must stay well inside Steam's rate limits and be opt-in.*
- Inventory value over time per game, not only for the open inventory.
- A per-item note ("bought at …", "keep") kept locally.

### Wishlist and prices
- Alert when a game gets **within X% of its historical low**, not only below a target price.
- Show how long the current price has held, and the time since the last discount, from the history that is already fetched.
- Per-game "ignore this sale" so a deal you've seen stops reappearing in the list.
- More display-currency and regional-price options (e.g. choose the set of regions).
- Sale-event reminders. *Needs a reliable key-free source for Steam sale dates; none verified yet.*

### Store, library and profile
- Library on Steam's new games page: playtime and value statistics from the data the page already loaded. *Needs the page's data shape verified signed in.*
- Achievements: a full list with unlock percentages, not only the easiest and rarest.
- "Owned by friends" beyond the first 30 friends, with paging and caching. *Needs your own Steam Web API key, as today.*
- Compare your library with a friend's. *Same key requirement.*
- Deeper badge tracking. *Per-game progress needs the Web API key.*

### Settings, privacy and permissions
- Request the host permissions for ITAD, ProtonDB and the exchange-rate service only when the matching feature is switched on (Chrome's optional host permissions), so a fresh install asks for less. *To evaluate: it adds a permission prompt to each feature.*
- Further settings granularity for people who want a quieter experience.
- Per-site on/off switch for the floating panels.

### Languages and accessibility
- Additional locales. Steam's largest languages not yet covered: Spanish, French, Turkish, Polish, Ukrainian, Simplified Chinese. *Needs a native-speaker read of each; the string table makes adding a column easy.*
- Keyboard focus and contrast review of the injected panels and floating bars.

## Considered and set aside

- **Inline float lookup for CS2.** No free public API resolves a float from an inspect link without a key. The inspect link goes to CSFloat's own page instead.
- **Reputation lookups for trade partners.** The SteamRep and backpack.tf reputation APIs that were tried didn't answer key-free; the extension links to their pages instead.
- **Automating account actions** (accepting gifts, declining trades, scanning Family Sharing). Too risky to run on your account without a confirmation each time, or no reliable data source.
- **HowLongToBeat data.** Its API blocks extensions, so it stays a search link.

## Out of scope

- A build step or bundler. The edit-reload-test loop is deliberate.
- Telemetry or analytics.
- Shipping API keys. Keyed services use a key the user supplies in Options.
- Reusing code or assets from Augmented Steam or Steam Inventory Helper.

## Suggest something

Open an [issue](https://github.com/DrummingBird1/steam-enhancer/issues) describing the use case. Bug reports with the page URL type (store, market, inventory, etc.) are the most useful.
