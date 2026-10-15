const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

// A spatial ordering keeps neighbouring characters together during a reform.
const spatialKey = ({ x, y }) => {
  x = Math.max(0, Math.min(255, Math.round(x)));
  y = Math.max(0, Math.min(255, Math.round(y * 2)));
  let key = 0;
  for (let bit = 0; bit < 8; bit++) key |= ((x >> bit & 1) << bit * 2) | ((y >> bit & 1) << (bit * 2 + 1));
  return key;
};

export class ParticleMotion {
  constructor(frame, cols, rows) {
    this.cols = cols; this.rows = rows;
    this.grid = Array.from({ length: cols * rows }, (_, id) => this.cell(id));
    this.items = this.grid;
    this.sync(frame, true);
  }

  cell(id) {
    return { id, x: id % this.cols, y: Math.floor(id / this.cols),
      tx: id % this.cols, ty: Math.floor(id / this.cols), vx: 0, vy: 0,
      glyph: ' ', targetGlyph: ' ', glyphMix: 1, opacity: 0, targetOpacity: 0 };
  }

  sync(frame, instant = false) {
    const glyphs = frame.replaceAll('\n', '');
    for (let id = 0; id < this.grid.length; id++) {
      const p = this.grid[id], glyph = glyphs[id] || ' ';
      p.targetOpacity = glyph === ' ' ? 0 : 1;
      if (glyph !== ' ') {
        p.glyph = p.targetGlyph = glyph; p.glyphMix = 1;
        if (p.opacity < .001) { p.x = p.tx; p.y = p.ty; p.vx = p.vy = 0; }
      }
      if (instant) p.opacity = p.targetOpacity;
    }
  }

  reform(frame) {
    // Compute spatial keys once per particle, rather than inside every sort
    // comparison on the first frame of a switch.
    const source = this.items.filter(p => p.opacity > .001)
      .map(p => ({ particle: p, key: spatialKey(p) }))
      .sort((a, b) => a.key - b.key).map(item => item.particle);
    const targets = [];
    frame.replaceAll('\n', '').split('').forEach((glyph, id) => {
      if (glyph !== ' ') {
        const target = { id, x: id % this.cols, y: Math.floor(id / this.cols), glyph };
        target.key = spatialKey(target); targets.push(target);
      }
    });
    targets.sort((a, b) => a.key - b.key);
    if (!targets.length) {
      this.items = source.map(p => ({ ...p, id: -1, targetOpacity: 0 }));
      return;
    }
    const usedSources = new Set(), usedTargets = new Set();
    const count = Math.max(source.length, targets.length);
    this.items = Array.from({ length: count }, (_, i) => {
      const s = Math.floor(i * source.length / count), t = Math.floor(i * targets.length / count);
      const target = targets[t];
      const from = source[s] || this.cell(target.id);
      const uniqueSource = !usedSources.has(s), uniqueTarget = !usedTargets.has(t);
      usedSources.add(s); usedTargets.add(t);
      return { ...from, id: uniqueTarget ? target.id : -1,
        tx: target.x, ty: target.y,
        opacity: uniqueSource ? from.opacity : 0, targetOpacity: uniqueTarget ? 1 : 0,
        glyph: from.glyphMix > .5 ? from.targetGlyph : from.glyph,
        targetGlyph: target.glyph, glyphMix: 0 };
    });
  }

  step(delta, cursor, reforming = false, progress = 1, bounds = null) {
    const steps = Math.max(1, Math.ceil(delta * 120)), dt = delta / steps;
    const stiffness = reforming ? 140 : 22, damping = reforming ? 20 : 8.8;
    for (const p of this.items) {
      if (p.opacity < .001 && !p.targetOpacity) continue;
      p.opacity += (p.targetOpacity - p.opacity) * (1 - Math.exp(-14 * delta));
      if (reforming) p.glyphMix = smooth(progress);
      for (let i = 0; i < steps; i++) {
        let fx = 0, fy = 0;
        if (cursor?.strength > .001) {
          const dx = p.x - cursor.x, dy = (p.y - cursor.y) * 2;
          const distance = Math.hypot(dx, dy);
          if (distance < 14) {
            const room = bounds ? Math.min(p.x - bounds.x0, bounds.x1 - p.x, (p.y - bounds.y0) * 2, (bounds.y1 - p.y) * 2) : 6;
            const edge = Math.max(0, Math.min(1, room / 6));
            const force = (1 - distance / 14) ** 2 * 1000 * cursor.strength * edge;
            const angle = distance < .01 ? (p.id + 1) * 2.39996 : Math.atan2(dy, dx);
            fx = Math.cos(angle) * force; fy = Math.sin(angle) * force / 2;
          }
        }
        p.vx = (p.vx + ((p.tx - p.x) * stiffness + fx) * dt) * Math.exp(-damping * dt);
        p.vy = (p.vy + ((p.ty - p.y) * stiffness + fy) * dt) * Math.exp(-damping * dt);
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (bounds) {
          if (p.x < bounds.x0 || p.x > bounds.x1) { p.x = Math.max(bounds.x0, Math.min(bounds.x1, p.x)); p.vx *= -.12; }
          if (p.y < bounds.y0 || p.y > bounds.y1) { p.y = Math.max(bounds.y0, Math.min(bounds.y1, p.y)); p.vy *= -.12; }
        }
      }
    }
  }

  finish() {
    this.grid = Array.from({ length: this.cols * this.rows }, (_, id) => this.cell(id));
    for (const p of this.items) {
      if (p.id < 0 || !p.targetOpacity) continue;
      p.glyph = p.targetGlyph; p.glyphMix = 1;
      this.grid[p.id] = p;
    }
    this.items = this.grid;
  }

  get particles() { return this.items.filter(p => p.opacity > .001 || p.targetOpacity); }
}
