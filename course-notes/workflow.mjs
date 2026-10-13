#!/usr/bin/env node
import { readFile, writeFile, mkdir, readdir, stat, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import katex from 'katex';
import { visit } from 'unist-util-visit';
import { NOTEBOOK_COURSES, NOTEBOOK_SOURCE } from '../src/data/notebook-config.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));
const VERSION = 1;
const CHECKS = ['source_read', 'knowledge_coverage', 'proofs_and_examples', 'supplements_marked', 'issues_resolved'];
const slash = (value) => value.split(path.sep).join('/');
export const hash = (value) => createHash('sha256').update(value).digest('hex');
const textHash = (value) => hash(value.replace(/\r\n/g, '\n'));
const json = (value) => JSON.stringify(value, null, 2) + '\n';
const assert = (condition, message) => { if (!condition) throw new Error(message); };
function verifyMath(errors) {
  return function mathValidationPlugin() {
    return (tree) => visit(tree, (node) => node.type === 'math' || node.type === 'inlineMath', (node) => {
      // rehype-katex falls back to red text on errors; retain the strict failure.
      try { katex.renderToString(node.value, { throwOnError: true, strict: 'ignore', trust: false, displayMode: node.type === 'math' }); }
      catch (error) { errors.push(error); }
    });
  };
}
async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return fallback; throw error; }
}
async function save(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, value, 'utf8');
  await rename(temporary, file);
}
async function saveNew(file, value) {
  try { await writeFile(file, value, { encoding: 'utf8', flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
}
async function filesIn(folder) {
  let entries;
  try { entries = await readdir(folder, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const nested = await Promise.all(entries.map(async (entry) => {
    const file = path.join(folder, entry.name);
    return entry.isDirectory() ? filesIn(file) : entry.isFile() ? [file] : [];
  }));
  return nested.flat().sort();
}
function parseDate(name) {
  const match = /\b(2026)\.(\d{1,2})\.(\d{1,2})\.md$/i.exec(name);
  assert(match, `文件名应以 2026.月.日.md 结尾：${name}`);
  const date = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  assert(!Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date, `无效日期：${name}`);
  return date;
}
function plainLines(markdown) {
  let fence = '';
  return markdown.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length && /^ {0,3}(`+|~+)\s*$/.test(line)) fence = '';
      return '';
    }
    if (marker) { fence = marker; return ''; }
    return line;
  });
}
export function sourceUnits(markdown) {
  const lines = plainLines(markdown);
  const starts = [{ start: 0, heading: '开头元信息' }];
  lines.forEach((line, index) => {
    const match = /^(#{1,6})\s+(.+)$/.exec(line);
    if (match) starts.push({ start: index, heading: match[2] });
  });
  return starts.filter((section, index) => (starts[index + 1]?.start ?? lines.length) > section.start)
    .map((section, index, sections) => ({
      id: `S${String(index + 1).padStart(3, '0')}`,
      source_heading: section.heading,
      source_start_line: section.start + 1,
      source_end_line: sections[index + 1]?.start ?? lines.length,
      decision: 'pending', output_heading: '', reason: '',
    }));
}

export function createWorkflow({ repoRoot = repository, notesRoot, coursesRoot, courses = NOTEBOOK_COURSES, notebookSource = NOTEBOOK_SOURCE } = {}) {
  const project = path.join(repoRoot, 'course-notes');
  const catalogFile = path.join(project, 'catalog.json');
  const load = () => readJson(catalogFile, { version: VERSION, notes: [] });
  const outputFor = (entry) => path.join(repoRoot, notebookSource, entry.course_id, `${entry.date}.md`);
  const reviewFor = (entry) => path.join(project, 'reviews', entry.course_id, `${entry.date}.json`);
  const workFor = (entry) => path.join(project, '.work', entry.course_id, entry.date, entry.input_hash);
  function entryFor(catalog, id) {
    const entry = catalog.notes.find((note) => note.id === id);
    assert(entry && !entry.missing, `未找到有效课次：${id}。先运行 notes:inventory。`);
    return entry;
  }
  async function describe(file, root, video = false) {
    const info = await stat(file);
    return video
      ? { path: slash(path.relative(root, file)), bytes: info.size, modified_at: info.mtime.toISOString(), kind: 'recording' }
      : { path: slash(path.relative(root, file)), sha256: hash(await readFile(file)), bytes: info.size };
  }
  async function scan() {
    assert(notesRoot && coursesRoot, '先根据 config.example.json 创建 course-notes/local.config.json。');
    const notes = [];
    for (const course of courses) {
      const folder = path.join(notesRoot, course.folder);
      const sourceFiles = (await readdir(folder, { withFileTypes: true }))
        .filter((entry) => entry.isFile() && /\.md$/i.test(entry.name));
      const reports = await filesIn(path.join(coursesRoot, course.name, '笔记'));
      for (const file of sourceFiles) {
        const date = parseDate(file.name);
        const day = `${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))}`;
        const dateFolder = path.join(coursesRoot, course.name, day);
        const materials = await filesIn(dateFolder);
        const transcripts = materials.filter((p) => /_原文\.(srt|docx)$/i.test(p));
        transcripts.sort((a, b) => Number(!a.endsWith('.srt')) - Number(!b.endsWith('.srt')) || a.localeCompare(b));
        const transcript = transcripts[0];
        const dateText = `2026.${day}`;
        const reportFiles = [...new Set([...reports, ...materials])].filter((p) =>
          p.includes('复查报告') && path.basename(p).includes(dateText) && !/\d/.test(path.basename(p).split(dateText)[1]?.[0] ?? '') && /\.md$/i.test(p));
        const source = {
          note: await describe(path.join(folder, file.name), notesRoot),
          transcript: transcript ? await describe(transcript, coursesRoot) : null,
          reports: await Promise.all(reportFiles.map((p) => describe(p, coursesRoot))),
          materials: await Promise.all(materials.filter((p) => p !== transcript && !reportFiles.includes(p))
            .map((p) => describe(p, coursesRoot, /\.(mp4|mkv|mov|avi|webm)$/i.test(p)))),
        };
        const entry = { id: `${course.id}/${date}`, course_id: course.id, course_name: course.name, date, source, input_hash: hash(json({ workflow_version: VERSION, source })), publication: null };
        assert(!notes.some((note) => note.id === entry.id), `${course.name} 有重复日期：${date}`);
        notes.push(entry);
      }
    }
    return notes.sort((a, b) => a.id.localeCompare(b.id));
  }
  async function current(entry) {
    const scanned = (await scan()).find((note) => note.id === entry.id);
    assert(scanned && scanned.input_hash === entry.input_hash, `${entry.id} 的来源已变更。先运行 notes:inventory，再准备新草稿。`);
  }
  async function inventory() {
    const previous = await load();
    const scanned = await scan();
    assert(scanned.length || previous.notes.length, '来源目录没有四门课的 Markdown 笔记。');
    for (const entry of scanned) entry.publication = previous.notes.find((note) => note.id === entry.id)?.publication ?? null;
    for (const entry of previous.notes) if (!scanned.some((note) => note.id === entry.id)) scanned.push({ ...entry, missing: true });
    const catalog = { version: VERSION, notes: scanned };
    await save(catalogFile, json(catalog));
    return catalog;
  }
  async function prepare(id) {
    const entry = entryFor(await load(), id);
    await current(entry);
    assert(entry.source.transcript, `${id} 缺少原始 SRT/DOCX，请补齐材料后重新盘点。`);
    const work = workFor(entry);
    try { await stat(path.join(work, 'task.md')); return { work, existing: true }; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    await mkdir(work, { recursive: true });
    await mkdir(path.join(work, 'source-reports'), { recursive: true });
    const sourceText = await readFile(path.join(notesRoot, entry.source.note.path), 'utf8');
    await save(path.join(work, 'source.md'), sourceText);
    const extension = path.extname(entry.source.transcript.path);
    await writeFile(path.join(work, `transcript${extension}`), await readFile(path.join(coursesRoot, entry.source.transcript.path)));
    for (const [index, report] of entry.source.reports.entries()) {
      await save(path.join(work, 'source-reports', `${index + 1}.md`), await readFile(path.join(coursesRoot, report.path), 'utf8'));
    }
    await save(path.join(work, 'materials.json'), json(entry.source.materials.map((material) => ({ ...material, local_path: path.join(coursesRoot, material.path) }))));
    const review = {
      version: VERSION, note_id: entry.id, input_hash: entry.input_hash, status: 'draft', author: '',
      source_units: sourceUnits(sourceText), additions: [], issues: [],
      checks: Object.fromEntries(CHECKS.map((check) => [check, false])),
      reading: { source_note: '', transcript: '', materials: '' },
      reviewer: { name: '', independent: false, claims: [] },
    };
    await saveNew(path.join(work, 'review.json'), json(review));
    await saveNew(path.join(work, 'note.md'), await readFile(path.join(repository, 'course-notes/templates/note.md'), 'utf8'));
    const task = `# ${entry.course_name} ${entry.date} 网站笔记整理\n\n` +
      `课次：${entry.id}\n\n输入指纹：${entry.input_hash}\n\n` +
      `先读取 ${path.join(repository, 'course-notes/AGENTS.md')} 与 ${path.join(repository, 'course-notes/prompts/rewrite.md')}。\n\n` +
      `工作目录：${work}\n\n` +
      `读取 source.md、source-reports/、transcript${extension}、materials.json；原始材料只读。\n\n` +
      `在 note.md 写网站正文，在 review.json 填覆盖、补充、疑点和实际阅读范围。source_units 中预置的是来源章节范围，不代表已经识别全部知识点。\n\n` +
      `撰写后按 ${path.join(repository, 'course-notes/prompts/review.md')} 完成独立复核，再运行 npm run notes:validate -- --note ${entry.id}。\n\n` +
      `发布命令：npm run notes:publish -- --note ${entry.id}\n`;
    await save(path.join(work, 'task.md'), task);
    return { work, existing: false };
  }
  async function validate(id) {
    const entry = entryFor(await load(), id);
    await current(entry);
    const work = workFor(entry);
    const note = await readFile(path.join(work, 'note.md'), 'utf8');
    const review = await readJson(path.join(work, 'review.json'));
    const baseline = sourceUnits(await readFile(path.join(work, 'source.md'), 'utf8'));
    assert(hash(await readFile(path.join(work, 'source.md'))) === entry.source.note.sha256, '工作目录中的原笔记副本已变更，请恢复来源文件。');
    assert(hash(await readFile(path.join(work, `transcript${path.extname(entry.source.transcript.path)}`))) === entry.source.transcript.sha256, '工作目录中的原始转写副本已变更。');
    for (const [index, report] of entry.source.reports.entries()) {
      assert(hash(await readFile(path.join(work, 'source-reports', `${index + 1}.md`))) === report.sha256, '工作目录中的原复查报告副本已变更。');
    }
    validateReview(review, entry, baseline, note);
    await validateMarkdown(note);
    return { entry, note, review };
  }
  async function publish(id) {
    const { entry, note, review } = await validate(id);
    const catalog = await load();
    const savedNote = note.replace(/\r\n/g, '\n').trim() + '\n';
    // Persist only the defined audit fields; local materials paths and input copies stay in .work.
    const savedReview = json({
      version: VERSION, note_id: review.note_id, input_hash: review.input_hash, status: review.status, author: review.author,
      source_units: review.source_units.map(({ id, source_heading, source_start_line, source_end_line, decision, output_heading, reason }) =>
        ({ id, source_heading, source_start_line, source_end_line, decision, output_heading, reason })),
      additions: review.additions, issues: review.issues, checks: review.checks, reading: review.reading, reviewer: review.reviewer,
    });
    await save(outputFor(entry), savedNote);
    await save(reviewFor(entry), savedReview);
    entryFor(catalog, id).publication = {
      input_hash: entry.input_hash, note_hash: textHash(savedNote), review_hash: textHash(savedReview), workflow_version: VERSION,
    };
    await save(catalogFile, json(catalog));
    return { note: outputFor(entry), review: reviewFor(entry), catalog: catalogFile };
  }
  async function check() {
    const catalog = await load();
    assert(catalog.version === VERSION, '不支持的来源清单版本。');
    let published = 0;
    for (const entry of catalog.notes) {
      if (!entry.publication) continue;
      assert(!entry.missing, `${entry.id} 的来源已删除，请确认处理方式。`);
      assert(entry.input_hash === entry.publication.input_hash, `${entry.id} 的整理版本已过期。`);
      const note = await readFile(outputFor(entry), 'utf8');
      const reviewText = await readFile(reviewFor(entry), 'utf8');
      assert(textHash(note) === entry.publication.note_hash, `${entry.id} 正文被直接修改，请重新审核并发布。`);
      assert(textHash(reviewText) === entry.publication.review_hash, `${entry.id} 核查记录被直接修改，请重新审核并发布。`);
      const review = JSON.parse(reviewText);
      validateReview(review, entry, null, note);
      await validateMarkdown(note);
      published++;
    }
    return { published, pending: catalog.notes.filter((note) => !note.publication).length, total: catalog.notes.length };
  }
  async function status() {
    const catalog = await load();
    return catalog.notes.map((entry) => ({ id: entry.id, state: entry.missing ? '来源缺失' : !entry.source.transcript ? '缺原始转写' : !entry.publication ? '待整理' : entry.input_hash !== entry.publication.input_hash ? '需要更新' : '已发布' }));
  }
  return { inventory, prepare, validate, publish, check, status, workFor };
}

export function validateReview(review, entry, baseline, note) {
  assert(!/[A-Za-z]:[\\/]|\/(?:Users|home|CloudingYu)\//.test(JSON.stringify(review)), '公开核查记录不能包含本机绝对路径，使用源目录相对定位。');
  assert(review.version === VERSION && review.note_id === entry.id && review.input_hash === entry.input_hash, '核查记录与课次/来源版本不一致。');
  assert(review.status === 'ready', '核查记录 status 必须为 ready。');
  assert(typeof review.author === 'string' && review.author.trim(), '填写实际撰写者 author。');
  const headings = new Set(plainLines(note).flatMap((line) => /^#{2,3}\s+(.+)$/.exec(line)?.[1] ?? []));
  assert(Array.isArray(review.source_units) && review.source_units.length, '缺少来源章节覆盖记录。');
  assert(new Set(review.source_units.map((unit) => unit.id)).size === review.source_units.length, '来源章节 ID 重复。');
  if (baseline) {
    assert(baseline.length === review.source_units.length, '来源章节覆盖记录不能删除或增添；细化的知识点写入 reason。');
    for (const original of baseline) {
      const unit = review.source_units.find((item) => item.id === original.id);
      assert(unit && ['source_heading', 'source_start_line', 'source_end_line'].every((key) => unit[key] === original[key]), `来源章节 ${original.id} 的定位被修改。`);
    }
  }
  for (const unit of review.source_units) {
    assert(['include', 'merge', 'exclude'].includes(unit.decision), `${unit.id} 尚未决定如何处理。`);
    assert(typeof unit.reason === 'string' && unit.reason.trim(), `${unit.id} 需要写明保留的知识或排除理由。`);
    if (unit.decision !== 'exclude') assert(headings.has(unit.output_heading), `${unit.id} 指向不存在的正文标题。`);
    else assert(!unit.output_heading, `${unit.id} 排除项不应指向正文标题。`);
  }
  assert(CHECKS.every((check) => review.checks?.[check] === true), '知识完整性、例题/证明、补充标记和疑点检查尚未完成。');
  assert(['source_note', 'transcript', 'materials'].every((field) => typeof review.reading?.[field] === 'string' && review.reading[field].trim()), '记录实际阅读范围；未读取的材料也须如实说明。');
  assert(Array.isArray(review.additions) && Array.isArray(review.issues), 'additions 和 issues 必须为数组。');
  for (const addition of review.additions) {
    assert(['补充推导', '补充解答', '勘误'].includes(addition.type) && addition.verified === true && addition.reason?.trim(), '新增知识必须记录类型、依据和核实结果。');
    assert(headings.has(addition.output_heading) && note.includes(`**${addition.type}**`), '新增知识缺少对应标题或正文标记。');
  }
  for (const type of ['补充推导', '补充解答', '勘误']) {
    const count = note.split(`**${type}**`).length - 1;
    assert(count === review.additions.filter((item) => item.type === type).length, `正文 ${type} 与核查记录数量不一致或缺少核查记录。`);
  }
  for (const issue of review.issues) assert(['resolved', 'omitted'].includes(issue.status) && issue.reason?.trim(), '仍有未解决的疑点；解决或明确排除后才能发布。');
  const reviewer = review.reviewer;
  assert(reviewer?.independent === true && reviewer.name?.trim() && reviewer.name !== review.author, '需要不同于撰写者的实际复核者。');
  assert(Array.isArray(reviewer.claims) && reviewer.claims.length >= 5, '独立复核至少记录 5 个断言。');
  for (const claim of reviewer.claims) assert(claim.claim?.trim() && claim.evidence?.trim() && claim.verdict === 'pass', '复核断言需要具体依据，且全部通过。');
}

export async function validateMarkdown(note) {
  assert(note.trim(), '笔记正文为空。');
  const lines = plainLines(note);
  assert(lines.some((line) => /^##\s+\S/.test(line)), '正文至少包含一个二级知识标题。');
  assert(!lines.some((line) => /^(#|#{4,6})\s/.test(line)), '正文只使用二级和三级标题。');
  const plain = lines.join('\n');
  assert(!/TODO|待填写|PLACEHOLDER/.test(plain), '正文仍有模板占位内容。');
  assert(!/^#{2,3}\s+.*(?:课程事务|作业安排|课程预告|课前准备|课间休息|资料核对)/m.test(plain), '网站正文残留课堂事务或转写章节。');
  assert(!/\*\*(?:日期|内容|原文待核实|老师强调|老师提示|老师比喻|老师总结|老师启发|课堂问答|资料核对|补充说明)\*\*/.test(plain), '网站正文残留还原版标签，请改写成知识陈述。');
  assert(!/\b\d{2}:\d{2}:\d{2}\b/.test(plain), '来源时间戳应放在核查记录中。');
  assert(!/!\[|<img\b|!\[\[|<script\b/i.test(plain), '正文使用文字、表格和公式，不插入图片或脚本。');
  let fence = '';
  for (const line of note.split(/\r?\n/)) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (!fence && marker) fence = marker;
    else if (fence && marker && marker[0] === fence[0] && marker.length >= fence.length && /^ {0,3}(`+|~+)\s*$/.test(line)) fence = '';
  }
  assert(!fence, '代码围栏未闭合。');
  let mathOpen = false;
  for (const line of lines) {
    const withoutCode = line.replace(/(`+).*?\1/g, '');
    assert((withoutCode.match(/(?<!\\)\$/g)?.length ?? 0) % 2 === 0, '行内公式未闭合；跨行公式使用独占一行的 $$。');
    if (/^\s*\$\$\s*$/.test(line)) mathOpen = !mathOpen;
  }
  assert(!mathOpen, '块公式 $$ 未闭合。');
  const mathErrors = [];
  const processor = await createMarkdownProcessor({
    remarkPlugins: [remarkMath, verifyMath(mathErrors)], rehypePlugins: [[rehypeKatex, { strict: false, trust: false }]], syntaxHighlight: false,
  });
  const rendered = await processor.render(note);
  if (mathErrors.length) throw mathErrors[0];
  assert(!/class=["'][^"']*\bkatex-error\b/.test(rendered.code), 'KaTeX 无法渲染公式，请检查命令、括号和符号。');
}

export async function runCli(args = process.argv.slice(2)) {
  const [command, ...options] = args;
  assert(['inventory', 'status', 'prepare', 'validate', 'publish', 'check'].includes(command), '命令：inventory | status | prepare | validate | publish | check');
  let id;
  for (let index = 0; index < options.length; index++) {
    assert(options[index] === '--note' && options[index + 1] && !id, '仅接受 --note <课程ID/YYYY-MM-DD>。原笔记根目录应配置在 local.config.json。');
    id = options[++index];
  }
  if (['prepare', 'validate', 'publish'].includes(command)) assert(id, '请指定 --note <课程ID/YYYY-MM-DD>。');
  else assert(!id, `${command} 不接受 --note。`);
  const config = await readJson(path.join(repository, 'course-notes/local.config.json'), {});
  const workflow = createWorkflow({ notesRoot: config.notes_root, coursesRoot: config.courses_root });
  const result = await workflow[command](id);
  if (command === 'status') result.forEach((entry) => console.log(`${entry.id}  ${entry.state}`));
  else if (command === 'inventory') console.log(`已盘点 ${result.notes.length} 个课次；运行 npm run notes:status 查看待办。`);
  else if (command === 'prepare') console.log(`${result.existing ? '继续已有草稿' : '已建立草稿'}：${result.work}`);
  else if (command === 'validate') console.log(`${id}：草稿机检通过。机检不代替内容复核。`);
  else if (command === 'publish') console.log(`已更新网站正文：${result.note}\n核查记录：${result.review}\n来源清单：${result.catalog}\n请运行 check、build、verify 后，将这三项提交到当前仓库。`);
  else console.log(`网站笔记检查通过：${result.published} 篇整理成果，${result.pending} 篇待整理，共 ${result.total} 篇。`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
