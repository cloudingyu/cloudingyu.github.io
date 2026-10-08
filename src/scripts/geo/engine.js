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
/**
 * 把一个场景挂到元素上。
 *
 * 场景拿到的是「交互状态」（input）：滚动推进度、指针位置与速度、点击冲量、
 * 活跃度。几何体的运动应该由这些量推导出来 —— 自己开一个计时器永远匀速转，
 * 看起来就像一段装饰动画贴在页面上，而不是在回应人。
 *
 * @param {HTMLElement} host 容器（会被绝对定位的 canvas 填满）
 * @param {(ctx) => {update?, dispose?, onTheme?, onResize?}} factory 场景工厂
 * @param {{seed?: string, scroll?: boolean}} opts
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
  /*
    交互状态 —— 这是这一层最重要的东西。
    几何体不该「自己动」，它应该由人的动作驱动：滚动推进、指针牵引、
    点击给一次冲量。所以引擎只维护这些量，场景从 update 的入参里读。

    每个量都成对存在：目标值（tx/滚动）与平滑值（x/滚动实际值），
    由阻尼收敛 —— 直接赋值会让几何体跟着事件一跳一跳。
  */
  const input = {
    // 指针：归一化到 [-1,1]
    px: 0, py: 0, ptx: 0, pty: 0,
    // 指针速度（屏幕尺寸/秒），用于「甩动」类反馈
    pvx: 0, pvy: 0,
    // 容器在视口里的推进度：0 = 刚露头，1 = 已滚过
    scroll: 0, scrollT: 0,
    // 每帧的滚动增量与世界单位的累计位移，供螺旋/荒原这类「正比于滚动」的场景用
    scrollDelta: 0, travel: 0,
    // 点击冲量：0→1 的脉冲，按下即置 1 后自然衰减
    impulse: 0,
    // 活跃度：有输入时升到 1，静置后衰减到 0；场景用它决定「自己动」的幅度
    activity: 0,
    // 场景可以把自己的空闲漂移写回来（默认极缓），活跃时会被压掉
    idle: 0,
  };

  const state = factory({
    THREE,
    scene,
    camera,
    renderer,
    colors,
    input,
    // 兼容旧签名：有些场景仍按 pointer 读
    pointer: {
      get x() { return input.px; },
      get y() { return input.py; },
      get tx() { return input.ptx; },
      get ty() { return input.pty; },
    },
    reduced,
    lowPower,
    host,
    seed: opts.seed ?? 'cloudingyu',
    get scroll() {
      return input.scroll;
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

  /*
    循环状态先于交互监听声明。
    onScroll 在注册时会立刻跑一次（初始化推进度），它会调用 bump()，
    而 bump 里引用了 raf / start —— 声明在后面就是 TDZ 报错。
  */
  const clock = new THREE.Clock();
  let raf = 0;
  let elapsed = 0;
  // 可见性：bump() 与 onScroll() 都要读它，所以先于监听器声明
  let visible = false;

  const renderOnce = () => {
    input.scroll = input.scrollT;
    state?.update?.(elapsed, 1 / 60, { reduced: true, input });
    renderer.render(scene, camera);
  };

  const frame = () => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    const prevScroll = input.scroll;
    // 指针用更紧的阻尼跟随，滚动用稍松的，跟手但不抖
    input.px = damp(input.px, input.ptx, 6.5, dt);
    input.py = damp(input.py, input.pty, 6.5, dt);
    input.scroll = damp(input.scroll, input.scrollT, 9, dt);
    input.scrollDelta = input.scroll - prevScroll;
    // 世界位移按增量累积：螺旋、荒原这类场景直接吃这个值，滚动多少就走多少
    input.travel += input.scrollDelta * 26;
    // 冲量与指针速度都按指数衰减
    input.impulse = damp(input.impulse, 0, 4.2, dt);
    input.pvx = damp(input.pvx, 0, 5, dt);
    input.pvy = damp(input.pvy, 0, 5, dt);
    // 活跃度：有交互时维持，静置后回落；场景的「自主呼吸」乘这个值，
    // 所以没人操作时几何体基本是静止的
    input.activity = damp(input.activity, 0, 0.55, dt);

    state?.update?.(elapsed, dt, { reduced: false, input });
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

  /* 可见性：滚出视口或标签页隐藏就停表 */
  const io = new IntersectionObserver(
    (entries) => {
      visible = entries[0]?.isIntersecting ?? false;
      if (visible) start();
      else stop();
    },
    { threshold: 0 },
  );
  io.observe(host);

  /* 指针：不抢交互（canvas 本身 pointer-events:none），只提供牵引力 */
  let lastPointer = null;
  const onPointer = (e) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    if (lastPointer) {
      const dt = Math.max((e.timeStamp - lastPointer.t) / 1000, 1 / 240);
      input.pvx = (nx - lastPointer.x) / dt;
      input.pvy = (ny - lastPointer.y) / dt;
    }
    lastPointer = { x: nx, y: ny, t: e.timeStamp };
    input.ptx = nx;
    input.pty = ny;
    bump(1);
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  /*
    滚动：容器在视口里的推进度。
    0 → 1 表示「从刚进入视口到滚过它」，各场景把这一条曲线用成自己的时间轴。
  */
  let lastScrollY = window.scrollY;
  const onScroll = () => {
    const r = host.getBoundingClientRect();
    const vh = window.innerHeight;
    let t = clamp01(1 - (r.top + r.height) / (vh + r.height));
    if (r.bottom < 0) t = 1;
    if (r.top > vh) t = 0;
    input.scrollT = t;
    lastScrollY = window.scrollY;
    bump(1);
  };
  if (opts.scroll !== false) {
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /*
    点击：整个文档上的 pointerdown 给场景一次冲量。
    只监听 host 内部不够用 —— 页头的几何体上面盖着文字与遮罩，
    而那些元素本身是可点的（标题、面包屑）。所以整页都算「一次点击」，
    幅度按点击位置到容器中心的距离衰减，近处反馈更强。
  */
  const onPress = (e) => {
    const r = host.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const d = Math.hypot(e.clientX - cx, e.clientY - cy);
    const reach = Math.max(r.width, r.height) * 0.9;
    input.impulse = Math.min(1, Math.max(0.25, 1 - d / reach));
    bump(1);
  };
  document.addEventListener('pointerdown', onPress, { passive: true });

  /** 把活跃度顶起来：任何交互都会让几何体「醒过来」，然后缓慢回落 */
  function bump(amount) {
    input.activity = Math.min(1, input.activity + amount);
    if (!raf && visible && !reduced) start();
  }

  const onVis = () => {
    if (document.hidden) stop();
    else if (visible) start();
  };
  document.addEventListener('visibilitychange', onVis);

  if (reduced) {
    elapsed = 2.2;
    state?.update?.(elapsed, 1 / 60, { reduced: true, input });
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
