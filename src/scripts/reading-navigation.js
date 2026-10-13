export function bindReadingNavigation(body) {
  const root = body.querySelector('[data-reading-navigation]');
  const header = body.querySelector('.exp-nav');
  if (!root || !header) return () => {};
  const button = root.querySelector('[data-reading-navigation-toggle]');
  const panel = root.querySelector('[data-reading-navigation-panel]');
  const topButton = root.querySelector('[data-reading-navigation-top]');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const options = { signal: controller.signal };
  let open = false;
  let available = false;
  let hideTimer = 0;
  let frame = 0;
  let layoutDirty = true;
  let headerEnd = 0;

  const close = (restoreFocus = false) => {
    if (restoreFocus || panel.contains(document.activeElement)) button.focus({ preventScroll: true });
    open = false;
    root.removeAttribute('data-open');
    panel.inert = true;
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', '展开阅读转盘');
    button.title = '展开阅读转盘';
  };
  const show = (keyboard = false) => {
    if (!available) return;
    open = true;
    panel.inert = false;
    root.setAttribute('data-open', '');
    button.setAttribute('aria-expanded', 'true');
    button.setAttribute('aria-label', '收起阅读转盘');
    button.title = '收起阅读转盘';
    if (keyboard) panel.querySelector('a')?.focus({ preventScroll: true });
  };
  const setAvailable = (offscreen) => {
    if (offscreen === available) return;
    available = offscreen;
    clearTimeout(hideTimer);
    if (available) {
      root.removeAttribute('data-leaving');
      root.hidden = false;
      button.disabled = false;
    } else {
      const focused = root.contains(document.activeElement);
      close();
      if (focused) header.querySelector('a')?.focus({ preventScroll: true });
      button.disabled = true;
      root.setAttribute('data-leaving', '');
      if (motion.matches) root.hidden = true;
      // animationend handles normal playback; this also covers interrupted animation.
      else hideTimer = setTimeout(() => { if (!available) root.hidden = true; }, 400);
    }
  };
  const update = () => {
    frame = 0;
    if (layoutDirty) {
      headerEnd = header.getBoundingClientRect().bottom + window.scrollY;
      layoutDirty = false;
    }
    // An intersection at exactly zero can miss the next pixel on a slow return.
    // Use the scroll position directly, with an 18px gap only when appearing.
    setAvailable(window.scrollY > headerEnd + (available ? 0 : 18));
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  const invalidate = () => { layoutDirty = true; schedule(); };
  const resize = new ResizeObserver(invalidate);
  resize.observe(header);
  window.addEventListener('scroll', schedule, { ...options, passive: true });
  window.addEventListener('resize', invalidate, { ...options, passive: true });
  root.addEventListener('animationend', (event) => {
    if (event.target === root && event.animationName === 'orb-depart' && !available) {
      clearTimeout(hideTimer); root.hidden = true;
    }
  }, options);
  motion.addEventListener('change', () => {
    if (motion.matches && !available) { clearTimeout(hideTimer); root.hidden = true; }
  }, options);
  update();
  button.addEventListener('click', (event) => open ? close(true) : show(event.detail === 0), options);
  topButton.addEventListener('click', () => {
    close(true);
    window.scrollTo({ top: 0, behavior: motion.matches ? 'instant' : 'smooth' });
  }, options);
  document.addEventListener('pointerdown', (event) => {
    if (open && !root.contains(event.target)) close();
  }, options);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) { event.preventDefault(); close(true); }
  }, options);
  return () => {
    resize.disconnect(); controller.abort(); cancelAnimationFrame(frame); clearTimeout(hideTimer); close();
    available = false; root.hidden = true; root.removeAttribute('data-leaving');
  };
}
