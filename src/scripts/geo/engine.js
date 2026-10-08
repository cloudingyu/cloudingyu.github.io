/**
 * WebGL 场景引擎（three.js）。
 *
 * 这一层的存在理由只有一个：让「页面上的几何体」成为可复用的东西。
 * 五个页面各有一场几何动画，它们共享同一套生命周期管理 ——
 * 懒加载、只在可见时渲染、主题变更时重新取色、卸载时释放 GPU 资源。
 *
 * 三条硬约束（不做就会变成「炫技但难用」）：
 *   1. 不可见就不渲染 —— IntersectionObserver + document.hidden，滚动离开即停表。
 *      GitHub Pages 上的博客没有预算让一个 canvas 在后台白烧电。
 *   2. prefers-reduced-motion 时只画一帧静态图 —— 动画是增强，不是内容。
 *   3. three.js 走动态 import —— 首屏 HTML 不背 400KB 的库；
 *      不支持 WebGL 的浏览器直接不加载（catch 掉即可）。
 */
import * as THREE from 'three';
// 工具函数住在 util.js（不 import three），这样 motion.js 只引工具时
// 不会把整包 three 拖进首屏 chunk
import { seeded, damp, clamp01, prefersReducedMotion, palette } from './util.js';

/* ------------------------------ 几何构件 ------------------------------ */

/** 线框：只保留结构边，不用满屏三角网 —— 描线感来自「少而准」。 */
export function wire(geometry, { color, opacity = 0.5, threshold = 18 } = {}) {
  const edges = new THREE.EdgesGeometry(geometry, threshold);
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  return new THREE.LineSegments(edges, mat);
}

/** 完整网面（含对角线）—— 用于「透视骨架」这一类需要密度的地方。 */
export function meshWire(geometry, { color, opacity = 0.22 } = {}) {
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  return new THREE.LineSegments(new THREE.WireframeGeometry(geometry), mat);
}

/** 有限网格平面：坐标纸。比 GridHelper 可控（可以要多大就多大、不无限延伸）。 */
export function gridPlane(size = 40, divisions = 40, { color, opacity = 0.18 } = {}) {
  const step = size / divisions;
  const half = size / 2;
  const pts = [];
  for (let i = 0; i <= divisions; i++) {
    const p = -half + i * step;
    pts.push(-half, 0, p, half, 0, p);
    pts.push(p, 0, -half, p, 0, half);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  return new THREE.LineSegments(geo, mat);
}

let spriteCache = null;
/** 圆形柔边贴图：Points 用方点会显得廉价，这里画一个径向渐变的圆。 */
function dotTexture() {
  if (spriteCache) return spriteCache;
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
  g.fill();
  spriteCache = new THREE.CanvasTexture(c);
  return spriteCache;
}

/** 尘埃 / 星点：给几何体一个纵深参照，不然空间是平的。 */
export function dust(count = 400, spread = 40, { color, size = 0.16, opacity = 0.5 } = {}) {
  const pos = new Float32Array(count * 3);
  const rnd = seeded('dust');
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rnd() - 0.5) * spread;
    pos[i * 3 + 1] = (rnd() - 0.5) * spread * 0.4;
    pos[i * 3 + 2] = (rnd() - 0.5) * spread;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color,
    size,
    map: dotTexture(),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  return new THREE.Points(geo, mat);
}

/* ------------------------------ 挂载 ------------------------------ */

/**
 * 把一个场景挂到元素上。
 *
 * @param {HTMLElement} host 容器（会被绝对定位的 canvas 填满）
 * @param {(ctx) => {update?, dispose?, onTheme?, onResize?}} factory 场景工厂
 * @param {{seed?: string, scroll?: boolean, fixedView?: boolean}} opts
 */
export function mountScene(host, factory, opts = {}) {
  if (!host || host.dataset.sceneMounted === '1') return () => {};
  host.dataset.sceneMounted = '1';

  const reduced = prefersReducedMotion();
  const lowPower
    = (navigator.hardwareConcurrency || 8) <= 4
    || window.matchMedia('(max-width: 40rem)').matches;

  const renderer = new THREE.WebGLRenderer({
    antialias: !lowPower,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearAlpha(0);
  const maxDpr = lowPower ? 1.35 : 1.75;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.inset = '0';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  host.insertBefore(renderer.domElement, host.firstChild);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 220);
  camera.position.set(0, 0, 14);

  // palette() 返回 CSS 颜色字符串，这里统一转成 THREE.Color
  const toColors = (raw) => {
    const out = {};
    for (const [k, v] of Object.entries(raw)) out[k] = new THREE.Color(v);
    return out;
  };
  let colors = toColors(palette());
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let scrollProgress = 0;
  let scrollTarget = 0;

  const state = factory({
    THREE,
    scene,
    camera,
    renderer,
    colors,
    pointer,
    reduced,
    lowPower,
    // 容器本身也交给场景：有几场戏需要按容器宽度重新取景（窄屏把几何体收回中心）
    host,
    seed: opts.seed ?? 'cloudingyu',
    get scroll() {
      return scrollProgress;
    },
  });

  /* 尺寸：容器尺寸变化（翻页、响应式断点）时重建投影矩阵 */
  const resize = () => {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    state?.onResize?.(w, h, camera);
  };
  resize();
  // ResizeObserver 覆盖「容器尺寸变了但窗口没变」的情况（比如翻页切换）
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  /* 主题：MutationObserver 监听 data-theme，重新取色后交给场景决定改哪些材质 */
  const themeObs = new MutationObserver(() => {
    colors = toColors(palette());
    state?.onTheme?.(colors);
    if (reduced || !visible) renderOnce();
  });
  themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* 可见性：滚出视口或标签页隐藏就停表 */
  let visible = false;
  const io = new IntersectionObserver(
    (entries) => {
      visible = entries[0]?.isIntersecting ?? false;
      if (visible) start();
      else stop();
    },
    { threshold: 0 },
  );
  io.observe(host);

  /* 指针视差：不抢交互（canvas 本身 pointer-events:none），只是让空间有反应 */
  const onPointer = (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  /* 滚动联动：几何体随页面滚动推进（JIEJOE 那种「滚动驱动」的手感） */
  const onScroll = () => {
    const r = host.getBoundingClientRect();
    const vh = window.innerHeight;
    scrollTarget = clamp01(1 - (r.top + r.height) / (vh + r.height));
    // 若容器已经滚到视口之上，直接锁定为 1
    if (r.bottom < 0) scrollTarget = 1;
    if (r.top > vh) scrollTarget = 0;
  };
  if (opts.scroll !== false) {
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  const clock = new THREE.Clock();
  let raf = 0;
  let elapsed = 0;

  const renderOnce = () => {
    state?.update?.(elapsed, 1 / 60, { reduced: true });
    renderer.render(scene, camera);
  };

  const frame = () => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    pointer.x = damp(pointer.x, pointer.tx, 3.4, dt);
    pointer.y = damp(pointer.y, pointer.ty, 3.4, dt);
    scrollProgress = damp(scrollProgress, scrollTarget, 5, dt);
    state?.update?.(elapsed, dt, { reduced: false });
    renderer.render(scene, camera);
  };

  const start = () => {
    if (reduced || raf || document.hidden) return;
    clock.getDelta();
    frame();
  };
  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  const onVis = () => {
    if (document.hidden) stop();
    else if (visible) start();
  };
  document.addEventListener('visibilitychange', onVis);

  if (reduced) {
    elapsed = 2.2;
    state?.update?.(elapsed, 1 / 60, { reduced: true });
    renderer.render(scene, camera);
  } else if (visible) {
    start();
  }

  /* 返回卸载函数：ClientRouter 换页时旧页面会被替换，必须显式释放 */
  return () => {
    stop();
    io.disconnect();
    ro.disconnect();
    themeObs.disconnect();
    window.removeEventListener('pointermove', onPointer);
    window.removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', onVis);
    state?.dispose?.();
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose?.();
      const m = obj.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose?.());
      else m?.dispose?.();
    });
    renderer.dispose();
    renderer.domElement.remove();
    delete host.dataset.sceneMounted;
  };
}
