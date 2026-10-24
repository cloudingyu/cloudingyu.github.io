import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { ANALYSIS_METHOD, collectReadingBlocks, readingSnapshot, validateReadingAnalysis } from '../src/lib/reading-analysis.mjs';
import { scoreReadingAnalysis, displayAlpha, displayLevel } from '../src/lib/reading-scoring.mjs';
import { readingMarkdownOptions, prepareNoteMarkdown, preparePostMarkdown } from '../src/lib/reading-markdown.mjs';
import { snapshotReadingSource } from '../src/lib/reading-snapshot.mjs';
import { rehypeReadingEmphasis } from '../src/lib/rehype-reading-emphasis.mjs';
import { READING_EMPHASIS, getReadingEmphasis } from '../src/data/reading-emphasis.mjs';
import astroConfig from '../astro.config.mjs';

const raw = '---\ntitle: 测试\n---\n# 模型标题\n\n模型依赖条件。模型只是背景。\n\n在 **既有强调** 与 $x^2$、`code` 和 [链接](https://example.com) 后，结论不成立。\n\n- 父项\n  - 子项 👩‍💻\n\n```js\nconst x = 1;\n```\n';
const textOf = n => n.type === 'text' ? n.value : (n.children ?? []).map(textOf).join('');
const elements = (n, predicate) => [...(predicate(n) ? [n] : []), ...(n.children ?? []).flatMap(c => elements(c, predicate))];
const profileFor = (snapshot, snapshotHash) => ({ schemaVersion: 2, method: ANALYSIS_METHOD, offsetEncoding: 'utf16', snapshotHash,
  blocks: snapshot.map(b => ({ ...b, sentences: b.sentences.map((s, i) => ({ ...s,
    importance: i === 0 ? 95 : 30, words: [],
  })) })),
});
const annotate = (profile, blockIndex, sentenceIndex, text, information) => {
  const b = profile.blocks[blockIndex], s = b.sentences[sentenceIndex];
  const start = b.text.indexOf(text, s.start);
  assert(start >= s.start && start + text.length <= s.end);
  s.words.push({ start, end: start + text.length, text, information });
};

test('the same word has independent scores in different sentences', async () => {
  const { snapshot } = await snapshotReadingSource(raw);
  const profile = profileFor(snapshot);
  annotate(profile, 0, 0, '模型', 95); annotate(profile, 0, 1, '模型', 15);
  validateReadingAnalysis(profile, snapshot);
  const scored = scoreReadingAnalysis(profile.blocks);
  assert.equal(scored[0].important, true);
  assert.equal(scored[0].spans[0].level, 15);
  assert(scored[1].spans[0].level < scored[0].spans[0].level);
  assert(scored[0].spans.at(-1).alpha > .3, 'important sentence grammar retains a readable floor');
  assert.equal(scored[1].spans.at(-1).alpha, .3);
});

test('sixteen levels are monotonic and keep 30% / 100% endpoints', () => {
  let previous = 0; const levels = new Set();
  for (let i = 0; i <= 1000; i++) {
    const alpha = displayAlpha(i / 1000); assert(alpha >= previous); previous = alpha;
    levels.add(displayLevel(i / 1000));
  }
  assert.equal(levels.size, 16); assert.equal(displayAlpha(0), .3); assert.equal(displayAlpha(1), 1);
});

test('tied paragraph scores and single-sentence paragraphs get no invented ranking', () => {
  const b = { id: 'b1', sentences: [
    { start: 0, end: 2, importance: 95, words: [] },
    { start: 2, end: 4, importance: 95, words: [] },
  ] };
  assert(scoreReadingAnalysis([b]).every(s => !s.important));
  assert(scoreReadingAnalysis([{ ...b, sentences: b.sentences.slice(0, 1) }]).every(s => !s.important));
});

test('snapshot protects inline math, code, author emphasis, links and nested list items', async () => {
  const { snapshot } = await snapshotReadingSource(raw);
  assert(snapshot.some(b => b.text.includes('\uFFFC')));
  assert(!snapshot.some(b => /既有强调|x\^2|链接|const x|模型标题/.test(b.text)));
  assert(snapshot.some(b => b.text.includes('父项')));
  assert(snapshot.some(b => b.text.includes('子项')));
  const profile = profileFor(snapshot); annotate(profile, 0, 0, '模型', 90);
  const invalid = structuredClone(profile); invalid.blocks[0].sentences[0].words[0].end++;
  assert.throws(() => validateReadingAnalysis(invalid, snapshot));
  const changed = structuredClone(snapshot); changed[0].text += '变化';
  assert.throws(() => validateReadingAnalysis(profile, changed));
});

test('reject protected ranges, split graphemes, English substrings, overlap and missing scores', () => {
  const tree = { type: 'element', tagName: 'p', children: [{ type: 'text', value: 'cache 👩‍💻 ' },
    { type: 'element', tagName: 'code', children: [{ type: 'text', value: 'x' }] }, { type: 'text', value: '结束。' }] };
  const snapshot = readingSnapshot(collectReadingBlocks(tree));
  const base = profileFor(snapshot);
  for (const word of [
    { start: 1, end: 5, text: 'ache', information: 80 },
    { start: 6, end: 8, text: '👩', information: 80 },
    { start: 12, end: 14, text: '\uFFFC结', information: 80 },
  ]) {
    const profile = structuredClone(base); profile.blocks[0].sentences[0].words = [word];
    assert.throws(() => validateReadingAnalysis(profile, snapshot));
  }
  annotate(base, 0, 0, 'cache', 80);
  const overlap = structuredClone(base); overlap.blocks[0].sentences[0].words.push(overlap.blocks[0].sentences[0].words[0]);
  assert.throws(() => validateReadingAnalysis(overlap, snapshot));
  const missing = structuredClone(base); missing.blocks[0].sentences[0].importance = null;
  assert.throws(() => validateReadingAnalysis(missing, snapshot));
  assert.doesNotThrow(() => validateReadingAnalysis(missing, snapshot, false));
});

test('rendering preserves every source character and every protected subtree, rejects stale text', async () => {
  const { snapshot, snapshotHash } = await snapshotReadingSource(raw), profile = profileFor(snapshot, snapshotHash);
  annotate(profile, 0, 0, '模型', 95); annotate(profile, 0, 1, '模型', 15);
  const key = '__reading_test__'; READING_EMPHASIS[key] = profile;
  try {
    const options = readingMarkdownOptions(); let before, after, protectedBefore, protectedAfter;
    const protectedNode = n => n.type === 'element' && ['a', 'strong', 'code', 'math'].includes(n.tagName);
    const captureBefore = () => tree => { before = textOf(tree); protectedBefore = structuredClone(elements(tree, protectedNode)); };
    const captureAfter = () => tree => { after = tree; protectedAfter = elements(tree, protectedNode); };
    const renderer = await createMarkdownProcessor({ ...options,
      rehypePlugins: [...options.rehypePlugins, captureBefore, rehypeReadingEmphasis, captureAfter],
    });
    await renderer.render(preparePostMarkdown(raw), { frontmatter: { readingEmphasisKey: key } });
    assert.equal(textOf(after), before); assert.deepEqual(protectedAfter, protectedBefore);
    assert(elements(after, n => n.properties?.className?.includes('reading-word')).length > 0);
    await renderer.render(preparePostMarkdown(raw.replace('只是背景', '背景已经变化')), { frontmatter: { readingEmphasisKey: key } });
    assert.equal(elements(after, n => n.properties?.className?.includes('reading-word')).length, 0);
    await renderer.render(preparePostMarkdown(raw.replace('$x^2$', '$y^3$')), { frontmatter: { readingEmphasisKey: key } });
    assert.equal(elements(after, n => n.properties?.className?.includes('reading-word')).length, 0, 'protected formula changes invalidate old semantic context');
    READING_EMPHASIS[key] = { ...profile, blocks: [] }; assert.equal(getReadingEmphasis(key), null);
  } finally { delete READING_EMPHASIS[key]; }
});

test('notebook snapshot uses the same existing formula and metadata transforms', async () => {
  const note = '**日期** 10 月 24 日\r\n**内容** 测试\r\n\r\n公式 $x$ 保留。结论依赖条件。\r\n\r\n$$x^2\r\n+y^2$$\r\n';
  const { snapshot } = await snapshotReadingSource(note, true);
  assert(snapshot.some(b => b.text.includes('结论依赖条件')));
  assert(!snapshot.some(b => b.text.includes('y^2')));
  assert(prepareNoteMarkdown(note).startsWith('**日期** 10 月 24 日  \n**内容** 测试'));
});

test('the actual configured Astro processor accepts an offline snapshot without a site build', async () => {
  const { snapshot, snapshotHash } = await snapshotReadingSource(raw);
  const profile = profileFor(snapshot, snapshotHash); annotate(profile, 0, 0, '模型', 95);
  const key = '__configured_processor_test__'; READING_EMPHASIS[key] = profile;
  try {
    const renderer = await astroConfig.markdown.processor.createRenderer(astroConfig.markdown);
    const result = await renderer.render(preparePostMarkdown(raw), { frontmatter: { title: key } });
    assert(result.code.includes('class="reading-word"'));
  } finally { delete READING_EMPHASIS[key]; }
});
