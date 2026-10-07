/**
 * 构建期生成 /search-index.json。
 *
 * 搜索必须能在 GitHub Pages 这种纯静态托管上工作，所以没有服务端可查 ——
 * 索引在构建时烘出来，浏览器端只做过滤。15 篇文章的语料很小，
 * 一份扁平 JSON 足够，不需要 Lunr / FlexSearch 这类索引库。
 *
 * 正文取原始 markdown 而不是渲染后的 HTML：markdown 本身已经是纯文本，
 * 顺着它匹配还能让读者用代码片段、命令名（vim、VScode、spfa…）搜到文章，
 * 这在技术博客里恰恰是最常被搜的东西。只把公式与图片语法剔掉，
 * 它们既占体积又没有检索价值。
 */
import type { APIRoute } from 'astro';
import { allPosts, permalink, formatDate } from '../lib/posts';

/** 把 markdown 正文粗洗成可检索的纯文本。 */
function plain(md: string): string {
  return md
    // 代码围栏的标记行去掉，保留代码本身
    .replace(/^```.*$/gm, ' ')
    // 行内代码的反引号去掉，保留内容
    .replace(/`([^`]*)`/g, '$1')
    // 图片只留 alt，链接只留文字
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // 数学公式整体剔除：$...$ / $$...$$ 对检索没有意义，注释掉反而会污染标题匹配
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$\n]*\$/g, ' ')
    // HTML 标签（正文里的 <div align=...> 之类）
    .replace(/<[^>]+>/g, ' ')
    // 标题井号、引用符号、列表符号
    .replace(/^[#>\-*+]\s*/gm, ' ')
    // 表格分隔行
    .replace(/^\|?[\s:-]+\|[\s:|-]*$/gm, ' ')
    // 兜底：行内代码是「保留内容」的，所以代码里的 $ 会活到这一步 ——
    // 比如 vim 的 `y$`（复制到行尾）。公式语法已经在上一步整段剔除了，
    // 走到这里还剩下的 $ 一定是代码或残留定界符，对检索毫无用处，抹掉。
    .replace(/\$/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

export const GET: APIRoute = async () => {
  const posts = await allPosts();

  const index = posts.map((post) => ({
    title: post.data.title,
    subtitle: post.data.subtitle ?? '',
    date: formatDate(post.data.date, 'dash'),
    tags: post.data.tags,
    url: permalink(post),
    author: post.data.author,
    // 正文压缩掉换行：JSON 更小，客户端也不必处理多行
    body: plain(post.body ?? '').replace(/\s*\n\s*/g, ' '),
  }));

  return new Response(JSON.stringify(index), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // 内容随构建而变，交给 HTTP 缓存但允许长期复用同一份
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
