import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { readingMarkdownOptions, prepareNoteMarkdown } from './reading-markdown.mjs';
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

export async function renderSemesterNote(note: SemesterNote) {
  const options = readingMarkdownOptions(true);
  renderer ??= createMarkdownProcessor({ ...options,
    rehypePlugins: [...options.rehypePlugins, rehypeReadingEmphasis],
  });
  const rendered = await (await renderer).render(prepareNoteMarkdown(note.content), { frontmatter: { readingEmphasisKey: noteUrl(note) } });
  return {
    ...rendered,
    metadata: { ...rendered.metadata, headings: rendered.metadata.frontmatter.notebookHeadings ?? rendered.metadata.headings },
  };
}
