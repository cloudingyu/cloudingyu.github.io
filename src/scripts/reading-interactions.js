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
  const bar = body.querySelector('#progress-bar');
  const percent = body.querySelector('[data-reading-progress]');
  const directory = body.querySelector('.post__toc-panel');
  const compact = matchMedia('(max-width: 67.99rem)');
  const adaptDirectory = () => { if (directory) directory.open = !compact.matches; };
  if (directory && !directory.hasAttribute('data-directory-ready')) {
    adaptDirectory();
    directory.setAttribute('data-directory-ready', '');
  }
  compact.addEventListener('change', adaptDirectory);
  const headings = [...body.querySelectorAll('.post__toc a[href^="#"]')].map((link) => ({
    link, heading: document.getElementById(decodeURIComponent(link.hash.slice(1))),
  })).filter(({ heading }) => heading);
  let frame = 0;

  const update = () => {
    frame = 0;
    const rect = article.getBoundingClientRect();
    const range = Math.max(rect.height - innerHeight * .65, 1);
    const progress = Math.min(1, Math.max(0, (innerHeight * .2 - rect.top) / range));
    if (bar) bar.style.transform = `scaleX(${progress})`;
    if (percent) percent.textContent = `${Math.round(progress * 100)}%`;
    let active = headings[0];
    for (const entry of headings) {
      if (entry.heading.getBoundingClientRect().top <= innerHeight * .28) active = entry;
      else break;
    }
    headings.forEach((entry) => {
      const current = active === entry;
      entry.link.classList.toggle('is-current', current);
      if (current) entry.link.setAttribute('aria-current', 'location');
      else entry.link.removeAttribute('aria-current');
    });
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  const resize = new ResizeObserver(schedule);
  resize.observe(article);
  update();
  return () => {
    copyCleanup();
    cancelAnimationFrame(frame);
    resize.disconnect();
    compact.removeEventListener('change', adaptDirectory);
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
  };
}
