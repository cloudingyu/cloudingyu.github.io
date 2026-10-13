import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createWorkflow, validateMarkdown, validateReview, sourceUnits } from './workflow.mjs';

const note = '## 概率与事件\n\n概率满足 $0\\le P(A)\\le 1$。\n\n### 互补事件\n\n$P(A^c)=1-P(A)$。\n';
async function fixture(t, dates = ['2026.9.30']) {
  const root = await mkdtemp(path.join(tmpdir(), 'website-notes-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repoRoot = path.join(root, 'repo');
  const notesRoot = path.join(root, 'notes');
  const coursesRoot = path.join(root, 'courses');
  const course = { id: 'probability', name: '概统测试', folder: 'Math/概统测试' };
  await mkdir(path.join(notesRoot, course.folder), { recursive: true });
  for (const date of dates) {
    const day = date.slice(5);
    await mkdir(path.join(coursesRoot, course.name, day), { recursive: true });
    await writeFile(path.join(notesRoot, course.folder, `${course.name} ${date}.md`),
      '**日期**: 2026年9月30日\n\n## 定义 [00:01:00–00:05:00]\n\n概率值在零到一之间。\n\n### 互补事件\n\n互补概率为一减原概率。\n\n## 课程事务\n\n下周放假。\n', 'utf8');
    await writeFile(path.join(coursesRoot, course.name, day, `${course.name}_原文.srt`), '1\n00:01:00,000 --> 00:05:00,000\n互补事件的概率是1减P(A)\n', 'utf8');
  }
  const options = { repoRoot, notesRoot, coursesRoot, courses: [course], notebookSource: 'notebook/2026-autumn' };
  const workflow = createWorkflow(options);
  const catalog = await workflow.inventory();
  const entry = catalog.notes[0];
  const { work } = await workflow.prepare(entry.id);
  return { root, options, workflow, entry, work, notesRoot, coursesRoot, repoRoot, course };
}
async function ready(work) {
  const file = path.join(work, 'review.json');
  const review = JSON.parse(await readFile(file, 'utf8'));
  review.status = 'ready';
  review.author = 'fixture-author';
  for (const unit of review.source_units) {
    const excluded = unit.source_heading === '开头元信息' || unit.source_heading.includes('课程事务');
    unit.decision = excluded ? 'exclude' : 'include';
    unit.output_heading = excluded ? '' : unit.source_heading === '互补事件' ? '互补事件' : '概率与事件';
    unit.reason = excluded ? '模拟数据中的元信息或事务，不包含知识。' : '保留概率取值或互补事件的知识。';
  }
  for (const check of Object.keys(review.checks)) review.checks[check] = true;
  review.reading = { source_note: '模拟原笔记全文', transcript: '模拟字幕第1条', materials: '无材料' };
  review.reviewer = { name: 'fixture-reviewer', independent: true, claims: Array.from({ length: 5 }, (_, i) =>
    ({ claim: `模拟断言 ${i + 1}`, evidence: '模拟来源第1条与算式检验', verdict: 'pass' })) };
  await writeFile(file, JSON.stringify(review, null, 2) + '\n', 'utf8');
  await writeFile(path.join(work, 'note.md'), note, 'utf8');
  return review;
}

test('pending drafts cannot overwrite an existing website page', async (t) => {
  const f = await fixture(t);
  const target = path.join(f.repoRoot, 'notebook/2026-autumn/probability/2026-09-30.md');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, 'existing page');
  await assert.rejects(f.workflow.publish(f.entry.id), /ready/);
  assert.equal(await readFile(target, 'utf8'), 'existing page');
});

test('publication changes only the selected note and validates offline', async (t) => {
  const f = await fixture(t, ['2026.9.23', '2026.9.30']);
  await ready(f.work);
  const untouched = path.join(f.repoRoot, 'notebook/2026-autumn/probability/2026-09-30.md');
  await mkdir(path.dirname(untouched), { recursive: true });
  await writeFile(untouched, 'other page');
  const original = await readFile(path.join(f.notesRoot, f.entry.source.note.path), 'utf8');
  await f.workflow.publish(f.entry.id);
  assert.equal(await readFile(untouched, 'utf8'), 'other page');
  assert.equal(await readFile(path.join(f.notesRoot, f.entry.source.note.path), 'utf8'), original);
  const offline = createWorkflow({ repoRoot: f.repoRoot, courses: [f.course] });
  assert.deepEqual(await offline.check(), { published: 1, pending: 1, total: 2 });
  const publishedNote = path.join(f.repoRoot, 'notebook/2026-autumn/probability/2026-09-23.md');
  const publishedReview = path.join(f.repoRoot, 'course-notes/reviews/probability/2026-09-23.json');
  await writeFile(publishedNote, (await readFile(publishedNote, 'utf8')).replace(/\n/g, '\r\n'));
  await writeFile(publishedReview, (await readFile(publishedReview, 'utf8')).replace(/\n/g, '\r\n'));
  assert.deepEqual(await offline.check(), { published: 1, pending: 1, total: 2 });
  await writeFile(path.join(f.repoRoot, 'notebook/2026-autumn/probability/2026-09-23.md'), note + 'edited');
  await assert.rejects(offline.check(), /正文被直接修改/);
});

test('changed sources invalidate drafts and published versions without erasing old work', async (t) => {
  const f = await fixture(t);
  await ready(f.work);
  await f.workflow.publish(f.entry.id);
  const transcript = path.join(f.coursesRoot, f.entry.source.transcript.path);
  await writeFile(transcript, 'changed source');
  await assert.rejects(f.workflow.publish(f.entry.id), /来源已变更/);
  await f.workflow.inventory();
  assert.equal((await f.workflow.status())[0].state, '需要更新');
  await assert.rejects(f.workflow.check(), /整理版本已过期/);
  const next = await f.workflow.prepare(f.entry.id);
  assert.notEqual(next.work, f.work);
  assert.equal(await readFile(path.join(f.work, 'note.md'), 'utf8'), note);
});

test('removed sources retain published pages and become explicitly missing', async (t) => {
  const f = await fixture(t);
  await ready(f.work);
  const published = await f.workflow.publish(f.entry.id);
  await rm(path.join(f.notesRoot, f.entry.source.note.path));
  await f.workflow.inventory();
  assert.equal((await f.workflow.status()).find((entry) => entry.id === f.entry.id).state, '来源缺失');
  assert.equal(await readFile(published.note, 'utf8'), note);
  await assert.rejects(f.workflow.check(), /来源已删除/);
});

test('modified local input copies block publication', async (t) => {
  const f = await fixture(t);
  await ready(f.work);
  await writeFile(path.join(f.work, 'transcript.srt'), 'tampered local transcript');
  await assert.rejects(f.workflow.publish(f.entry.id), /原始转写副本已变更/);
});

test('review gates reject self-review, missing coverage, open issues and untracked additions', async (t) => {
  const f = await fixture(t);
  const review = await ready(f.work);
  const baseline = sourceUnits(await readFile(path.join(f.work, 'source.md'), 'utf8'));
  validateReview(review, f.entry, baseline, note);
  const selfReview = structuredClone(review);
  selfReview.reviewer.name = selfReview.author;
  assert.throws(() => validateReview(selfReview, f.entry, baseline, note), /实际复核者/);
  const missing = structuredClone(review);
  missing.source_units.pop();
  assert.throws(() => validateReview(missing, f.entry, baseline, note), /覆盖记录不能删除/);
  const unresolved = structuredClone(review);
  unresolved.issues.push({ description: 'missing parameter', status: 'open', reason: '' });
  assert.throws(() => validateReview(unresolved, f.entry, baseline, note), /未解决/);
  assert.throws(() => validateReview(review, f.entry, baseline, note + '\n**补充推导**：附加内容。'), /缺少核查记录/);
  const localPath = structuredClone(review);
  localPath.reading.source_note = 'C:/private/notes.md';
  assert.throws(() => validateReview(localPath, f.entry, baseline, note), /绝对路径/);
});

test('DOCX transcripts are supported and repeated prepare preserves drafts', async (t) => {
  const f = await fixture(t);
  await rm(path.join(f.coursesRoot, f.entry.source.transcript.path));
  const docx = path.join(f.coursesRoot, f.course.name, '9.30', `${f.course.name}_原文.docx`);
  await writeFile(docx, Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  const catalog = await f.workflow.inventory();
  assert.equal(path.extname(catalog.notes[0].source.transcript.path), '.docx');
  const draft = await f.workflow.prepare(f.entry.id);
  await writeFile(path.join(draft.work, 'note.md'), 'unfinished work');
  assert.equal((await f.workflow.prepare(f.entry.id)).existing, true);
  assert.equal(await readFile(path.join(draft.work, 'note.md'), 'utf8'), 'unfinished work');
  assert.deepEqual(await readFile(path.join(draft.work, 'transcript.docx')), await readFile(docx));
});

test('interrupted preparation restores inputs without replacing existing work', async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.work, 'note.md'), 'preserve my draft');
  await rm(path.join(f.work, 'task.md'));
  await rm(path.join(f.work, 'transcript.srt'));
  await f.workflow.prepare(f.entry.id);
  assert.equal(await readFile(path.join(f.work, 'note.md'), 'utf8'), 'preserve my draft');
  assert.equal(await readFile(path.join(f.work, 'transcript.srt'), 'utf8'), await readFile(path.join(f.coursesRoot, f.entry.source.transcript.path), 'utf8'));
});

test('invalid source dates fail inventory before changing the catalog', async (t) => {
  const f = await fixture(t);
  const catalog = path.join(f.repoRoot, 'course-notes/catalog.json');
  const original = await readFile(catalog, 'utf8');
  await writeFile(path.join(f.notesRoot, f.course.folder, '课程 2026.2.30.md'), 'invalid');
  await assert.rejects(f.workflow.inventory(), /无效日期/);
  assert.equal(await readFile(catalog, 'utf8'), original);
});

test('Markdown gate checks math and code while allowing literal dollars in code', async () => {
  await validateMarkdown(note + '\n`$variable`\n\n```sh\necho $variable\n```\n');
  await assert.rejects(validateMarkdown('## 知识\n\n$x+1'), /公式未闭合/);
  await assert.rejects(validateMarkdown('## 知识\n\n$$\nx+1\n'), /块公式/);
  await assert.rejects(validateMarkdown('## 知识\n\n$\\notarealcommand{x}$'), /KaTeX/);
  await assert.rejects(validateMarkdown('## 课程事务\n\n下次放假。'), /事务/);
  await assert.rejects(validateMarkdown('## 知识\n\n```js\ncode'), /围栏/);
});
