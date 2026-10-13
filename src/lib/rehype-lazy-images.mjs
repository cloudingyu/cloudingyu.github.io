import { visit } from 'unist-util-visit';

/** Defer article diagrams below the viewport; keep any explicit author loading preference. */
export function rehypeLazyImages() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'img') return;
      node.properties ??= {};
      node.properties.loading ??= 'lazy';
      node.properties.decoding ??= 'async';
    });
  };
}
