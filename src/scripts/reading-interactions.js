import { bindReadingPreferences } from './reading-preferences.js';

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return; }
    catch { /* 剪贴板权限不可用时尝试浏览器的传统复制方式。 */ }
  }
  const previous = document.activeElement;
  const selection = window.getSelection();
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
  const field = document.createElement('textarea');
  field.value = text;
  field.readOnly = true;
  field.style.cssText = 'position:fixed;left:-9999px;top:0';
  document.body.append(field);
  field.select();
  let copied;
  try { copied = document.execCommand('copy'); }
  finally {
    field.remove();
    if (previous instanceof HTMLElement) previous.focus({ preventScroll: true });
    if (selection) { selection.removeAllRanges(); ranges.forEach((range) => selection.addRange(range)); }
  }
  if (!copied) throw new Error('Clipboard unavailable');
}

function bindCodeCopy(article) {
  const controller = new AbortController();
  const buttons = [];
  const timers = new Set();
  for (const frame of article.querySelectorAll('.code')) {
    const code = frame.querySelector('pre > code');
    if (!code) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'code-copy';
    button.textContent = '复制';
    button.setAttribute('aria-label', '复制代码');
    button.setAttribute('aria-live', 'polite');
    frame.append(button);
    buttons.push(button);
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await copyText(code.textContent ?? '');
        button.textContent = '已复制';
        button.setAttribute('aria-label', '代码已复制');
      } catch {
        button.textContent = '重试';
        button.setAttribute('aria-label', '复制失败，点击重试');
      } finally {
        button.disabled = false;
      }
      if (controller.signal.aborted) return;
      const timer = setTimeout(() => {
        button.textContent = '复制';
        button.setAttribute('aria-label', '复制代码');
        timers.delete(timer);
      }, 2000);
      timers.add(timer);
    }, { signal: controller.signal });
  }
  return () => {
    controller.abort();
    timers.forEach(clearTimeout);
    buttons.forEach((button) => button.remove());
  };
}

export function bindReading(body) {
  const article = body.querySelector('.post__prose');
  if (!article) return () => {};
  const copyCleanup = bindCodeCopy(article);
  const preferencesCleanup = bindReadingPreferences(body);
  const bar = body.querySelector('#progress-bar');
  const headings = [...body.querySelectorAll('.post__toc a[href^="#"]')].map((link) => ({
    link, heading: document.getElementById(decodeURIComponent(link.hash.slice(1))),
  })).filter(({ heading }) => heading);
  let frame = 0;
  let layoutDirty = true;
  let articleTop = 0;
  let articleHeight = 0;
  let activeHeading = null;

  const update = () => {
    frame = 0;
    // Read positions together only after layout changes, before changing the DOM.
    if (layoutDirty) {
      const rect = article.getBoundingClientRect();
      articleTop = rect.top + scrollY;
      articleHeight = rect.height;
      for (const entry of headings) entry.top = entry.heading.getBoundingClientRect().top + scrollY;
      layoutDirty = false;
    }
    const range = Math.max(articleHeight - innerHeight * .65, 1);
    const progress = Math.min(1, Math.max(0, (scrollY + innerHeight * .2 - articleTop) / range));
    if (bar) bar.style.transform = `scaleX(${progress})`;
    let active = headings[0];
    for (const entry of headings) {
      if (entry.top <= scrollY + innerHeight * .28) active = entry;
      else break;
    }
    if (active !== activeHeading) {
      activeHeading?.link.classList.remove('is-current');
      activeHeading?.link.removeAttribute('aria-current');
      active?.link.classList.add('is-current');
      active?.link.setAttribute('aria-current', 'location');
      activeHeading = active;
    }
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  const invalidate = () => { layoutDirty = true; schedule(); };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', invalidate, { passive: true });
  body.addEventListener('reading-layout-change', invalidate);
  body.addEventListener('load', invalidate, true);
  const resize = new ResizeObserver(invalidate);
  resize.observe(article);
  update();
  return () => {
    copyCleanup();
    preferencesCleanup();
    cancelAnimationFrame(frame);
    resize.disconnect();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', invalidate);
    body.removeEventListener('reading-layout-change', invalidate);
    body.removeEventListener('load', invalidate, true);
  };
}
