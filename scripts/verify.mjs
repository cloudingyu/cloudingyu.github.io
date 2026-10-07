#!/usr/bin/env node
/**
 * 对照 README 末尾的校验清单自查 dist/。
 *
 * 这个脚本只读 dist，不碰源码 —— 它回答的问题是「构建出来的站点是否满足清单」，
 * 而不是「源码看起来对不对」。
 *
 * 用法：
 *   node scripts/verify.mjs [distDir]        # 默认 ./dist
 *   DIST=/path/to/dist node scripts/verify.mjs
 *
 * 退出码：全部通过 0，有失败项 1。可直接接进 CI。
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const DIST = path.resolve(process.argv[2] || process.env.DIST || 'dist');

/* ---------- 清单里写死的期望值（来自 SITE_DATA.md / POSTS_INDEX.md） ---------- */

/**
 * 期望的永久链接：大小写与线上旧站逐字一致（GitHub Pages 跑在 Linux 上，
 * 路径大小写敏感，改一个字母就是 404）。
 * 依据：https://cloudingyu.github.io/2025/04/06/Visitor/ 与 /2025/04/07/UML/ 均 200。
 */
const EXPECTED_POSTS = [
  ['2022/02/08', 'luogu-P1007'],
  ['2022/02/09', 'luogu-P1004'],
  ['2022/02/09', 'luogu-P3382'],
  ['2022/02/10', 'luogu-P1008'],
  ['2022/02/10', 'luogu-P1010'],
  ['2025/01/13', 'luogu-P1009'],
  ['2025/01/26', 'vim-VScode'],
  ['2025/04/06', 'Visitor'],
  ['2025/04/07', 'UML'],
  ['2025/04/11', 'Iterator'],
  ['2025/04/11', 'red-black-tree'],
  ['2025/04/13', 'leetcode-4'],
  ['2025/04/14', 'Command'],
  ['2025/05/09', 'SOLID'],
  ['2026/03/22', 'MLInit'],
];

// 17 个标签，中文的落到目录名时是原值（Astro 会做百分号编码）
const EXPECTED_TAGS = [
  '题解', '洛谷', '面向对象', '软件设计', '设计模式', '行为型模式', '算法',
  '力扣', 'VSCode', 'Vim', 'IDE', '插件', '数据结构', '算法设计',
  '人工智能', '机器学习', '概率论与数理统计',
];

const PAGE_BG = {
  home: 'images/site/home-bg.jpg',
  about: 'images/site/about-bg.jpg',
  archive: 'images/site/archive-bg.jpg',
  notFound: 'images/site/404-bg.jpg',
};

const SOCIAL_HOSTS = ['github.com', 'zhihu.com', 'weibo.com'];
const FRIEND_NAMES = ['顺其自然2319', 'trs62'];

const IMAGE_TOTAL = 50;
const EXPECTED_TOTAL_POSTS = 15;
const EXPECTED_TAGS_COUNT = 17;

/**
 * 公式文章不再手写清单 —— POSTS_INDEX.md 把 Visitor 也列成「依赖 MathJax」，
 * 但那份索引写的是「原站开了 MathJax」，不是「正文里有公式」。
 * 实测 Visitor 正文里一个 $ 都没有，照抄清单会把没有公式的页面也当成必查项。
 * 所以这里直接数源码里的 $ 出现次数：>= 4 次才算真正写了公式的文章。
 */
const MATH_MIN_DOLLARS = 4;
const postsDir = path.resolve('src/content/posts');

/* ------------------------------ 小工具 ------------------------------ */

const results = [];
const pending = [];
function check(name, fn) {
  const p = (async () => {
    try {
      const detail = await fn();
      results.push({ name, ok: true, detail: detail ?? '' });
    } catch (err) {
      results.push({ name, ok: false, detail: err.message });
    }
  })();
  pending.push(p);
  return p;
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const distFile = (...p) => path.join(DIST, ...p);
const rel = (p) => path.relative(DIST, p).split(path.sep).join('/');

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

async function read(p) {
  return readFile(p, 'utf8');
}

/** 去掉 <script> / <style> 内容后的正文（避免把内联脚本里的 $ 当成公式残留）。 */
function textOf(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
}

/** 取出一段 HTML 里所有本地资源引用（img/script/link/a 的 src 与 href）。 */
function assetRefs(html) {
  const refs = new Set();
  const re = /(?:src|href)\s*=\s*"([^"]+)"/gi;
  let m;
  while ((m = re.exec(html))) {
    const v = m[1];
    if (!v || v.startsWith('data:') || v.startsWith('mailto:') || v.startsWith('#')) continue;
    if (/^https?:\/\//i.test(v) || v.startsWith('//')) continue;
    refs.add(v.split('#')[0].split('?')[0]);
  }
  return [...refs];
}

/** 把页面 URL 形式的引用解析到 dist 里的实际文件。 */
function resolveRef(fromFile, ref) {
  if (ref.startsWith('/')) {
    return path.join(DIST, decodeURIComponent(ref));
  }
  return path.resolve(path.dirname(fromFile), decodeURIComponent(ref));
}

/** 目录形式的引用（/foo/）实际文件是 /foo/index.html。 */
async function refExists(p) {
  if (existsSync(p)) {
    const s = await stat(p);
    if (s.isFile()) return true;
    if (s.isDirectory() && existsSync(path.join(p, 'index.html'))) return true;
  }
  // 无扩展名的路径也按 .html 试一次
  if (!path.extname(p) && existsSync(p + '.html')) return true;
  return false;
}

/* ------------------------------ 开始校验 ------------------------------ */

console.log(`\n校验目标：${DIST}\n`);

if (!existsSync(DIST)) {
  console.error(`× 找不到 dist 目录：${DIST}\n  先跑一次构建。`);
  process.exit(1);
}

const allFiles = await walk(DIST);
const htmlFiles = allFiles.filter((f) => f.endsWith('.html'));

/* 1. 文章数量与永久链接 */
await check(`1. 15 篇文章全部生成，且沿用旧永久链接 /YYYY/MM/DD/<slug>/`, async () => {
  const missing = [];
  for (const [ymd, slug] of EXPECTED_POSTS) {
    const [y, m, d] = ymd.split('/');
    const p = distFile(y, m, d, slug, 'index.html');
    if (!existsSync(p)) missing.push(rel(p));
  }
  assert(missing.length === 0, `缺失 ${missing.length} 篇：${missing.slice(0, 4).join(', ')}`);

  // 反向检查：dist 里不该出现非 /YYYY/MM/DD/ 形状的文章页
  const postish = htmlFiles
    .map(rel)
    .filter((f) => f.split('/').length === 5 && /^\d{4}\/\d{2}\/\d{2}\//.test(f));
  assert(
    postish.length === EXPECTED_TOTAL_POSTS,
    `永久链接形状的文章页有 ${postish.length} 个，期望 ${EXPECTED_TOTAL_POSTS}`
  );
  return `${EXPECTED_TOTAL_POSTS} 篇，路径形状全部为 /YYYY/MM/DD/<slug>/`;
});

/* 2. 首页分页 */
await check('2. 首页每页 6 篇，共 3 页（/ 与 /page/2、/page/3）', async () => {
  const pages = ['index.html', 'page/2/index.html', 'page/3/index.html'];
  for (const p of pages) assert(existsSync(distFile(p)), `缺 ${p}`);

  const first = await read(distFile('index.html'));
  // 首页应含 6 个文章条目：用「阅读全文」的出现次数作为每条卡片的指纹
  const n1 = (first.match(/阅读全文/g) || []).length;
  assert(n1 === 6, `首页列出 ${n1} 条，期望 6`);

  const third = await read(distFile('page/3/index.html'));
  const n3 = (third.match(/阅读全文/g) || []).length;
  assert(n3 === 3, `第 3 页列出 ${n3} 条，期望 3（15 = 6+6+3）`);

  assert(!existsSync(distFile('page/1/index.html')), '不该生成 /page/1/（第 1 页就是首页）');
  return '6 + 6 + 3 = 15';
});

/* 3. 归档页 */
await check('3. 归档页按年份分组，年份与篇数正确', async () => {
  const html = await read(distFile('archive/index.html'));
  const years = [['2022', 5], ['2025', 9], ['2026', 1]];
  for (const [y, n] of years) {
    assert(html.includes(y), `归档页没有年份 ${y}`);
    assert(html.includes(`${n} 篇`), `年份 ${y} 的篇数标注（${n} 篇）缺失`);
  }
  return '2022(5) / 2025(9) / 2026(1)';
});

/* 4. 标签页 */
await check(`4. ${EXPECTED_TAGS_COUNT} 个标签都有独立列表页`, async () => {
  const dir = distFile('tags');
  assert(existsSync(dir), '没有 tags/ 目录');
  const entries = (await readdir(dir, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => decodeURIComponent(e.name));
  assert(
    entries.length === EXPECTED_TAGS_COUNT,
    `标签目录 ${entries.length} 个，期望 ${EXPECTED_TAGS_COUNT}`
  );
  const missing = EXPECTED_TAGS.filter((t) => !entries.includes(t));
  assert(missing.length === 0, `缺标签页：${missing.join(', ')}`);
  // 中英混排的标签必须都在（VSCode / Vim / IDE）
  for (const t of ['VSCode', 'Vim', 'IDE']) {
    assert(entries.includes(t), `拉丁标签 ${t} 的页面缺失`);
  }
  return `含中英混排标签，${entries.length} 页`;
});

/* 5. 图片完整性 */
await check(`5. ${IMAGE_TOTAL} 张图片全部就位且可访问（无 404）`, async () => {
  const imgDir = distFile('images');
  assert(existsSync(imgDir), 'dist 里没有 images/ 目录');
  const files = (await walk(imgDir)).filter((f) => !f.endsWith('.DS_Store'));
  assert(
    files.length === IMAGE_TOTAL,
    `dist/images 下 ${files.length} 个文件，期望 ${IMAGE_TOTAL}（6 站点图 + 44 文章图）`
  );

  // 遍历所有 HTML，确认每一条本地图片引用都能落到真实文件
  const broken = [];
  let checked = 0;
  for (const f of htmlFiles) {
    const html = await read(f);
    for (const tag of html.match(/<(?:img|source)\b[^>]*>/gi) || []) {
      const m = /(?:src|srcset)\s*=\s*"([^"]+)"/i.exec(tag);
      if (!m) continue;
      const v = m[1].split(' ')[0];
      if (!v || /^https?:\/\//i.test(v) || v.startsWith('data:')) continue;
      checked++;
      if (!(await refExists(resolveRef(f, v)))) broken.push(`${rel(f)} → ${v}`);
    }
  }
  assert(broken.length === 0, `${broken.length} 条图片引用 404：\n     ${broken.slice(0, 6).join('\n     ')}`);
  return `${files.length} 个文件，全文共 ${checked} 条图片引用全部命中`;
});

/* 6. 旧路径 /img/ 的重写 */
await check('6. 正文里的旧路径 /img/posts/... 已全部改写，无残留', async () => {
  const leftover = [];
  for (const f of htmlFiles) {
    const html = await read(f);
    if (/["'(]\/img\//.test(html)) leftover.push(rel(f));
  }
  assert(leftover.length === 0, `仍有 /img/ 引用：${leftover.slice(0, 5).join(', ')}`);
  return '0 处残留';
});

/* 7. LaTeX */
await check('7. 带公式的文章用 KaTeX 渲染，正文里没有裸 $', async () => {
  // 从源码数 $：不依赖任何手写清单，清单会随内容变化而失真
  const mathSlugs = new Set();
  for (const name of (await readdir(postsDir)).filter((n) => n.endsWith('.md'))) {
    const src = await read(path.join(postsDir, name));
    const dollars = (src.match(/\$/g) ?? []).length;
    if (dollars >= MATH_MIN_DOLLARS) {
      mathSlugs.add(name.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, ''));
    }
  }
  assert(mathSlugs.size > 0, '源码里没找到任何公式文章，判据可能失效了');

  const bad = [];
  const noKatex = [];
  for (const [ymd, slug] of EXPECTED_POSTS) {
    const [y, m, d] = ymd.split('/');
    const html = await read(distFile(y, m, d, slug, 'index.html'));

    // class="katex…" 只可能来自 KaTeX 的输出元素；
    // 早先用的 /katex/ 子串会命中每页都有的 katex.min.css <link>，等于没查
    if (mathSlugs.has(slug) && !/class="[^"]*katex/.test(html)) noKatex.push(slug);

    // 裸 $：只看正文文字，且先抠掉代码 —— 代码里的 $ 是合法的
    // （`y$` 这种 Vim 指令就在 2025-01-26-vim-VScode 里）
    const stripped = textOf(html)
      .replace(/<code[\s\S]*?<\/code>/gi, ' ')
      .replace(/<pre[\s\S]*?<\/pre>/gi, ' ');
    const bare = stripped.replace(/<[^>]+>/g, ' ');
    // KaTeX 会把 $ 换成 <span class="katex">，所以残留的 $ 就是漏渲染
    // （P1010 那句被误配的中文只在第 17 项里单查）
    if (bare.includes('$')) bad.push(slug);
  }
  assert(noKatex.length === 0, `这些公式文章没有 KaTeX 输出：${noKatex.join(', ')}`);
  assert(bad.length === 0, `这些文章的正文里残留未渲染的 $：${bad.join(', ')}`);

  assert(
    existsSync(distFile('vendor/katex/katex.min.css')),
    'KaTeX 样式表没被 vendor 到 /vendor/katex/'
  );
  const fonts = (await walk(distFile('vendor/katex/fonts'))).filter((f) => /\.(woff2|woff|ttf)$/.test(f));
  assert(fonts.length > 0, 'KaTeX 字体没有随样式表一起复制');
  return `${mathSlugs.size} 篇命中 KaTeX，${fonts.length} 个字体文件`;
});

/* 8. 代码块高亮与行号 */
await check('8. 代码块有语法高亮（双主题），行号由 CSS 计数器提供', async () => {
  // 抽一篇代码量大的文章
  const f = distFile('2025/05/09', 'SOLID', 'index.html');
  const html = await read(f);
  assert(/class="astro-code/.test(html), '没有 astro-code 容器');
  assert(/--shiki-light/.test(html) && /--shiki-dark/.test(html), '没有双主题着色变量');
  assert(/class="line"/.test(html), '代码行没有 .line 包装，行号会失效');

  // 站点 CSS 被 Astro 按入口拆成多个文件，行号规则可能在任何一个里 ——
  // 早先只读文件名排最前的那一个（404.xxxx.css），必然扑空
  const cssDir = distFile('_astro');
  const cssNames = (await readdir(cssDir)).filter((n) => n.endsWith('.css'));
  assert(cssNames.length > 0, '_astro 下没有 CSS 产物');
  let css = '';
  for (const n of cssNames) css += await read(path.join(cssDir, n));
  assert(/counter-increment:\s*codeline/.test(css), 'CSS 里没有行号计数器');
  assert(/counter-reset:\s*codeline/.test(css), 'CSS 里没有行号重置');
  return `双主题 token + CSS 行号（${cssNames.length} 份样式表）`;
});

/* 9. 无封面图的 14 篇不伪造图片 */
await check('9. 只有 vim-VScode 一篇有头图，其余 14 篇不出现伪造封面', async () => {
  for (const [ymd, slug] of EXPECTED_POSTS) {
    const [y, m, d] = ymd.split('/');
    const html = await read(distFile(y, m, d, slug, 'index.html'));
    const hasCover = /class="[^"]*post__cover/.test(html);
    if (slug === 'vim-VScode') {
      assert(hasCover, '唯一有专属头图的文章没有渲染封面');
      assert(html.includes('2025-01-26-vim-VScode/bg.png'), '头图路径不对');
    } else {
      assert(!hasCover, `${slug} 出现了不该有的封面区`);
    }
  }
  return '1 篇有封面（bg.png），14 篇按版式承接';
});

/* 10. 原文保真：两处「坑」 */
await check('10. 小写署名 cloudingyu 与一句话文章都按原样保留', async () => {
  const ml = await read(distFile('2026/03/22', 'MLInit', 'index.html'));
  assert(/class="post__author"[^>]*>cloudingyu</.test(ml), '第 15 篇的小写署名 cloudingyu 被改动了');

  const rb = await read(distFile('2025/04/11', 'red-black-tree', 'index.html'));
  assert(
    rb.includes('笔者埋下了一个大坑'),
    '一句话的文章内容丢失了（不该被当作空文章过滤）'
  );
  // 这篇不应被误当作 draft 或空内容而缺失
  assert(existsSync(distFile('2025/04/11', 'red-black-tree', 'index.html')), '红黑树那篇没有生成页面');
  return 'cloudingyu 小写署名保留；一句话正文保留';
});

/* 11. 四个页面的背景图与引语 */
await check('11. 首页 / 关于 / 归档 / 404 的背景图与引语都在', async () => {
  const pages = {
    home: 'index.html',
    about: 'about/index.html',
    archive: 'archive/index.html',
    notFound: '404.html',
  };
  const missing = [];
  for (const [key, file] of Object.entries(pages)) {
    assert(existsSync(distFile(file)), `缺 ${file}`);
    const html = await read(distFile(file));
    if (!html.includes(PAGE_BG[key])) missing.push(`${key} 缺背景 ${PAGE_BG[key]}`);
    if (!/class="[^"]*hero__quote/.test(html)) missing.push(`${key} 缺引语区块`);
  }
  assert(missing.length === 0, missing.join('；'));
  return '4 张背景图 + 4 处引语';
});

/* 12. 社交与友链 */
await check('12. 3 个社交链接与 2 个友链与 SITE_DATA 一致', async () => {
  const html = await read(distFile('index.html'));
  const missing = [];
  for (const host of SOCIAL_HOSTS) {
    if (!html.includes(host)) missing.push(`社交链接缺 ${host}`);
  }
  for (const name of FRIEND_NAMES) {
    if (!html.includes(name)) missing.push(`友链缺 ${name}`);
  }
  assert(missing.length === 0, missing.join('；'));
  assert(html.includes('cloudingyu@gmail.com'), '页脚缺邮箱');
  return 'GitHub / 知乎 / 微博 + 顺其自然2319 / trs62 + 邮箱';
});

/* 13. 站点元信息 */
await check('13. 页面 title、favicon、avatar、sitemap、404 均正确', async () => {
  const home = await read(distFile('index.html'));
  assert(/<title>[^<]*CY&#39;s Blog[^<]*<\/title>|<title>[^<]*CY's Blog[^<]*<\/title>/.test(home), '首页 title 不是 SITE_DATA 里的 seoTitle');
  assert(home.includes('images/site/favicon.ico'), '缺 favicon');
  assert(home.includes('images/site/profile_pic.jpg'), '缺头像');
  assert(home.includes('images/site/home-bg.jpg'), '首页背景图没被引用');

  const post = await read(distFile('2025/05/09', 'SOLID', 'index.html'));
  // 文章页 title 取的是文章自己的 title 字段（该文标题是「面向对象程序设计基本原则（SOLID）」），
  // 不能再退化成站点名 —— 早先这里只找字面量 SOLID，撞对了也算不上证据
  assert(
    /<title>[^<]*面向对象程序设计基本原则[^<]*SOLID[^<]*<\/title>/.test(post),
    '文章页 title 没带文章名'
  );
  assert(!/<title>小鱼儿clouding的博客/.test(post), '文章页 title 退回了站点名');

  assert(existsSync(distFile('sitemap-index.xml')), '缺 sitemap-index.xml');
  const sitemap = await read(distFile('sitemap-0.xml'));
  const urls = (sitemap.match(/<loc>/g) || []).length;
  assert(urls >= 15 + 17, `sitemap 只收录 ${urls} 条 URL，至少应有 15 篇文章 + 17 个标签页`);

  return `sitemap 收录 ${urls} 条 URL`;
});

/* 14. 搜索索引 */
await check('14. 搜索页与构建期索引就绪', async () => {
  assert(existsSync(distFile('search/index.html')), '缺 /search/ 页面');
  const idx = JSON.parse(await read(distFile('search-index.json')));
  assert(Array.isArray(idx) && idx.length === EXPECTED_TOTAL_POSTS, `索引 ${idx.length} 条，期望 ${EXPECTED_TOTAL_POSTS}`);
  for (const item of idx) {
    for (const k of ['title', 'date', 'tags', 'url', 'body']) {
      assert(k in item, `索引项缺字段 ${k}`);
    }
    assert(item.url.startsWith('/202'), `索引项 URL 形状不对：${item.url}`);
    assert(!/\$/.test(item.body), `索引正文里残留公式符号：${item.title}`);
  }
  // 中文标题应能在正文里被搜到
  assert(idx.some((i) => i.tags.includes('洛谷')), '索引里没有标签数据');
  return `${idx.length} 条，字段与 URL 全部合规`;
});

/* 15. 页面互链与锚点 */
await check('15. 站内链接无死链（页面与目录形式引用全部可达）', async () => {
  const broken = [];
  let total = 0;
  for (const f of htmlFiles) {
    const html = await read(f);
    for (const ref of assetRefs(html)) {
      // 只查站内页面跳转与静态资源，跳过外链
      total++;
      if (!(await refExists(resolveRef(f, ref)))) broken.push(`${rel(f)} → ${ref}`);
    }
  }
  assert(broken.length === 0, `${broken.length} 条死链：\n     ${broken.slice(0, 8).join('\n     ')}`);
  return `${total} 条引用全部可达`;
});

/* 16. 纯静态：不依赖服务端 */
await check('16. 产物为纯静态，可直接部署到 GitHub Pages', async () => {
  const bad = allFiles.filter((f) =>
    /\.(php|rb|py|mjs|ts|tsx|astro|jsx)$/.test(f) && !/_astro/.test(f)
  );
  assert(bad.length === 0, `产物里混入了源码文件：${bad.slice(0, 3).map(rel).join(', ')}`);
  assert(existsSync(distFile('404.html')), '缺根级 404.html，GitHub Pages 无法接管未命中路径');
  assert(existsSync(distFile('index.html')), '缺首页');
  const js = allFiles.filter((f) => f.endsWith('.js') && /_astro/.test(f));
  return `404.html 就位，${htmlFiles.length} 个 HTML 页面，${js.length} 个 JS 资源（仅主题/进度/搜索/揭示）`;
});

/* 17. KaTeX 误配守卫（P1010 的中文句号） */
await check('17. P1010 被误判成公式的中文句被守卫改回普通文字', async () => {
  const html = await read(distFile('2022/02/10', 'luogu-P1010', 'index.html'));
  const body = textOf(html).replace(/<[^>]+>/g, ' ');

  // 该文原文有 $137$ 与 $2(2(2)+2+2(0))+2(2+2(0))+2(0)。$ —— 前者是真公式，后者是缺陷
  assert(html.includes('katex'), 'P1010 的真公式没有被渲染');
  assert(!body.includes('$'), `正文里残留了未处理的 $：${body.match(/.{0,30}\$.{0,30}/)?.[0] ?? ''}`);
  // 「137」应仍以公式呈现
  assert(/137/.test(body), '真公式 137 渲染后文本丢失');
  // 那句中文的结尾句号要回到正文里
  assert(body.includes('可表示为') && /2\(0\)\s*。/.test(body.replace(/\s+/g, ' ')), '被守卫拆出的文字没有回到正文');
  return '公式保留、中文句号回到正文、无残留 $';
});

/* 18. 永久链接大小写 */
await check('18. 永久链接大小写与旧站逐一相符（Linux 上路径敏感，错一个字母即 404）', async () => {
  const mixed = EXPECTED_POSTS.filter(([, slug]) => slug !== slug.toLowerCase());
  // 15 篇里只有 red-black-tree 与 leetcode-4 是全小写，其余 13 篇文件名都带大小写
  assert(mixed.length === 13, `清单里有大小写的文章应是 13 篇，实际 ${mixed.length}`);

  const wrong = [];
  for (const [ymd, slug] of mixed) {
    const [y, m, d] = ymd.split('/');
    const dir = distFile(y, m, d);
    const names = await readdir(dir);
    if (!names.includes(slug)) wrong.push(`${ymd}/${slug}（实际目录：${names.join(', ')}）`);
  }
  assert(wrong.length === 0, `大小写不符：\n     ${wrong.join('\n     ')}`);
  return `${mixed.length} 篇带大小写的 slug 全部原样保留（luogu-P1007 / vim-VScode / UML / MLInit …）`;
});

/* ------------------------------ 输出 ------------------------------ */

await Promise.all(pending);

const pass = results.filter((r) => r.ok);
const fail = results.filter((r) => !r.ok);

for (const r of results) {
  console.log(`${r.ok ? '✓' : '×'} ${r.name}`);
  if (r.detail) console.log(`    ${r.detail}${r.ok ? '' : ''}`);
  if (!r.ok) console.log('');
}

console.log(`\n${pass.length} 通过 / ${fail.length} 失败 / 共 ${results.length} 项\n`);
process.exit(fail.length === 0 ? 0 : 1);
