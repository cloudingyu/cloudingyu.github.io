// Adapted from InfoHighlight signals.mjs / appearance.mjs (Apache-2.0).
// See docs/reading-emphasis.md and licenses/InfoHighlight-NOTICE.md.
// Inputs here are Luna's semantic annotations, NEVER causal token probabilities.
export const READING_POLICY = Object.freeze({ minimumImportance: 75, sentenceBudget: .5,
  importantFloor: .36, brightLevel: 14, brightMultiplier: 2, maxImportantBrightFraction: .85,
  minimumAlpha: .30, levels: 16 });
const clamp = n => Math.max(0, Math.min(1, n));
const smooth = n => { const t = clamp(n); return t * t * (3 - 2 * t); };
export function scoreCurve(score) {
  const x = clamp(score) / .8;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const axis = (t, a, b) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3;
  let low = 0, high = 1;
  for (let i = 0; i < 30; i++) {
    const t = (low + high) / 2;
    if (axis(t, .25, .5) < x) low = t; else high = t;
  }
  return axis((low + high) / 2, 0, 1);
}
export const displayLevel = score => Math.round(scoreCurve(score) * 15);
export const displayAlpha = score => READING_POLICY.minimumAlpha + (1 - READING_POLICY.minimumAlpha) * displayLevel(score) / 15;
let bright = 0;
{
  let low = 0, high = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    if (scoreCurve(mid) < (READING_POLICY.brightLevel - .5) / 15) low = mid; else high = mid;
  }
  bright = high + 1e-8;
}

/** Same paragraph normalization and conservative tie policy as the reference. */
export function scoreReadingAnalysis(blocks) {
  const sentences = blocks.flatMap(block => {
    const raw = block.sentences.map(s => s.importance / 100);
    const min = Math.min(...raw), spread = Math.max(...raw) - min;
    return block.sentences.map((sentence, index) => ({ ...sentence, blockId: block.id,
      raw: raw[index], normalized: raw.length >= 2 && spread >= .05 - 1e-12 ? (raw[index] - min) / spread : .5,
    }));
  });
  const ranked = [...sentences].sort((a, b) => b.normalized - a.normalized);
  const limit = Math.max(1, Math.floor(sentences.length * READING_POLICY.sentenceBudget));
  const boundary = ranked[Math.min(limit, ranked.length) - 1]?.normalized;
  const tied = ranked.length > limit && ranked[limit].normalized === boundary;
  const important = new Set(ranked.filter(s => s.importance >= READING_POLICY.minimumImportance && s.normalized >= .75
    && (s.normalized > boundary || s.normalized === boundary && !tied)).slice(0, limit));
  const words = sentences.flatMap(s => s.words.map(w => ({ score: w.information / 100, important: important.has(s) })));
  const pool = words.filter(w => w.important);
  const baseline = words.filter(w => w.score >= bright).length;
  const inside = pool.filter(w => w.score >= bright).length;
  const target = Math.min(inside + baseline * (READING_POLICY.brightMultiplier - 1),
    Math.max(inside, Math.floor(pool.length * READING_POLICY.maxImportantBrightFraction)));
  const sorted = pool.map(w => w.score).sort((a, b) => b - a);
  let cutoff = 1;
  if (target > 0) cutoff = target >= sorted.length ? 0 : sorted[target - 1] === sorted[target]
    ? Math.min(bright, sorted[target] + 1e-8) : Math.min(bright, (sorted[target - 1] + sorted[target]) / 2);
  const fuse = (score, isImportant) => {
    if (!isImportant) return score;
    const floor = READING_POLICY.importantFloor;
    if (score === 0) return floor;
    const mapped = score < cutoff ? floor + (bright - floor) * smooth(score / cutoff)
      : bright + (1 - bright) * smooth((score - cutoff) / Math.max(1e-9, 1 - cutoff));
    return Math.max(score, mapped);
  };
  return sentences.map(sentence => {
    const isImportant = important.has(sentence), spans = [];
    let cursor = sentence.start;
    const add = (start, end, information) => {
      if (end <= start) return;
      const finalScore = fuse(information / 100, isImportant);
      spans.push({ start, end, finalScore, level: displayLevel(finalScore), alpha: displayAlpha(finalScore) });
    };
    for (const word of sentence.words) {
      add(cursor, word.start, 0); add(word.start, word.end, word.information); cursor = word.end;
    }
    add(cursor, sentence.end, 0);
    return { blockId: sentence.blockId, important: isImportant, spans };
  });
}
