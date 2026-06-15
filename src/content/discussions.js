(function () {
  'use strict';
  const SE = window.SteamEnhancer;
  SE.onReady(() => init());

  function init() {
    if (!/\/discussions\//.test(location.pathname)) return;
    if (!SE.once('discussions:mouseup')) return;
    document.addEventListener('mouseup', (e) => SE.safe('quote', () => onSelect(e)));
  }

  let popup = null;
  function onSelect(e) {
    const sel = window.getSelection();
    const text = sel.toString().trim();
    if (!text || text.length < 3) { hide(); return; }
    if (e.target.closest('.commentthread_entry, textarea, input')) return;
    show(e.pageX, e.pageY, text);
  }

  function show(x, y, text) {
    hide();
    popup = SE.el('button', {
      class: 'se-btn se-quote-popup',
      style: { position: 'absolute', left: (x + 8) + 'px', top: (y + 8) + 'px', zIndex: 99999 },
      onclick: () => insertQuote(text)
    }, '“ Quote selected');
    document.body.appendChild(popup);
  }
  function hide() { popup?.remove(); popup = null; }

  function insertQuote(text) {
    const box = document.querySelector('.commentthread_entry textarea, #commentthread_ForumTopic_TopicComment, textarea[name="comment"]');
    if (!box) { alert('No reply box found on this page.'); return; }
    const quoted = `[quote]${text}[/quote]\n`;
    box.value = quoted + (box.value || '');
    box.focus();
    box.dispatchEvent(new Event('input', { bubbles: true }));
    hide();
  }
})();
