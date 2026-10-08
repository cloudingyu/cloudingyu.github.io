// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { remarkGuardCurrency } from './src/lib/remark-guard-currency.mjs';
import { remarkMathRestore } from './src/lib/remark-math-restore.mjs';
import { rehypeMathHeadings } from './src/lib/rehype-math-headings.mjs';
import { rehypeCodeFrame } from './src/lib/rehype-code-frame.mjs';

/**
 * Astro 7 起 Markdown 插件要经由 @astrojs/markdown-remark 的 unified() 传入，
 * 旧的 markdown.remarkPlugins / markdown.rehypePlugins 已废弃。
 * 插件顺序（每一步都有原因，改顺序会坏）：
 *   remarkMath          → 先让 remark-math 收正常写法的公式
 *   remarkMathRestore   → 再把旧站 Ruby 插件留下的 \"\\$$\" 与 HTML 块内公式劈成 math 节点
 *                         （remark-math 是分词期扩展，改完字符串再等它重扫是无效的）
 *   remarkGuardCurrency → 最后把 P1010 被误括的中文句降级回正文
 *   rehypeKatex         → 渲染成 KaTeX
 *   rehypeMathHeadings  → 排在 Astro 收集 heading 之前，把标题里的数学拍平成纯文本，
 *                         否则目录会漏出 \\mathrm{Vim} 这种注解源码
 *   rehypeCodeFrame     → 最后给代码块套上「语言栏 + 复制按钮」的框
 *                         （rehypePlugins 整体排在 Shiki 之后，所以这一步拿得到已着色的 pre）
 */
const markdownProcessor = unified({
  remarkPlugins: [remarkMath, remarkMathRestore, remarkGuardCurrency],
  rehypePlugins: [rehypeKatex, rehypeMathHeadings, rehypeCodeFrame],
});

export default defineConfig({
  site: 'https://cloudingyu.github.io',
  base: '/',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
  markdown: {
    // 显式指定处理器，替代 Astro 7 的默认 satteri()。
    // satteri 只把 .md 注册为内容条目类型，且 unified() 只在 markdown-remark
    // 处理器下生效。这里用 markdown-remark，兼顾既有插件链。
    processor: markdownProcessor,
    syntaxHighlight: 'shiki',
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark-dimmed',
      },
      // defaultColor:false → 明暗主题切换由 CSS 变量完成，不产生两份 HTML
      defaultColor: false,
      wrap: false,
    },
  },
  integrations: [sitemap()],
  vite: {
    build: {
      // 图片一律走独立文件，便于逐张校验 50 张素材是否都在
      assetsInlineLimit: 0,
    },
  },
});
