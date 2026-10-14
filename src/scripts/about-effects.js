let cleanup = () => {};

function bindAbout() {
  cleanup();
  const root = document.querySelector('[data-about]');
  const profile = root?.querySelector('.about-profile');
  const art = document.querySelector('[data-about-art]');
  const button = art?.querySelector('[data-about-trigger]');
  if (!root || !profile || !art || !button) return;

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const controller = new AbortController();
  const { signal } = controller;
  const sparks = art.querySelector('.about-art__sparks');
  const word = art.querySelector('[data-about-word]');
  const caption = art.querySelector('[data-about-caption]');
  const modes = [
    ['BUILD.', '把想法写成代码'],
    ['BREAK.', '打破边界，探索可能'],
    ['LEARN.', '保持好奇，继续生长'],
  ];
  let phase = Number(art.dataset.phase) || 0;
  let frame = 0;
  let pointer = null;
  let visible = true;
  let activeTile = null;
  let tileRect = null;
  const animations = new Set();
  const remember = (animation, finish = () => {}) => {
    animations.add(animation);
    animation.finished.then(finish, finish).finally(() => animations.delete(animation));
  };
  const stopAnimations = () => {
    animations.forEach((animation) => animation.cancel());
    animations.clear();
    sparks.replaceChildren();
  };
  const resetTile = () => {
    if (!activeTile) return;
    activeTile.removeAttribute('data-pointer-active');
    for (const property of ['--tile-rx', '--tile-ry', '--depth-x', '--depth-y', '--trace']) activeTile.style.removeProperty(property);
    activeTile = null;
    tileRect = null;
  };
  const resetArt = () => {
    for (const property of ['--tilt-x', '--tilt-y', '--shift-x', '--shift-y']) art.style.removeProperty(property);
  };
  const resetPointer = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    pointer = null;
    resetArt();
    resetTile();
    root.style.removeProperty('--name-x');
    root.style.removeProperty('--name-y');
  };
  const paintPointer = () => {
    frame = 0;
    if (!pointer || motion.matches || document.hidden) return;
    const rect = profile.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (pointer.x - rect.left) / rect.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (pointer.y - rect.top) / rect.height * 2 - 1));
    root.style.setProperty('--name-x', `${x * 5}px`);
    root.style.setProperty('--name-y', `${y * 3}px`);
    if (visible) {
      art.style.setProperty('--tilt-x', `${-y * 9}deg`);
      art.style.setProperty('--tilt-y', `${x * 12}deg`);
      art.style.setProperty('--shift-x', `${x * 25}px`);
      art.style.setProperty('--shift-y', `${y * 25}px`);
    }
    if (activeTile && tileRect) {
      const px = Math.max(0, Math.min(1, (pointer.x - tileRect.left) / tileRect.width));
      const py = Math.max(0, Math.min(1, (pointer.y - tileRect.top) / tileRect.height));
      const nx = px * 2 - 1, ny = py * 2 - 1;
      activeTile.style.setProperty('--spot-x', `${px * 100}%`);
      activeTile.style.setProperty('--spot-y', `${py * 100}%`);
      activeTile.style.setProperty('--tile-rx', `${-ny * 5}deg`);
      activeTile.style.setProperty('--tile-ry', `${nx * 6}deg`);
      activeTile.style.setProperty('--depth-x', `${nx * 12}px`);
      activeTile.style.setProperty('--depth-y', `${ny * 9}px`);
      activeTile.style.setProperty('--trace', String(nx * 120));
    }
  };
  const onPointer = (event) => {
    if (motion.matches || !fine.matches || event.pointerType === 'touch' || document.hidden) return;
    const tile = event.target.closest('.about-tile');
    if (tile !== activeTile) {
      resetTile();
      if (tile) {
        // Cache the resting bounds so the tilt cannot feed back into its own input.
        tileRect = tile.getBoundingClientRect();
        activeTile = tile;
        tile.setAttribute('data-pointer-active', '');
      }
    }
    pointer = { x: event.clientX, y: event.clientY };
    if (!frame) frame = requestAnimationFrame(paintPointer);
  };
  const syncLabel = () => button.setAttribute('aria-label', `点亮灵感，切换到 ${modes[(phase + 1) % modes.length][0].slice(0, -1)}`);
  const burst = () => {
    stopAnimations();
    phase = (phase + 1) % modes.length;
    art.dataset.phase = String(phase);
    word.textContent = modes[phase][0];
    caption.textContent = modes[phase][1];
    syncLabel();
    if (motion.matches || !visible || document.hidden || typeof button.animate !== 'function') return;

    const ring = art.querySelector('.about-portrait-button__ring');
    remember(ring.animate([
      { transform: 'scale(1)', opacity: .7 },
      { transform: 'scale(1.85)', opacity: 0 },
    ], { duration: 750, easing: 'cubic-bezier(.16,1,.3,1)' }));
    remember(word.animate([
      { opacity: 0, transform: 'translateY(8px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 350, easing: 'ease-out' }));
    const distance = art.clientWidth * .4;
    for (let i = 0; i < 18; i++) {
      const spark = document.createElement('i');
      spark.className = 'about-spark';
      sparks.appendChild(spark);
      const angle = i / 18 * Math.PI * 2 + Math.random() * .2;
      const reach = distance * (.65 + Math.random() * .4);
      const dx = Math.cos(angle), dy = Math.sin(angle);
      remember(spark.animate([
        { transform: `translate(${dx * distance * .3}px, ${dy * distance * .3}px) scale(.4)`, opacity: 0 },
        { opacity: 1, offset: .15 },
        { transform: `translate(${dx * reach}px, ${dy * reach}px) rotate(${i * 40}deg) scale(0)`, opacity: 0 },
      ], { duration: 650 + Math.random() * 300, easing: 'cubic-bezier(.12,.6,.25,1)' }), () => spark.remove());
    }
  };
  const pause = () => {
    art.toggleAttribute('data-motion-paused', !visible || document.hidden || motion.matches);
    if (!visible) resetArt();
    if (document.hidden || motion.matches || !fine.matches) {
      resetPointer();
    }
    if (!visible || document.hidden || motion.matches) {
      stopAnimations();
    }
  };
  const observer = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    pause();
  }, { threshold: 0 });
  observer.observe(art);
  button.disabled = false;
  syncLabel();
  pause();
  root.addEventListener('pointermove', onPointer, { passive: true, signal });
  root.addEventListener('pointerleave', resetPointer, { signal });
  button.addEventListener('click', burst, { signal });
  window.addEventListener('scroll', resetPointer, { passive: true, signal });
  window.addEventListener('resize', resetPointer, { passive: true, signal });
  document.addEventListener('visibilitychange', pause, { signal });
  motion.addEventListener('change', pause, { signal });
  fine.addEventListener('change', pause, { signal });
  cleanup = () => {
    controller.abort();
    observer.disconnect();
    resetPointer();
    stopAnimations();
    button.disabled = true;
    cleanup = () => {};
  };
}

bindAbout();
window.addEventListener('pagehide', () => cleanup());
window.addEventListener('pageshow', (event) => { if (event.persisted) bindAbout(); });
