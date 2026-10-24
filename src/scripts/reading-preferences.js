export const READING_LIMITS = {
  width: { min: 16, max: 96 },
};

export function bindReadingPreferences(body) {
  const article = body.querySelector('.post__prose');
  if (!article) return () => {};
  const root = document.documentElement;
  root.dataset.readingMode = 'normal';
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const configuredToggle = body.querySelector('[data-reading-mode-toggle][data-reading-mode-available="true"]');
  const modeToggle = article.querySelector('.reading-term, .reading-word') ? configuredToggle : null;
  if (configuredToggle && !modeToggle) {
    configuredToggle.dataset.readingModeAvailable = 'false';
    configuredToggle.setAttribute('aria-label', '正文已变化，请重新进行阅读分级');
  }
  const updateModeToggle = () => {
    const enhanced = root.dataset.readingMode === 'enhanced';
    modeToggle?.setAttribute('aria-pressed', String(enhanced));
    modeToggle?.setAttribute('aria-label', enhanced ? '关闭强化阅读' : '开启强化阅读');
  };
  modeToggle?.addEventListener('click', () => {
    root.dataset.readingMode = root.dataset.readingMode === 'enhanced' ? 'normal' : 'enhanced';
    updateModeToggle();
  }, options);
  updateModeToggle();
  if (modeToggle) modeToggle.disabled = false;
  const compact = matchMedia('(max-width: 67.99rem)');
  const grid = article.closest('.post__grid');
  const directory = grid?.querySelector('.post__toc-panel');
  const directoryToggle = directory?.querySelector('[data-toc-toggle]');
  const directoryList = directory?.querySelector('nav');
  const widthControls = body.querySelector('[data-reading-width-controls]');
  const handles = [...body.querySelectorAll('[data-reading-width-handle]')];
  const layoutTransitions = new Set();
  let frame = 0;
  let drag = null;
  const preferences = { width: null, toc: null };

  const apply = () => {
    if (preferences.width === null) root.style.removeProperty('--reading-width');
    else root.style.setProperty('--reading-width', `${preferences.width}rem`);
    const expanded = preferences.toc ?? !compact.matches;
    root.dataset.readingToc = expanded ? 'open' : 'closed';
    if (directoryToggle && directoryList) {
      grid.toggleAttribute('data-toc-collapsed', !expanded);
      directoryList.inert = !expanded;
      directoryToggle.setAttribute('aria-expanded', String(expanded));
      directoryToggle.setAttribute('aria-label', expanded ? '收起目录' : '展开目录');
      directoryToggle.title = expanded ? '收起目录' : '展开目录';
    }
    body.dispatchEvent(new CustomEvent('reading-layout-change'));
    schedule();
  };
  directoryToggle?.addEventListener('click', () => {
    preferences.toc = root.dataset.readingToc !== 'open';
    apply();
  }, options);
  const positionHandles = () => {
    if (!widthControls) return;
    const rect = article.getBoundingClientRect();
    const visibleTop = Math.max(0, rect.top);
    const visibleBottom = Math.min(innerHeight, rect.bottom);
    // Keep the full 64px handle beside the visible text, including on refresh
    // when the opening leaves the article below the viewport's midpoint.
    widthControls.hidden = visibleBottom - visibleTop < 64;
    const center = Math.max(visibleTop + 32, Math.min(innerHeight * .52, visibleBottom - 32));
    widthControls.style.setProperty('--reading-edge-top', `${center}px`);
    widthControls.style.setProperty('--reading-edge-left', `${Math.max(0, rect.left - 42)}px`);
    widthControls.style.setProperty('--reading-edge-right', `${Math.min(innerWidth - 24, rect.right + 18)}px`);
  };
  const updateHandles = () => {
    frame = 0;
    positionHandles();
    if (layoutTransitions.size) schedule();
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(updateHandles); };
  const onLayoutTransition = (event) => {
    if (event.target !== grid && event.target !== article) return;
    const key = `${event.target === grid ? 'grid' : 'article'}:${event.propertyName}`;
    if (event.type === 'transitionrun') layoutTransitions.add(key);
    else layoutTransitions.delete(key);
    positionHandles();
    schedule();
  };
  const availableWidth = () => {
    const gridStyle = getComputedStyle(grid);
    // The reading column can grow its outer frame. Use the viewport's shared
    // gutters, rather than the frame's current max-width, as the drag limit.
    const frameWidth = body.querySelector('.exp-nav')?.clientWidth ?? grid.clientWidth;
    // Desktop TOC occupies a separate column; mobile TOC sits above the text.
    const tocWidth = directory && !compact.matches && root.dataset.readingToc === 'open'
      ? grid.querySelector('.post__toc').getBoundingClientRect().width + parseFloat(gridStyle.columnGap) : 0;
    return Math.max(0, frameWidth - tocWidth);
  };
  const setWidth = (pixels) => {
    const rem = parseFloat(getComputedStyle(root).fontSize);
    const available = availableWidth();
    const minimum = Math.min(READING_LIMITS.width.min * rem, available);
    const maximum = Math.min(READING_LIMITS.width.max * rem, available);
    preferences.width = Math.max(minimum, Math.min(maximum, pixels)) / rem;
    apply();
  };
  const resetWidth = () => { preferences.width = null; apply(); };
  const finishDrag = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const handle = drag.handle;
    drag = null;
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    root.removeAttribute('data-reading-resizing');
    widthControls.removeAttribute('data-resizing');
  };
  for (const handle of handles) {
    handle.addEventListener('pointerdown', (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      handle.focus({ preventScroll: true });
      handle.setPointerCapture(event.pointerId);
      drag = { handle, pointerId: event.pointerId, startX: event.clientX, width: article.getBoundingClientRect().width, direction: handle.dataset.readingWidthHandle === 'right' ? 1 : -1 };
      root.setAttribute('data-reading-resizing', '');
      widthControls.setAttribute('data-resizing', '');
    }, options);
    handle.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      setWidth(drag.width + (event.clientX - drag.startX) * drag.direction * 2);
    }, options);
    handle.addEventListener('pointerup', finishDrag, options);
    handle.addEventListener('pointercancel', finishDrag, options);
    handle.addEventListener('lostpointercapture', finishDrag, options);
    handle.addEventListener('dblclick', resetWidth, options);
    handle.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Home') resetWidth();
      else {
        const step = (event.shiftKey ? 4 : 2) * parseFloat(getComputedStyle(root).fontSize);
        setWidth(event.key === 'End' ? availableWidth() : article.getBoundingClientRect().width + (event.key === 'ArrowRight' ? step : -step));
      }
    }, options);
  }
  window.addEventListener('scroll', schedule, { ...options, passive: true });
  window.addEventListener('resize', schedule, { ...options, passive: true });
  window.addEventListener('pageshow', schedule, options);
  body.addEventListener('load', schedule, { ...options, capture: true });
  document.fonts.ready.then(() => { if (!controller.signal.aborted) schedule(); });
  // A width change is measured in the same rendered frame. Transitions also
  // need frame tracking when the column moves without changing its size.
  const resize = new ResizeObserver(positionHandles);
  resize.observe(article);
  if (grid) resize.observe(grid);
  for (const type of ['transitionrun', 'transitionend', 'transitioncancel']) {
    grid?.addEventListener(type, onLayoutTransition, options);
  }
  compact.addEventListener('change', apply, options);
  apply();
  return () => {
    controller.abort();
    if (modeToggle) modeToggle.disabled = true;
    resize.disconnect();
    cancelAnimationFrame(frame);
    layoutTransitions.clear();
    if (drag) { drag.handle.releasePointerCapture(drag.pointerId); drag = null; }
    root.removeAttribute('data-reading-resizing');
    widthControls?.removeAttribute('data-resizing');
    if (widthControls) widthControls.hidden = true;
  };
}
