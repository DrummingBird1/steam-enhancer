# Privacy Policy — Steam Enhancer

_Last updated: November 2026 (version 1.5.0)_

Steam Enhancer ("the extension") is a free, open-source Chrome extension that enhances the Steam Store and Steam Community websites. This document explains exactly what data the extension does — and does not — handle.

## TL;DR
- The extension does **not** collect, transmit, or sell any personal data.
- It does **not** use any analytics service.
- It runs **only** on Steam-owned domains and a small list of public price/info APIs listed below.
- Your settings and data live **only** in your own browser, via Chrome's standard `storage.sync` and `storage.local`.

## What data the extension processes locally

| Data | Purpose | Where it lives |
|---|---|---|
| Your settings (toggles, country, deal threshold, quiet hours, API keys you paste in) | Remember your preferences | `chrome.storage.sync` (synced across your Chrome profile by Google) |
| Your custom CSS | Apply your own styles to Steam pages | `chrome.storage.local` (this browser only) |
| Cached price/API responses | Avoid re-fetching the same data | `chrome.storage.local`, expires per-entry |
| Your owned / wishlisted / ignored app IDs | Highlight rows on store pages | `chrome.storage.local`, refreshed from Steam's own `dynamicstore/userdata` endpoint while you're logged in to Steam |
| Your own Steam Web API key (optional) | Powers the opt-in "owned by friends" feature only | `chrome.storage.sync` — only if you paste one in Options; the feature is off by default and does nothing without it |
| Local trade history, price-target alerts, notes, hidden games, prices seen on store pages, library/inventory snapshots, alert history, private item notes, games you muted, and short notes of which tool could not find its place on which kind of Steam page (the tool's name and the page type, never an address or id) | Power the trade-history, price-alert, price-chart, notification-center, value-over-time, item-note, mute and "Report a problem" features | `chrome.storage.local`, built entirely from pages you've visited in your own browser |
| Your Steam wallet currency and storefront country | Show and compare prices in the right currency | `chrome.storage.local`, read from the Steam pages you visit |

None of this data ever leaves your browser via the extension. The Options page can export it to a backup file on your own computer, only when you click Export.

## Network requests the extension makes

The extension makes direct browser requests (no proxy server) to the following endpoints, and only when relevant:

| Endpoint | When | What is sent |
|---|---|---|
| `store.steampowered.com`, `steamcommunity.com` | While you're on Steam pages | Your normal Steam cookies (same as the page itself) |
| `api.isthereanydeal.com` | When you view a store page, search results or a wishlist, or when a price/deal alert check runs | The Steam app ID(s), your selected country code, and **your own free ITAD API key** (required by IsThereAnyDeal as of v1.4.0 — registered per-application at isthereanydeal.com/apps/my/, not a personal credential; entered by you in Options, never baked into the extension) |
| `api.steampowered.com` (player count, achievements, featured specials, review histogram) | When you view a store app page, or hourly/every-2h if price/promo alerts are enabled | Steam app ID |
| `api.steampowered.com` (GetWishlist, StoreBrowse GetItems) | When you open a wishlist page | The wishlist owner's public Steam ID, app IDs, your country and language |
| `api.steampowered.com` (GetFriendList, GetOwnedGames, ResolveVanityURL, GetPlayerAchievements) | Only if you supply your own API key ("owned by friends", your achievement progress) | Your API key, your Steam ID, and up to 100 of your friends' Steam IDs (30 by default; you choose in Options) — sent straight to Steam, not to us |
| `steamcommunity.com/market` (sell, remove listing) | Only when you click a sell or remove button and then confirm | The item and price you confirmed, with your Steam session — exactly what Steam's own market page sends |
| `open.er-api.com` | Currency converter / display-currency conversion | Currency codes only |
| `protondb.com` | When you view a store app page | Steam app ID |
| `steamdb.info`, `howlongtobeat.com`, `steamcharts.com`, `barter.vg`, `steamladder.com`, `steamrep.com`, `backpack.tf`, `csfloat.com` | Only when you click those links | None from the extension (they're ordinary links) |

## Report a problem

Options → Help & report shows a short diagnostic text (the extension version, your Chrome version and system, your UI language, which settings differ from the defaults, whether a key is set — never the keys themselves — and which tool could not find its place on which kind of page). It is shown in full on the page and is only copied when you click Copy report; the extension sends it nowhere. What you paste into a GitHub issue is up to you.

The extension **does not** send your Steam ID, persona name, email, or any account credentials anywhere.

## Notifications

The optional wishlist-deal, price-alert and free-promo alerts use Chrome's `chrome.notifications` API to show local desktop notifications, and are also listed in the toolbar popup. No notification text is sent anywhere — they are generated in your browser.

## Permissions

Each Chrome permission requested by the extension is justified in `store-assets/description.md`. We follow the principle of least privilege.

## Children

The extension is not directed at children under 13. It does not knowingly collect data from anyone.

## Changes

If this policy changes in a meaningful way, the version number in `manifest.json` will be bumped and the change will be documented in the GitHub repository.

## Contact

Open an issue on the GitHub repository linked from the Chrome Web Store listing.
