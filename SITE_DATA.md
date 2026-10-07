# 站点数据（唯一事实来源）

本文件包含重建博客所需的**全部个人信息与站点结构**。所有值均从原站点的配置文件、页面与模板中提取，未经改写。

> 原站点使用 Jekyll + SCSS，**本包不包含任何样式、布局、脚本或模板**。新站点可自由选择技术栈（Next.js / Astro / Hugo / 纯静态均可），但下列内容必须原样保留。

---

## 1. 站点基本信息

| 键 | 值 |
| --- | --- |
| 站点标题（页头品牌） | `CloudingYu的博客` |
| SEO 标题 | `小鱼儿clouding的博客 \| CY's Blog` |
| 站点描述 / 副标语 | `技术宅拯救世界真的很酷！` |
| 首页导语 | `「好奇心仅是引领我们启程的火种。它点燃了我们对未知的渴望，却不足以照亮整个旅程。」` |
| 邮箱 | `cloudingyu@gmail.com` |
| 站点 URL | `http://cloudingyu.github.io` |
| 关键词 | 无（原配置为空字符串） |
| 中文时区 | Asia/Shanghai |

## 2. 个人信息 / 作者身份

| 键 | 值 |
| --- | --- |
| 作者名（文章署名） | `CloudingYu` |
| 头像 | `images/site/profile_pic.jpg`（原路径 `/img/profile_pic.jpg`） |
| 侧边栏自我介绍 | `懒惰骄傲不耐烦` |
| 侧边栏邮箱明文展示 | `cloudingyu@gmail.com` |

## 3. 社交链接

原站点通过生成 `https://<平台>/<用户名>` 的形式拼接链接，因此下表同时给出原始用户名与最终 URL。

| 平台 | 用户名 | 完整 URL | 是否启用 |
| --- | --- | --- | --- |
| GitHub | `cloudingyu` | `https://github.com/cloudingyu` | 启用 |
| 知乎 | `xian-min-77-58` | `https://www.zhihu.com/people/xian-min-77-58` | 启用 |
| 微博 | `u/7749674615` | `http://weibo.com/u/7749674615` | 启用 |
| RSS / Atom | — | 原为 `/feed.xml` | **已禁用**（`RSS: false`） |
| Twitter | — | — | 未配置 |
| Facebook | — | — | 未配置 |
| LinkedIn | — | — | 未配置 |

## 4. 友链

| 名称 | 链接 |
| --- | --- |
| 顺其自然2319 | `http://sqzr2319.github.io` |
| trs62 | `https://travellingsheep.github.io/` |

## 5. 导航与页面结构

导航栏结构为：品牌名（指向首页）→ 首页 → 所有带 `title` 且未标记 `hide-in-nav` 的页面 → 搜索入口。

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/` | 首页 | 文章列表，**每页 6 篇**，带「更新 / 更早」翻页 |
| `/about/` | About | 关于页，展示头像与个人简介 |
| `/archive/` | Archive | 归档页，按 **年份分组** + 标签云筛选；标签按文章数降序排列 |
| `/404.html` | 404 | 隐藏于导航 |
| 搜索 | — | 站内搜索，原站点通过 `search.json` 提供索引 |

其他行为约定：

- 文章详情页有上/下一篇导航与侧边栏
- 归档页标签云默认展示「Show All」，并显示总文章数
- About 页有中英双语字段，但**英文版在原站已被注释禁用**，仅中文生效
- 原站点启用 Service Worker / PWA，但最终配置已把 `service-worker` 设为 `false`（缓存功能关闭）

## 6. About 页正文

以下为 About 页的完整内容，需在重建时保留（原始为 Markdown，含外链 Badge 图片）。

```markdown
# 你好, 我是 CloudingYu 👋

## 🚀 关于我

- 💡 喜欢用优雅的代码简化复杂问题并解决实际问题
- 🎮 业余游戏 ~~开发者~~ 玩家
- 📚 终身学习者，始终保持好奇心
- 🎓 复旦大学本科生

![Coding GIF](https://media.giphy.com/media/qgQUggAC3Pfv687qPC/giphy.gif)

<div align="center"><em>"Curiosity is the spark that lights the flame of our journey, but it is not enough to illuminate the entire path"</em></div>

## 💻 技术栈

![Python](https://img.shields.io/badge/-Python-3776AB?style=flat-square&logo=python&logoColor=white) ![C++](https://img.shields.io/badge/-C++-00599C?style=flat-square&logo=cplusplus&logoColor=white) ![Java](https://img.shields.io/badge/-Java-007396?style=flat-square&logo=java&logoColor=white) ![JavaScript](https://img.shields.io/badge/-JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black) ![Vue](https://img.shields.io/badge/-Vue.js-4FC08D?style=flat-square&logo=vue.js&logoColor=white)

## 📊 我的 GitHub 统计

![CodeTime Badge](https://img.shields.io/endpoint?style=flat-square&color=41B883&url=https%3A%2F%2Fapi.codetime.dev%2Fshield%3Fid%3D31966%26project%3D%26in=0) [![GitHub followers](https://img.shields.io/github/followers/cloudingyu?label=Followers&style=social)](https://github.com/cloudingyu?tab=followers) [![GitHub stars](https://img.shields.io/github/stars/cloudingyu?style=social)](https://github.com/cloudingyu?tab=stars) ![Last Commit](https://img.shields.io/github/last-commit/cloudingyu/cloudingyu)
```

> 注意：上述 Badge 与 GIF 均为**外部 CDN 图片**，不在本包内，重建时保留原始直链即可。

## 7. 各页面的背景图与描述文案

原站点为不同页面配置了不同的头图背景与一句话描述。这些属于**内容**（图片素材 + 文案），不属于设计，需保留。

| 页面 | 背景图 | 页面描述文案 |
| --- | --- | --- |
| 首页 | `images/site/home-bg.jpg` | `「好奇心仅是引领我们启程的火种。它点燃了我们对未知的渴望，却不足以照亮整个旅程。」` |
| About | `images/site/about-bg.jpg` | `「节制与癫狂，秩序与诗意，能相提并论乎？」` |
| Archive | `images/site/archive-bg.jpg` | `「未经反思的生活不值得过」` |
| 404 | `images/site/404-bg.jpg` | `你来到了没有知识的荒原` |
| 站点图标 | `images/site/favicon.ico` | — |

## 8. 原站点的其他配置（供参考，非必留）

| 键 | 原值 | 说明 |
| --- | --- | --- |
| 高亮器 | `rouge` | 代码高亮 |
| 永久链接 | `pretty` | 形如 `/2025/04/07/UML/` |
| Markdown | `kramdown` + GFM 输入 | 代码块显示行号，数学公式走 MathJax |
| 分页 | `jekyll-paginate`，每页 6 条 | |
| 评论 | Disqus | **注释状态，未启用** |
| 统计 | 百度统计 / Google Analytics | 均为注释状态，**未启用**（无有效追踪 ID） |
| 锚点 | `anchorjs: true` | 标题锚点 |
| 特色标签 | 开启，阈值 1 | 文章数 > 1 的标签会被突出展示 |

## 9. 重要迁移提示

1. **`profile_pic.jpg` 曾被同时用作 `icon_wechat.png`**，两者字节完全相同（MD5 一致），已去重，仅保留 `profile_pic.jpg`。
2. **`DeviceWithVisitorPro.svg` 已移除**：这是访问者模式一文的废弃旧版图，正文从未引用。
3. **`bg.png` 路径陷阱**：`2025-01-26-vim-VScode` 一文的头图字段写的是 `img/posts/2025-01-26-vim-VScode/bg.png`，缺前导斜杠。重建时请统一为包内的 `images/posts/2025-01-26-vim-VScode/bg.png`。
4. **图片绝对路径**：全部文章正文使用 `/img/posts/...` 形式的**根绝对路径**引图。若新站点部署在子路径下，需补 `baseurl` 或改写为相对路径。
5. **`_config.yml` 中不存在 `_notes` 相关构建产物**：项目内曾有 `prompt.md` 描述「课堂笔记 → `_notes/**/*.md`」的流程，但本仓库中**没有 `_notes` 目录**，该部分内容不在本包内（无内容可导出）。
