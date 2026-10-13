#!/usr/bin/env node
/** Explicit local import. Normal builds use the committed snapshot, including on Pages. */
import { readdir, readFile, mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NOTEBOOK_COURSES, NOTEBOOK_SOURCE } from '../src/data/notebook-config.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const suppliedSource = process.argv[2] || process.env.CY_NOTES_SOURCE;
if (!suppliedSource) {
  console.error('用法：npm run notes:sync -- "笔记的 Markdown 根目录"');
  process.exit(1);
}
const source = path.resolve(suppliedSource);
const output = path.resolve(root, NOTEBOOK_SOURCE);
if (source === output || source.startsWith(output + path.sep) || output.startsWith(source + path.sep)) {
  throw new Error('笔记原件和网站快照目录不能相互包含。');
}

// Read all four courses before changing the snapshot, so a missing folder fails early.
const snapshot = await Promise.all(NOTEBOOK_COURSES.map(async (course) => {
  const folder = path.join(source, course.folder);
  const files = (await readdir(folder, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /\.md$/i.test(entry.name));
  if (!files.length) throw new Error(`${course.name}：未找到 Markdown 笔记。`);
  const notes = await Promise.all(files.map(async (file) => {
    const date = /\b(2026)\.(\d{1,2})\.(\d{1,2})\.md$/i.exec(file.name);
    if (!date) throw new Error(`${file.name}：文件名应以 2026.月.日.md 结尾。`);
    const iso = `${date[1]}-${date[2].padStart(2, '0')}-${date[3].padStart(2, '0')}`;
    if (new Date(iso).toISOString().slice(0, 10) !== iso) throw new Error(`无效日期：${file.name}`);
    return { name: `${iso}.md`, text: await readFile(path.join(folder, file.name), 'utf8') };
  }));
  if (new Set(notes.map((note) => note.name)).size !== notes.length) throw new Error(`${course.name}：有重复日期。`);
  return { course, notes };
}));

for (const { course, notes } of snapshot) {
  const folder = path.join(output, course.id);
  await mkdir(folder, { recursive: true });
  for (const note of notes) await writeFile(path.join(folder, note.name), note.text, 'utf8');
  const wanted = new Set(notes.map((note) => note.name));
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (entry.isFile() && /^2026-\d{2}-\d{2}\.md$/.test(entry.name) && !wanted.has(entry.name)) {
      await unlink(path.join(folder, entry.name));
    }
  }
  console.log(`${course.name}：同步 ${notes.length} 篇`);
}
console.log('原笔记未修改。快照将在下一次构建时发布到隐藏笔记区。');
