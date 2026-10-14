import { getReadingEmphasis } from '../data/reading-emphasis.mjs';

const EXCLUDED_TAGS = new Set([
  'pre', 'code', 'kbd', 'samp', 'script', 'style', 'svg', 'math', 'annotation',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'a', 'button',
]);

const classesOf = (node) => {
  const value = node.properties?.className ?? node.properties?.class ?? [];
  return Array.isArray(value) ? value : String(value).split(/\s+/);
};

/** Add presentation-only spans to ordinary prose, preserving every character.
 * Longest matches win so “负对数似然” is not split into shorter concepts.
 * Math, code, headings and the author's own emphasis remain intact. */
export function rehypeReadingEmphasis() {
  return (tree, file) => {
    const frontmatter = file.data.astro?.frontmatter;
    const profile = getReadingEmphasis(frontmatter?.readingEmphasisKey ?? frontmatter?.title);
    if (!profile) return;
    const levels = new Map();
    for (const level of ['secondary', 'primary']) {
      for (const term of profile[level]) if (term) levels.set(term, level);
    }
    const terms = [...levels.keys()].sort((a, b) => b.length - a.length);
    const pattern = new RegExp(terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gu');

    function splitText(node) {
      const children = [];
      let cursor = 0;
      for (const match of node.value.matchAll(pattern)) {
        if (match.index > cursor) children.push({ type: 'text', value: node.value.slice(cursor, match.index) });
        children.push({
          type: 'element', tagName: 'span',
          properties: { className: ['reading-term'], 'data-importance': levels.get(match[0]) },
          children: [{ type: 'text', value: match[0] }],
        });
        cursor = match.index + match[0].length;
      }
      if (!cursor) return [node];
      if (cursor < node.value.length) children.push({ type: 'text', value: node.value.slice(cursor) });
      return children;
    }

    function walk(node, inProse = false) {
      if (!Array.isArray(node.children)) return;
      if (node.type === 'element' && (EXCLUDED_TAGS.has(node.tagName)
        || classesOf(node).some(name => name.startsWith('katex') || name === 'reading-term'))) return;
      const prose = inProse || (node.type === 'element' && ['p', 'li', 'td', 'dd', 'figcaption'].includes(node.tagName));
      node.children = node.children.flatMap(child => {
        if (prose && child.type === 'text') return splitText(child);
        walk(child, prose);
        return [child];
      });
    }
    walk(tree);
  };
}
