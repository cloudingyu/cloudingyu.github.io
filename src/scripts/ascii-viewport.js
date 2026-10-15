export function bindAsciiViewport(host, button) {
  const hero = host.closest('[data-exp-hero]');
  const copy = hero.querySelector('.hero-type');
  const latest = hero.querySelector('.latest-dock');
  const header = document.querySelector('.exp-nav');
  const band = document.querySelector('.signal-band');
  let frame = 0;
  let disposed = false;

  const fit = () => {
    frame = 0;
    if (disposed) return;
    const root = hero.getBoundingClientRect();
    const style = getComputedStyle(hero);
    const padding = parseFloat(style.paddingRight);
    const gap = innerWidth <= 768 ? 20 : 28;
    const availableHeroHeight = innerHeight - (header?.offsetHeight || 0) - (band?.offsetHeight || 0);
    // Use actual text extents: .hero-type's wide layout box includes empty space.
    const textRects = [];
    const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      textRects.push(...range.getClientRects());
    }
    const copyRight = Math.max(root.left, ...textRects.map(rect => rect.right));
    const left = Math.max(root.left + root.width * .38, copyRight + 48);
    const right = root.right - padding;
    const stacked = innerWidth <= 768 || right - left < 560 || availableHeroHeight < 420;
    hero.toggleAttribute('data-ascii-stacked', stacked);

    if (stacked) {
      for (const property of ['left', 'right', 'top', 'bottom', 'width', 'height']) host.style.removeProperty(property);
    } else {
      const top = root.top + Math.max(24, root.height * .045);
      // The model gets a complete silhouette above the article; the text mask
      // remains a fallback during scrolling and pointer disruption.
      const bottom = Math.min(root.bottom - 24, latest.getBoundingClientRect().top - gap);
      const width = Math.min(1200, right - left);
      const values = {
        left: `${left - root.left + (right - left - width) / 2}px`, right: 'auto',
        top: `${top - root.top}px`, bottom: 'auto', width: `${width}px`,
        height: `${Math.max(120, bottom - top)}px`,
      };
      for (const [property, value] of Object.entries(values)) {
        if (host.style[property] !== value) host.style[property] = value;
      }
    }
    const view = host.getBoundingClientRect();
    const buttonStyle = getComputedStyle(button);
    const size = parseFloat(buttonStyle.width);
    const values = {
      left: `${view.right - root.left - size}px`,
      top: `${view.bottom - size - root.top}px`, right: 'auto', bottom: 'auto',
    };
    for (const [property, value] of Object.entries(values)) {
      if (button.style[property] !== value) button.style[property] = value;
    }
  };
  const schedule = () => { if (!frame && !disposed) frame = requestAnimationFrame(fit); };
  const resize = new ResizeObserver(schedule);
  [hero, copy, latest, header, band].filter(Boolean).forEach(element => resize.observe(element));
  // The original scroll effects move the article; re-fit as that transform settles.
  const scrollStyle = new MutationObserver(schedule);
  scrollStyle.observe(hero, { attributes: true, attributeFilter: ['style'] });
  window.addEventListener('resize', schedule);
  window.addEventListener('scroll', schedule, { passive: true });
  document.fonts.ready.then(() => { if (!disposed) schedule(); });
  fit();
  return () => {
    disposed = true; cancelAnimationFrame(frame);
    resize.disconnect(); scrollStyle.disconnect();
    window.removeEventListener('resize', schedule);
    window.removeEventListener('scroll', schedule);
  };
}
