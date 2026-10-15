export function createTextMask(hero, button, onChange) {
  const lines = [...hero.querySelectorAll('.hero-line, .hero-type > p')];
  const blocks = [hero.querySelector('.hero-cta'), hero.querySelector('.latest-dock'), button].filter(Boolean);
  const invalidate = () => { onChange?.(); };
  const pad = (rect, amount) => ({
    left: rect.left - amount, top: rect.top - amount,
    right: rect.right + amount, bottom: rect.bottom + amount,
  });
  const read = () => {
    // Read current geometry on each paint: transforms and font changes can move
    // text without changing the outer box watched by ResizeObserver.
    const regions = [];
    for (const line of lines) {
      const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
      const rects = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        rects.push(...range.getClientRects());
      }
      if (rects.length) regions.push(pad({
        left: Math.min(...rects.map(r => r.left)), top: Math.min(...rects.map(r => r.top)),
        right: Math.max(...rects.map(r => r.right)), bottom: Math.max(...rects.map(r => r.bottom)),
      }, 22));
    }
    for (const block of blocks) {
      const rect = block.getBoundingClientRect();
      if (rect.width && rect.height) regions.push(pad(rect, block === button ? 8 : 22));
    }
    return regions;
  };
  const resize = new ResizeObserver(invalidate);
  [hero, ...lines, ...blocks].forEach(element => resize.observe(element));
  const mutations = new MutationObserver(invalidate);
  mutations.observe(hero, { attributes: true, attributeFilter: ['style', 'data-ascii-stacked'] });
  mutations.observe(button, { attributes: true, attributeFilter: ['style', 'disabled'] });
  window.addEventListener('resize', invalidate);
  window.addEventListener('scroll', invalidate, { passive: true });
  let disposed = false;
  document.fonts.ready.then(() => { if (!disposed) invalidate(); });

  return {
    regions: read,
    dispose() {
      disposed = true; resize.disconnect(); mutations.disconnect();
      window.removeEventListener('resize', invalidate);
      window.removeEventListener('scroll', invalidate);
    },
  };
}
