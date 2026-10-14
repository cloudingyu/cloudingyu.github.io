import TurndownService from 'turndown';
import '../styles/markdown-selection.css';

const elementOf = (node) => node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;

function createConverter() {
  const converter = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
  });
  converter.addRule('math', {
    filter: (node) => node.hasAttribute('data-copy-math'),
    replacement: (_, node) => node.hasAttribute('data-copy-display')
      ? `\n\n$$\n${node.getAttribute('data-copy-math')}\n$$\n\n`
      : `$${node.getAttribute('data-copy-math')}$`,
  });
  converter.addRule('fencedCode', {
    filter: 'pre',
    replacement: (_, node) => {
      const code = node.textContent.replace(/\n$/, '');
      // A fence longer than every run in the code can also contain Markdown examples.
      const length = Math.max(3, ...Array.from(code.matchAll(/`+/g), (match) => match[0].length + 1));
      const fence = '`'.repeat(length);
      const language = node.getAttribute('data-language')
        || node.querySelector('code')?.className.match(/language-([\w+-]+)/)?.[1]
        || '';
      return `\n\n${fence}${language}\n${code}\n${fence}\n\n`;
    },
  });
  converter.addRule('strikethrough', {
    filter: ['del', 's', 'strike'],
    replacement: (content) => `~~${content}~~`,
  });
  converter.addRule('taskCheckbox', {
    filter: (node) => node.nodeName === 'INPUT' && node.getAttribute('type') === 'checkbox',
    replacement: (_, node) => node.hasAttribute('checked') ? '[x] ' : '[ ] ',
  });
  converter.addRule('table', {
    filter: 'table',
    replacement: (_, node) => {
      const rows = Array.from(node.rows);
      if (!rows.length) return '';
      const width = Math.max(...rows.map((row) => row.cells.length));
      const line = (cells) => `| ${Array.from({ length: width }, (_, i) => cells[i] || '').join(' | ')} |`;
      const values = rows.map((row) => Array.from(row.cells, (cell) => converter.turndown(cell.innerHTML)
        .replace(/\|/g, '\\|').replace(/\n+/g, '<br>')));
      // A selection containing only body rows still needs a Markdown table header.
      const header = rows[0].querySelector('th') ? values.shift() : [];
      return `\n\n${[line(header), line(Array(width).fill('---')), ...values.map(line)].join('\n')}\n\n`;
    },
  });
  return converter;
}

function selectedFragment(range, article) {
  const copyRange = range.cloneRange();
  // KaTeX has two rendering trees. Copy its complete TeX annotation once,
  // even if a selection endpoint is inside an individual rendered symbol.
  const startMath = elementOf(copyRange.startContainer)?.closest('.katex-display, .katex, [data-copy-math]');
  const endMath = elementOf(copyRange.endContainer)?.closest('.katex-display, .katex, [data-copy-math]');
  if (startMath) copyRange.setStartBefore(startMath.closest('.katex-display') || startMath);
  if (endMath) copyRange.setEndAfter(endMath.closest('.katex-display') || endMath);

  let fragment = copyRange.cloneContents();
  // cloneContents omits the common ancestor. Restore that context so selecting
  // part of a heading, link, list item, or code block retains its Markdown format.
  let ancestor = elementOf(copyRange.commonAncestorContainer);
  while (ancestor && ancestor !== article) {
    const wrapper = ancestor.cloneNode(false);
    if (ancestor.tagName === 'OL') {
      const firstItem = elementOf(copyRange.startContainer)?.closest('li');
      const index = Array.from(ancestor.children).indexOf(firstItem);
      if (index >= 0) wrapper.setAttribute('start', String((Number(ancestor.getAttribute('start')) || 1) + index));
    }
    wrapper.append(fragment);
    fragment = wrapper;
    ancestor = ancestor.parentElement;
  }
  const container = document.createElement('div');
  container.append(fragment);
  container.querySelectorAll('.code-copy, a.anchor, script, style').forEach((node) => node.remove());
  for (const math of container.querySelectorAll('.katex')) {
    const tex = math.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
    if (tex == null) continue;
    const display = math.closest('.katex-display');
    const replacement = document.createElement(display ? 'div' : 'span');
    replacement.setAttribute('data-copy-math', tex);
    if (display) replacement.setAttribute('data-copy-display', '');
    replacement.textContent = tex;
    (display || math).replaceWith(replacement);
  }
  for (const node of container.querySelectorAll('a[href], img[src]')) {
    const attribute = node.tagName === 'A' ? 'href' : 'src';
    // Root-relative article assets should remain usable when pasted elsewhere.
    node.setAttribute(attribute, new URL(node.getAttribute(attribute), document.baseURI).href);
  }
  return container;
}

export function bindMarkdownSelectionCopy(article, copyText) {
  const converter = createConverter();
  const controller = new AbortController();
  const cursor = document.querySelector('.exp-cursor');
  const popup = document.createElement('div');
  popup.className = 'markdown-selection';
  popup.hidden = true;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'markdown-selection__button';
  button.setAttribute('aria-label', '将选中内容复制为 Markdown');
  button.title = '复制 Markdown';
  button.innerHTML = '<svg class="markdown-selection__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g class="markdown-selection__sheets"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/></g><path class="markdown-selection__check" d="m5 12 4 4 10-10"/></svg><span class="markdown-selection__label">复制 Markdown</span>';
  const label = button.querySelector('.markdown-selection__label');
  const status = document.createElement('span');
  status.className = 'markdown-selection__status';
  status.setAttribute('role', 'status');
  popup.append(button, status);
  document.body.append(popup);
  let currentRange = null;
  let dragging = false;
  let frame = 0;
  let timer = 0;
  let bounds = null;
  let pointer = null;
  let selectionAnchor = null;
  const formulas = Array.from(article.querySelectorAll('.katex'));
  const selectedFormulas = new Set();
  const highlightFormulas = (range) => {
    for (const formula of formulas) {
      const selected = !!range && range.intersectsNode(formula);
      if (selected === selectedFormulas.has(formula)) continue;
      formula.toggleAttribute('data-math-selected', selected);
      if (selected) selectedFormulas.add(formula);
      else selectedFormulas.delete(formula);
    }
  };
  const updateCursor = () => {
    if (!pointer || !bounds) return;
    const target = elementOf(pointer.target);
    const blocked = target?.closest('button, .post__toc, .markdown-selection, .reading-width')
      || (!article.contains(target) && target?.closest('a'));
    const margin = 40;
    const y = pointer.y + scrollY;
    cursor?.classList.toggle('is-reading-text', !blocked
      && pointer.x >= bounds.left - margin && pointer.x <= bounds.right + margin
      && y >= bounds.top - margin && y <= bounds.bottom + margin);
  };
  const measure = () => {
    const rect = article.getBoundingClientRect();
    bounds = { left: rect.left, right: rect.right, top: rect.top + scrollY, bottom: rect.bottom + scrollY };
    updateCursor();
  };

  const getRange = () => {
    if (document.activeElement?.closest('input, textarea, [contenteditable]:not([contenteditable="false"])')) return null;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null;
    const range = selection.getRangeAt(0);
    return article.contains(range.startContainer) && article.contains(range.endContainer) ? range : null;
  };
  const hide = () => { popup.hidden = true; };
  const position = () => {
    if (!currentRange || dragging) return hide();
    const rect = currentRange.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= innerHeight) return hide();
    popup.hidden = false;
    const { width, height } = popup.getBoundingClientRect();
    const anchoredRange = selectionAnchor?.range;
    const matchesAnchor = anchoredRange
      && anchoredRange.startContainer === currentRange.startContainer && anchoredRange.startOffset === currentRange.startOffset
      && anchoredRange.endContainer === currentRange.endContainer && anchoredRange.endOffset === currentRange.endOffset;
    let x, y;
    if (matchesAnchor) {
      x = selectionAnchor.x - scrollX;
      y = selectionAnchor.y - scrollY;
    } else {
      // Keyboard and touch selections use the moving end of the selection.
      const caret = currentRange.cloneRange();
      const selection = window.getSelection();
      if (selection?.focusNode && article.contains(selection.focusNode)) {
        caret.setStart(selection.focusNode, selection.focusOffset);
        caret.collapse(true);
      } else caret.collapse(false);
      const caretRect = caret.getBoundingClientRect();
      const end = caretRect.height ? caretRect : Array.from(currentRange.getClientRects()).at(-1) || rect;
      x = end.right;
      y = end.bottom;
    }
    const left = Math.max(12, Math.min(x + 12 + width <= innerWidth - 12 ? x + 12 : x - width - 12, innerWidth - width - 12));
    const top = Math.max(12, Math.min(y + 12 + height <= innerHeight - 12 ? y + 12 : y - height - 12, innerHeight - height - 12));
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
  };
  const update = () => {
    frame = 0;
    currentRange = getRange()?.cloneRange() || null;
    highlightFormulas(currentRange);
    clearTimeout(timer);
    delete popup.dataset.state;
    label.textContent = '复制 Markdown';
    button.title = '复制 Markdown';
    button.setAttribute('aria-label', '将选中内容复制为 Markdown');
    status.textContent = '';
    position();
  };
  const schedule = () => { if (!frame && !button.disabled) frame = requestAnimationFrame(update); };
  const feedback = (success) => {
    label.textContent = success ? '已复制' : '重试复制';
    button.title = success ? '已复制' : '复制失败，点击重试';
    button.setAttribute('aria-label', success ? '已复制为 Markdown，再次点击复制' : '复制失败，点击重试');
    status.textContent = success ? '已复制为 Markdown' : '复制失败，请重试';
    popup.dataset.state = success ? 'copied' : 'error';
    clearTimeout(timer);
    timer = setTimeout(() => {
      delete popup.dataset.state;
      label.textContent = '复制 Markdown';
      button.title = '复制 Markdown';
      button.setAttribute('aria-label', '将选中内容复制为 Markdown');
      status.textContent = '';
    }, 2000);
  };
  const onCopy = (event) => {
    if (!event.clipboardData || event.defaultPrevented) return;
    if (elementOf(event.target)?.closest('input, textarea, [contenteditable]:not([contenteditable="false"])')) return;
    const range = getRange();
    if (!range) return;
    try {
      const markdown = converter.turndown(selectedFragment(range, article));
      if (!markdown) return;
      event.clipboardData.setData('text/plain', markdown);
      event.preventDefault();
      cancelAnimationFrame(frame);
      frame = 0;
      currentRange = range.cloneRange();
      highlightFormulas(currentRange);
      position();
      feedback(true);
    } catch {
      // Keep native copying available if an unusual selection cannot be converted.
    }
  };
  const listen = (target, type, handler, options = {}) => target.addEventListener(type, handler, { ...options, signal: controller.signal });
  listen(document, 'copy', onCopy);
  listen(document, 'selectionchange', schedule);
  listen(document, 'pointermove', (event) => {
    pointer = { x: event.clientX, y: event.clientY, target: event.target };
    updateCursor();
  }, { passive: true });
  listen(document, 'pointerdown', (event) => {
    if (popup.contains(event.target)) return;
    if (event.button === 0) selectionAnchor = null;
    dragging = event.button === 0 && article.contains(event.target);
    if (dragging) hide();
  }, { passive: true });
  listen(document, 'pointerup', (event) => {
    if (!dragging) return;
    dragging = false;
    const range = getRange();
    selectionAnchor = range ? { x: event.clientX + scrollX, y: event.clientY + scrollY, range: range.cloneRange() } : null;
    schedule();
  }, { passive: true });
  listen(document, 'pointercancel', () => { dragging = false; selectionAnchor = null; schedule(); });
  listen(document, 'pointerleave', () => { pointer = null; cursor?.classList.remove('is-reading-text'); });
  listen(document, 'keydown', (event) => { if (event.key === 'Escape') hide(); });
  listen(window, 'scroll', () => { updateCursor(); position(); }, { passive: true });
  listen(window, 'resize', () => { selectionAnchor = null; measure(); position(); }, { passive: true });
  listen(document.body, 'reading-layout-change', measure);
  listen(document.body, 'load', measure, { capture: true });
  const resize = new ResizeObserver(measure);
  resize.observe(article);
  measure();
  listen(button, 'pointerdown', (event) => { if (event.pointerType === 'mouse') event.preventDefault(); });
  listen(button, 'click', async () => {
    if (!currentRange) return;
    button.disabled = true;
    delete popup.dataset.state;
    label.textContent = '正在复制…';
    button.title = '正在复制…';
    try {
      await copyText(converter.turndown(selectedFragment(currentRange, article)));
      if (!controller.signal.aborted) feedback(true);
    } catch {
      if (!controller.signal.aborted) feedback(false);
    } finally {
      if (!controller.signal.aborted) button.disabled = false;
    }
  });
  return () => {
    controller.abort();
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    resize.disconnect();
    selectedFormulas.forEach((formula) => formula.removeAttribute('data-math-selected'));
    cursor?.classList.remove('is-reading-text');
    popup.remove();
  };
}
