# Roadmap

**🌐 עברית: ראו את [README.he.md](README.he.md) לסקירת הפרויקט. מפת הדרכים כתובה באנגלית.**

This is an informal, best-effort list of what Steam Enhancer may work on next. It is not a commitment and has no dates. Priorities follow what breaks, what users ask for, and the maintainer's free time. Current version: **1.4.0** (see [CHANGELOG.md](CHANGELOG.md)).

> Unofficial. Not affiliated with Valve, Augmented Steam, or Steam Inventory Helper.

## Shipped so far

- Store pages: lowest/historical price, regional pricing, bundle savings, ProtonDB, HowLongToBeat, price alerts, free-promo and review-bomb detection.
- Search, wishlist, library and badges tooling.
- Market and inventory helpers, trade-offer summaries and local trade history.
- English and Hebrew UI (including RTL), settings page and popup.
- Zero-dependency unit tests and a live smoke test.

## Near term

- **Keep things working.** Re-run the smoke test after Steam redesigns and fix broken selectors or endpoints.
- **Chrome Web Store listing.** Finish the listing assets and screenshots.
- **More unit coverage** for the pure logic in `src/lib/`.
- **Verification with a logged-in session** for features the anonymous smoke test can't fully check (market price history, buy-order helper).

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
