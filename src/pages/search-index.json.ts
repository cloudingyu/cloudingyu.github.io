/**
 * 构建期生成 /search-index.json。
 *
 * 搜索必须能在 GitHub Pages 这种纯静态托管上工作，所以没有服务端可查 ——
 * 索引在构建时烘出来，浏览器端只做过滤。16 篇文章的语料很小，
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
  const code: string[] = [];
  // 先保护代码，避免 <T>、比较运算符和 Vim 的 y$ 被当作 HTML 或公式删除。
  const text = md.replace(/```[^\n]*\n([\s\S]*?)```|`([^`\n]*)`/g, (_, block, inline) => {
    code.push(block ?? inline);
    return `\u0000${code.length - 1}\u0000`;
  });
  return text
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // 图片只留 alt，链接只留文字
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // 数学公式整体剔除：$...$ / $$...$$ 对检索没有意义，注释掉反而会污染标题匹配
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$\n]*\$/g, ' ')
    // HTML 标签（正文里的 <div align=...> 之类）
    .replace(/<[^>]+>/g, ' ')
    // 标题井号、引用符号、列表符号
    .replace(/^\s{0,3}#{1,6}\s+/gm, ' ')
    .replace(/^[>\-*+]\s+/gm, ' ')
    .replace(/(\*\*|__)([^\n]*?)\1/g, '$2')
    .replace(/~~([^\n]*?)~~/g, '$1')
    // 表格分隔行
    .replace(/^\|?[\s:-]+\|[\s:|-]*$/gm, ' ')
    // 去掉正文残留的公式定界符，再还原代码中的所有字符。
    .replace(/\$/g, ' ')
    .replace(/\u0000(\d+)\u0000/g, (_, index) => code[Number(index)]!)
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
