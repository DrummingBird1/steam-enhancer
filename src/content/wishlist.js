(function () {
  'use strict';
  const SE = window.SteamEnhancer;

  document.addEventListener('se-ready', () => init(), { once: true });

  async function init() {
    if (!/\/wishlist\//.test(location.pathname)) return;
    insertToolbar();
  }

  function insertToolbar() {
    if (SE.$('#se-wishlist-toolbar')) return;
    const anchor = SE.$('#wishlist_ctn') || SE.$('.wishlist_content') || document.body;
    const bar = SE.el('div', { id: 'se-wishlist-toolbar', class: 'se-toolbar' },
      SE.el('button', { class: 'se-btn', onclick: exportCSV }, 'Export CSV'),
      SE.el('button', { class: 'se-btn', onclick: exportJSON }, 'Export JSON'),
      SE.el('button', { class: 'se-btn', onclick: exportText }, 'Copy as text'),
      SE.el('button', { class: 'se-btn', onclick: openAllOnITAD }, 'Open in ITAD bundle'),
      SE.el('span', { id: 'se-wishlist-count', class: 'se-muted' }, '')
    );
    anchor.parentElement?.insertBefore(bar, anchor);
    refreshCount();
    new MutationObserver(SE.throttle(refreshCount, 250)).observe(document.body, { childList: true, subtree: true });
  }

  function rows() {
    return SE.$$('.wishlist_row');
  }
  function refreshCount() {
    const c = rows().length;
    const el = SE.$('#se-wishlist-count');
    if (el) el.textContent = `${c} visible`;
  }

  function collect() {
    return rows().map((r) => {
      const appid = r.getAttribute('data-app-key') || r.id?.replace(/[^\d]/g, '');
      const title = r.querySelector('.title')?.textContent?.trim() || '';
      const price = r.querySelector('.discount_final_price, .price')?.textContent?.trim() || '';
      const discount = r.querySelector('.discount_pct')?.textContent?.trim() || '';
      const added = r.querySelector('.added_on')?.textContent?.trim().replace(/^Added on\s*/i, '') || '';
      return { appid, title, price, discount, added };
    });
  }

  function download(name, content, mime = 'text/plain') {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function exportCSV() {
    const rs = collect();
    const header = 'appid,title,price,discount,added\n';
    const csv = header + rs.map(r => [r.appid, JSON.stringify(r.title), JSON.stringify(r.price), JSON.stringify(r.discount), JSON.stringify(r.added)].join(',')).join('\n');
    download('steam-wishlist.csv', csv, 'text/csv');
  }
  function exportJSON() {
    download('steam-wishlist.json', JSON.stringify(collect(), null, 2), 'application/json');
  }
  function exportText() {
    const text = collect().map(r => `- ${r.title} (${r.price})`).join('\n');
    navigator.clipboard.writeText(text).then(() => alert('Copied wishlist to clipboard.'));
  }
  function openAllOnITAD() {
    const ids = collect().map(r => r.appid).filter(Boolean).slice(0, 30);
    if (!ids.length) return alert('Nothing to open.');
    window.open(`https://isthereanydeal.com/search/?q=${encodeURIComponent(ids.join(','))}`, '_blank');
  }
})();
