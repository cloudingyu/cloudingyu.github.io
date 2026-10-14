import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { remarkMathRestore } from './remark-math-restore.mjs';
import { rehypeNotebookHeadings } from './rehype-notebook-headings.mjs';
import { rehypeCodeFrame } from './rehype-code-frame.mjs';
import { rehypeLazyImages } from './rehype-lazy-images.mjs';
import { rehypeReadingEmphasis } from './rehype-reading-emphasis.mjs';
import { NOTEBOOK_PATH, NOTEBOOK_SOURCE, NOTEBOOK_COURSES } from '../data/notebook-config.mjs';

export type NotebookCourse = typeof NOTEBOOK_COURSES[number];
export interface SemesterNote {
  courseId: string;
  date: string;
  content: string;
}
export interface CourseNotes extends NotebookCourse { notes: SemesterNote[] }

let catalog: Promise<CourseNotes[]> | undefined;
export function loadNotebook() {
  catalog ??= Promise.all(NOTEBOOK_COURSES.map(async (course) => {
    const folder = path.resolve(NOTEBOOK_SOURCE, course.id);
    const files = (await readdir(folder)).filter((file) => /^2026-\d{2}-\d{2}\.md$/.test(file));
    const notes = await Promise.all(files.map(async (file) => {
      const content = await readFile(path.join(folder, file), 'utf8');
      return {
        courseId: course.id,
        date: file.slice(0, -3),
        content,
      };
    }));
    notes.sort((a, b) => b.date.localeCompare(a.date));
    return { ...course, notes };
  }));
  return catalog;
}

export const courseUrl = (course: NotebookCourse) => `${NOTEBOOK_PATH}/${course.id}/`;
export const noteUrl = (note: SemesterNote) => `${NOTEBOOK_PATH}/${note.courseId}/${note.date}/`;
export const noteDate = (date: string) => `${Number(date.slice(5, 7))} 月 ${Number(date.slice(8, 10))} 日`;

let renderer: ReturnType<typeof createMarkdownProcessor> | undefined;
// Notes sometimes start a multiline display formula on the delimiter's line.
// Give those formulas explicit block fences at render time; leave source files intact.
function blockMath(content: string) {
  const lines = content.split(/\r?\n/);
  let fence = '';
  let plain = '';
  let output = '';
  const flush = () => {
    output += plain.replace(/^[ \t]*\$\$([^$]+?)\$\$[ \t]*$/gm, (_, tex: string) => `$$\n${tex.trim()}\n$$`);
    plain = '';
  };
  for (const line of lines) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (!fence && marker) { flush(); fence = marker; output += line + '\n'; continue; }
    if (fence) {
      output += line + '\n';
      if (marker && marker[0] === fence[0] && marker.length >= fence.length && /^ {0,3}(`+|~+)\s*$/.test(line)) fence = '';
    } else plain += line + '\n';
  }
  flush();
  return output;
}

export async function renderSemesterNote(note: SemesterNote) {
  renderer ??= createMarkdownProcessor({
    remarkPlugins: [remarkMath, remarkMathRestore],
    rehypePlugins: [[rehypeKatex, { strict: false, trust: false }], rehypeNotebookHeadings, rehypeCodeFrame, rehypeLazyImages, rehypeReadingEmphasis],
    syntaxHighlight: 'shiki',
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark-dimmed' },
      defaultColor: false,
      wrap: false,
    },
    smartypants: false,
  });
  // The metadata lines belong together, but Markdown's soft line break joins them.
  const content = note.content.replace(/^(\uFEFF?\*\*日期\*\*[^\r\n]*)\r?\n(?=[ \t]*\*\*内容\*\*)/, '$1  \n');
  const rendered = await (await renderer).render(blockMath(content), { frontmatter: { readingEmphasisKey: noteUrl(note) } });
  return {
    ...rendered,
    metadata: { ...rendered.metadata, headings: rendered.metadata.frontmatter.notebookHeadings ?? rendered.metadata.headings },
  };
}
