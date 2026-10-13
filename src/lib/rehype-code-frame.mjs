/** Shiki 代码块只包裹一层容器，用于背景、滚动与行号排版。 */
const h = (tagName, properties = {}, children = []) => ({
  type: 'element',
  tagName,
  properties,
  children,
});

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
  return h('figure', { className: ['code'], 'data-lang': langOf(node) || 'plain' }, [node]);
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
