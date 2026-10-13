/** 首页文章展台：阻尼视差、拖动换页、滚动展开与逐行排印。 */
let disposeStage = () => {};

function bindArticleStage() {
  disposeStage();
  const stage = document.querySelector('[data-article-stage]');
  if (!stage) return;

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  const deck = stage.querySelector('.reading-stage__deck');
  const slots = [...stage.querySelectorAll('.folio-slot')];
  const previous = stage.querySelector('[data-stage-prev]');
  const next = stage.querySelector('[data-stage-next]');
  const position = stage.querySelector('[data-stage-position]');
  const title = stage.querySelector('h1');
  const titleLink = title.querySelector('a');
  const titleText = titleLink.textContent;
  const list = document.querySelector('.index__grid');
  const values = { x: 0, y: 0, scroll: 0 };
  const target = { x: 0, y: 0, scroll: 0 };
  let visible = false;
  let frame = 0;
  let lastTime = 0;
  let active = slots.length - 1;
  let gesture = null;
  let suppressClickUntil = 0;
  let layoutFrame = 0;
  let titleTimer = 0;
  let rowFrame = 0;
  let lastRowPointer = null;
  const animations = new Set();
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const remember = (animation) => {
    animations.add(animation);
    animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
  };

  const select = (index, direction = 0) => {
    const keepDeckFocus = deck.contains(document.activeElement);
    active = (index + slots.length) % slots.length;
    slots.forEach((slot, i) => {
      const depth = (i - active + slots.length - 1) % slots.length;
      slot.dataset.depth = String(depth);
      slot.querySelector('a').tabIndex = depth === slots.length - 1 ? 0 : -1;
    });
    position.textContent = `${String(slots.length - active).padStart(2, '0')} / ${String(slots.length).padStart(2, '0')}`;
    if (keepDeckFocus) slots[active].querySelector('a').focus({ preventScroll: true });
    if (direction && !motion.matches) {
      remember(slots[active].querySelector('a').animate([
        { transform: `translate3d(${direction * 30}px, 12px, -45px) rotateY(${direction * 16}deg)`, opacity: 0.65 },
        { transform: 'translate3d(0, -4px, 12px) rotateY(0)', opacity: 1, offset: 0.65 },
        { transform: 'none', opacity: 1 },
      ], { duration: 650, easing: 'cubic-bezier(0.22, 0.68, 0.35, 1)' }));
    }
  };
  const onPrevious = () => select(active + 1, -1);
  const onNext = () => select(active - 1, 1);
  const onDeckKey = (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); onPrevious(); }
    if (event.key === 'ArrowRight') { event.preventDefault(); onNext(); }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') slots[active].querySelector('a').focus({ preventScroll: true });
  };
  const onDeckDown = (event) => {
    if (event.button !== 0 || !event.isPrimary) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dragging: false };
  };
  const onDeckMove = (event) => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.dragging) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { gesture = null; return; }
      if (Math.abs(dx) < 9) return;
      gesture.dragging = true;
      deck.setPointerCapture(event.pointerId);
      stage.setAttribute('data-stage-dragging', '');
    }
    if (event.cancelable) event.preventDefault();
    gesture.dx = dx;
    stage.style.setProperty('--stage-drag', String(clamp(dx / (deck.clientWidth * 0.45), -1.2, 1.2)));
  };
  const finishGesture = (cancelled = false) => {
    if (!gesture) return;
    const current = gesture;
    gesture = null;
    stage.removeAttribute('data-stage-dragging');
    stage.style.setProperty('--stage-drag', '0');
    if (deck.hasPointerCapture(current.id)) deck.releasePointerCapture(current.id);
    if (!current.dragging) return;
    suppressClickUntil = performance.now() + 400;
    const threshold = Math.min(65, deck.clientWidth * 0.16);
    if (!cancelled && Math.abs(current.dx) > threshold) {
      if (current.dx < 0) onNext();
      else onPrevious();
    }
  };
  const onDeckUp = () => finishGesture();
  const onDeckCancel = () => finishGesture(true);
  const onDeckCaptureLost = (event) => {
    // 触屏会先隐式捕获到链接；转交给展台时，链接的 lost 事件也会冒泡。
    if (event.target === deck && gesture && !deck.hasPointerCapture(event.pointerId)) finishGesture(true);
  };
  const onDeckClick = (event) => {
    if (!deck.contains(event.target)) return;
    if (performance.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    const slot = event.target.closest('.folio-slot');
    if (slot && slot !== slots[active] && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      event.stopImmediatePropagation();
      select(slots.indexOf(slot), slots.indexOf(slot) < active ? 1 : -1);
    }
  };

  // 按实际行宽拆分标题，保留原文和链接；窗口变化时重新排印。
  const splitTitle = () => {
    titleLink.textContent = titleText;
    const node = titleLink.firstChild;
    const range = document.createRange();
    const lines = [];
    let offset = 0;
    let lastTop = null;
    for (const character of titleText) {
      range.setStart(node, offset);
      offset += character.length;
      range.setEnd(node, offset);
      const top = Math.round(range.getBoundingClientRect().top);
      if (lastTop === null || Math.abs(top - lastTop) > 3) { lines.push(''); lastTop = top; }
      lines[lines.length - 1] += character;
    }
    const fragment = document.createDocumentFragment();
    lines.forEach((line, i) => {
      const wrapper = document.createElement('span');
      wrapper.className = 'title-line';
      wrapper.style.setProperty('--title-line', String(i));
      const text = document.createElement('span');
      text.className = 'title-line__text';
      text.textContent = line;
      wrapper.append(text);
      fragment.append(wrapper);
    });
    titleLink.replaceChildren(fragment);
    title.setAttribute('data-title-lines', '');
  };
  const onResize = () => {
    onScroll();
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(() => { layoutFrame = 0; splitTitle(); });
  };
  const onRowPointer = (event) => {
    if (!pointer.matches || motion.matches) return;
    const row = event.target.closest('.entry');
    if (!row) return;
    lastRowPointer = { row, x: event.clientX, y: event.clientY };
    if (!rowFrame) rowFrame = requestAnimationFrame(() => {
      rowFrame = 0;
      const { row: item, x, y } = lastRowPointer;
      const rect = item.getBoundingClientRect();
      item.style.setProperty('--row-x', `${x - rect.left}px`);
      item.style.setProperty('--row-y', `${y - rect.top}px`);
    });
  };

  const draw = () => {
    stage.style.setProperty('--stage-x', values.x.toFixed(4));
    stage.style.setProperty('--stage-y', values.y.toFixed(4));
    stage.style.setProperty('--stage-scroll', values.scroll.toFixed(4));
    stage.style.setProperty('--light-x', `${55 + values.x * 23}%`);
    stage.style.setProperty('--light-y', `${35 + values.y * 20}%`);
  };
  const tick = (time) => {
    frame = 0;
    if (!visible || document.hidden || motion.matches) return;
    const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 1 / 60;
    lastTime = time;
    const amount = 1 - Math.exp(-7 * dt);
    let unsettled = false;
    for (const key of Object.keys(values)) {
      values[key] += (target[key] - values[key]) * amount;
      if (Math.abs(target[key] - values[key]) > 0.0005) unsettled = true;
      else values[key] = target[key];
    }
    draw();
    if (unsettled) frame = requestAnimationFrame(tick);
  };
  const schedule = () => {
    if (frame || !visible || document.hidden || motion.matches) return;
    lastTime = 0;
    frame = requestAnimationFrame(tick);
  };
  const onPointer = (event) => {
    if (gesture?.dragging || !pointer.matches || motion.matches || event.pointerType === 'touch') return;
    const rect = stage.getBoundingClientRect();
    target.x = clamp(((event.clientX - rect.left) / rect.width - 0.5) * 2, -1, 1);
    target.y = clamp(((event.clientY - rect.top) / rect.height - 0.5) * 2, -1, 1);
    schedule();
  };
  const onLeave = () => { target.x = 0; target.y = 0; schedule(); };
  const onScroll = () => {
    if (motion.matches) return;
    const rect = stage.getBoundingClientRect();
    target.scroll = clamp((100 - rect.top) / Math.max(rect.height, 1), 0, 1);
    schedule();
  };
  const onVisibility = () => {
    stage.toggleAttribute('data-stage-visible', visible && !document.hidden);
    if (document.hidden) { finishGesture(true); cancelAnimationFrame(frame); frame = 0; }
    else { onScroll(); schedule(); }
  };
  const onPreference = () => {
    finishGesture(true);
    cancelAnimationFrame(frame);
    frame = 0;
    if (motion.matches) {
      for (const animation of animations) animation.finish();
      Object.assign(values, { x: 0, y: 0, scroll: 0 });
      Object.assign(target, values);
      draw();
    } else onScroll();
  };

  const sceneObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    stage.toggleAttribute('data-stage-visible', visible && !document.hidden);
    if (visible) { onScroll(); schedule(); }
    else { cancelAnimationFrame(frame); frame = 0; }
  });
  sceneObserver.observe(stage);

  // 使用 Web Animations 直接揭示已进入视口的文章，不预先隐藏正文。
  const rows = [...document.querySelectorAll('.index__grid .entry')];
  const rowObserver = new IntersectionObserver((entries) => {
    const entering = entries.filter((entry) => entry.isIntersecting);
    entering.forEach((entry, index) => {
      rowObserver.unobserve(entry.target);
      if (motion.matches || !entry.target.animate) return;
      const animation = entry.target.animate([
        { opacity: 0, transform: 'perspective(900px) translateY(28px) rotateX(4deg)' },
        { opacity: 1, transform: 'perspective(900px) translateY(0) rotateX(0)' },
      ], { duration: 700, delay: Math.min(index, 3) * 65, easing: 'cubic-bezier(0.22, 0.68, 0.35, 1)', fill: 'backwards' });
      remember(animation);
    });
  }, { threshold: 0.08 });
  rows.forEach((row) => rowObserver.observe(row));

  stage.setAttribute('data-stage-ready', '');
  previous.disabled = false;
  next.disabled = false;
  previous.addEventListener('click', onPrevious);
  next.addEventListener('click', onNext);
  deck.addEventListener('keydown', onDeckKey);
  deck.addEventListener('pointerdown', onDeckDown);
  deck.addEventListener('pointermove', onDeckMove, { passive: false });
  deck.addEventListener('pointerup', onDeckUp);
  deck.addEventListener('pointercancel', onDeckCancel);
  deck.addEventListener('lostpointercapture', onDeckCaptureLost);
  window.addEventListener('click', onDeckClick, true);
  list?.addEventListener('pointermove', onRowPointer, { passive: true });
  stage.addEventListener('pointermove', onPointer, { passive: true });
  stage.addEventListener('pointerleave', onLeave);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  motion.addEventListener('change', onPreference);
  draw();
  select(active);
  splitTitle();
  titleTimer = setTimeout(() => title.setAttribute('data-title-settled', ''), 1500);

  disposeStage = () => {
    finishGesture(true);
    cancelAnimationFrame(frame);
    cancelAnimationFrame(layoutFrame);
    cancelAnimationFrame(rowFrame);
    clearTimeout(titleTimer);
    sceneObserver.disconnect();
    rowObserver.disconnect();
    animations.forEach((animation) => animation.cancel());
    stage.removeEventListener('pointermove', onPointer);
    stage.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    motion.removeEventListener('change', onPreference);
    previous.removeEventListener('click', onPrevious);
    next.removeEventListener('click', onNext);
    previous.disabled = true;
    next.disabled = true;
    deck.removeEventListener('keydown', onDeckKey);
    deck.removeEventListener('pointerdown', onDeckDown);
    deck.removeEventListener('pointermove', onDeckMove);
    deck.removeEventListener('pointerup', onDeckUp);
    deck.removeEventListener('pointercancel', onDeckCancel);
    deck.removeEventListener('lostpointercapture', onDeckCaptureLost);
    window.removeEventListener('click', onDeckClick, true);
    list?.removeEventListener('pointermove', onRowPointer);
    stage.removeAttribute('data-stage-ready');
    stage.removeAttribute('data-stage-visible');
    disposeStage = () => {};
  };
}

bindArticleStage();
document.addEventListener('astro:page-load', bindArticleStage);
window.addEventListener('pagehide', () => disposeStage());
window.addEventListener('pageshow', (event) => { if (event.persisted) bindArticleStage(); });
