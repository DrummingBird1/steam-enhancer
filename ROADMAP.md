# Roadmap

**🌐 עברית: ראו את [README.he.md](README.he.md) לסקירת הפרויקט. מפת הדרכים כתובה באנגלית.**

This is an informal, best-effort list of what Steam Enhancer may work on next. It is not a commitment and has no dates. Priorities follow what breaks, what users ask for, and the maintainer's free time. Current version: **1.6.0** (see [CHANGELOG.md](CHANGELOG.md); how 1.5.0 and 1.6.0 were planned: [docs/PLAN-1.5.0.md](docs/PLAN-1.5.0.md), [docs/PLAN-1.6.0.md](docs/PLAN-1.6.0.md)).

> Unofficial. Not affiliated with Valve, Augmented Steam, or Steam Inventory Helper.

## Shipped so far

- Store pages: lowest/historical price, regional pricing (your choice of regions), bundle savings, ProtonDB, HowLongToBeat link, price alerts, free-promo and review-bomb detection, price-held / last-drop line, full achievements list.
- Search, wishlist, library and badges tooling.
- Market and inventory helpers, trade-offer summaries and local trade history.
- Wishlist dashboard built on Steam's own wishlist API; whole-wishlist deal checks, opt-in near-low alerts, per-game mute.
- Interactive price-history chart, regional prices in your currency, Steam Deck status.
- Market Pro: quick / instant sell, my-listings check, keep-N mass-list, correct fees and wallet currency everywhere.
- Works with the pages Steam rebuilt in React: the wishlist, the inventory item pane, the library (game count and value estimate) and the Market Beta item page (price chart, summary, undercut, buy-order helper).
- "Steam changed this page" notes and a copy-only "Report a problem" diagnostic.
- Notification center with quiet hours; searchable settings with presets and full backup.
- Five languages (English, Hebrew with RTL, Russian, German, Portuguese-Brazil).
- Keyboard focus, labelled dialogs and contrast reviewed.
- Zero-dependency unit tests, a live smoke test, a signed-in check script, and CI on every pull request.

## Next release candidates

Nothing here is promised.

- **Trade Guard.** Warnings inside trade offers: new or private accounts, trade holds, large value gaps, look-alike item names. *Needs real trade offers to tune before it ships.*
- **Signed-in coverage of what 1.6.0 couldn't test**: real selling (needs an account allowed to sell on the market), the classic market item page, trade offers, ITAD alerts (needs a key), and "owned by friends" with a large friend list (needs a Steam Web API key). `scripts/signed-in-check.js` covers the rest.
- **Library on Steam's new games page**: playtime and value statistics from the data the page already loaded. *Needs the page's data shape verified signed in.*

## Ideas

Each one is a possibility, not a plan; the notes say what it would need.

- **Stale-listing check in the background**: notify when one of your listings has been undercut. *Needs care: it reads the market page with your session on a timer, so it must stay well inside Steam's rate limits and be opt-in, and it can't be verified without an account that has listings.*
- Per-game "ignore this sale" beyond the mute.
- Sale-event reminders. *Needs a reliable key-free source for Steam sale dates; none verified yet.*
- Compare your library with a friend's; deeper badge tracking. *Both need your own Steam Web API key, as "owned by friends" does.*
- Additional locales: Spanish, French, Turkish, Polish, Ukrainian, Simplified Chinese. *Each needs a native-speaker read before shipping: a wrong word next to a "confirm listing" button can cost money. The string table makes adding a column easy.*
- Further settings granularity for people who want a quieter experience.

## Considered and set aside

- **Optional host permissions** for ITAD, ProtonDB and the exchange-rate service (asked for only when the feature is switched on). Evaluated for 1.6.0 and declined: it adds a permission prompt per feature, and moving permissions to optional risks existing users silently losing price features on update, for a small gain (those hosts are not alarming).
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
