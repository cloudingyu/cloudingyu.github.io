/** Shared Markdown options keep offline annotation offsets equal to site offsets. */
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { remarkMathRestore } from './remark-math-restore.mjs';
import { remarkGuardCurrency } from './remark-guard-currency.mjs';
import { rehypeMathHeadings } from './rehype-math-headings.mjs';
import { rehypeNotebookHeadings } from './rehype-notebook-headings.mjs';
import { rehypeCodeFrame } from './rehype-code-frame.mjs';
import { rehypeLazyImages } from './rehype-lazy-images.mjs';

/** @returns {import('@astrojs/markdown-remark').AstroMarkdownOptions & {rehypePlugins: import('@astrojs/markdown-remark').RehypePlugins}} */
export const readingMarkdownOptions = (isNote = false) => ({
  remarkPlugins: isNote ? [remarkMath, remarkMathRestore] : [remarkMath, remarkMathRestore, remarkGuardCurrency],
  rehypePlugins: [isNote ? [rehypeKatex, { strict: false, trust: false }] : rehypeKatex,
    isNote ? rehypeNotebookHeadings : rehypeMathHeadings, rehypeCodeFrame, rehypeLazyImages],
  syntaxHighlight: 'shiki',
  shikiConfig: { themes: { light: 'github-light', dark: 'github-dark-dimmed' }, defaultColor: false, wrap: false },
  ...(isNote ? { smartypants: false } : {}),
});

// Moved unchanged from notebook.ts: transform rendering input only.
export function prepareNoteMarkdown(raw) {
  const content = raw.replace(/^(\uFEFF?\*\*日期\*\*[^\r\n]*)\r?\n(?=[ \t]*\*\*内容\*\*)/, '$1  \n');
  const lines = content.split(/\r?\n/);
  let fence = '', plain = '', output = '';
  const flush = () => {
    output += plain.replace(/^[ \t]*\$\$([^$]+?)\$\$[ \t]*$/gm, (_, tex) => `$$\n${tex.trim()}\n$$`);
    plain = '';
  };
  for (const line of lines) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (!fence && marker) { flush(); fence = marker; output += line + '\n'; continue; }
    if (fence) {
      output += line + '\n';
      if (marker && marker[0] === fence[0] && marker.length >= fence.length && /^ {0,3}(`+|~+)\s*$/.test(line)) fence = '';
    } else plain += line + '\n';
  }
  flush();
  return output;
}

export function preparePostMarkdown(raw) {
  return raw.replace(/\r\n/g, '\n').replace(/^---\n[\s\S]*?\n---[ \t]*\n/, '')
    .replace(/^\n+/, '\n').replace(/(\]\()\/img\//g, '$1/images/').replace(/(\bsrc=["'])\/img\//g, '$1/images/');
}
