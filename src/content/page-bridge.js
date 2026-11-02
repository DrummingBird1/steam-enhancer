// Runs in the page's own JS world ("world": "MAIN" in manifest.json), where
// Steam's globals live (g_ActiveInventory, g_rgWalletInfo, UserYou, …).
// Content scripts call it via SE.pageCall(op, args) — a postMessage round-trip.
//
// Until 1.4.x the extension injected inline <script> elements with stringified
// functions instead, which only worked because Steam's CSP happens to allow
// 'unsafe-inline'. This file is a fixed list of named operations: nothing is
// eval'd, and it only does what the page's own scripts could already do with
// the user's session.
(function () {
  'use strict';
  if (window.__seBridgeInstalled) return;
  window.__seBridgeInstalled = true;

  const ops = {
    steamId: () => window.g_steamID || null,

    walletCurrency: () => (window.g_rgWalletInfo && window.g_rgWalletInfo.wallet_currency) || null,

    // Items of the inventory currently shown. contextid matters: game items
    // live in context 2, Steam's own items (appid 753) in context 6.
    inventoryItems: () => {
      const inv = window.g_ActiveInventory;
      if (!inv) return null;
      const toItem = (asset, d, contextid) => ({
        id: asset.assetid || asset.id, classid: asset.classid, instanceid: asset.instanceid,
        amount: Number(asset.amount) || 1, appid: String(asset.appid || inv.appid),
        contextid: String(asset.contextid || contextid || inv.contextid || ''),
        market_hash_name: d.market_hash_name, name: d.name,
        tradable: !!d.tradable, marketable: !!d.marketable,
        tags: (d.tags || []).map((t) => ({ category: t.category, name: t.localized_tag_name || t.name })),
        actions: d.actions || []
      });
      let items = null;
      if (inv.m_rgAssets && Object.keys(inv.m_rgAssets).length) {
        // Current inventory code: CAsset objects carrying their own description.
        items = Object.values(inv.m_rgAssets).map((a) => toItem(a, a.description || {}, a.contextid));
      } else if (inv.rgInventory) {
        // Older/partial inventories: assets and descriptions in separate maps.
        items = Object.values(inv.rgInventory).map((it) =>
          toItem(it, inv.rgDescriptions[it.classid + '_' + it.instanceid] || {}, inv.contextid));
      }
      if (!items) return null;
      return { items, owner: inv.m_owner && inv.m_owner.strSteamId };
    },

    // Both sides of the trade offer being composed or viewed.
    tradeItems: () => {
      const collect = (slotsId) => {
        const items = [];
        document.querySelectorAll(`#${slotsId} .item`).forEach((node) => {
          // item<appid>_<contextid>_<assetid>
          const m = node.id && node.id.match(/item(\d+)_(\d+)_(\d+)/);
          if (!m) return;
          const [, appid, contextid, assetid] = m;
          // Steam's item elements carry their item (rgItem) — the only source
          // for an offer you received, where the partner's inventory isn't
          // loaded. Otherwise look it up in the loaded inventory.
          let desc = node.rgItem && node.rgItem.description ? node.rgItem.description : node.rgItem || null;
          if (!desc || !desc.market_hash_name) {
            const user = slotsId === 'your_slots' ? window.UserYou : window.UserThem;
            const inv = user && user.getInventory && user.getInventory(appid, contextid);
            const asset = inv && inv.rgInventory && inv.rgInventory[assetid];
            desc = (asset && inv.rgDescriptions[asset.classid + '_' + asset.instanceid]) || desc;
          }
          items.push({
            appid, contextid,
            name: (desc && desc.name) || '',
            market_hash_name: (desc && desc.market_hash_name) || '',
            marketable: !!(desc && desc.marketable)
          });
        });
        return items;
      };
      return { your: collect('your_slots'), their: collect('their_slots') };
    },

    // The item currently open in the inventory's detail pane.
    selectedItem: () => {
      const a = window.g_ActiveInventory && window.g_ActiveInventory.selectedItem;
      if (!a) return null;
      const d = a.description || {};
      return {
        id: String(a.assetid || a.id), appid: String(a.appid), contextid: String(a.contextid),
        amount: Number(a.amount) || 1, name: d.name, market_hash_name: d.market_hash_name,
        marketable: !!d.marketable
      };
    },

    // Take one of the user's own listings off the market.
    removeListing: async ({ listingid }) => {
      if (!/^\d+$/.test(String(listingid))) throw new Error('bad listing id');
      const resp = await fetch(`/market/removelisting/${listingid}`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: new URLSearchParams({ sessionid: window.g_sessionID })
      });
      return { ok: resp.ok, status: resp.status };
    },

    // `price` is what the seller receives, in wallet-currency cents.
    sellItem: async ({ appid, contextid, assetid, amount, price }) => {
      const body = new URLSearchParams({
        sessionid: window.g_sessionID, appid, contextid, assetid,
        amount: String(amount), price: String(price)
      });
      const resp = await fetch('/market/sellitem/', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body
      });
      return resp.json();
    }
  };

  window.addEventListener('message', async (ev) => {
    if (ev.source !== window || !ev.data || typeof ev.data.__se_req !== 'string') return;
    const { __se_req: id, op, args } = ev.data;
    let reply;
    try {
      reply = ops[op] ? { ok: true, result: await ops[op](args || {}) } : { ok: false, error: `unknown op ${op}` };
    } catch (e) {
      reply = { ok: false, error: String(e) };
    }
    window.postMessage({ __se_id: id, ...reply }, location.origin);
  });
})();
