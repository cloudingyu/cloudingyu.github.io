/**
 * remark 层修复：把旧站遗留的公式语法还原成 remark-math 认识的节点。
 *
 * 内容层一字不改，所以只能在渲染层兜底。下面每一处都是旧站
 * `_plugins/math_markdown_protect.rb` 的产物，不是作者写错了公式。
 *
 * 关键难点：remark-math 是 micromark 的**分词期**扩展，只在 tokenize 那一次扫描里
 * 认公式；markdown 里的 `\$` 在分词期就被吃成字面 `$`，而配对判断同时完成 ——
 * 所以「先把 `\$$` 改回 `$$`，再让 remarkMath 重新收一遍」是做不到的：
 * 等本插件跑起来时，parse 早就结束了，text 节点里的 `$$` 不会再被当成定界符。
 * 因此这里必须自己把 text 节点劈成 [text, math, text, …]。
 *
 * 三处来源：
 *
 * 1) `\$$ … \$$`（2025-04-13-leetcode-4 第 74–75 行）
 *    旧插件的 protect_inline_math 判断行内公式结尾时要看「前一个字符不是 \」，
 *    而开头那侧的判断写在 `line[i+1] != "$"` 之后，`\$$` 就被漏在 markdown 里。
 *    原站靠 MathJax 的 processEscapes 兜住了，KaTeX 不认。
 *
 * 2) 行内公式写在 HTML 块里（2022-02-08-luogu-P1007 第 66、71 行）
 *    `<p style="text-align: center;">$\displaystyle\max(...)$</p>`
 *    HTML 块在语法树里是单个 html 节点，remark-math 扫不进去。原站同样失效
 *    （MathJax 也没处理这些），属于长期存在的缺陷，这里顺手修好。
 *
 * 3) 中文被误括（2022-02-10-luogu-P1010）—— 见 remark-guard-currency.mjs。
 */

import { visit } from 'unist-util-visit';
import { isMathMisfire } from './remark-guard-currency.mjs';

/** 把 tex 里被 kramdown 转义过的定界符折回正常写法 */
const unescapeDollars = (s) => s.replace(/\\\$/g, '$');

/**
 * 把一个纯文本字符串按公式定界符切成节点数组。
 * 先认 `$$…$$`（块级），再认 `$…$`（行内），避免长定界符被短定界符抢断。
 * 误触（中文被 `$` 包住且不含 LaTeX 命令）不切，留给 remarkGuardCurrency 处理。
 */
function splitMath(value) {
  const out = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let last = 0;
  let m;

  const pushText = (v) => {
    if (v) out.push({ type: 'text', value: v });
  };

  while ((m = re.exec(value))) {
    const tex = m[1] ?? m[2];
    const isBlock = m[1] !== undefined;

    // 中文被 `$` 误括的段落不在这里拆，交回给守卫插件降级成正文
    if (!isBlock && isMathMisfire(tex)) continue;

    pushText(value.slice(last, m.index));
    out.push(isBlock ? { type: 'math', value: tex } : { type: 'inlineMath', value: tex });
    last = m.index + m[0].length;
  }

  pushText(value.slice(last));
  return out;
}

/** 单个 html 块恰好是一对定界符包着一个公式：拆成 html + math + html */
function splitHtmlMath(value) {
  const m = /^(<(?:p|div)\b[^>]*>)\s*\$([^$\n]+)\$\s*(<\/(?:p|div)>)\s*$/i.exec(value);
  if (!m) return null;
  const [, open, tex, close] = m;
  if (isMathMisfire(tex)) return null;
  return [
    { type: 'html', value: open },
    { type: 'inlineMath', value: tex },
    { type: 'html', value: close },
  ];
}

/** 递归替换：把 text 节点里残留的公式语法劈成 math 节点 */
function rewriteChildren(parent) {
  if (!Array.isArray(parent.children)) return;
  const next = [];
  for (const child of parent.children) {
    if (child.type === 'text') {
      const v = unescapeDollars(child.value);
      // 没有 `$` 就不必切
      next.push(...(v.includes('$') ? splitMath(v) : [{ ...child, value: v }]));
    } else if (child.type === 'html') {
      const parts = splitHtmlMath(unescapeDollars(child.value));
      if (parts) next.push(...parts);
      else next.push({ ...child, value: unescapeDollars(child.value) });
    } else {
      rewriteChildren(child);
      next.push(child);
    }
  }
  parent.children = next;
}

export function remarkMathRestore() {
  return (tree) => {
    rewriteChildren(tree);
    // 补一遍：KaTeX 之外还有别的插件可能再造出 text 节点，稳妥起见多走一层
    visit(tree, (node) => {
      if (node.type === 'html') {
        const parts = splitHtmlMath(unescapeDollars(node.value));
        if (parts) return parts;
      }
    });
  };
}

export default remarkMathRestore;
