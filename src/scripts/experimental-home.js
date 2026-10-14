import { bindReading } from './reading-interactions.js';
import { bindReadingNavigation } from './reading-navigation.js';
import { bindHomeScroll } from './home-scroll.js';

let cleanup = () => {};
let savePointer = () => {};
let rememberedPointer = null;

function bindExperiment() {
  cleanup();
  const body = document.querySelector('.experimental');
  if (!body) return;
  const hero = body.querySelector('[data-exp-hero]');
  const host = body.querySelector('[data-cloud-stage]');
  const cloudView = body.querySelector('[data-cloud-view]');
  const cursor = body.querySelector('.exp-cursor');
  const themeButton = body.querySelector('[data-exp-theme]');
  const morphButton = body.querySelector('[data-morph]');
  const signalBand = body.querySelector('.signal-band__offset');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const readingCleanup = bindReading(body);
  const navigationCleanup = bindReadingNavigation(body);
  const homeScrollCleanup = bindHomeScroll(body);
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const input = { x: 0, y: 0, scroll: 0 };
  const target = { x: 0, y: 0, scroll: 0 };
  let disposed = false;
  let art = null;
  let artLoading = false;
  let artFrame = 0;
  let artIdle = 0;
  let artTimer = 0;
  const artController = new AbortController();
  let frame = 0;
  let previous = 0;
  let tx = innerWidth / 2, ty = innerHeight / 2;
  let cursorVisible = false;
  let magnet = null;
  let magnetRect = null;
  let hoveredLink = null;
  let pointerEvent = null;
  let scrollingTimer = 0;
  let heroRect = null;
  let paintedScroll = -1;
  const animations = new Set();
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const remember = (animation) => {
    animations.add(animation);
    animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
  };

  const paint = () => {
    const progress = motion.matches ? 0 : input.scroll;
    if (hero && progress !== paintedScroll) {
      hero.style.setProperty('--hero-progress', String(progress));
      paintedScroll = progress;
    }
  };
  const tick = (time) => {
    frame = 0;
    if (disposed || document.hidden || motion.matches) return;
    if (pointerEvent) { processPointer(pointerEvent); pointerEvent = null; }
    const dt = previous ? Math.min((time - previous) / 1000, .05) : 1 / 60;
    previous = time;
    let pending = false;
    // Pointer motion transforms a cached image; it never schedules a WebGL draw.
    const pointerChanged = input.x !== target.x || input.y !== target.y;
    input.x = target.x; input.y = target.y;
    input.scroll += (target.scroll - input.scroll) * (1 - Math.exp(-14 * dt));
    if (Math.abs(input.scroll - target.scroll) > .0008) pending = true;
    if (pointerChanged && cloudView) {
      cloudView.style.setProperty('--cloud-x', input.x.toFixed(4));
      cloudView.style.setProperty('--cloud-y', input.y.toFixed(4));
    }
    paint();
    if (pending) frame = requestAnimationFrame(tick);
  };
  const schedule = () => {
    if (frame || disposed || document.hidden || motion.matches) return;
    previous = 0;
    frame = requestAnimationFrame(tick);
  };
  const resetMagnet = () => {
    magnet?.style.setProperty('--mag-x', '0px');
    magnet?.style.setProperty('--mag-y', '0px');
    magnet = null;
    magnetRect = null;
  };
  const processPointer = (event) => {
    if (heroRect && !hero.hasAttribute('data-offscreen')) {
      target.x = clamp((event.clientX - heroRect.left) / heroRect.width * 2 - 1, -1, 1);
      target.y = clamp((event.clientY + scrollY - heroRect.top) / heroRect.height * 2 - 1, -1, 1);
    }
    const nextMagnet = event.target.closest('[data-magnet]');
    if (nextMagnet !== magnet) {
      const rect = nextMagnet?.getBoundingClientRect();
      resetMagnet(); magnet = nextMagnet;
      if (rect) magnetRect = { left: rect.left, top: rect.top + scrollY, width: rect.width, height: rect.height };
    }
    if (magnet) {
      const r = magnetRect;
      magnet.style.setProperty('--mag-x', `${clamp((event.clientX - r.left - r.width / 2) * .17, -12, 12)}px`);
      magnet.style.setProperty('--mag-y', `${clamp((event.clientY + scrollY - r.top - r.height / 2) * .2, -9, 9)}px`);
    }

  };
  const onPointer = (event) => {
    if (event.pointerType !== 'mouse') return;
    // Keep the pointer responsive even while the cloud's animation frame is busy.
    tx = event.clientX; ty = event.clientY;
    cursor.style.transform = `translate3d(${tx}px, ${ty}px, 0) translate(-50%, -50%)`;
    cursor.style.opacity = '1';
    const link = event.target.closest('a[href], button:not(:disabled), summary, [role="button"]:not([aria-disabled="true"])');
    if (link !== hoveredLink) {
      hoveredLink = link;
      cursor.classList.toggle('is-link', !!link);
    }
    if (!cursorVisible) {
      cursorVisible = true;
      // Hide the native pointer only after the custom pointer has a position.
      body.setAttribute('data-cursor-ready', '');
    }
    if (!fine.matches || motion.matches) return;
    pointerEvent = event;
    schedule();
  };
  const onLeave = () => {
    pointerEvent = null;
    hoveredLink = null;
    cursorVisible = false;
    cursor.style.opacity = '0';
    cursor.classList.remove('is-link');
    body.removeAttribute('data-cursor-ready');
    target.x = 0; target.y = 0;
    resetMagnet(); schedule();
  };
  const onScroll = () => {
    if (heroRect) {
      // Give the first wheel movement a clear response, easing into the full range.
      const distance = clamp(scrollY / Math.max(heroRect.height * .72, 1), 0, 1);
      target.scroll = 1 - Math.pow(1 - distance, 1.35);
      // Move the already rendered cloud with CSS while scrolling; release the GPU.
      art?.setScrolling(true);
      clearTimeout(scrollingTimer);
      scrollingTimer = setTimeout(() => { scrollingTimer = 0; art?.setScrolling(false); }, 150);
    }
    signalBand?.style.setProperty('--signal-offset', String(motion.matches ? 0 : scrollY * .12));
    schedule();
  };
  const onResize = () => {
    if (hero) {
      const rect = hero.getBoundingClientRect();
      heroRect = { left: rect.left, top: rect.top + scrollY, width: rect.width, height: rect.height };
    }
    resetMagnet();
    onScroll();
  };
  const onVisibility = () => {
    body.toggleAttribute('data-page-hidden', document.hidden);
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; onLeave(); }
    else { onScroll(); schedule(); }
  };
  const onPreference = () => {
    body.toggleAttribute('data-cursor-ready', cursorVisible);
    if (motion.matches) {
      cancelAnimationFrame(frame); frame = 0;
      animations.forEach((animation) => animation.finish());
      Object.assign(input, { x: 0, y: 0, scroll: 0 });
      Object.assign(target, input);
      pointerEvent = null;
      resetMagnet(); paint();
      cloudView?.style.removeProperty('--cloud-x');
      cloudView?.style.removeProperty('--cloud-y');
      signalBand?.style.setProperty('--signal-offset', '0');
    } else {
      onScroll();
      if (hero && !art && !artLoading) { artObserver.unobserve(hero); artObserver.observe(hero); }
    }
  };
  const updateThemeLabel = () => {
    themeButton.setAttribute('aria-label', document.documentElement.dataset.theme === 'dark' ? '切换到白昼配色' : '切换到暗夜配色');
  };
  const onTheme = () => {
    if (document.documentElement.hasAttribute('data-exp-theme-transition')) return;
    const root = document.documentElement;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    const apply = () => {
      root.dataset.theme = next;
      try { localStorage.setItem('cy-theme', next); } catch { /* 私密模式下仍可切换。 */ }
      updateThemeLabel();
    };
    if (document.startViewTransition && !motion.matches) {
      const rect = themeButton.getBoundingClientRect();
      root.style.setProperty('--theme-x', `${rect.left + rect.width / 2}px`);
      root.style.setProperty('--theme-y', `${rect.top + rect.height / 2}px`);
      root.setAttribute('data-exp-theme-transition', '');
      try {
        const transition = document.startViewTransition(apply);
        transition.ready.catch(() => {});
        transition.finished.then(() => root.removeAttribute('data-exp-theme-transition'), () => root.removeAttribute('data-exp-theme-transition'));
      } catch { root.removeAttribute('data-exp-theme-transition'); apply(); }
    } else apply();
  };
  const onMorph = () => {
    art?.reshape();
    if (!motion.matches) remember(morphButton.animate([{ transform: 'scale(.9)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 450, easing: 'cubic-bezier(.16,1,.3,1)' }));
  };
  const loadArt = async () => {
    if (disposed || motion.matches || hero.hasAttribute('data-offscreen')) { artLoading = false; return; }
    try {
      // Load after the first paint; the baked volume no longer needs to wait for the entrance.
      const { mountCloud } = await import('./cloud-sculpture.js');
      if (disposed || motion.matches || hero.hasAttribute('data-offscreen')) return;
      const mounted = await mountCloud(host, { signal: artController.signal });
      if (disposed) { mounted.dispose(); return; }
      art = mounted;
      art.setScrolling(scrollingTimer !== 0);
      morphButton.disabled = false;
    } catch { if (!disposed) host.setAttribute('data-canvas-fallback', ''); }
    finally { artLoading = false; }
  };
  const artObserver = new IntersectionObserver(([entry]) => {
    hero.toggleAttribute('data-offscreen', !entry.isIntersecting);
    if (!entry.isIntersecting || motion.matches || art || artLoading) return;
    artLoading = true;
    // Paint the readable homepage first; the CSS cloud is visible during initialization.
    artFrame = requestAnimationFrame(() => {
      artFrame = requestAnimationFrame(() => {
        artFrame = 0;
        if ('requestIdleCallback' in window) artIdle = requestIdleCallback(loadArt, { timeout: 1000 });
        else artTimer = setTimeout(loadArt, 50);
      });
    });
  }, { rootMargin: '100px' });
  if (hero && host) artObserver.observe(hero);

  const revealObserver = new IntersectionObserver((entries) => {
    entries.filter((entry) => entry.isIntersecting).forEach((entry, i) => {
      revealObserver.unobserve(entry.target);
      if (motion.matches || !entry.target.animate) return;
      remember(entry.target.animate([
        { opacity: 0, transform: 'translateY(35px)' },
        { opacity: 1, transform: 'none' },
      ], { duration: 550, delay: Math.min(i, 2) * 60, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
    });
  }, { threshold: .08 });
  body.querySelectorAll('[data-exp-reveal], .archive__stats > div, .year__head, .year__list .item, .about__main, .about__card, .notfound__path').forEach((el) => {
    if (!el.hasAttribute('data-scroll-scene')) revealObserver.observe(el);
  });
  const motionObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) entry.target.toggleAttribute('data-motion-paused', !entry.isIntersecting);
  });
  body.querySelectorAll('.signal-band, .topic-flow').forEach((el) => motionObserver.observe(el));
  const heroResize = new ResizeObserver(onResize);
  if (hero) heroResize.observe(hero);

  themeButton.disabled = false;
  themeButton.addEventListener('click', onTheme);
  morphButton?.addEventListener('click', onMorph);
  window.addEventListener('pointermove', onPointer, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  motion.addEventListener('change', onPreference);
  fine.addEventListener('change', onPreference);
  updateThemeLabel(); onResize(); onPreference();

  const restored = document.documentElement.hasAttribute('data-cursor-restored');
  const remembered = rememberedPointer && Date.now() - rememberedPointer.time < 30000
    && rememberedPointer.width === innerWidth && rememberedPointer.height === innerHeight;
  if (restored || remembered) {
    const style = document.documentElement.style;
    const x = restored ? parseFloat(style.getPropertyValue('--cursor-x')) : rememberedPointer.x;
    const y = restored ? parseFloat(style.getPropertyValue('--cursor-y')) : rememberedPointer.y;
    onPointer({ pointerType: 'mouse', clientX: x, clientY: y, target: document.elementFromPoint(x, y) || body });
    document.documentElement.removeAttribute('data-cursor-restored');
    style.removeProperty('--cursor-x');
    style.removeProperty('--cursor-y');
  }
  savePointer = () => {
    if (!cursorVisible) return;
    rememberedPointer = { x: tx, y: ty, width: innerWidth, height: innerHeight, time: Date.now() };
    try {
      sessionStorage.setItem('cy-pointer', JSON.stringify(rememberedPointer));
    } catch { /* Navigation still works when storage is disabled. */ }
  };

  cleanup = () => {
    disposed = true;
    artController.abort();
    cancelAnimationFrame(artFrame);
    if (artIdle) cancelIdleCallback(artIdle);
    clearTimeout(artTimer);
    clearTimeout(scrollingTimer);
    cancelAnimationFrame(frame);
    animations.forEach((animation) => animation.cancel());
    artObserver.disconnect(); revealObserver.disconnect(); motionObserver.disconnect(); heroResize.disconnect(); art?.dispose(); readingCleanup(); navigationCleanup(); homeScrollCleanup();
    themeButton.removeEventListener('click', onTheme);
    morphButton?.removeEventListener('click', onMorph);
    window.removeEventListener('pointermove', onPointer);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    motion.removeEventListener('change', onPreference);
    fine.removeEventListener('change', onPreference);
    themeButton.disabled = true;
    if (morphButton) morphButton.disabled = true;
    onLeave(); body.removeAttribute('data-cursor-ready');
    savePointer = () => {};
    cleanup = () => {};
  };
}

bindExperiment();
window.addEventListener('pageswap', () => savePointer());
window.addEventListener('pagehide', () => { savePointer(); cleanup(); });
window.addEventListener('pageshow', (event) => { if (event.persisted) bindExperiment(); });
