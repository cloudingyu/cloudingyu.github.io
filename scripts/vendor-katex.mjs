/**
 * 把 KaTeX 的样式表与字体复制到 public/vendor/katex/。
 *
 * 为什么这么做：katex.min.css 用相对路径 `url(fonts/...)` 引用 60 个字体文件，
 * 靠打包器处理容易漏掉字体或路径错位。直接整份搬到 public/ 下，路径关系原样保留，
 * GitHub Pages 的纯静态部署最稳。
 *
 * 复制的产物不进版本库（见 .gitignore），每次 build 前由 npm script 重新生成。
 */
import { cp, mkdir, rm, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const dist = path.dirname(require.resolve('katex/dist/katex.min.css'));
const out = path.resolve('public/vendor/katex');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(path.join(dist, 'katex.min.css'), path.join(out, 'katex.min.css'));
await cp(path.join(dist, 'fonts'), path.join(out, 'fonts'), { recursive: true });

try {
  await access(path.join(out, 'fonts'));
} catch {
  throw new Error('KaTeX 字体复制失败：public/vendor/katex/fonts 不存在');
}

console.log('[vendor-katex] 已复制 katex.min.css 与字体到 public/vendor/katex/');
