/**
 * 场景通用工具 —— 刻意不 import three.js。
 *
 * 为什么单独一个文件：engine.js 里有 `import * as THREE from 'three'`，
 * motion.js 只要从 engine.js 引一个 damp()，打包器就会把 700KB 的 three
 * 连到首屏的 chunk 上（实测首页多下 750KB）。所以纯数学/媒体查询这类
 * 不碰 three 的东西放这里，motion.js 从这儿引，three 保持纯粹的按需加载。
 */


/** 确定性随机：同一个种子在任何机器上都长出同一个形状。 */
export function seeded(seed) {
  let h = 1779033703 ^ String(seed).length;
  for (let i = 0; i < String(seed).length; i++) {
    h = Math.imul(h ^ String(seed).charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const damp = (current, target, lambda, dt) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt));

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 从 CSS 变量取色。几何体的颜色必须跟主题走 ——
 * 深色模式下把浅色描线留在浅色纸面上，就是看不见。
 */
export function palette() {
  const cs = getComputedStyle(document.documentElement);
  const read = (name, fallback) => {
    const v = cs.getPropertyValue(name).trim();
    return v || fallback;
  };
  // 返回 CSS 颜色字符串：工具的职责只是把变量读出来，
  // 转成 THREE.Color 由场景层做（这样本文件不必 import three）
  return {
    accent: read('--accent', '#1B4B7F'),
    mark: read('--mark', '#A33B22'),
    ink: read('--ink', '#171C1A'),
    muted: read('--ink-muted', '#667069'),
    faint: read('--ink-faint', '#98A19B'),
    line: read('--line-strong', '#C4CBC3'),
  };
}

