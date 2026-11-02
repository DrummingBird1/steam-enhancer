# Roadmap

**🌐 עברית: ראו את [README.he.md](README.he.md) לסקירת הפרויקט. מפת הדרכים כתובה באנגלית.**

This is an informal, best-effort list of what Steam Enhancer may work on next. It is not a commitment and has no dates. Priorities follow what breaks, what users ask for, and the maintainer's free time. Current version: **1.5.0** (see [CHANGELOG.md](CHANGELOG.md); how it was planned: [docs/PLAN-1.5.0.md](docs/PLAN-1.5.0.md)).

> Unofficial. Not affiliated with Valve, Augmented Steam, or Steam Inventory Helper.

## Shipped so far

- Store pages: lowest/historical price, regional pricing, bundle savings, ProtonDB, HowLongToBeat, price alerts, free-promo and review-bomb detection.
- Search, wishlist, library and badges tooling.
- Market and inventory helpers, trade-offer summaries and local trade history.
- Wishlist dashboard built on Steam's own wishlist API; whole-wishlist deal checks.
- Interactive price-history chart, regional prices in your currency, Steam Deck status.
- Market Pro: quick / instant sell, my-listings check, correct fees and wallet currency everywhere.
- Notification center with quiet hours; searchable settings with presets and full backup.
- Five languages (English, Hebrew with RTL, Russian, German, Portuguese-Brazil).
- Zero-dependency unit tests, a live smoke test, and CI on every pull request.

## Near term

- **Keep things working.** Re-run the smoke test after Steam redesigns and fix broken selectors or endpoints.
- **Trade Guard** (planned for 1.6.0): warnings in trade offers — new or private accounts, trade holds, large value gaps, look-alike item names. Needs real trade offers to tune before it ships.
- **More signed-in coverage**: market, inventory and trade-offer features are tested by hand; more of their logic can move into unit-tested helpers.

## Under consideration

- More display-currency and regional-price options.
- Further settings granularity for people who want a quieter experience.
- Additional locales.
- Better graceful degradation when third-party services (ITAD, HowLongToBeat) change or rate-limit.

## Out of scope

- A build step or bundler. The edit-reload-test loop is deliberate.
- Telemetry or analytics.
- Shipping API keys. Keyed services use a key the user supplies in Options.
- Reusing code or assets from Augmented Steam or Steam Inventory Helper.

## Suggest something

Open an [issue](https://github.com/DrummingBird1/steam-enhancer/issues) describing the use case. Bug reports with the page URL type (store, market, inventory, etc.) are the most useful.
