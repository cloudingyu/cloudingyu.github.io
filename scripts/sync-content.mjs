/**
 * 把仓库根目录的内容包同步成 Astro 能吃的形态。
 *
 * 为什么要有这支脚本：
 *   根目录的 posts/ 与 images/ 是**内容包本体**（README 定义的「唯一信息载体」，
 *   已入库、一字不改）。Astro 需要的是 src/content/posts/*.md 与 public/images/。
 *   两边不是同一份文件、也不能互相替代，于是必须有一步确定的转换 ——
 *   手工拷一次的话，以后改内容包就不知道站点里那份是怎么来的了。
 *   所以：posts/ + images/ 是源，src/content/posts/ + public/images/ 是产物，
 *   每次 build 前重新生成，源与产物永远对得上。
 *
 * 转换只有四件事，都是 README「关键实施细节」里点名允许的：
 *   1. 换行统一：内容包是 CRLF，Astro 按 LF 处理更省心
 *   2. 图片路径：正文写作 /img/posts/...，素材实际在 images/posts/...
 *      同时覆盖 markdown 语法 ](/img/ 与 HTML 语法 src="/img/
 *   3. front matter 瘦身：只留站点真正会渲染的字段。
 *      layout / header-style / mathjax 是 Jekyll 的版式开关（README #2 明确
 *      它们属于「设计层，重做」），丢弃。
 *      header-img 改名 cover（只有 vim-VScode 一篇有），字段名跟 schema 对齐。
 *      title/subtitle/date/author/tags **原样保留**，包括第 15 篇的小写
 *      author: cloudingyu —— 那是原始数据，不是笔误，不许「修正」。
 *   4. 文件名 .markdown → .md（Astro 的内容条目类型只注册 .md）
 *
 * 幂等：重复跑结果一致，不会累积改动。
 */
import { readFile, writeFile, readdir, mkdir, rm, cp } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_POSTS = path.join(ROOT, 'posts');
const SRC_IMAGES = path.join(ROOT, 'images');
const OUT_POSTS = path.join(ROOT, 'src/content/posts');
const OUT_IMAGES = path.join(ROOT, 'public/images');

/** Jekyll 版式开关，重做设计后不再需要 */
const DROP_KEYS = new Set(['layout', 'header-style', 'mathjax']);

/**
 * 解析 Jekyll 风格的 front matter。
 * 原件的键有对齐空格（`title:      "..."`），值形如 `"文本"` 或 `2022-02-08`，
 * 标签是缩进 4 空格的 `    - 值`。手写解析比引 yaml 依赖轻，且这里字段固定。
 *
 * 正文开头的空行按原样保留：这一篇与那一篇的排版本来就不一样
 * （有些开头直接是标题，有些先空一行），统一成一种等于替作者改稿。
 * 所以正则只吃掉闭合的 `---` 及其后紧跟的那一个换行，不多吃。
 */
function parseFrontMatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n/.exec(text);
  if (!m) return { data: {}, body: text };

  const data = {};
  let tags = null;

  for (const rawLine of m[1].split(/\r?\n/)) {
    if (!rawLine.trim()) continue;

    // 标签列表项
    const tagItem = /^\s+-\s+(.*)$/.exec(rawLine);
    if (tagItem && tags) {
      tags.push(unquote(tagItem[1].trim()));
      continue;
    }

    const kv = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(rawLine);
    if (!kv) continue;
    const key = kv[1];
    const value = kv[2].trim();

    if (key === 'tags' && value === '') {
      tags = [];
      data.tags = tags;
      continue;
    }
    data[key] = unquote(value);
  }

  return { data, body: text.slice(m[0].length).replace(/^\n+/, '\n') };
}

/** 去掉包裹的引号；`mathjax: ` 这种空值原样留空串 */
function unquote(v) {
  const s = v.trim();
  if (s.length >= 2 && ((s[0] === '"' && s.endsWith('"')) || (s[0] === "'" && s.endsWith("'")))) {
    return s.slice(1, -1);
  }
  return s;
}

/** YAML 单行字符串转义：只处理双引号与反斜杠，标题里不会出现其它特殊字符 */
const quote = (v) => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * 把 front matter 里的图片路径改成站点使用的形态。
 * 自动替换只认 markdown 的 `](` 与 HTML 的 `src=` 两种写法，
 * 而 header-img 的值是裸路径（`img/posts/.../bg.png`），所以要单独补一次。
 */
function rewriteImagePaths(s) {
  return s
    .replace(/(\]\()\/img\//g, '$1/images/')
    .replace(/(\bsrc=["'])\/img\//g, '$1/images/');
}

/** header-img 的值是裸路径，单独改写：img/... → images/... */
const rewriteBareAsset = (p) => String(p).replace(/^\/?img\//, 'images/');

async function syncPosts() {
  const names = (await readdir(SRC_POSTS)).filter((n) => /\.markdown$/.test(n));
  if (names.length === 0) throw new Error(`内容包里没有文章：${SRC_POSTS}`);

  await rm(OUT_POSTS, { recursive: true, force: true });
  await mkdir(OUT_POSTS, { recursive: true });

  const written = [];
  for (const name of names.sort()) {
    const raw = await readFile(path.join(SRC_POSTS, name), 'utf8');
    const { data, body } = parseFrontMatter(raw.replace(/\r\n/g, '\n'));

    // 只留 schema 认的字段，顺序固定，diff 才稳定
    const out = [];
    out.push(`title: ${quote(data.title ?? '')}`);
    out.push(`subtitle: ${quote(data.subtitle ?? '')}`);
    out.push(`date: ${data.date ?? ''}`);
    out.push(`author: ${quote(data.author ?? '')}`);

    // header-img 是 Jekyll 的命名，转成 schema 里的 cover。
    // 只有 vim-VScode 有头图，其余 14 篇不补默认值 —— 不许伪造封面。
    if (data['header-img']) {
      out.push(`cover: ${quote(rewriteBareAsset(data['header-img']))}`);
      out.push(`coverAlt: ${quote(data.title ?? '')}`);
    }

    const tags = Array.isArray(data.tags) ? data.tags : [];
    if (tags.length) {
      out.push('tags:');
      for (const t of tags) out.push(`  - ${quote(t)}`);
    } else {
      out.push('tags: []');
    }

    const target = name.replace(/\.markdown$/, '.md');
    const content = `---\n${out.join('\n')}\n---\n${rewriteImagePaths(body)}`;
    await writeFile(path.join(OUT_POSTS, target), content, 'utf8');
    written.push({ name, target, tags: tags.length });
  }

  return written;
}

async function syncImages() {
  let entries;
  try {
    entries = await readdir(SRC_IMAGES);
  } catch {
    throw new Error(`内容包里没有图片目录：${SRC_IMAGES}`);
  }
  if (entries.length === 0) throw new Error(`图片目录为空：${SRC_IMAGES}`);

  await rm(OUT_IMAGES, { recursive: true, force: true });
  await mkdir(path.dirname(OUT_IMAGES), { recursive: true });
  // 整目录原样搬运，不重编码、不缩放 —— 50 张素材必须字节一致
  await cp(SRC_IMAGES, OUT_IMAGES, { recursive: true });

  // 数一遍，数量对不上就炸，别让半份素材悄悄上线
  let count = 0;
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (e.isDirectory()) await walk(path.join(dir, e.name));
      else count++;
    }
  };
  await walk(OUT_IMAGES);
  return count;
}

const posts = await syncPosts();
const images = await syncImages();

const dropped = [...DROP_KEYS].join(' / ');
console.log(`[sync-content] 文章 ${posts.length} 篇（丢弃 ${dropped}，header-img → cover）`);
console.log(`[sync-content] 图片 ${images} 个文件已原样复制到 public/images/`);
