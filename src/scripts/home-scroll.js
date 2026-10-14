// Scroll triggers a brief entrance; the animation settles even when scrolling stops.
export function bindHomeScroll(body) {
  if (!body.querySelector('[data-exp-hero]')) return () => {};
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const compact = matchMedia('(max-width: 48rem)');
  const elements = [...body.querySelectorAll(
    '.exp-journal [data-exp-reveal], .exp-journal .pager, .exp-topics [data-exp-reveal], .exp-topics .topic-flow, .exp-footer [data-exp-reveal], .exp-footer__base',
  )];
  const scenes = elements.map((element, index) => {
    const kind = element.matches('.journal-entry') ? 'article'
      : element.matches('.journal-heading, .topics-heading h2') ? 'heading'
      : element.matches('.exp-footer__lead, .footer-directory') ? 'footer' : 'band';
    element.dataset.scrollScene = kind;
    return { element, kind, index, animation: null, shown: false, top: 0 };
  });
  let frame = 0;
  let dirty = true;
  let disposed = false;
  let viewport = innerHeight;
  const update = () => {
    frame = 0;
    if (disposed || motion.matches || document.hidden) return;
    if (dirty) {
      viewport = innerHeight;
      for (const scene of scenes) {
        // offsetTop is unaffected by the animation, so it cannot feed back into itself.
        let top = 0;
        for (let node = scene.element; node; node = node.offsetParent) top += node.offsetTop;
        scene.top = top;
      }
      dirty = false;
    }
    const y = scrollY;
    for (const scene of scenes) {
      if (!scene.animation) continue;
      const relativeTop = scene.top - y;
      // Fast scrolling and keyboard focus show readable content immediately.
      if (scene.element.matches(':focus-within') || relativeTop <= viewport * .72 || y + viewport >= body.scrollHeight - 2) {
        scene.shown = true;
        if (scene.animation.playState !== 'finished') scene.animation.finish();
      } else if (relativeTop > viewport + 48) {
        // Replay only after an upward scroll takes the whole item below the screen.
        if (scene.shown) {
          scene.animation.pause();
          scene.animation.currentTime = 0;
          scene.shown = false;
        }
      } else if (!scene.shown && relativeTop <= viewport - 72) {
        scene.shown = true;
        scene.animation.play();
      }
    }
  };
  const schedule = () => {
    if (!frame && !disposed && !motion.matches && !document.hidden) frame = requestAnimationFrame(update);
  };
  const invalidate = () => { dirty = true; schedule(); };
  const rebuild = () => {
    for (const scene of scenes) {
      scene.animation?.cancel();
      scene.animation = null;
      scene.shown = false;
      if (motion.matches) continue;
      const distance = compact.matches ? 64 : scene.kind === 'footer' ? 120 : 104;
      const sideways = compact.matches ? 0 : scene.kind === 'heading' ? -56 : scene.kind === 'article' ? (scene.index % 2 ? 56 : -56) : 0;
      const animation = scene.element.animate([
        { opacity: .25, transform: `translate(${sideways}px, ${distance}px) scale(${compact.matches ? .94 : .9})` },
        { opacity: 1, transform: 'none' },
      ], { duration: compact.matches ? 240 : 280, easing: 'cubic-bezier(.22,.8,.25,1)', fill: 'both' });
      animation.pause();
      scene.animation = animation;
    }
    dirty = true;
    update();
  };
  const resize = new ResizeObserver(invalidate);
  resize.observe(body);
  elements.forEach((element) => resize.observe(element));
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', invalidate, { passive: true });
  body.addEventListener('load', invalidate, true);
  body.addEventListener('focusin', schedule);
  body.addEventListener('focusout', schedule);
  document.addEventListener('visibilitychange', schedule);
  motion.addEventListener('change', rebuild);
  compact.addEventListener('change', rebuild);
  document.fonts.ready.then(invalidate);
  rebuild();
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    resize.disconnect();
    scenes.forEach((scene) => { scene.animation?.cancel(); delete scene.element.dataset.scrollScene; });
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', invalidate);
    body.removeEventListener('load', invalidate, true);
    body.removeEventListener('focusin', schedule);
    body.removeEventListener('focusout', schedule);
    document.removeEventListener('visibilitychange', schedule);
    motion.removeEventListener('change', rebuild);
    compact.removeEventListener('change', rebuild);
  };
}
