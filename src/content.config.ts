import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Posts come straight from the Jekyll export (README: 内容层一字不改).
 * Only `layout` / `header-style` / `mathjax` were dropped in conversion —
 * all are presentation-layer flags per README「关键实施细节」#2.
 *
 * Note: `author` deliberately has no enum/default normalization — post 15 is
 * signed lowercase `cloudingyu` and the rest `CloudingYu`. That difference is
 * original data and must survive to the rendered page (README #2, SITE_DATA).
 *
 * Extension note: the source files were `.markdown`. Astro's default Markdown
 * content entry type registers `.md` only (`.markdown` is a *page* extension,
 * not a collection entry type), so the glob loader found all 15 files and
 * silently dropped every one. Files were renamed to `.md` — the container
 * changed, not the content. Slug and permalink come from the filename minus
 * its date prefix, so `/YYYY/MM/DD/<slug>/` is unaffected.
 *
 * `generateId` note: the glob loader's default id comes from
 * `getContentEntryIdAndSlug`, which **lowercases** the slug. Nine of the 15
 * filenames carry meaningful case (`luogu-P1007`, `vim-VScode`, `UML`,
 * `MLInit`, …) and the live site serves those URLs case-sensitively — verified
 * against https://cloudingyu.github.io/2025/04/06/Visitor/ (200 OK, canonical
 * link spells `Visitor`). Letting the default stand would rewrite every one of
 * those permalinks to lowercase and 404 the external links and search index.
 * So generateId is overridden to hand back the filename minus its extension,
 * byte for byte as on disk — no lowercasing, no slugifying, no percent-encoding.
 */
const posts = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/posts',
    // `entry` is the path relative to `base`, e.g. "2025-04-07-UML.md".
    generateId: ({ entry }) => entry.replace(/\.(md|markdown)$/, ''),
  }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string().default(''),
    date: z.coerce.date(),
    author: z.string(),
    cover: z.string().optional(),
    coverAlt: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { posts };
