import { visit } from 'unist-util-visit';
import { rehypeHeadingIds } from '@astrojs/markdown-remark';
import { rehypeMathHeadings } from './rehype-math-headings.mjs';

/** Collect readable directory labels on copies; retain KaTeX in the actual headings. */
export function rehypeNotebookHeadings() {
  return (tree, file) => {
    const originals = [];
    visit(tree, 'element', (node) => {
      if (/^h[1-6]$/.test(node.tagName)) originals.push(node);
    });
    const copy = { type: 'root', children: structuredClone(originals) };
    rehypeMathHeadings()(copy);
    rehypeHeadingIds()(copy, file);
    const headings = file.data.astro.headings;
    originals.forEach((node, i) => {
      node.properties ??= {};
      node.properties.id = headings[i].slug;
    });
    // Astro collects headings again later; preserve the clean labels separately.
    file.data.astro.frontmatter.notebookHeadings = headings;
  };
}
