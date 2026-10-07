/**
 * 站点数据 —— 逐字转录自 SITE_DATA.md（唯一事实来源）。
 * 任何文案改动都必须先改 SITE_DATA.md。
 */

export const SITE = {
  /** 页头品牌名 */
  title: 'CloudingYu的博客',
  /** SEO <title> */
  seoTitle: "小鱼儿clouding的博客 | CY's Blog",
  /** 站点描述 / 副标语 */
  tagline: '技术宅拯救世界真的很酷！',
  url: 'https://cloudingyu.github.io',
  email: 'cloudingyu@gmail.com',
  lang: 'zh-CN',
  timezone: 'Asia/Shanghai',
} as const;

export const AUTHOR = {
  /** 文章署名基准。注意：第 15 篇原文署名为小写 cloudingyu，保留原样。 */
  name: 'CloudingYu',
  avatar: 'images/site/profile_pic.jpg',
  /** 侧边栏自我介绍 */
  bio: '懒惰骄傲不耐烦',
} as const;

export const SOCIALS = [
  { name: 'GitHub', handle: 'cloudingyu', url: 'https://github.com/cloudingyu' },
  { name: '知乎', handle: 'xian-min-77-58', url: 'https://www.zhihu.com/people/xian-min-77-58' },
  { name: '微博', handle: 'u/7749674615', url: 'http://weibo.com/u/7749674615' },
] as const;

export const FRIENDS = [
  { name: '顺其自然2319', url: 'http://sqzr2319.github.io' },
  { name: 'trs62', url: 'https://travellingsheep.github.io/' },
] as const;

/**
 * 各页面的背景图与引言文案（SITE_DATA.md 第 7 节）。
 * 背景图属于内容素材，不是设计资产 —— 保留原图，不改用渐变替代。
 */
export type PageKey = 'home' | 'about' | 'archive' | 'notFound';

export const PAGES: Record<PageKey, { bg: string; quote: string }> = {
  home: {
    bg: 'images/site/home-bg.jpg',
    quote: '「好奇心仅是引领我们启程的火种。它点燃了我们对未知的渴望，却不足以照亮整个旅程。」',
  },
  about: {
    bg: 'images/site/about-bg.jpg',
    quote: '「节制与癫狂，秩序与诗意，能相提并论乎？」',
  },
  archive: {
    bg: 'images/site/archive-bg.jpg',
    quote: '「未经反思的生活不值得过」',
  },
  notFound: {
    bg: 'images/site/404-bg.jpg',
    quote: '你来到了没有知识的荒原',
  },
};

export const NAV = [
  { href: '/', label: '首页' },
  { href: '/about/', label: '关于' },
  { href: '/archive/', label: '归档' },
] as const;

/** 分页：每页 6 篇（SITE_DATA.md 第 5 节） */
export const POSTS_PER_PAGE = 6;
