/**
 * 五场几何戏。
 *
 * 设计前提：站点的视觉语汇是「图纸 / 手稿」—— 发丝描线、等宽元数据、
 * 靛蓝强调色。所以 3D 不能是塑料质感的卡通模型，只能是**线框几何**：
 * 棱边、网格、节点、轨迹。颜色全部来自 CSS 变量，随主题切换。
 *
 * 每场戏都对应它所在页面的**内容**，不是随便放个立方体：
 *   home    → 红黑树    这批文章里算法/数据结构占大头（含一篇红黑树）
 *   archive → 时间线螺旋 15 篇按年份绕成一条上升的螺旋，一年一个环
 *   about   → 开普勒立体 作者是数学/CS 背景，用正多面体嵌套这张「数学名片」
 *   notFound→ 荒原线框   原文案就是「你来到了没有知识的荒原」
 *   post    → 印记       由 slug 定种子的线框印章，与正文形成层次
 */
// 几何构件（依赖 three）来自 engine.js；纯工具来自 util.js
import { wire, dust, gridPlane } from './engine.js';
import { seeded, easeOut, damp, clamp01 } from './util.js';


/* ============================================================
   1. 首页：红黑树
   一棵能在 3D 里生长的二叉搜索树。节点按深度依次「安装」，
   根节点与一条路径用氧化红标注 —— 正好呼应红黑树这个主题。
   ============================================================ */

export function rbTreeScene({ THREE, scene, colors, reduced, lowPower, seed, host }) {
  const root = new THREE.Group();
  scene.add(root);

  const rnd = seeded(seed);
  const NODE_GEO = new THREE.OctahedronGeometry(0.46, 0);

  /** 树的构造：随机插入，长出一棵不完全平衡的树 —— 平衡的树反而看不出结构。 */
  const nodes = [];
  const build = () => {
    const list = [];
    const insert = (depth, x, z, spread) => {
      if (depth > 3) return;
      list.push({ depth, x, y: 7.4 - depth * 2.9, z, spread });
      const next = spread * 0.6;
      if (depth < 3) {
        if (rnd() > 0.18) insert(depth + 1, x - next, z + (rnd() - 0.5) * next * 0.5, next);
        if (rnd() > 0.18) insert(depth + 1, x + next, z + (rnd() - 0.5) * next * 0.5, next);
      }
    };
    insert(0, 0, 0, 5.0);
    return list;
  };
  const defs = build();

  const edgePositions = [];
  const nodeMats = [];
  const nodeGroups = [];

  // 边：父 → 子，用两点线段连接，逐条生长
  for (const d of defs) {
    const kids = defs.filter((k) => k.depth === d.depth + 1 && Math.abs(k.x - d.x) < d.spread);
    for (const k of kids) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([d.x, d.y, d.z, k.x, k.y, k.z], 3));
      const mat = new THREE.LineBasicMaterial({
        color: colors.line,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      root.add(line);
      edgePositions.push({ line, mat, appear: d.depth * 0.34 + 0.15 });
    }
  }

  // 节点：八面体线框
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
    g.add(oct);
    root.add(g);
    nodeMats.push(mat);
    nodeGroups.push({ g, oct, appear: d.depth * 0.34 + 0.3, spin: (rnd() - 0.5) * 0.6 });
    if (isRoot) {
      // 根节点里再嵌一颗小八面体，强调「起点」
      const inner = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.16, 0)),
        new THREE.LineBasicMaterial({ color: colors.mark, transparent: true, opacity: 0, depthWrite: false }),
      );
      g.add(inner);
      nodeMats.push(inner.material);
    }
  }

  // 竖直轴线：树是「长出来」的，需要一根时间轴
  const axisPts = new Float32Array([0, 8.4, 0, 0, -3.4, 0]);
  const axisGeo = new THREE.BufferGeometry();
  axisGeo.setAttribute('position', new THREE.BufferAttribute(axisPts, 3));
  const axis = new THREE.Line(
    axisGeo,
    new THREE.LineBasicMaterial({ color: colors.faint, transparent: true, opacity: 0.7, depthWrite: false }),
  );
  root.add(axis);

  const motes = dust(lowPower ? 140 : 320, 34, { color: colors.ink, size: 0.11, opacity: 0.4 });
  scene.add(motes);

  /*
    取景：相机在 z=14、fov 38°，页头高度普遍在 420–520px 之间，
    对应的可视半高约 ±4.8 世界单位。树本身从 y=7.4 长到 y=-1.3，
    直接摆会顶到页头上边缘（根节点被切掉）。
    所以整体缩到 0.68 并把树的几何中心挪到视口中心附近。
  */
  /*
    宽屏把树放在右侧（左侧留给标题），窄屏则要收回中间 ——
    手机上行宽只有 390px，树留在 x=6.4 就只剩半个枝干在外面。
  */
  const wide = host.clientWidth >= 900;
  root.position.set(wide ? 6.4 : 0.4, -1.95, 0);
  root.scale.setScalar(wide ? 0.68 : 0.5);
  let grow = 0;

  return {
    update(t, dt, { reduced: isReduced }) {
      if (!isReduced) grow = Math.min(1, grow + dt * 0.55);
      const g = easeOut(grow);
      for (const e of edgePositions) {
        const p = clamp01((g - e.appear) / 0.34);
        e.mat.opacity = p * 0.85;
        e.line.scale.y = Math.max(0.001, p);
        // 从父端长出：缩放原点放到起点
        e.line.geometry.computeBoundingSphere?.();
      }
      for (const n of nodeGroups) {
        const p = clamp01((g - n.appear) / 0.3);
        n.oct.scale.setScalar(Math.max(0.001, easeOut(p)));
        n.oct.rotation.y += n.spin * dt;
        n.oct.rotation.x = Math.sin(t * 0.4 + n.appear * 3) * 0.12;
        n.g.position.y += Math.sin(t * 0.7 + n.appear * 4) * 0.0016;
      }
      for (const m of nodeMats) m.opacity = easeOut(g);
      root.rotation.y = Math.sin(t * 0.12) * 0.22;
    },
    onTheme(c) {
      for (const e of edgePositions) e.mat.color.copy(c.line);
      for (const m of nodeMats) m.color.copy(m.color.getHex() === 0 ? c.accent : m.color);
      motes.material.color.copy(c.ink);
    },
    dispose() {
      NODE_GEO.dispose();
    },
  };
}

/* ============================================================
   2. 归档：时间线螺旋
   15 篇文章 = 15 块「记录牌」沿螺旋上升。同一年的一组半径更小、
   颜色更浅，年份之间的落差就是时间本身。
   ============================================================ */

export function helixScene({ THREE, scene, colors, reduced, lowPower, scroll, seed, host }) {
  const rnd = seeded(seed);
  const group = new THREE.Group();
  group.rotation.x = -0.09;
  scene.add(group);

  const COUNT = 15;
  const plates = [];
  const plateGeo = new THREE.BoxGeometry(2.15, 0.95, 0.06);
  // 只画棱边：实心板会挡住后面的牌
  const plateEdges = new THREE.EdgesGeometry(plateGeo);

  for (let i = 0; i < COUNT; i++) {
    // 半径与纵向步距都按「能塞进 ±4.8 的可视半高」来定，
    // 之前 r=6.2 / 步距 0.78 会把上半段整个顶出画面（只剩底部几张牌）
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

    // 牌的「正反面」用一块极淡的填充区分，让螺旋有体积感
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(2.15, 0.95),
      new THREE.MeshBasicMaterial({
        color: colors.accent,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    plate.add(fill);

    // 每篇一个小小的锚点，落在牌前方
    const anchor = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 8, 8),
      new THREE.MeshBasicMaterial({ color: colors.accent, transparent: true, opacity: 0 }),
    );
    anchor.position.set(0, 0, 0.5);
    plate.add(anchor);

    plates.push({ plate, mat, fill, anchor, baseY: y, phase: rnd() * Math.PI * 2 });
  }

  // 三个年份环：把螺旋圈成「逐年」的结构
  const rings = [];
  for (let k = 0; k < 3; k++) {
    const geo = new THREE.TorusGeometry(4.4 - k * 0.06, 0.01, 5, 96);
    const mat = new THREE.LineBasicMaterial({ color: colors.faint, transparent: true, opacity: 0.35 });
    const ring = new THREE.LineSegments(new THREE.WireframeGeometry(geo), mat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = k * 2.5 + 1.1;
    group.add(ring);
    rings.push(mat);
  }

  const motes = dust(lowPower ? 120 : 260, 30, { color: colors.ink, size: 0.1, opacity: 0.35 });
  scene.add(motes);

  const wide = host.clientWidth >= 700;
  group.position.set(wide ? 1.4 : 0, -2.1, 0);
  group.scale.setScalar(wide ? 0.9 : 0.62);
  let reveal = 0;
  let spin = 0;

  return {
    update(t, dt, { reduced: isReduced }) {
      if (!isReduced) reveal = Math.min(1, reveal + dt * 0.5);
      spin += dt * 0.055;
      // 滚动驱动：往下滚，螺旋转过去看后面的牌
      group.rotation.y = spin + scroll * 1.5;
      for (let i = 0; i < plates.length; i++) {
        const p = plates[i];
        const local = clamp01((reveal - i * 0.045) * 3.4);
        const bob = Math.sin(t * 0.6 + p.phase) * 0.075;
        p.plate.position.y = p.baseY + bob;
        p.mat.opacity = 0.75 * easeOut(local);
        p.fill.opacity = 0.05 * easeOut(local);
        p.anchor.material.opacity = 0.9 * easeOut(local);
        p.anchor.scale.setScalar(1 + Math.sin(t * 2 + p.phase) * 0.25);
      }
      for (let k = 0; k < rings.length; k++) rings[k].opacity = 0.28 * easeOut(clamp01(reveal - k * 0.1));
      motes.rotation.y = t * 0.02;
    },
    onTheme(c) {
      for (let i = 0; i < plates.length; i++) {
        plates[i].mat.color.copy(i > 10 ? c.accent : c.line);
        plates[i].fill.color.copy(c.accent);
        plates[i].anchor.material.color.copy(c.accent);
      }
      for (const r of rings) r.color.copy(c.faint);
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
   正四面体 / 立方体 / 正八面体 / 正十二面体 / 正二十面体 互为内外接，
   每层套一层球壳。开普勒当年就是用这套嵌套解释行星轨道的 ——
   放在「关于我」这一页，代替一切自我介绍式的装饰。
   ============================================================ */

export function keplerScene({ THREE, scene, colors, reduced, lowPower }) {
  const group = new THREE.Group();
  group.rotation.set(0.35, -0.5, 0.1);
  scene.add(group);

  const shells = [];
  /*
    五层全上会糊成一团毛线（正十二面体的棱太多）。
    改成三层：四面体 → 立方体 → 正二十面体，每层之间留出明显的空隙，
    棱的数量从少到多，正好是一个「复杂度递增」的读数。
  */
  const defs = [
    { geo: new THREE.TetrahedronGeometry(1.35), spin: 0.17, r: 1.55 },
    { geo: new THREE.BoxGeometry(2.5, 2.5, 2.5), spin: -0.11, r: 2.75 },
    { geo: new THREE.IcosahedronGeometry(2.15), spin: 0.07, r: 3.5 },
  ];

  for (const d of defs) {
    const g = new THREE.Group();
    const mat = new THREE.LineBasicMaterial({
      color: colors.accent,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const solid = new THREE.LineSegments(new THREE.EdgesGeometry(d.geo), mat);
    g.add(solid);

    // 球壳：只有三条经纬线，避免变成毛线球
    const shellMat = new THREE.LineBasicMaterial({
      color: colors.faint,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    // 经线只给 12 条、纬线 6 条：再多就成毛线球了
    const shell = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.SphereGeometry(d.r, 12, 6)),
      shellMat,
    );
    g.add(shell);
    // 球壳只留赤道与两条经线
    const pos = shell.geometry.attributes.position;
    const keep = [];
    for (let i = 0; i < pos.count; i += 2) {
      const y1 = pos.getY(i);
      const y2 = pos.getY(i + 1);
      const flat = Math.abs(y1) < d.r * 0.03 && Math.abs(y2) < d.r * 0.03;
      const polar = Math.abs(y1) > d.r * 0.35 && Math.abs(y2) > d.r * 0.35;
      if (!flat && !polar) continue;
      keep.push(
        pos.getX(i), pos.getY(i), pos.getZ(i),
        pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1),
      );
    }
    shell.geometry.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));

    group.add(g);
    shells.push({ g, solid, mat, shell, shellMat, spin: d.spin, r: d.r });
  }

  const motes = dust(lowPower ? 110 : 240, 26, { color: colors.ink, size: 0.1, opacity: 0.4 });
  scene.add(motes);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const key = new THREE.PointLight(0xffffff, 1.4, 60);
  key.position.set(6, 8, 10);
  scene.add(key);

  group.position.set(1.6, 0, 0);
  let reveal = 0;

  return {
    update(t, dt, { reduced: isReduced }) {
      if (!isReduced) reveal = Math.min(1, reveal + dt * 0.42);
      for (let i = 0; i < shells.length; i++) {
        const s = shells[i];
        const p = easeOut(clamp01((reveal - i * 0.13) / 0.5));
        s.g.rotation.y += s.spin * dt;
        s.g.rotation.x = Math.sin(t * 0.16 + i) * 0.14;
        s.solid.scale.setScalar(0.55 + p * 0.45);
        s.mat.opacity = 0.62 * p;
        s.shellMat.opacity = 0.22 * p;
      }
      group.rotation.y = Math.sin(t * 0.08) * 0.34 - 0.4;
      key.position.x = Math.sin(t * 0.3) * 7;
      key.position.z = Math.cos(t * 0.3) * 7;
      motes.rotation.y = -t * 0.015;
    },
    onTheme(c) {
      for (let i = 0; i < shells.length; i++) {
        shells[i].mat.color.copy(i === shells.length - 1 ? c.accent : c.accent);
        shells[i].shellMat.color.copy(c.faint);
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
   低多边形线框地平线，顶点按确定性噪声起伏，远处有雾。
   镜头缓慢前进 —— 走在一片没有路的荒原上。
   ============================================================ */

export function wastelandScene({ THREE, scene, colors, camera, reduced, lowPower }) {
  const rnd = seeded('wasteland');
  const SIZE = 150;
  const SEG = 46;

  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  // 用几个错开的正弦叠出「地形感」，比纯随机更像地貌而非噪点
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

  // 雾：让地平线隐入纸面，而不是硬切一条边
  scene.fog = new THREE.Fog(colors.ink.clone().setHSL(0, 0, 0.5), 26, 96);

  // 悬浮的碎片：荒原上仅剩的人造物
  const shards = [];
  const shardGeos = [
    new THREE.TetrahedronGeometry(0.5),
    new THREE.BoxGeometry(0.55, 0.55, 0.55),
    new THREE.OctahedronGeometry(0.42),
  ];
  for (let i = 0; i < (lowPower ? 6 : 12); i++) {
    const g = new THREE.Group();
    const base = shardGeos[Math.floor(rnd() * shardGeos.length)];
    const mat = new THREE.LineBasicMaterial({
      color: colors.accent,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
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

  let travel = 0;

  return {
    update(t, dt, { reduced: isReduced }) {
      if (!isReduced) travel += dt * 1.15;
      camera.position.set(0, 7.4 + Math.sin(t * 0.24) * 0.5, 30);
      camera.lookAt(0, 1.5, -6);
      camera.rotation.z = Math.sin(t * 0.31) * 0.012;
      // 地形向镜头推进后回卷，形成无限前进
      terrain.position.z = (travel % 8) - 4;
      for (const s of shards) {
        s.g.position.y = s.baseY + Math.sin(t * 0.5 + s.phase) * 0.55;
        s.g.rotation.x += dt * 0.12;
        s.g.rotation.y += dt * 0.18;
      }
      motes.rotation.y = t * 0.01;
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
   小画布里的线框印章。形状由 slug 决定 —— 同一篇文章永远是同一个印记，
   不同文章长得不一样（红黑树圆、设计模式方、题解三角）。
   ============================================================ */

export function sealScene({ THREE, scene, camera, colors, seed }) {
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

  // 一圈刻度：像印章边缘的齿
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
    ticks.push(m);
  }

  camera.position.set(0, 0, 9.2);

  return {
    update(t, dt, { reduced: isReduced }) {
      if (!isReduced) {
        group.rotation.y += dt * 0.42;
        group.rotation.x += dt * 0.19;
      } else {
        group.rotation.set(0.5, 0.7, 0);
      }
      inner.rotation.y -= dt * 0.7;
      outer.rotation.z += dt * 0.06;
      const s = 1 + Math.sin(t * 0.9) * 0.015;
      group.scale.setScalar(s);
    },
    onTheme(c) {
      outer.material.color.copy(c.line);
      inner.material.color.copy(c.accent);
      for (let i = 0; i < ticks.length; i++) ticks[i].color.copy(i % 6 === 0 ? c.mark : c.faint);
    },
    dispose() {
      accentGeo.dispose();
    },
  };
}

/* ============================================================
   6. 归档 / 标签页：标签球
   17 个标签分布在一个球面上，用发光点表示，连线按「是否共现」连 ——
   球体缓慢自转，指针划过时整体倾斜（JIEJOE 那种磁力手感）。
   ============================================================ */

export function tagSphereScene({ THREE, scene, colors, lowPower, pointer, host }) {
  const group = new THREE.Group();
  scene.add(group);

  const COUNT = 17;
  const pts = [];
  // 斐波那契球面：均匀分布，比 rand 出来的点好看得多
  for (let i = 0; i < COUNT; i++) {
    const y = 1 - (i / (COUNT - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = i * 2.399963;
    pts.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r).multiplyScalar(7.2));
  }

  const nodeMat = new THREE.MeshBasicMaterial({ color: colors.accent, transparent: true, opacity: 0.9 });
  const nodeGeo = new THREE.SphereGeometry(0.09, 10, 10);
  const nodes = pts.map((p) => {
    const m = new THREE.Mesh(nodeGeo, nodeMat.clone());
    m.position.copy(p);
    group.add(m);
    return m;
  });

  // 连线：近邻相连，形成一张网而不是一坨
  const segs = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (pts[i].distanceTo(pts[j]) < 6.2) segs.push(pts[i], pts[j]);
    }
  }
  const lineGeo = new THREE.BufferGeometry().setFromPoints(segs);
  const netMat = new THREE.LineBasicMaterial({
    color: colors.line,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
  group.add(new THREE.LineSegments(lineGeo, netMat));

  // 一层极淡的球壳，交代「这是一颗球」：经线 10 / 纬线 5 就够，
  // 再密就变成一张盖住节点的网（首页那张 700px 宽的画布尤其明显）
  const shellGeo = new THREE.SphereGeometry(7.2, 10, 5);
  const shellMat = new THREE.LineBasicMaterial({ color: colors.faint, transparent: true, opacity: 0.09, depthWrite: false });
  group.add(new THREE.LineSegments(new THREE.WireframeGeometry(shellGeo), shellMat));

  const motes = dust(lowPower ? 90 : 200, 34, { color: colors.ink, size: 0.1, opacity: 0.32 });
  scene.add(motes);

  // 宽容器时靠右（左边留文字），窄容器居中
  group.position.set(host.clientWidth >= 700 ? 5.5 : 0, 0, 0);

  return {
    update(t, dt, { reduced: isReduced }) {
      if (!isReduced) group.rotation.y += dt * 0.09;
      // 指针磁力：球整体朝光标方向偏
      group.rotation.x = damp(group.rotation.x, pointer.y * 0.32, 2.4, dt);
      const tilt = damp(group.rotation.z, -pointer.x * 0.18, 2.4, dt);
      group.rotation.z = tilt;
      for (let i = 0; i < nodes.length; i++) {
        nodes[i].scale.setScalar(1 + Math.sin(t * 1.6 + i * 0.7) * 0.28);
      }
      motes.rotation.y = -t * 0.02;
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
