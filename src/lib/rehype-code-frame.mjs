/**
 * 把 Shiki 产出的 <pre class="astro-code"> 包进一层「代码框」。
 *
 * 为什么要包：Astro 自己的 Shiki 输出只有一个 <pre>，语言标签与复制按钮
 * 没地方挂 —— 早先靠 CSS 的 ::before + attr(data-language) 画标签，
 * 但伪元素里的文字选不中、也进不了无障碍树，复制按钮更是必须是真的 DOM。
 *
 * 产出结构：
 *   <figure class="code" data-lang="python">
 *     <figcaption class="code__bar">
 *       <span class="code__lang">python</span>
 *       <button class="code__copy" data-copy type="button" aria-label="复制这段代码">…</button>
 *     </figcaption>
 *     <pre class="astro-code" data-language="python">…</pre>
 *   </figure>
 *
 * 这一层必须挂在 Shiki 之后 —— Astro 的处理器里 rehypePlugins 正是在 Shiki
 * 之后执行的，所以能拿到已经着好色的 pre。
 *
 * 实现上刻意不做「先 visit 找 pre 再替换」：unist-util-visit 在返回 'skip'
 * 时仍会把已替换的父节点继续往下走，导致新插进来的 figcaption 又被处理一遍。
 * 这里改成显式遍历 children 数组，一步到位。
 */
const h = (tagName, properties = {}, children = []) => ({
  type: 'element',
  tagName,
  properties,
  children,
});

/** 没有信息量、不显示语言标签的语言名 */
const NO_LABEL = new Set(['plaintext', 'text', 'txt', '']);

/** 语言名的展示别名 */
const LABEL_ALIAS = {
  console: '终端',
  terminal: '终端',
  bash: 'shell',
  sh: 'shell',
  zsh: 'shell',
  html: 'HTML',
  css: 'CSS',
  js: 'JavaScript',
  ts: 'TypeScript',
  md: 'Markdown',
  yml: 'YAML',
};

/**
 * 属性的读法要兼容两种写法。
 *
 * 这一版的 markdown 处理器交给插件的 HAST 节点里，属性名是「驼峰」形式
 * （class / dataLanguage），而不是 HTML 风格的 className / data-language。
 * h() 造出来的节点用 className，而进入哈希序列化时两者等价、都能正确输出。
 * 所以读取时两种都认，写死一边就会静默不生效（这个坑已经踩过一次）。
 */
const classListOf = (node) => {
  const raw = node.properties?.className ?? node.properties?.class;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') return raw.split(/\s+/);
  return [];
};

const langOf = (node) => {
  const raw = node.properties?.['data-language'] ?? node.properties?.dataLanguage ?? '';
  return String(raw).trim();
};

function isShikiPre(node) {
  if (!node || node.type !== 'element' || node.tagName !== 'pre') return false;
  const list = classListOf(node);
  return list.includes('astro-code') || list.includes('shiki') || langOf(node) !== '';
}

function frame(node) {
  const langRaw = langOf(node);
  const label = LABEL_ALIAS[langRaw] ?? (NO_LABEL.has(langRaw) ? '' : langRaw);

  const bar = h('figcaption', { className: ['code__bar'] }, [
    h('span', { className: ['code__lang'] }, [{ type: 'text', value: label }]),
    h(
      'button',
      {
        type: 'button',
        className: ['code__copy'],
        'data-copy': '',
        'aria-label': '复制这段代码',
      },
      [
        h('span', { className: ['code__copy-icon'], 'aria-hidden': 'true' }),
        h('span', { className: ['code__copy-label'] }, [{ type: 'text', value: '复制' }]),
      ],
    ),
  ]);

  return h('figure', { className: ['code'], 'data-lang': langRaw || 'plain' }, [bar, node]);
}

/** 深度优先遍历，遇到 Shiki 的 pre 就地包一层。 */
function walk(node) {
  if (!node || !Array.isArray(node.children)) return;
  node.children = node.children.map((child) => (isShikiPre(child) ? frame(child) : child));
  for (const child of node.children) {
    if (child?.type === 'element' && child.tagName === 'figure') continue;
    walk(child);
  }
}

export function rehypeCodeFrame() {
  return (tree) => {
    walk(tree);
  };
}
