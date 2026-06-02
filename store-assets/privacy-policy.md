# Privacy Policy — Steam Enhancer

_Last updated: June 2026_

Steam Enhancer ("the extension") is a free, open-source Chrome extension that enhances the Steam Store and Steam Community websites. This document explains exactly what data the extension does — and does not — handle.

## TL;DR
- The extension does **not** collect, transmit, or sell any personal data.
- It does **not** use any analytics service.
- It runs **only** on Steam-owned domains and a small list of public price/info APIs listed below.
- Your settings live **only** in your own browser, via Chrome's standard `storage.sync`.

## What data the extension processes locally

| Data | Purpose | Where it lives |
|---|---|---|
| Your settings (toggles, country, deal threshold) | Remember your preferences | `chrome.storage.sync` (synced across your Chrome profile by Google) |
| Cached price/API responses | Avoid re-fetching the same data | `chrome.storage.local`, expires per-entry |
| Your owned / wishlisted / ignored app IDs | Highlight rows on store pages | `chrome.storage.local`, refreshed from Steam's own `dynamicstore/userdata` endpoint while you're logged in to Steam |

None of this data ever leaves your browser via the extension.

## Network requests the extension makes

The extension makes direct browser requests (no proxy server) to the following endpoints, and only when relevant:

| Endpoint | When | What is sent |
|---|---|---|
| `store.steampowered.com`, `steamcommunity.com` | While you're on Steam pages | Your normal Steam cookies (same as the page itself) |
| `api.isthereanydeal.com` | When you view a store page or use the wishlist deal-check | The Steam app ID and your selected country code |
| `api.steampowered.com` (player count, achievements) | When you view a store app page | Steam app ID |
| `protondb.com` | When you view a store app page | Steam app ID |
| `howlongtobeat.com` | When you click the HLTB link | Game title (only on your click) |
| `steamdb.info`, `steamcharts.com`, `barter.vg`, `steamladder.com`, `steamrep.com`, `backpack.tf` | Only when you click those links | None (handled by the destination site) |

The extension **does not** send your Steam ID, persona name, email, or any account credentials anywhere.

## Notifications

The optional "wishlist deal alerts" feature uses Chrome's `chrome.notifications` API to show local desktop notifications. No notification text is sent anywhere — they are generated in your browser.

## Permissions

Each Chrome permission requested by the extension is justified in `store-assets/description.md`. We follow the principle of least privilege.

## Children

The extension is not directed at children under 13. It does not knowingly collect data from anyone.

## Changes

If this policy changes in a meaningful way, the version number in `manifest.json` will be bumped and the change will be documented in the GitHub repository.

## Contact

Open an issue on the GitHub repository linked from the Chrome Web Store listing.
