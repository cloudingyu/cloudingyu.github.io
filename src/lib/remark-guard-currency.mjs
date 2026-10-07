/**
 * remark 层守卫：把被误判成公式的中文句子还原成正文。
 *
 * 起因（内容层一字不改，只能在渲染层兜底）：
 * `2022-02-10-luogu-P1010.md` 第 21 行原文是
 *   所以最后 $137$ 可表示为：$2(2(2)+2+2(0))+2(2+2(0))+2(0)。$
 * 句末多出一个 `$`。原站 MathJax 下它恰好与前一个 `$` 配成一对，视觉上无碍；
 * remark-math 按同样规则把 `2(2(2)+…+2(0)。` 整段收成行内公式，于是 KaTeX 把
 * 中文句号「。」排进数学模式，并发出 unicodeTextInMathMode 警告。
 *
 * 做法：本插件排在 remarkMath **之后**，此时公式节点已经成型，只需做判断 ——
 * 内容含中日韩字符、且不含任何 LaTeX 命令（\xxx）的 inlineMath / math 节点
 * 判定为误触，原地降级回纯文本。
 *
 * 为什么不能排在 remarkMath 之前：即使把误触的那个 `$` 转义成 `\$` 写回 text
 * 节点，紧随其后的 remarkMath 仍会重新扫描同一段文本、把两个字面 `$` 再配一次，
 * 等于没修。只有在公式节点已经生成之后介入，判断才是稳定的。
 *
 * 真公式不含中文，所以本站 10 篇含公式的文章里只命中这一处误触。
 */

import { visit } from 'unist-util-visit';

/** 中日韩字符（含全角标点、假名、谚文） */
const CJK = /[　-〿぀-ヿ㐀-䶿一-鿿豈-﫿＀-￯]/;
/** LaTeX 命令，例如 \displaystyle \frac \le —— 有它基本可以确定是真公式 */
const LATEX_CMD = /\\[a-zA-Z]/;

/** true = 这段「公式」其实是中文正文被 `$` 误括进来的 */
export function isMathMisfire(value) {
  return CJK.test(value) && !LATEX_CMD.test(value);
}

export function remarkGuardCurrency() {
  return (tree) => {
    visit(tree, (node, index, parent) => {
      if (node.type !== 'inlineMath' && node.type !== 'math') return;
      if (!parent || index === null || index === undefined) return;
      if (!isMathMisfire(node.value)) return;

      // 只还原「内容」本身，丢掉误触这一对定界符 —— 句子本来到「。」就结束了，
      // 那两个 `$` 是该被修掉的书写残留，不是正文（转义写回的话，读者会看到
      // 一个突兀的 `$`，且渲染出来与原文语义不符）。
      parent.children.splice(index, 1, { type: 'text', value: node.value });
      return index + 1;
    });
  };
}

export default remarkGuardCurrency;
