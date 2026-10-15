# CloudingYu 的博客

基于 [Astro](https://astro.build/) 的个人技术博客，部署于 GitHub Pages。

[访问博客](https://cloudingyu.github.io/)

支持 Markdown 写作、数学公式、代码高亮、明暗主题和全文搜索。

## 本地开发

需要 Node.js 22.12 或更新版本。

```sh
npm ci
npm run dev
```

## 构建与检查

```sh
npm run check
npm run build
npm run verify
```

构建结果位于 `dist/`，可运行 `npm run preview` 本地预览。

## 内容维护

文章放在 `posts/`，图片放在 `images/`，页面与样式位于 `src/`。开发和构建时会自动同步内容，无需直接修改生成文件。

首页主视觉使用 [ascii.rest](https://ascii.rest/) 的 3D kit（MIT，作者 [@bas3line](https://github.com/bas3line)），可切换立体云和立体鱼，以 60 秒一圈缓慢自转。每个字符以原生 SVG `<text>` 绘制，使用本地 Maple Mono Bold 字体与分级明暗表现光影，不使用位图字形贴图。桌面模型独立放在标题右侧、最新文章上方，切换按钮对齐展示区右下角；空间不足时改为纵向排列。标题、简介、文章入口与最新文章按实际位置生成 SVG 文字遮罩，窗口缩放与滚动时自动更新，字符和扰动不会进入阅读区域。鼠标向外推开附近字符形成空洞，每个字符保留独立速度，以弹簧和阻尼回落，不改变模型角度；光标按 SVG 实际屏幕变换映射，命中位置不额外缓动。两者保持相同的 112×48 字符网格和字符大小，切换时约 0.55 秒就地重组。矢量绘制位于 `src/scripts/ascii-particle-svg.js`，文字遮罩位于 `src/scripts/ascii-text-mask.js`，视窗适配位于 `src/scripts/ascii-viewport.js`；静态字符首帧在构建时生成，动画按需加载，离屏时暂停，并遵循系统的减少动态效果设置。
