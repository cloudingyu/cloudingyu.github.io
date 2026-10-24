import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { readingMarkdownOptions, prepareNoteMarkdown, preparePostMarkdown } from './reading-markdown.mjs';
import { collectReadingBlocks, readingSnapshot, hashReadingSnapshot } from './reading-analysis.mjs';

/** Parse only this source in memory; no content sync, build, preview, or source writes. */
export async function snapshotReadingSource(raw, isNote = false) {
  let snapshot, snapshotHash;
  function capture() { return tree => {
    snapshot = readingSnapshot(collectReadingBlocks(tree)); snapshotHash = hashReadingSnapshot(snapshot, tree);
  }; }
  const options = readingMarkdownOptions(isNote);
  const renderer = await createMarkdownProcessor({ ...options, rehypePlugins: [...options.rehypePlugins, capture] });
  await renderer.render(isNote ? prepareNoteMarkdown(raw) : preparePostMarkdown(raw));
  return { snapshot, snapshotHash };
}
