/** Position-based, offline sentence/word annotations. Offsets are UTF-16. */
import { createHash } from 'node:crypto';
const PROSE = new Set(['p', 'li', 'td', 'dd', 'figcaption']);
const EXCLUDED = new Set(['pre', 'code', 'kbd', 'samp', 'script', 'style', 'svg', 'math', 'annotation',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'a', 'button',
  'img', 'picture', 'video', 'audio', 'br', 'hr', 'input']);
export const ANALYSIS_METHOD = 'luna-sentence-word-v1';
export const classesOf = node => {
  const value = node.properties?.className ?? node.properties?.class ?? [];
  return Array.isArray(value) ? value : String(value).split(/\s+/);
};
export const excluded = node => node.type === 'element' && (EXCLUDED.has(node.tagName)
  || classesOf(node).some(name => name.startsWith('katex') || name.startsWith('reading-')));

export function segmentReadingSentences(text) {
  const result = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const period = text[i] === '.' && (i + 1 === text.length || /\s/u.test(text[i + 1]));
    if (!/[。！？!?；;\n]/u.test(text[i]) && !period) continue;
    let end = i + 1;
    while (end < text.length && /[\s。！？!?；;”’"']/u.test(text[end])) end++;
    result.push({ start, end, text: text.slice(start, end) });
    start = end; i = end - 1;
  }
  if (start < text.length) result.push({ start, end: text.length, text: text.slice(start) });
  return result;
}

/** Protected inline content is one object-replacement character, never joined away. */
export function collectReadingBlocks(tree) {
  const blocks = [];
  const barrier = block => { if (block) block.text += '\uFFFC'; };
  function walk(node, current) {
    if (node.type === 'raw') { barrier(current); return; }
    if (excluded(node)) { barrier(current); return; }
    if (node.type === 'element' && PROSE.has(node.tagName)) {
      barrier(current);
      current = { text: '', pieces: [] };
      blocks.push(current);
    }
    if (node.type === 'text' && current) {
      const start = current.text.length;
      current.text += node.value;
      if (node.value.length) current.pieces.push({ node, start, end: current.text.length });
    }
    for (const child of node.children ?? []) walk(child, current);
  }
  walk(tree, null);
  return blocks.filter(b => b.pieces.some(p => p.node.value.trim())).map((b, index) => ({
    ...b, id: `b${index + 1}`, ranges: b.pieces.map(({ start, end }) => ({ start, end })),
  }));
}

export function readingSnapshot(blocks) {
  return blocks.map(({ id, text, ranges }) => ({ id, text, ranges,
    sentences: segmentReadingSentences(text),
  }));
}

/** Ignore source-location metadata, retain rendered text and protected objects. */
export function hashReadingSnapshot(snapshot, tree) {
  const shape = node => ({ type: node.type, tagName: node.tagName, value: node.value,
    properties: node.properties, children: node.children?.map(shape) });
  return createHash('sha256').update(JSON.stringify({ snapshot, document: shape(tree) })).digest('hex');
}

const fail = message => { throw new Error(message); };
const score = value => Number.isInteger(value) && value >= 0 && value <= 100;
const graphemes = new Intl.Segmenter('zh-CN', { granularity: 'grapheme' });

/** Validate ALL blocks before painting anything, including unannotated prose. */
export function validateReadingAnalysis(profile, snapshot, graded = true) {
  if (profile.method !== ANALYSIS_METHOD || profile.offsetEncoding !== 'utf16') fail('无效的句词分级方法或偏移编码');
  if (!Array.isArray(profile.blocks) || profile.blocks.length !== snapshot.length) fail('正文块数量与快照不符');
  let words = 0;
  for (let index = 0; index < snapshot.length; index++) {
    const expected = snapshot[index], block = profile.blocks[index];
    if (!block || block.id !== expected.id || block.text !== expected.text
      || JSON.stringify(block.ranges) !== JSON.stringify(expected.ranges)) fail(`正文块已变化：${expected.id}`);
    if (!Array.isArray(block.sentences) || block.sentences.length !== expected.sentences.length) fail(`句子数量不符：${block.id}`);
    const boundaries = new Set([block.text.length, ...Array.from(graphemes.segment(block.text), p => p.index)]);
    for (let si = 0; si < expected.sentences.length; si++) {
      const sentence = block.sentences[si], actual = expected.sentences[si];
      if (!sentence || sentence.start !== actual.start || sentence.end !== actual.end || sentence.text !== actual.text) fail(`句子范围或文本不符：${block.id}:${si}`);
      if (!(score(sentence.importance) || !graded && sentence.importance === null)) fail('句子重要度必须为 0–100 整数；draft 可为 null');
      if (!Array.isArray(sentence.words)) fail('words 必须为数组');
      let through = sentence.start;
      for (const word of sentence.words) {
        if (!word || !Number.isInteger(word.start) || !Number.isInteger(word.end)
          || word.start < through || word.end <= word.start || word.end > sentence.end
          || typeof word.text !== 'string' || !word.text.trim() || word.text !== word.text.trim()
          || /[\r\n\uFFFC]/u.test(word.text) || block.text.slice(word.start, word.end) !== word.text
          || !boundaries.has(word.start) || !boundaries.has(word.end)) fail('词组范围、顺序、字素边界或文本无效');
        // Adjacent text nodes may be joined, but protected content is always a gap.
        let covered = word.start;
        for (const range of block.ranges) {
          if (range.end <= covered) continue;
          if (range.start > covered) break;
          covered = Math.max(covered, range.end);
        }
        if (covered < word.end) fail('词组跨越了受保护内容');
        if (/[\p{L}\p{N}_]/u.test(word.text[0]) && /[A-Za-z0-9_]/u.test(word.text[0])
          && /[A-Za-z0-9_]/u.test(block.text[word.start - 1] ?? '')) fail('英文词组从单词内部开始');
        if (/[A-Za-z0-9_]/u.test(word.text.at(-1)) && /[A-Za-z0-9_]/u.test(block.text[word.end] ?? '')) fail('英文词组在单词内部结束');
        if (!score(word.information)) fail('词组信息作用必须为 0–100 整数');
        if (word.information > 0) words++;
        through = word.end;
      }
    }
  }
  if (graded && !words) fail('graded 结果必须包含有效词组评分');
  return { blocks: snapshot.length, sentences: snapshot.reduce((n, b) => n + b.sentences.length, 0), words };
}
