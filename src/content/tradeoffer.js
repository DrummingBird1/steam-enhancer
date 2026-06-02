(function () {
  'use strict';
  const SE = window.SteamEnhancer;

  document.addEventListener('se-ready', () => init(), { once: true });

  async function init() {
    if (!SE.ctx.settings.enableTradeOfferTools) return;
    insertSummaryBox();
    setInterval(refresh, 1500);
  }

  function insertSummaryBox() {
    if (SE.$('#se-trade-summary')) return;
    const anchor = SE.$('#trade_box') || SE.$('.trade_partner_headline') || document.body;
    const box = SE.el('div', { id: 'se-trade-summary', class: 'se-panel' },
      SE.el('div', { class: 'se-panel-h' }, 'Trade summary (estimated)'),
      SE.el('div', { class: 'se-panel-body', id: 'se-trade-body' },
        SE.el('div', { class: 'se-row se-muted' }, 'Counting items…')
      )
    );
    anchor.parentElement?.insertBefore(box, anchor);
  }

  async function refresh() {
    const r = await SE.injectPage(() => {
      try {
        const collect = (id) => {
          const items = [];
          document.querySelectorAll(`#${id} .item`).forEach(node => {
            const id = node.id;
            items.push(id);
          });
          return items.length;
        };
        return {
          your: collect('your_slots'),
          their: collect('their_slots')
        };
      } catch (e) { return null; }
    });
    if (!r?.ok || !r.result) return;
    const body = SE.$('#se-trade-body');
    if (!body) return;
    body.innerHTML = '';
    body.appendChild(SE.el('div', { class: 'se-row' }, `You offer: ${r.result.your} items`));
    body.appendChild(SE.el('div', { class: 'se-row' }, `They offer: ${r.result.their} items`));
    body.appendChild(SE.el('div', { class: 'se-row se-muted' }, 'Tip: hover items to see their market value links.'));
  }
})();
