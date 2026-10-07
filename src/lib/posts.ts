import { getCollection, type CollectionEntry } from 'astro:content';
import { POSTS_PER_PAGE } from '../data/site';

export type Post = CollectionEntry<'posts'>;

/** slug = 文件名去掉日期前缀，与旧站 Jekyll slug 完全一致。 */
export function slugOf(post: Post): string {
  return post.id.replace(/\.(markdown|md)$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
}

/**
 * 旧站永久链接格式：/YYYY/MM/DD/<slug>/
 * 保留它，外部已有引用与 SEO 都不会失效（README 关键实施细节 #3）。
 */
export function permalink(post: Post): string {
  const d = post.data.date;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `/${yyyy}/${mm}/${dd}/${slugOf(post)}/`;
}

/**
 * 按日期倒序返回全部文章。
 * 注意：只有一句话的 `2025-04-11-red-black-tree` 是作者明说的「坑」，
 * 不能被当成空文章过滤掉（README 校验清单）。
 */
export async function allPosts(): Promise<Post[]> {
  const posts = await getCollection('posts');
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export interface TagCount {
  tag: string;
  count: number;
  /** 文章数 ≥ 2 的标签在原站被突出展示（特色标签阈值 1）。 */
  featured: boolean;
}

/** 标签统计，按文章数降序；同数量时按名称稳定排序，保证中英混排结果可复现。 */
export function tagCounts(posts: Post[]): TagCount[] {
  const counts = new Map<string, number>();
  for (const p of posts) {
    for (const t of p.data.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count, featured: count > 1 }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh-Hans-CN'));
}

/** 归档页按年份分组（含年份内文章数）。 */
export function groupByYear(posts: Post[]) {
  const years = new Map<number, Post[]>();
  for (const p of posts) {
    const y = p.data.date.getUTCFullYear();
    if (!years.has(y)) years.set(y, []);
    years.get(y)!.push(p);
  }
  return [...years.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, items]) => ({ year, posts: items }));
}

export interface Page<T> {
  items: T[];
  current: number;
  total: number;
  prev?: number;
  next?: number;
}

/** 分页：每页 6 篇。第 1 页为 /，第 2 页起为 /page/N/。 */
export function paginate<T>(items: T[], perPage = POSTS_PER_PAGE): Page<T>[] {
  const total = Math.max(1, Math.ceil(items.length / perPage));
  const pages: Page<T>[] = [];
  for (let i = 0; i < total; i++) {
    pages.push({
      items: items.slice(i * perPage, (i + 1) * perPage),
      current: i + 1,
      total,
      prev: i > 0 ? i : undefined,
      next: i < total - 1 ? i + 2 : undefined,
    });
  }
  return pages;
}

export function pageUrl(n: number): string {
  return n <= 1 ? '/' : `/page/${n}/`;
}

export interface Neighbors {
  prev?: Post;
  next?: Post;
}

/** 文章详情页的上/下一篇，按时间顺序（更早为「上一篇」）。 */
export function neighbors(posts: Post[], current: Post): Neighbors {
  const i = posts.findIndex((p) => p.id === current.id);
  return { prev: posts[i + 1], next: posts[i - 1] };
}

export function formatDate(d: Date, style: 'slash' | 'dash' | 'cjk' = 'slash'): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  if (style === 'dash') return `${y}-${m}-${day}`;
  if (style === 'cjk') return `${y} 年 ${Number(m)} 月 ${Number(day)} 日`;
  return `${y}/${m}/${day}`;
}

/** 纯文本摘要，用于搜索索引与列表页描述。 */
export function excerpt(body: string, len = 140): string {
  const flat = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]/g, ' ')
    .replace(/\$[^$]*\$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > len ? flat.slice(0, len) + '…' : flat;
}

/**
 * 内容里的图片路径存的是 `images/...`（无前导斜杠，来自旧站 front matter）。
 * 但页面可能挂在 /2025/04/11/xxx/ 这样的深层路由下，相对路径会解析错。
 * 统一补成根绝对路径 —— 这正是 README 关键实施细节 #1 要处理的问题，
 * 只是旧站靠 Jekyll 的 baseurl 兜底，这里由渲染层统一收口。
 * 配 GitHub Pages 的仓库根部署（base: '/'）能正确解析。
 */
export function assetUrl(path?: string, base = '/'): string {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return base.replace(/\/$/, '') + '/' + path.replace(/^\/+/, '');
}

/** 文章封面（只有 2025-01-26-vim-VScode 一篇有）。没有就返回空串。 */
export function coverUrl(post: Post, base = '/'): string {
  return assetUrl(post.data.cover, base);
}

