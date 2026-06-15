(function () {
  'use strict';
  const SE = window.SteamEnhancer;

  document.addEventListener('se-ready', () => init(), { once: true });

  async function init() {
    if (!SE.ctx?.settings.enableTradeOfferTools) return;
    SE.safe('trade:summary', insertSummaryBox);
    SE.safe('trade:steamrep', insertSteamRepBadge);
    SE.safe('trade:hold', insertConfirmHold);
    if (SE.once('trade:refresh')) setInterval(() => SE.safe('trade:refresh', refresh), 2000);
  }

  function insertSteamRepBadge() {
    const partner = location.search.match(/partner=(\d+)/)?.[1];
    if (!partner) return;
    const steamId64 = (BigInt(partner) + 76561197960265728n).toString();
    const header = SE.$('.trade_partner_headline') || SE.$('.profile_header');
    if (!header || SE.$('#se-steamrep')) return;
    header.appendChild(SE.el('div', { id: 'se-steamrep', class: 'se-row' },
      SE.el('a', { href: `https://steamrep.com/profiles/${steamId64}`, target: '_blank', rel: 'noopener', class: 'se-link' }, '🛡 Check on SteamRep'),
      ' · ',
      SE.el('a', { href: `https://www.backpack.tf/profiles/${steamId64}`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'Backpack.tf'),
      ' · ',
      SE.el('a', { href: `https://steamid.uk/profile/${steamId64}`, target: '_blank', rel: 'noopener', class: 'se-link' }, 'SteamID.uk')
    ));
  }

  function insertConfirmHold() {
    // Wrap the confirm button so it requires a 2s hold to fire.
    const tryWrap = () => {
      const btn = SE.$('#trade_confirmbtn');
      if (!btn || btn.dataset.seHold) return;
      btn.dataset.seHold = '1';
      const overlay = SE.el('div', { class: 'se-hold-overlay', title: 'Hold for 2 seconds to confirm' }, 'Hold to confirm trade');
      let holdT = null, pressed = false;
      const startHold = () => {
        if (pressed) return;
        pressed = true;
        overlay.classList.add('se-holding');
        holdT = setTimeout(() => {
          overlay.remove();
          btn.click();
        }, 2000);
      };
      const stopHold = () => {
        pressed = false;
        overlay.classList.remove('se-holding');
        if (holdT) clearTimeout(holdT);
      };
      overlay.addEventListener('mousedown', startHold);
      overlay.addEventListener('mouseup', stopHold);
      overlay.addEventListener('mouseleave', stopHold);
      overlay.addEventListener('touchstart', startHold);
      overlay.addEventListener('touchend', stopHold);
      btn.parentElement?.insertBefore(overlay, btn);
      btn.style.opacity = '0.4';
      btn.style.pointerEvents = 'none';

      // Safety escape: never lock the user out of the native confirm button.
      const escape = SE.el('a', {
        class: 'se-link', style: { marginLeft: '8px', fontSize: '11px' },
        href: 'javascript:void 0',
        onclick: (e) => {
          e.preventDefault();
          overlay.remove();
          btn.style.opacity = '';
          btn.style.pointerEvents = '';
        }
      }, 'use normal button');
      overlay.insertAdjacentElement('afterend', escape);
    };
    if (SE.once('trade:hold-interval')) setInterval(() => SE.safe('trade:hold', tryWrap), 1000);
  }

  function insertSummaryBox() {
    if (SE.$('#se-trade-summary')) return;
    const anchor = SE.$('#trade_box') || SE.$('.trade_partner_headline') || document.body;
    anchor.parentElement?.insertBefore(SE.el('div', { id: 'se-trade-summary', class: 'se-panel' },
      SE.el('div', { class: 'se-panel-h' }, 'Trade summary (estimated)'),
      SE.el('div', { class: 'se-panel-body', id: 'se-trade-body' },
        SE.el('div', { class: 'se-row se-muted' }, 'Counting items…')
      )
    ), anchor);
  }

  async function refresh() {
    const r = await SE.injectPage(() => {
      try {
        const collect = (id) => {
          const items = [];
          document.querySelectorAll(`#${id} .item`).forEach(node => {
            // Resolve description via UserYou/UserThem item lookup.
            const elemId = node.id; // item123_456_789
            const m = elemId && elemId.match(/item(\d+)_(\d+)_(\d+)/);
            if (!m) return;
            const [, appid, , inventoryid] = m;
            const u = id === 'your_slots' ? window.UserYou : window.UserThem;
            const inv = u && u.getInventory && u.getInventory(appid, 2);
            const desc = inv && inv.rgInventory && inv.rgInventory[inventoryid]
              ? inv.rgDescriptions[inv.rgInventory[inventoryid].classid + '_' + inv.rgInventory[inventoryid].instanceid]
              : null;
            items.push({
              appid,
              name: desc?.name || '',
              market_hash_name: desc?.market_hash_name || '',
              marketable: !!desc?.marketable
            });
          });
          return items;
        };
        return { your: collect('your_slots'), their: collect('their_slots') };
      } catch { return null; }
    });

    if (!r?.ok || !r.result) return;
    const body = SE.$('#se-trade-body'); if (!body) return;

    const yourVal = await sumValue(r.result.your);
    const theirVal = await sumValue(r.result.their);
    const diff = yourVal - theirVal;
    const pct = (Math.max(yourVal, theirVal) > 0) ? Math.abs(diff) / Math.max(yourVal, theirVal) * 100 : 0;

    body.innerHTML = '';
    body.appendChild(SE.el('div', { class: 'se-row' }, `You offer: ${r.result.your.length} items · est. ≈ ${yourVal.toFixed(2)}`));
    body.appendChild(SE.el('div', { class: 'se-row' }, `They offer: ${r.result.their.length} items · est. ≈ ${theirVal.toFixed(2)}`));
    body.appendChild(SE.el('div', { class: 'se-row' }, `Difference: ${diff >= 0 ? '+' : ''}${diff.toFixed(2)} (${pct.toFixed(0)}%)`));
    if (pct >= 20 && (yourVal + theirVal) > 1) {
      body.appendChild(SE.el('div', { class: 'se-row' }, SE.tag('VALUE MISMATCH', 'ignored'), ` Review carefully before accepting.`));
    }
  }

  const cache = new Map();
  async function sumValue(items) {
    let total = 0;
    for (const it of items) {
      if (!it.marketable || !it.market_hash_name) continue;
      const key = it.appid + ':' + it.market_hash_name;
      let val = cache.get(key);
      if (val == null) {
        const p = await SE.api.marketPriceOverview(it.appid, it.market_hash_name);
        val = SE.parsePrice(p?.data?.median_price || p?.data?.lowest_price) || 0;
        cache.set(key, val);
      }
      total += val;
    }
    return total;
  }
})();
