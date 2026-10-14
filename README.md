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
