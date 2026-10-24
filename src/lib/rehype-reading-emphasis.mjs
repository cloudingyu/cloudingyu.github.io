import { getReadingEmphasis } from '../data/reading-emphasis.mjs';
import { collectReadingBlocks, readingSnapshot, hashReadingSnapshot, validateReadingAnalysis } from './reading-analysis.mjs';
import { scoreReadingAnalysis } from './reading-scoring.mjs';

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
    if (profile.schemaVersion === 2) {
      const blocks = collectReadingBlocks(tree);
      const snapshot = readingSnapshot(blocks);
      if (profile.snapshotHash !== hashReadingSnapshot(snapshot, tree)) return;
      try { validateReadingAnalysis(profile, snapshot); }
      catch { return; } // A changed document cannot receive stale annotations.
      const scored = scoreReadingAnalysis(profile.blocks);
      for (const block of blocks) {
        const spans = scored.filter(s => s.blockId === block.id).flatMap(s => s.spans);
        for (const piece of block.pieces) {
          const children = [];
          for (const span of spans) {
            const start = Math.max(piece.start, span.start), end = Math.min(piece.end, span.end);
            if (start >= end) continue;
            children.push({ type: 'element', tagName: 'span', properties: {
              className: ['reading-word'], 'data-reading-level': span.level,
              style: `--reading-word-alpha:${(span.alpha * 100).toFixed(4)}%`,
            }, children: [{ type: 'text', value: block.text.slice(start, end) }] });
          }
          // Replacing this leaf by a transparent container keeps its parent intact.
          piece.node.type = 'element'; piece.node.tagName = 'span';
          piece.node.properties = { className: ['reading-prose-run'] };
          piece.node.children = children;
          delete piece.node.value;
        }
      }
      return;
    }
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
