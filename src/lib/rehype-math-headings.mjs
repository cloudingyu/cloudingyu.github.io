/**
 * rehype 层修复：标题里的行内公式拍平成纯文本。
 *
 * 起因：2025-01-26-vim-VScode 的小标题写成了
 *    ## $\mathrm{Vim}$ 与 $\mathrm{VSCode}$ 介绍
 * 正文里 KaTeX 会把它排成 Vim / VSCode 两个词，但 Astro 的目录（TOC）
 * 与标题锚点 id 取自语法树的**原始文本**，取到的是
 *    \mathrm{$Vim}Vim 与 VSCode\mathrm{$VSCode}VSCode 介绍
 * 于是侧栏目录会出现一坨注解源码，锚点 id 也跟着变成
 * vimmathrmvimvim-与-vscodemathrmvscodevscode-介绍。
 *
 * 做法：在 Astro 的 rehypeHeadingIds 之前把 h1–h6 里的数学节点替换成
 * 可读的纯文本（取 tex 原文、去掉 \命令 与花括号），顺带清一遍从 KaTeX
 * 注解里串进来的重复片段。标题里出现 `<span class="katex">` 的说明
 * rehypeKatex 已经跑过，所以两种形状都要认。
 *
 * 只动标题，不动正文 —— 正文里的公式该由 KaTeX 正常渲染。
 */

import { visit } from 'unist-util-visit';

/** 把 tex 源码压成可读文字：去命令、去花括号、清理多余空白 */
function texToText(tex) {
  return tex
    .replace(/\\mathrm\{([^}]*)\}/g, '$1')
    .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 收集元素下所有文本，用于识别 KaTeX 渲染后的标题 */
function textOf(node, out = []) {
  if (node.type === 'text') out.push(node.value);
  if (Array.isArray(node.children)) for (const c of node.children) textOf(c, out);
  return out;
}

export function rehypeMathHeadings() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (!/^h[1-6]$/.test(node.tagName)) return;

      // 形状 A：KaTeX 已跑过 —— 把每个 katex span 换成它的 tex 文本，
      // 否则 Astro 会把 MathML 注解里的 \mathrm{Vim} 连同 katex-html 里的
      // 字形再拼一遍，得到 \mathrm{$Vim}Vim
      visit(node, 'element', (child, index, parent) => {
        if (child.tagName !== 'span') return;
        const cls = child.properties?.className;
        const isKatex = Array.isArray(cls)
          ? cls.includes('katex')
          : typeof cls === 'string' && cls.includes('katex');
        if (!isKatex || !parent || index === null || index === undefined) return;

        const ann = [];
        visit(child, 'element', (n2) => {
          if (n2.tagName === 'annotation') {
            const t = textOf(n2).join('');
            if (t) ann.push(t);
          }
        });
        const tex = ann.join(' ') || textOf(child).join('');
        parent.children.splice(index, 1, { type: 'text', value: texToText(tex) });
        return index + 1;
      });

      // 形状 B：公式还没渲染（本插件若被排在 rehypeKatex 之前）
      visit(node, (child, index, parent) => {
        if (child.type !== 'inlineMath' && child.type !== 'math') return;
        if (!parent || index === null || index === undefined) return;
        parent.children.splice(index, 1, { type: 'text', value: texToText(child.value) });
        return index + 1;
      });

      // 兜底：清理残留的裸 $ 与重复文字（\mathrm{$Vim}Vim → Vim）
      node.children = node.children.map((c) => {
        if (c.type !== 'text') return c;
        let v = c.value;
        const dup = /([A-Za-z]+)\$\1(?![A-Za-z])/g;
        for (let i = 0; i < 3 && dup.test(v); i++) v = v.replace(dup, '$1');
        return { ...c, value: v };
      });
    });
  };
}

export default rehypeMathHeadings;
