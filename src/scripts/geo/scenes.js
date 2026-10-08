/**
 * 六场几何戏。
 *
 * 设计前提 1：站点的视觉语汇是「图纸 / 手稿」—— 发丝描线、等宽元数据、
 * 靛蓝强调色。所以 3D 只能是**线框几何**：棱边、网格、节点、轨迹。
 *
 * 设计前提 2（这一版的核心）：几何体由**人的动作**驱动，不是自己匀速转。
 * 每场戏都从 input 里取量：
 *   input.scroll   0→1，容器在视口里的推进度 —— 主时间轴
 *   input.travel   随滚动累积的世界位移，滚动多少走多少
 *   input.px/py    指针位置，用于牵引与视差
 *   input.pvx/pvy  指针速度，用于「甩动」类的惯性
 *   input.impulse  点击冲量，按下立刻置位后衰减
 *   input.activity 活跃度：有人在操作时升到 1，静置后回落到 0；
 *                  几何体的「自主呼吸」幅度乘以它，所以静止时几乎不动，
 *                  一旦开始滚动/移动指针，整场戏就醒过来。
 *
 * 每场戏对应的内容：
 *   home    → 红黑树    这批文章里算法/数据结构占大头（含一篇红黑树）
 *   archive → 时间线螺旋 15 篇按年份绕成一条上升的螺旋
 *   about   → 开普勒立体 正多面体嵌套，这张「数学名片」
 *   notFound→ 荒原线框   原文案就是「你来到了没有知识的荒原」
 *   post    → 印记       由 slug 定种子的线框印章
 *   tags    → 标签球     17 个标签的共现网络
 */
import { wire, dust, gridPlane } from './engine.js';
import { seeded, easeOut, easeInOut, damp, clamp01 } from './util.js';

/* 阻尼跟随：交互量的平滑收敛，避免几何体跟着事件一跳一跳 */
const follow = (cur, target, lambda, dt) => damp(cur, target, lambda, dt);

/* ============================================================
   1. 首页：红黑树
   滚动即生长：往下滚，树从根节点逐层「安装」出来；往前滚，它缩回去。
   指针牵引整棵树的倾角，点击给一次贯穿全树的自检脉冲。
   ============================================================ */

export function rbTreeScene({ THREE, scene, colors, reduced, lowPower, seed, host, input, viewScale = 1 }) {
  const root = new THREE.Group();
  scene.add(root);

  const rnd = seeded(seed);
  /*
    节点按深度分级：根节点最大、越深越小。尺寸本身在讲层级，
    也让最下面那层不会因为数量多而糊成一片。
  */
  const NODE_SIZE = [1.5, 1.05, 0.78, 0.6];
  const NODE_GEO = new THREE.OctahedronGeometry(0.42, 0);

  /*
    树形：真正的二叉分支，而不是「每层等距排列」。
    横轴按 2^depth 的网格铺开（每层间距减半），所以最下一层能横跨
    整个视口宽度 —— 整屏开场就是靠这一层把画面撑满的。
    纵向步距 2.6、四层，跨度约 8 个世界单位，正好覆盖整屏可视区。
  */
  const defs = [];
  const LEVELS = 4;
  // 取景分档：整屏宽屏 / 整屏窄屏 / 普通页头宽屏 / 普通页头窄屏
  const wide = host.clientWidth >= 900;
  const nk = wide ? 'wide' : 'narrow';
  const build = () => {
    const insert = (depth, x, z, span) => {
      defs.push({ depth, x, y: 4.9 - depth * 2.35, z, span });
      if (depth + 1 >= LEVELS) return;
      /*
        子节点偏移 = span/4，下一层的 span = span/2 —— 两者是同一个比例，
        所以第 k 层最外侧节点落在 ±span0/4 × (1 + 1/2 + 1/4 + …) ≈ ±span0/2。
        早先写成「偏移 span/2、下一层 span/2」，宽度每层不收敛，
        最外侧会跑到 ±span0，整棵树横跨屏幕两倍宽（实测 ±11.9 世界单位）。
      */
      const half = span / 4;
      const next = span / 2;
      // 每侧都有小概率缺枝：完全不缺就是一棵完美平衡树，反而不像数据结构
      if (rnd() > 0.12) insert(depth + 1, x - half, z + (rnd() - 0.5) * half * 0.5, next);
      if (rnd() > 0.12) insert(depth + 1, x + half, z + (rnd() - 0.5) * half * 0.5, next);
    };
    /*
      span 是这一层「子节点的展开宽度」。递归衰减后最外侧节点落在 ±span/2：
      span=13.6 → ±6.8 世界单位，而 1440×900 下的可视半宽约 7.7，
      所以最外层留在画面内，只让枝尖轻轻碰到边缘。
    */
    // 窄屏的可视半宽只有 ±2.6（390×844，aspect 0.46），跨度必须单独收窄
    insert(0, 0, 0, nk === 'narrow' ? 5.4 : 13.6);
  };
  build();

  const edges = [];
  const nodes = [];
  const nodeMats = [];
  let rootNode = null;

  for (const d of defs) {
    // 子节点 = 下一层里横向距离约等于 span/4 的那些（二叉分支的父子关系）
    const offset = d.span / 4;
    const kids = defs.filter(
      (k) => k.depth === d.depth + 1 && Math.abs(Math.abs(k.x - d.x) - offset) < offset * 0.5,
    );
    for (const k of kids) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([d.x, d.y, d.z, k.x, k.y, k.z], 3));
      const mat = new THREE.LineBasicMaterial({ color: colors.line, transparent: true, opacity: 0, depthWrite: false });
      const line = new THREE.Line(geo, mat);
      root.add(line);
      edges.push({ line, mat, appear: 0.04 + d.depth * 0.17, depth: d.depth });
    }
  }

  for (const d of defs) {
    const g = new THREE.Group();
    g.position.set(d.x, d.y, d.z);
    const isRoot = d.depth === 0;
    const mat = new THREE.LineBasicMaterial({
      color: isRoot ? colors.mark : colors.accent,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const oct = new THREE.LineSegments(new THREE.EdgesGeometry(NODE_GEO), mat);
    oct.scale.setScalar(0.001);
    const size = NODE_SIZE[d.depth] ?? 0.6;
    g.add(oct);
    root.add(g);
    nodeMats.push(mat);
    const node = {
      g, oct, mat, depth: d.depth, size,
      appear: 0.06 + d.depth * 0.17,
      spin: (rnd() - 0.5) * 0.5,
      // 点击脉冲会沿着深度依次点亮节点：delay 让波峰从根传到叶
      wave: 0,
      waveDelay: d.depth * 0.12,
      base: d.x,
    };
    nodes.push(node);
    if (isRoot) rootNode = node;
  }

  // 竖直轴线：树是「长出来」的，需要一根时间轴
  const axisGeo = new THREE.BufferGeometry();
  axisGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 6.0, 0, 0, -2.9, 0], 3));
  const axisMat = new THREE.LineBasicMaterial({ color: colors.faint, transparent: true, opacity: 0.24, depthWrite: false });
  root.add(new THREE.Line(axisGeo, axisMat));

  // 深度刻度：每层一道短横线，滚动时依次亮起，像树的「生长高度」
  const ticks = [];
  for (let d = 0; d < LEVELS; d++) {
    const y = 4.9 - d * 2.35;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.35, y, 0, 0.35, y, 0], 3));
    const m = new THREE.LineBasicMaterial({ color: colors.accent, transparent: true, opacity: 0, depthWrite: false });
    root.add(new THREE.Line(g, m));
    ticks.push({ m, at: d * 0.2 });
  }

  const motes = dust(lowPower ? 140 : 320, 34, { color: colors.ink, size: 0.11, opacity: 0.4 });
  scene.add(motes);

  /*
    取景：可视半高 = tan(fov/2) × 相机距离 = tan(19°) × 14 ≈ 4.82 世界单位。
    树的纵向跨度约 8.0（y=5.2 → y=-2.6），横向最下一层铺到 ±8.6。

    整屏开场（viewScale ≥ 1.4）：左右都不留余量，最外层枝叶溢出画布，
      纵向略微上移，让根节点靠近屏幕上方、叶层压到标题区。
    普通页头（viewScale ≈ 1.1）：树收在右侧，左侧留给文字。
    窄屏：收回中间并等比缩小。
  */
  const full = viewScale >= 1.35;
  if (full && !wide) {
    /*
      整屏 + 窄屏：可视半宽只有 ±2.6、半高 4.82 × (844/900 比例下仍约 4.8)。
      所以树要缩到 0.5 上下并整体上移，把叶子留在标题上方。
    */
    root.position.set(0, 1.0, 0);
    root.scale.setScalar(0.5 * viewScale);
  } else if (full && wide) {
    /*
      纵向对齐：视口可视半高 4.82，树顶在 4.9、树底在 -2.15（局部坐标）。
      缩放 1.05 后要把「树顶」压到 4.3 以内才会完整落在屏内，
      所以基准位取 -0.85 —— 根节点贴着页头上沿，叶层压到标题区上方。
    */
    root.position.set(0, -0.85, 0);
    root.scale.setScalar(0.68 * viewScale);
  } else if (wide) {
    root.position.set(7.2 * viewScale, -2.6 * viewScale, 0);
    root.scale.setScalar(0.92 * viewScale);
  } else {
    root.position.set(0, 1.15 * viewScale, 0);
    root.scale.setScalar(0.4 * viewScale);
  }
  // 记下基准位，滚动时在基准附近漂移（见 update）
  const basePos = root.position.clone();
  const baseScale = root.scale.x;

  /* 状态：全部由 input 推导 */
  let grow = 0;        // 实际生长度
  let sway = 0;        // 指针牵引的倾角
  let impulseSeen = 0; // 上一次读到的冲量，用来检测「新的一次点击」
  const waves = [];    // 正在扩散的自检波

  return {
    update(t, dt, { reduced: isReduced }) {
      const act = input.activity;

      /*
        生长：滚动是第一驱动。scroll 0→1 对应 0→1.15 的生长度，
        再叠一点「刚进视口时先长 12%」的初始态（否则页头刚出现是一棵空轴）。
        静置时只留极小呼吸，避免喧宾夺主。
      */
      const driven = clamp01(input.scroll * 1.15 + 0.12);
      const idle = isReduced ? 0 : Math.sin(t * 0.35) * 0.012 * (1 - act);
      grow = follow(grow, clamp01(driven + idle), 7, dt);

      const g = easeOut(grow);

      for (const e of edges) {
        const p = clamp01((g - e.appear) / 0.3);
        e.mat.opacity = p * 0.85;
        // 从父端长出：以起点为缩放原点
        e.line.scale.y = Math.max(0.001, p);
      }

      /*
        滚动漂移：整屏开场里，树随着滚动放大并轻微下沉 ——
        于是它不是「页头那张图」，而是会跟着视线长进正文里的东西。
      */
      if (full) {
        const drift = easeInOut(clamp01(input.scroll * 1.35));
        // 漂移同时下沉与放大：树「朝观者压过来」一点，然后随页头一起离开
        root.position.set(basePos.x, basePos.y + drift * 0.9, basePos.z);
        root.scale.setScalar(baseScale * (1 + drift * 0.14));
      }

      /* 指针牵引：整棵树朝光标方向倾一点，滚动时幅度更大 */
      const lean = 0.16 + act * 0.1;
      sway = follow(sway, input.px * lean, 3.2, dt);
      root.rotation.y = sway;
      root.rotation.x = follow(root.rotation.x, -input.py * 0.1, 3.2, dt);
      root.rotation.z = follow(root.rotation.z, -input.px * 0.045, 3.2, dt);

      /* 点击：新增一道自检波，沿深度向下扫过节点 */
      if (input.impulse > impulseSeen + 0.15) waves.push({ t: 0, power: input.impulse });
      impulseSeen = input.impulse;
      for (let i = waves.length - 1; i >= 0; i--) {
        waves[i].t += dt;
        if (waves[i].t > 1.6) waves.splice(i, 1);
      }

      for (const n of nodes) {
        const p = clamp01((g - n.appear) / 0.3);
        n.oct.scale.setScalar(Math.max(0.001, easeOut(p) * n.size));
        // 节点自转：静止几乎不转，活跃时明显
        n.oct.rotation.y += n.spin * dt * (0.18 + act * 1.6);
        n.oct.rotation.x = Math.sin(t * 0.4 + n.appear * 3) * (0.04 + act * 0.12);

        /* 点击波：节点被扫过时膨胀一下，颜色也短暂偏向强调/警示 */
        let pulse = 0;
        for (const w of waves) {
          const local = w.t - n.waveDelay;
          if (local > 0 && local < 0.5) pulse = Math.max(pulse, Math.sin((local / 0.5) * Math.PI) * w.power);
        }
        n.oct.scale.multiplyScalar(1 + pulse * 0.5);
        n.mat.opacity = easeOut(g) * (0.85 + pulse * 0.15);
        n.g.position.x = n.base + Math.sin(t * 0.7 + n.appear * 4) * 0.02 * (0.3 + act);
      }

      for (const m of nodeMats) m.opacity = easeOut(g);
      for (const tk of ticks) {
        const p = clamp01((g - tk.at) / 0.2);
        tk.m.opacity = p * 0.5;
      }

      /* 尘埃随滚动缓慢上移，制造「在往下走」的错觉 */
      motes.position.y = (input.travel * 0.06) % 2 - 1;
      motes.rotation.y = input.px * 0.15 + input.scroll * 0.6;
    },
    onTheme(c) {
      for (const e of edges) e.mat.color.copy(c.line);
      for (const n of nodes) n.mat.color.copy(n.depth === 0 ? c.mark : c.accent);
      axisMat.color.copy(c.faint);
      for (const tk of ticks) tk.m.color.copy(c.accent);
      motes.material.color.copy(c.ink);
    },
    dispose() {
      NODE_GEO.dispose();
    },
  };
}

/* ============================================================
   2. 归档：时间线螺旋
   滚动就是它的时间轴：往下滚，螺旋往前转，一块块「记录牌」从背后转到正面。
   停手之后保留一点惯性，像转盘；指针左右移动会加一点侧倾。
   ============================================================ */

export function helixScene({ THREE, scene, colors, reduced, lowPower, seed, host, input, viewScale = 1 }) {
  const rnd = seeded(seed);
  const group = new THREE.Group();
  group.rotation.x = -0.09;
  scene.add(group);

  const COUNT = 15;
  const plates = [];
  const plateGeo = new THREE.BoxGeometry(2.15, 0.95, 0.06);
  const plateEdges = new THREE.EdgesGeometry(plateGeo);

  for (let i = 0; i < COUNT; i++) {
    const a = (i / COUNT) * Math.PI * 2 * 1.45;
    const r = 4.3 - i * 0.04;
    const y = i * 0.36;
    const mat = new THREE.LineBasicMaterial({
      color: i > 10 ? colors.accent : colors.line,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const plate = new THREE.LineSegments(plateEdges, mat);
    plate.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    plate.rotation.y = -a + Math.PI / 2;
    group.add(plate);

    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(2.15, 0.95),
      new THREE.MeshBasicMaterial({ color: colors.accent, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    );
    plate.add(fill);

    const anchor = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 8, 8),
      new THREE.MeshBasicMaterial({ color: colors.accent, transparent: true, opacity: 0 }),
    );
    anchor.position.set(0, 0, 0.5);
    plate.add(anchor);

    plates.push({ plate, mat, fill, anchor, baseY: y, phase: rnd() * Math.PI * 2, spin: 0 });
  }

  const rings = [];
  for (let k = 0; k < 3; k++) {
    const geo = new THREE.TorusGeometry(4.4 - k * 0.06, 0.01, 5, 96);
    const mat = new THREE.LineBasicMaterial({ color: colors.faint, transparent: true, opacity: 0 });
    const ring = new THREE.LineSegments(new THREE.WireframeGeometry(geo), mat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = k * 2.5 + 1.1;
    group.add(ring);
    rings.push({ mat, at: k * 0.22 });
  }

  const motes = dust(lowPower ? 120 : 260, 30, { color: colors.ink, size: 0.1, opacity: 0.35 });
  scene.add(motes);

  /*
    取景：相机 z=14 / fov 38°，可视半高约 ±4.8 世界单位。
    螺旋从 y=0 爬到 y=5.04，加上 -2.1 的位移后上端到 y≈2.94，
    在页头（矮）里合适；但首页那条 26rem 高的舞台更高，
    所以整体再收一档，让 15 张牌完整落在框内而不是顶出去。
  */
  /*
    取景：相机 z=14 / fov 38°，可视半高 ≈ tan(19°)×14 ≈ 4.82 世界单位。
    螺旋纵向跨度约 5.1（15 张牌 × 0.36 步距 + 牌高），所以缩放取 0.78 刚好
    留出余量；整体下移 2.1 让重心落在框中心。首页那条舞台更高，但
    放大到填满反而会把牌推出左右边界，所以两处用同一组参数，靠舞台高度
    自己留白 —— 留白比裁切好。
  */
  const wide = host.clientWidth >= 700;
  const baseScale = (wide ? 0.86 : 0.6) * viewScale;
  // 纵向偏移：螺旋缩放后跨度约 4.0，重心落在视口中心偏下一点
  group.position.set(wide ? 1.4 * viewScale : 0, -1.45, 0);
  group.scale.setScalar(baseScale);

  /* 滚动 → 角度：两个通道叠加。
     直接映射保证「滚多少转多少」，惯性通道负责停手后的余韵。 */
  let angle = 0;       // 直接映射的角度（随滚动）
  let spinVel = 0;     // 惯性角速度
  let reveal = 0;
  let clickSpin = 0;   // 点击附加的一次转动

  return {
    update(t, dt, { reduced: isReduced }) {
      const act = input.activity;

      /* 主驱动：滚动位置决定螺旋的绝对角度 */
      const targetAngle = input.scroll * Math.PI * 2.2;
      angle = follow(angle, targetAngle, 9, dt);

      /* 惯性：滚动增量喂给角速度，停手后自然衰减 —— 转盘手感 */
      spinVel += input.scrollDelta * 26;
      spinVel = damp(spinVel, 0, 2.2, dt);

      /* 点击：给一次额外的转动冲量 */
      if (input.impulse > 0.2) clickSpin += input.impulse * 0.05;
      clickSpin = damp(clickSpin, 0, 3.4, dt);

      /* 静置时的极缓漂移：有人操作时被 activity 压掉 */
      const idleSpin = isReduced ? 0 : t * 0.008 * (1 - act);

      group.rotation.y = angle + spinVel + clickSpin + idleSpin;
      group.rotation.x = follow(group.rotation.x, -0.09 - input.py * 0.06, 3, dt);
      group.rotation.z = follow(group.rotation.z, -input.px * 0.04, 3, dt);

      // 入场揭示同样挂在滚动上
      reveal = follow(reveal, clamp01(0.25 + input.scroll * 1.2), 6, dt);

      for (let i = 0; i < plates.length; i++) {
        const p = plates[i];
        const local = clamp01((reveal - i * 0.045) * 3.4);
        // 牌自身的轻微浮动：静止时几乎停住
        const bob = Math.sin(t * 0.6 + p.phase) * 0.075 * (0.15 + act);
        p.plate.position.y = p.baseY + bob;
        p.mat.opacity = 0.75 * easeOut(local);
        p.fill.opacity = 0.05 * easeOut(local);
        p.anchor.material.opacity = 0.9 * easeOut(local);
        // 锚点的脉动也吃 activity：有人在滚时才跳
        p.anchor.scale.setScalar(1 + Math.sin(t * 2 + p.phase) * 0.25 * (0.2 + act));
      }
      for (let k = 0; k < rings.length; k++) {
        rings[k].mat.opacity = 0.28 * easeOut(clamp01(reveal - rings[k].at));
      }

      motes.rotation.y = input.px * 0.2 + input.scroll * 0.8;
      motes.position.y = (input.travel * 0.05) % 2 - 1;
    },
    onTheme(c) {
      for (let i = 0; i < plates.length; i++) {
        plates[i].mat.color.copy(i > 10 ? c.accent : c.line);
        plates[i].fill.color.copy(c.accent);
        plates[i].anchor.material.color.copy(c.accent);
      }
      for (const r of rings) r.mat.color.copy(c.faint);
      motes.material.color.copy(c.ink);
    },
    dispose() {
      plateGeo.dispose();
      plateEdges.dispose();
    },
  };
}

/* ============================================================
   3. 关于：开普勒立体
   滚动把三层立体「拆开」—— 往下滚，四面体/立方体/二十面体彼此拉开距离，
   露出嵌套关系；往前滚，它们重新咬合。指针让整组缓慢偏转。
   ============================================================ */

export function keplerScene({ THREE, scene, colors, reduced, lowPower, host, input, viewScale = 1 }) {
  const group = new THREE.Group();
  group.rotation.set(0.35, -0.5, 0.1);
  scene.add(group);

  const shells = [];
  /*
    三层：四面体 → 立方体 → 正二十面体。棱数由少到多，
    正好是一条「复杂度递增」的读数；五层全上会糊成一团毛线。
  */
  const defs = [
    { geo: new THREE.TetrahedronGeometry(1.35), spin: 0.17, r: 1.55 },
    { geo: new THREE.BoxGeometry(2.5, 2.5, 2.5), spin: -0.11, r: 2.75 },
    { geo: new THREE.IcosahedronGeometry(2.15), spin: 0.07, r: 3.5 },
  ];

  for (const d of defs) {
    const g = new THREE.Group();
    const mat = new THREE.LineBasicMaterial({ color: colors.accent, transparent: true, opacity: 0, depthWrite: false });
    const solid = new THREE.LineSegments(new THREE.EdgesGeometry(d.geo), mat);
    g.add(solid);

    const shellMat = new THREE.LineBasicMaterial({ color: colors.faint, transparent: true, opacity: 0, depthWrite: false });
    const shell = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(d.r, 12, 6)), shellMat);
    g.add(shell);
    // 球壳只留赤道与两条极区线
    const pos = shell.geometry.attributes.position;
    const keep = [];
    for (let i = 0; i < pos.count; i += 2) {
      const y1 = pos.getY(i);
      const y2 = pos.getY(i + 1);
      const flat = Math.abs(y1) < d.r * 0.03 && Math.abs(y2) < d.r * 0.03;
      const polar = Math.abs(y1) > d.r * 0.35 && Math.abs(y2) > d.r * 0.35;
      if (!flat && !polar) continue;
      keep.push(pos.getX(i), pos.getY(i), pos.getZ(i), pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
    }
    shell.geometry.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));

    group.add(g);
    shells.push({ g, solid, mat, shellMat, spin: d.spin, base: 1 });
  }

  const motes = dust(lowPower ? 110 : 240, 26, { color: colors.ink, size: 0.1, opacity: 0.4 });
  scene.add(motes);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const key = new THREE.PointLight(0xffffff, 1.4, 60);
  key.position.set(6, 8, 10);
  scene.add(key);

  group.position.set(1.9 * viewScale, 0, 0);
  group.scale.setScalar(viewScale);

  let reveal = 0;
  let spread = 0;     // 拆开程度
  let wobble = 0;     // 点击后的抖动

  return {
    update(t, dt, { reduced: isReduced }) {
      const act = input.activity;
      reveal = follow(reveal, clamp01(0.35 + input.scroll * 1.1), 6, dt);
      // 滚动决定「拆开」：0.6 → 1.9 的缩放系数，拆开后三层立体的间距明显拉开
      spread = follow(spread, 0.62 + input.scroll * 1.28, 6, dt);

      /* 点击：一次短促的抖动，三个立体错峰回弹 */
      if (input.impulse > 0.2) wobble = Math.min(1.2, wobble + input.impulse);
      wobble = damp(wobble, 0, 4.5, dt);

      for (let i = 0; i < shells.length; i++) {
        const s = shells[i];
        const p = easeOut(clamp01((reveal - i * 0.13) / 0.5));
        // 自转：静止近乎停住，活跃时明显
        s.g.rotation.y += s.spin * dt * (0.2 + act * 2.2);
        s.g.rotation.x = Math.sin(t * 0.16 + i) * 0.14 * (0.25 + act);
        const scale = spread * (1 + wobble * 0.06 * Math.sin(t * 9 + i * 1.4));
        s.solid.scale.setScalar(scale * (0.55 + p * 0.45));
        s.mat.opacity = 0.62 * p;
        s.shellMat.opacity = 0.22 * p;
      }

      // 整组：指针牵引 + 滚动带来的轻微俯仰
      group.rotation.y = follow(group.rotation.y, -0.4 + input.px * 0.5, 3, dt);
      group.rotation.x = follow(group.rotation.x, 0.35 - input.py * 0.32, 3, dt);
      group.rotation.z = follow(group.rotation.z, 0.1 + input.px * 0.08, 3, dt);

      key.position.x = Math.sin(t * 0.3) * 7;
      key.position.z = Math.cos(t * 0.3) * 7;
      motes.rotation.y = -t * 0.015 * (0.3 + act) + input.px * 0.2;
    },
    onTheme(c) {
      for (const s of shells) {
        s.mat.color.copy(c.accent);
        s.shellMat.color.copy(c.faint);
      }
      motes.material.color.copy(c.ink);
    },
    dispose() {
      for (const d of defs) d.geo.dispose();
    },
  };
}

/* ============================================================
   4. 404：荒原
   滚动就是前进：往下滚，镜头在荒原上向前推进，地形持续向后卷。
   指针左右移动改变行进方向，点击给一次镜头震动。
   ============================================================ */

export function wastelandScene({ THREE, scene, colors, camera, reduced, lowPower, input, viewScale = 1 }) {
  const rnd = seeded('wasteland');
  const SIZE = 150;
  const SEG = 46;

  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  // 几个错开的正弦叠出「地形感」，比纯随机更像地貌而非噪点
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const d = Math.hypot(x, z) / (SIZE / 2);
    const h
      = Math.sin(x * 0.09) * Math.cos(z * 0.11) * 1.9
      + Math.sin(x * 0.023 + 1.7) * 3.1
      + Math.cos(z * 0.031 - 0.6) * 2.4
      + (rnd() - 0.5) * 0.5;
    pos.setY(i, h * d * d);
  }
  geo.computeVertexNormals();

  const terrain = new THREE.LineSegments(
    new THREE.WireframeGeometry(geo),
    new THREE.LineBasicMaterial({ color: colors.line, transparent: true, opacity: 0.42, depthWrite: false }),
  );
  scene.add(terrain);

  scene.fog = new THREE.Fog(colors.ink.clone().setHSL(0, 0, 0.5), 26, 96);

  const shards = [];
  const shardGeos = [
    new THREE.TetrahedronGeometry(0.5),
    new THREE.BoxGeometry(0.55, 0.55, 0.55),
    new THREE.OctahedronGeometry(0.42),
  ];
  for (let i = 0; i < (lowPower ? 6 : 12); i++) {
    const g = new THREE.Group();
    const base = shardGeos[Math.floor(rnd() * shardGeos.length)];
    const mat = new THREE.LineBasicMaterial({ color: colors.accent, transparent: true, opacity: 0.5, depthWrite: false });
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(base), mat));
    const a = rnd() * Math.PI * 2;
    const r = 9 + rnd() * 22;
    g.position.set(Math.cos(a) * r, 3 + rnd() * 9, Math.sin(a) * r - 6);
    scene.add(g);
    shards.push({ g, baseY: g.position.y, phase: rnd() * 6.28, mat });
  }

  const motes = dust(lowPower ? 150 : 380, 60, { color: colors.ink, size: 0.14, opacity: 0.45 });
  motes.position.y = 8;
  scene.add(motes);

  /* 滚动即行走：位置与朝向都从滚动量推出来 */
  let travel = 0;
  let lateral = 0;
  let shake = 0;

  return {
    update(t, dt, { reduced: isReduced }) {
      const act = input.activity;

      // 主驱动：滚动增量直接变成前进距离（滚得越多走得越远，不滚就不走）
      travel += input.scrollDelta * 42;
      // 静置时留一点点自走，让人知道这是可以滚动的活物
      if (!isReduced) travel += dt * 0.5 * (1 - act);

      // 指针控制横向偏移：左右移动指针 = 左右改变行进方向
      lateral = follow(lateral, input.px * 5.5, 2.6, dt);
      // 点击：镜头震一下
      if (input.impulse > 0.2) shake = Math.min(1, shake + input.impulse);
      shake = damp(shake, 0, 6, dt);

      const shakeX = Math.sin(t * 42) * shake * 0.35;
      const shakeY = Math.cos(t * 37) * shake * 0.28;

      camera.position.set(
        lateral + shakeX,
        7.4 + Math.sin(t * 0.24) * 0.4 * (0.4 + act) + input.py * 1.6 + shakeY,
        30 / viewScale,
      );
      // 看向前方偏一点，产生「斜着走」的感觉
      camera.lookAt(lateral * 0.6, 1.5 - input.py * 2.2, -6);
      camera.rotation.z = Math.sin(t * 0.31) * 0.012 * (0.4 + act) + input.px * 0.02;

      // 地形向镜头推进后回卷，形成无限前进
      terrain.position.z = (travel % 8) - 4;

      for (const s of shards) {
        s.g.position.y = s.baseY + Math.sin(t * 0.5 + s.phase) * 0.55 * (0.3 + act);
        // 碎片自转同样吃 activity 与滚动
        s.g.rotation.x += dt * (0.05 + act * 0.25) + input.scrollDelta * 2;
        s.g.rotation.y += dt * (0.08 + act * 0.35);
      }

      motes.rotation.y = t * 0.01 * (0.3 + act) + input.px * 0.25;
      if (scene.fog) scene.fog.near = 26 + Math.sin(t * 0.2) * 2;
    },
    onTheme(c) {
      terrain.material.color.copy(c.line);
      terrain.material.opacity = 0.5;
      for (const s of shards) s.mat.color.copy(c.accent);
      motes.material.color.copy(c.ink);
      if (scene.fog) scene.fog.color.copy(c.ink).setHSL(0, 0, 0.5);
    },
    dispose() {
      geo.dispose();
      for (const g of shardGeos) g.dispose();
    },
  };
}

/* ============================================================
   5. 文章页：印记
   小画布里的线框印章。指针让它转向（像拿在手里看），滚动让它自转，
   点击盖一次「戳」—— 快速下压再回弹。
   ============================================================ */

export function sealScene({ THREE, scene, camera, colors, seed, input, viewScale = 1 }) {
  const group = new THREE.Group();
  scene.add(group);

  const rnd = seeded(seed);
  const accentGeo
    = rnd() > 0.66
      ? new THREE.TorusGeometry(1.5, 0.5, 8, 5)
      : rnd() > 0.33
        ? new THREE.BoxGeometry(2.3, 2.3, 2.3)
        : new THREE.TetrahedronGeometry(1.9);

  const outer = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.5, 0)),
    new THREE.LineBasicMaterial({ color: colors.line, transparent: true, opacity: 0.6, depthWrite: false }),
  );
  group.add(outer);

  const inner = new THREE.LineSegments(
    new THREE.EdgesGeometry(accentGeo),
    new THREE.LineBasicMaterial({ color: colors.accent, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  group.add(inner);

  // 一圈刻度：印章边缘的齿
  const ticks = [];
  const tickCount = 24;
  for (let i = 0; i < tickCount; i++) {
    const a = (i / tickCount) * Math.PI * 2;
    const g = new THREE.BufferGeometry();
    const r1 = 2.75;
    const r2 = i % 6 === 0 ? 3.25 : 3.0;
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([Math.cos(a) * r1, Math.sin(a) * r1, 0, Math.cos(a) * r2, Math.sin(a) * r2, 0], 3),
    );
    const m = new THREE.LineBasicMaterial({
      color: i % 6 === 0 ? colors.mark : colors.faint,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    group.add(new THREE.Line(g, m));
    ticks.push({ m, accent: i % 6 === 0, phase: i * 0.3 });
  }

  camera.position.set(0, 0, 9.2 / viewScale);

  let spin = 0;
  let press = 0;   // 点击的「盖章」下压量
  let seen = 0;

  return {
    update(t, dt, { reduced: isReduced }) {
      const act = input.activity;

      /* 滚动驱动自转：页头离开视口的程度就是它转过的角度 */
      spin = follow(spin, input.scroll * Math.PI * 1.6, 7, dt);

      /* 指针让它像被拿在手里转动 */
      group.rotation.y = spin + input.px * 0.55;
      group.rotation.x = isReduced ? 0.5 : follow(group.rotation.x, 0.28 - input.py * 0.4, 4, dt);
      group.rotation.z = follow(group.rotation.z, -input.px * 0.12, 4, dt);

      /* 点击：下压 → 回弹 */
      if (input.impulse > seen + 0.15) press = Math.min(1, input.impulse);
      seen = input.impulse;
      press = damp(press, 0, 5.5, dt);

      const s = 1 + Math.sin(t * 0.9) * 0.015 * (0.25 + act) - press * 0.16;
      group.scale.setScalar(s);
      // 下压时内层反向转一点，像被拧了一下
      inner.rotation.y -= dt * (0.7 * (0.25 + act) + press * 6);
      outer.rotation.z += dt * 0.06 * (0.25 + act);

      for (const tk of ticks) {
        // 齿的亮度跟着点击波动，像盖章时的机械反馈
        tk.m.opacity = 0.5 + Math.sin(t * 1.4 + tk.phase) * 0.12 * (0.3 + act) + press * (tk.accent ? 0.5 : 0.25);
      }
    },
    onTheme(c) {
      outer.material.color.copy(c.line);
      inner.material.color.copy(c.accent);
      for (const tk of ticks) tk.m.color.copy(tk.accent ? c.mark : c.faint);
    },
    dispose() {
      accentGeo.dispose();
    },
  };
}

/* ============================================================
   6. 标签球
   指针牵引整颗球（磁力手感），滚动让它自转，点击让节点集体亮一下。
   ============================================================ */

export function tagSphereScene({ THREE, scene, colors, lowPower, host, input, viewScale = 1 }) {
  const group = new THREE.Group();
  scene.add(group);

  const COUNT = 17;
  const pts = [];
  // 斐波那契球面：均匀分布，比随机点好看得多
  for (let i = 0; i < COUNT; i++) {
    const y = 1 - (i / (COUNT - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = i * 2.399963;
    pts.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r).multiplyScalar(7.2));
  }

  const nodeGeo = new THREE.SphereGeometry(0.17, 10, 10);
  const nodes = pts.map((p) => {
    const m = new THREE.Mesh(nodeGeo, new THREE.MeshBasicMaterial({ color: colors.accent, transparent: true, opacity: 0.9 }));
    m.position.copy(p);
    group.add(m);
    return m;
  });

  // 近邻相连：形成一张网而不是一坨
  const segs = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (pts[i].distanceTo(pts[j]) < 6.2) segs.push(pts[i], pts[j]);
    }
  }
  const lineGeo = new THREE.BufferGeometry().setFromPoints(segs);
  const netMat = new THREE.LineBasicMaterial({ color: colors.line, transparent: true, opacity: 0.42, depthWrite: false });
  group.add(new THREE.LineSegments(lineGeo, netMat));

  // 极淡的球壳：经线 10 / 纬线 5 就够，再密就变成一张盖住节点的网
  const shellGeo = new THREE.SphereGeometry(7.2, 10, 5);
  const shellMat = new THREE.LineBasicMaterial({ color: colors.faint, transparent: true, opacity: 0.13, depthWrite: false });
  group.add(new THREE.LineSegments(new THREE.WireframeGeometry(shellGeo), shellMat));

  const motes = dust(lowPower ? 90 : 200, 34, { color: colors.ink, size: 0.1, opacity: 0.32 });
  scene.add(motes);

  /*
    取景：球半径 7.2。可视半高 4.82、半宽 = 4.82 × aspect。
    舞台的 aspect 通常只有 1.3–1.9，半宽 6.3–9.2 —— 球本身就比框宽，
    所以必须把「右侧偏移」按 aspect 收，否则球心一偏就整团出框。
    向右偏移量取 min(2.4, 半宽 - 3.2)，保证球心到右边缘至少留 3.2 个单位的球面。
  */
  /*
    取景：球半径 7.2，直径 14.4。可视半高 4.82、半宽 4.82 × aspect；
    舞台 aspect 常见 1.3–2.0 → 半宽 6.3–9.6。球比框大，所以：
      · 缩放取「能塞进高度」的比例：4.82 × 2 / 14.4 ≈ 0.67，再乘一点余量；
      · 缩放上限同时受宽度约束，避免宽舞台把球放得横向出框；
      · 球心居中（不再向右偏移）—— 之前偏移 2.4 个单位，球右半边整块被裁掉。
  */
  const vw = host.clientWidth || 800;
  const vh = host.clientHeight || 400;
  const aspect = Math.max(vw / vh, 0.5);
  const half = 4.82;
  const fit = Math.min((half * 2) / 14.4, (half * aspect * 2) / 14.4) * 1.06;
  group.scale.setScalar(Math.min(viewScale, fit));
  group.position.set(0, 0, 0);

  let spin = 0;
  let pop = 0;

  return {
    update(t, dt, { reduced: isReduced }) {
      const act = input.activity;

      // 滚动驱动自转（容器滚过视口 = 球转过约一圈）
      spin = follow(spin, input.scroll * Math.PI * 2, 7, dt);
      group.rotation.y = spin;

      /* 磁力：指针把球拽向光标方向；指针一动，惯性让它多甩一点 */
      group.rotation.x = follow(group.rotation.x, input.py * 0.34 + input.pvy * 0.02, 2.6, dt);
      const rz = -input.px * 0.2 - input.pvx * 0.015;
      group.rotation.z = follow(group.rotation.z, rz, 2.6, dt);

      /* 点击：节点集体涨一下，然后回落 */
      if (input.impulse > 0.2) pop = Math.min(1, pop + input.impulse);
      pop = damp(pop, 0, 4, dt);

      for (let i = 0; i < nodes.length; i++) {
        // 静止时几乎不跳动，交互时明显
        const breathe = 1 + Math.sin(t * 1.6 + i * 0.7) * 0.28 * (0.15 + act);
        nodes[i].scale.setScalar(breathe * (1 + pop * 0.5));
      }

      motes.rotation.y = -input.scroll * 0.4 + input.px * 0.2;
    },
    onTheme(c) {
      for (const n of nodes) n.material.color.copy(c.accent);
      netMat.color.copy(c.line);
      shellMat.color.copy(c.faint);
      motes.material.color.copy(c.ink);
    },
    dispose() {
      nodeGeo.dispose();
      shellGeo.dispose();
    },
  };
}
