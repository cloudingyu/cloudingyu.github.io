/**
 * 站点的动效控制器。
 *
 * 一个入口，两类职责：
 *   · 挂载 WebGL 场景（按 data-scene 找容器，动态 import three.js）
 *   · 行为层：磁力光标、滚动揭示、代码复制、目录高亮、翻页过渡
 *
 * 为什么都写在这一处：Astro 的 ClientRouter 换页时不会重新执行模块顶层代码，
 * 但会派发 astro:page-load。把「绑定」写成幂等的 bind()，在首次加载与每次
 * 换页后各跑一次，就不会出现「第一页有效果、点进文章就失效」这种问题。
 */
// 只引工具层（不含 three），three 由 mountScenes 里的动态 import 负责
import { prefersReducedMotion, damp } from './geo/util.js';

/* ------------------------------------------------------------------ */
/* 场景：把 data-scene 的容器交给对应的几何戏                          */
/* ------------------------------------------------------------------ */

let liveScenes = [];

async function mountScenes() {
  const hosts = [...document.querySelectorAll('[data-scene]:not([data-scene-mounted])')];
  if (hosts.length === 0) return;

  // 不支持 WebGL 就安静退出：动效是增强，不是内容
  let engine, scenes;
  try {
    engine = await import('./geo/engine.js');
    scenes = await import('./geo/scenes.js');
  } catch (err) {
    hosts.forEach((h) => h.classList.add('scene--off'));
    return;
  }
  if (!engine || !scenes) return;

  for (const host of hosts) {
    const kind = host.dataset.scene;
    const factory = {
      tree: scenes.rbTreeScene,
      helix: scenes.helixScene,
      kepler: scenes.keplerScene,
      wasteland: scenes.wastelandScene,
      seal: scenes.sealScene,
      tags: scenes.tagSphereScene,
    }[kind];
    if (!factory) continue;
    try {
      const unmount = engine.mountScene(host, factory, {
        seed: host.dataset.seed || 'cloudingyu',
        scroll: host.dataset.sceneScroll !== 'off',
      });
      host.classList.add('scene--on');
      liveScenes.push(unmount);
    } catch (err) {
      host.classList.add('scene--off');
    }
  }
}

function unmountScenes() {
  for (const fn of liveScenes) {
    try {
      fn();
    } catch (err) {
      /* 已经随旧文档一起销毁 */
    }
  }
  liveScenes = [];
}

/* ------------------------------------------------------------------ */
/* 磁力光标：元素朝指针轻微位移（JIEJOE 的招牌手感）                    */
/* ------------------------------------------------------------------ */

const magnetic = new WeakMap();

function initMagnetic() {
  const reduced = prefersReducedMotion();
  const els = [...document.querySelectorAll('[data-magnetic]:not([data-mag-ready])')];
  els.forEach((el) => el.setAttribute('data-mag-ready', '1'));
  if (reduced || els.length === 0) return;

  const state = els.map((el) => {
    const strength = Number(el.dataset.magnetic) || 0.28;
    const s = { el, strength, x: 0, y: 0, tx: 0, ty: 0, active: false };
    magnetic.set(el, s);
    return s;
  });

  const onMove = (e) => {
    for (const s of state) {
      const r = s.el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      // 只在「近场」内吸：太远就归位，否则整页元素都在飘
      const radius = Math.max(r.width, r.height) * 1.15 + 90;
      const dist = Math.hypot(dx, dy);
      if (dist < radius) {
        const pull = (1 - dist / radius) ** 2;
        s.tx = dx * s.strength * pull;
        s.ty = dy * s.strength * pull;
        s.active = true;
      } else {
        s.tx = 0;
        s.ty = 0;
        s.active = true;
      }
    }
  };

  window.addEventListener('pointermove', onMove, { passive: true });

  let raf = 0;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    let moving = false;
    for (const s of state) {
      s.x = damp(s.x, s.tx, 7, 1 / 60);
      s.y = damp(s.y, s.ty, 7, 1 / 60);
      if (Math.abs(s.x) > 0.02 || Math.abs(s.y) > 0.02 || Math.abs(s.tx) > 0.02 || Math.abs(s.ty) > 0.02) moving = true;
      s.el.style.setProperty('--mag-x', `${s.x.toFixed(2)}px`);
      s.el.style.setProperty('--mag-y', `${s.y.toFixed(2)}px`);
    }
    // 全部归位后自停，避免一个空转的 rAF
    if (!moving) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
  const wake = () => {
    if (!raf) raf = requestAnimationFrame(tick);
  };
  window.addEventListener('pointermove', wake, { passive: true });
}

/* ------------------------------------------------------------------ */
/* 代码块复制                                                          */
/* ------------------------------------------------------------------ */

const COPY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="1.5"/><path d="M15 5.5A1.5 1.5 0 0 0 13.5 4H5.5A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15"/></svg>';
const DONE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m4.5 12.5 5 5 10-11"/></svg>';

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // 无 https / 无权限时的退路：临时 textarea + execCommand
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) {
      return false;
    }
  }
}

function initCopy() {
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest?.('[data-copy]');
    if (!btn) return;
    e.preventDefault();
    const frame = btn.closest('.code');
    const code = frame?.querySelector('code');
    if (!code) return;

    // 只取代码本身：行号是 CSS 计数器画的，不在 DOM 里；
    // Shiki 的 .line 之间那些纯空白文本节点用 textContent 取出来会多出空行，
    // 这里按 .line 逐行拼接，最忠实。
    const lines = code.querySelectorAll('.line');
    const text
      = lines.length > 0
        ? [...lines].map((l) => l.textContent).join('\n').replace(/\n+$/, '') + '\n'
        : code.textContent.replace(/\n+$/, '') + '\n';

    const ok = await copyText(text);
    const label = btn.querySelector('.code__copy-label') || btn;
    btn.classList.add(ok ? 'is-done' : 'is-fail');
    const prev = label.textContent;
    label.textContent = ok ? '已复制' : '复制失败';
    btn.setAttribute('aria-label', ok ? '代码已复制到剪贴板' : '复制失败，请手动选择');
    clearTimeout(btn._t);
    btn._t = setTimeout(() => {
      btn.classList.remove('is-done', 'is-fail');
      label.textContent = prev;
      btn.setAttribute('aria-label', '复制这段代码');
    }, 1900);
  });
}

/* ------------------------------------------------------------------ */
/* 滚动驱动：把「页面滚到哪」变成一个所有元素都能读的量                */
/* ------------------------------------------------------------------ */

/**
 * 一个共享的滚动状态，挂在 documentElement 上：
 *   --sp   本页滚动进度 0→1
 *   --dir  滚动方向 1 / -1
 *   --vel  滚动速度（归一化）
 *
 * 为什么用 CSS 变量而不是每个元素各自写监听：一处 rAF 更新，所有
 * 依赖滚动的样式（分布条、年份刻度、进度条）同时变化，不会各跑各的帧。
 */
let scrollDriver = null;

function initScrollDrive() {
  clearScrollDrive();
  if (prefersReducedMotion()) return;

  const root = document.documentElement;
  const els = [...document.querySelectorAll('[data-scroll-target]')];
  let last = window.scrollY;
  let raf = 0;
  let vel = 0;
  let dir = 1;

  const frame = () => {
    raf = 0;
    const y = window.scrollY;
    const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    const vh = window.innerHeight;
    dir = y >= last ? 1 : -1;
    vel = Math.min(1, Math.abs(y - last) / 60);
    last = y;

    root.style.setProperty('--sp', (y / max).toFixed(4));
    root.style.setProperty('--dir', String(dir));
    root.style.setProperty('--vel', vel.toFixed(3));

    // 每个声明了 data-scroll-target 的元素，算出「它在视口里的推进度」
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const p = Math.min(Math.max(1 - (r.top + r.height) / (vh + r.height), 0), 1);
      el.style.setProperty('--in', p.toFixed(4));
    }
  };

  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };
  frame();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  scrollDriver = () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    if (raf) cancelAnimationFrame(raf);
  };
}

function clearScrollDrive() {
  scrollDriver?.();
  scrollDriver = null;
}

/* ------------------------------------------------------------------ */
/* 分布条：柱子随滚动长出来，数字跟着滚动走                            */
/* ------------------------------------------------------------------ */

function initDistBars() {
  const segs = [...document.querySelectorAll('.dist__seg')];
  if (segs.length === 0) return;
  if (prefersReducedMotion()) {
    segs.forEach((s) => s.classList.add('is-in'));
    return;
  }
  // 柱子跟着「这一栏滚到哪」依次点亮，而不是进入视口就一起出现
  for (const seg of segs) {
    seg.style.setProperty('--fill', 'calc(var(--in) * 1)');
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) e.target.classList.add('is-in');
      }
    },
    { threshold: 0.2 },
  );
  segs.forEach((s) => io.observe(s));
}

/* ------------------------------------------------------------------ */
/* 归档条目：滚动时逐条滑入，指针划过时标题亮起                        */
/* ------------------------------------------------------------------ */

function initArchiveRows() {
  const rows = [...document.querySelectorAll('.year__list .item:not([data-row-ready])')];
  if (rows.length === 0) return;
  rows.forEach((r) => r.setAttribute('data-row-ready', '1'));
  if (prefersReducedMotion()) {
    rows.forEach((r) => r.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.1 },
  );
  rows.forEach((r) => io.observe(r));
}

/* ------------------------------------------------------------------ */
/* 打开文章：一次明确的「进入」动作                                    */
/* ------------------------------------------------------------------ */

/**
 * 点开一篇文章时，把被点的那条记录「推」进页面：
 * 在点击位置放一个圆形涟漪，同时给光标所在的那条记录一个短暂的压下反馈。
 * 站内跳转本身由跨文档视图过渡接手（标题会连续变形），
 * 这里补的是「我点了它」这一下即时反馈 —— 静态站在跳转前往往是真空的。
 */
function initOpenPost() {
  if (document.documentElement.dataset.openReady === '1') return;
  document.documentElement.dataset.openReady = '1';

  document.addEventListener(
    'click',
    (e) => {
      const link = e.target.closest?.('a[href]');
      if (!link) return;
      const href = link.getAttribute('href');
      // 只看站内跳转，并且排除锚点、文件、外链
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:')) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      if (prefersReducedMotion()) return;

      // 涟漪：从点击处扩散，颜色取自当前强调色
      const ripple = document.createElement('span');
      ripple.className = 'open-ripple';
      ripple.style.left = `${e.clientX}px`;
      ripple.style.top = `${e.clientY}px`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 620);

      // 被点的条目（如果在列表里）短暂压下
      const row = link.closest('.entry, .item, .ghlink, .notfound__path');
      if (row) {
        row.classList.add('is-launching');
        setTimeout(() => row.classList.remove('is-launching'), 320);
      }
    },
    { capture: true },
  );
}

/* ------------------------------------------------------------------ */
/* 滚动揭示 / 目录高亮 / 页头收起 / 主题圆形揭示                       */
/* ------------------------------------------------------------------ */

let revealObserver = null;

function initReveal() {
  revealObserver?.disconnect();
  const targets = document.querySelectorAll('.reveal:not(.is-in)');
  if (targets.length === 0) return;
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-in'));
    return;
  }
  revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const delay = Number(entry.target.dataset.revealDelay || 0);
        if (delay) entry.target.style.transitionDelay = `${delay}ms`;
        entry.target.classList.add('is-in');
        revealObserver.unobserve(entry.target);
      }
    },
    // rootMargin 收到 -18%：元素要真正进入视口下方三分之一才揭示，
    // 滚动与动效的因果关系才看得出来（早了就像「本来就在那儿」）
    { rootMargin: '0px 0px -18% 0px', threshold: 0.04 },
  );
  targets.forEach((el) => revealObserver.observe(el));
}

/** 文章目录：跟正文标题联动，滚到哪一节哪一节亮 */
function initTocSpy() {
  const links = [...document.querySelectorAll('.post__toc a[href^="#"]')];
  if (links.length === 0 || prefersReducedMotion()) return;
  const map = new Map();
  for (const a of links) {
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    const head = document.getElementById(id);
    if (head) map.set(head, a);
  }
  if (map.size === 0) return;

  let raf = 0;
  const update = () => {
    raf = 0;
    const line = window.innerHeight * 0.28;
    let current = null;
    for (const [head] of map) {
      if (head.getBoundingClientRect().top <= line) current = head;
      else break;
    }
    for (const [head, a] of map) {
      const on = head === current;
      a.classList.toggle('is-current', on);
      if (on) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    }
    // 阅读进度条与目录用同一帧更新，避免两处各开一个监听
    const bar = document.getElementById('progress-bar');
    const article = document.querySelector('[data-article]');
    if (bar && article) {
      const r = article.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      const passed = Math.min(Math.max(-r.top, 0), Math.max(total, 1));
      bar.style.transform = `scaleX(${total > 0 ? passed / total : 0})`;
    }
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
}

/** 页头：向下滚时收起，向上滚立刻展开（给正文让出高度） */
function initMasthead() {
  const head = document.querySelector('.masthead');
  if (!head || prefersReducedMotion()) return;
  let last = window.scrollY;
  let raf = 0;
  const update = () => {
    raf = 0;
    const y = window.scrollY;
    const down = y > last && y > 220;
    head.classList.toggle('is-tucked', down);
    last = y;
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!raf) raf = requestAnimationFrame(update);
    },
    { passive: true },
  );
}

/* ------------------------------------------------------------------ */
/* 3D 标题：逐字拆开，按指针给每个字一点纵深                            */
/* ------------------------------------------------------------------ */

let depthState = null;

function initDepthText() {
  if (depthState) {
    window.removeEventListener('pointermove', depthState.onMove);
    depthState = null;
  }
  if (prefersReducedMotion()) return;

  const title = document.querySelector('.depth');
  if (!title || title.dataset.depthReady === '1') return;

  // 只拆一次：用原文字符逐个包 span，空字符（含中英文混排里的空格）单独标记
  const raw = title.textContent ?? '';
  const chars = [...raw];
  if (chars.length === 0 || chars.length > 40) return; // 太长的标题就不拆了，没有意义
  title.setAttribute('aria-label', raw);
  title.textContent = '';
  const spans = chars.map((c, i) => {
    const s = document.createElement('span');
    s.className = c === ' ' ? 'ch ch--space' : 'ch';
    s.setAttribute('aria-hidden', 'true');
    s.textContent = c === ' ' ? ' ' : c;
    s.dataset.i = String(i);
    title.appendChild(s);
    return s;
  });
  title.dataset.depthReady = '1';

  const mid = (chars.length - 1) / 2;
  const onMove = (e) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    for (const s of spans) {
      const i = Number(s.dataset.i);
      // 离指针近的字动得多一点：整体呈一条斜向的「波」
      const falloff = 1 - Math.min(1, Math.abs(i - mid - nx * mid) / Math.max(mid, 1));
      const amt = falloff ** 2;
      s.style.setProperty('--px', (nx * 3.4 * amt).toFixed(2));
      s.style.setProperty('--py', (ny * 2.6 * amt).toFixed(2));
      s.style.setProperty('--pz', (amt * 14).toFixed(2));
      s.style.setProperty('--rx', (-ny * 7 * amt).toFixed(2));
      s.style.setProperty('--ry', (nx * 9 * amt).toFixed(2));
    }
  };

  depthState = { onMove };
  window.addEventListener('pointermove', onMove, { passive: true });
}

/* ------------------------------------------------------------------ */
/* 主题切换：从按钮位置扩散的圆形揭示                                   */
/* ------------------------------------------------------------------ */

/**
 * 做法与「点击捕获 + CSS 变量」不同，原因是要改的是 data-theme 这个属性，
 * 而它由 BaseLayout 的内联脚本改。这里用 view transition 包住这次改动，
 * 在过渡期间用 clip-path 圆从按钮位置扩散 —— 圆外是旧主题的快照。
 * 不支持的话直接不拦，退化成本来的瞬时切换。
 */
function initThemeReveal() {
  const btn = document.getElementById('theme-toggle');
  if (!btn || btn.dataset.revealReady === '1') return;
  btn.dataset.revealReady = '1';
  if (prefersReducedMotion() || typeof document.startViewTransition !== 'function') return;

  const root = document.documentElement;
  // 提前声明过渡形态：只让根元素的快照参与，避免整页元素逐个做交叉淡入
  root.dataset.themeTransition = '1';

  btn.addEventListener(
    'click',
    (e) => {
      // 阻止内联脚本那一次点击直接改主题，改由我们包在过渡里执行
      e.stopImmediatePropagation();
      e.preventDefault();
      const r = btn.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const far = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      root.style.setProperty('--reveal-x', `${x}px`);
      root.style.setProperty('--reveal-y', `${y}px`);
      root.style.setProperty('--reveal-r', `${far}px`);

      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      const apply = () => {
        root.dataset.theme = next;
        try {
          localStorage.setItem('cy-theme', next);
        } catch (err) {
          /* 隐私模式 */
        }
        const label = document.getElementById('theme-label');
        if (label) label.textContent = next === 'dark' ? '日间' : '夜间';
        btn.setAttribute('aria-label', next === 'dark' ? '切换到日间模式' : '切换到夜间模式');
      };

      const vt = document.startViewTransition(apply);
      // 过渡结束后清掉变量，避免影响下一次（比如翻页）的过渡
      vt.finished.finally(() => {
        root.style.removeProperty('--reveal-x');
        root.style.removeProperty('--reveal-y');
        root.style.removeProperty('--reveal-r');
        delete root.dataset.themeTransition;
      });
    },
    { capture: true },
  );
}

/* ------------------------------------------------------------------ */
/* 翻页：视图过渡（标题在两个页面之间连续变形）                        */
/* ------------------------------------------------------------------ */

function tagViewTransitionNames() {
  // 只给「一页里唯一」的元素命名，重复名字会让过渡整段失效
  const h1 = document.querySelector('main h1, .hero__title');
  if (h1) h1.style.setProperty('view-transition-name', 'hero-title');
  const bg = document.querySelector('.hero');
  if (bg) bg.style.setProperty('view-transition-name', 'hero-field');
}

/* ------------------------------------------------------------------ */

function bind() {
  tagViewTransitionNames();
  initScrollDrive();
  initReveal();
  initTocSpy();
  initMasthead();
  initDepthText();
  initDistBars();
  initArchiveRows();
  mountScenes();
}

// ClientRouter 每次换页后重新绑定（模块顶层不会重跑，所以必须挂事件）
document.addEventListener('astro:page-load', bind);
document.addEventListener('astro:before-swap', () => {
  unmountScenes();
  clearScrollDrive();
  revealObserver?.disconnect();
  // 旧的标题节点会被替换，指针监听要跟着解绑
  if (depthState) {
    window.removeEventListener('pointermove', depthState.onMove);
    depthState = null;
  }
});

// 只绑一次的监听：磁力光标、代码复制、打开文章的反馈（都是事件委托，
// 换页后依然有效，所以不放在 bind 里）
initMagnetic();
initCopy();
initThemeReveal();
initOpenPost();

// 首次加载
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bind, { once: true });
} else {
  bind();
}

// 首次加载
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bind, { once: true });
} else {
  bind();
}

// ClientRouter 每次换页后重新绑定（模块顶层不会重跑，所以必须挂事件）
document.addEventListener('astro:page-load', bind);
document.addEventListener('astro:before-swap', () => {
  unmountScenes();
  revealObserver?.disconnect();
});

initMagnetic();
initCopy();
