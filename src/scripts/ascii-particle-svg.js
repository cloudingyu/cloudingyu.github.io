import { ASCII_LIGHT_RAMP } from '../data/ascii-pieces.mjs';
import { createTextMask } from './ascii-text-mask.js';

const NS = 'http://www.w3.org/2000/svg';
let nextMaskId = 0;
const create = name => document.createElementNS(NS, name);
const set = (node, key, value) => {
  const text = String(value);
  if (node.getAttribute(key) !== text) node.setAttribute(key, text);
};
const decimal = value => Math.round(value * 100) / 100;

export function createParticleSvg(art, cols, rows) {
  const host = art.closest('[data-ascii-stage]');
  const hero = host.closest('[data-exp-hero]');
  const svg = create('svg');
  svg.classList.add('ascii-stage__svg');
  svg.setAttribute('xmlns', NS);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const defs = create('defs'), maskNode = create('mask');
  const maskId = `ascii-reading-mask-${++nextMaskId}`;
  maskNode.id = maskId;
  maskNode.setAttribute('maskUnits', 'userSpaceOnUse');
  maskNode.setAttribute('maskContentUnits', 'userSpaceOnUse');
  const visible = create('rect');
  visible.setAttribute('fill', 'white');
  maskNode.append(visible); defs.append(maskNode);
  const ink = create('g');
  ink.setAttribute('mask', `url(#${maskId})`);
  ink.setAttribute('text-anchor', 'middle');
  ink.setAttribute('dominant-baseline', 'central');
  svg.append(defs, ink); art.parentElement.append(svg);

  const slots = new Map(), cutouts = [], colors = new Map();
  const padding = { x: 10, y: 5 };
  let dirty = true, lastDraw = null, cellWidth = 0, cellHeight = 0;
  let palette = [];
  const mask = createTextMask(hero, hero.querySelector('[data-morph]'), () => {
    if (lastDraw) draw(lastDraw);
  });

  const shade = glyph => {
    if (colors.has(glyph)) return colors.get(glyph);
    const value = Math.max(0, ASCII_LIGHT_RAMP.indexOf(glyph)) / (ASCII_LIGHT_RAMP.length - 1);
    const t = Math.pow(value, .8) * 2;
    const i = Math.min(1, Math.floor(t)), weight = t - i;
    const color = `rgb(${palette[i].map((channel, c) => Math.round(channel + (palette[i + 1][c] - channel) * weight)).join(',')})`;
    colors.set(glyph, color);
    return color;
  };

  const prepare = () => {
    if (!dirty) return;
    dirty = false;
    const style = getComputedStyle(art), rect = art.getBoundingClientRect();
    const parent = art.parentElement.getBoundingClientRect();
    cellWidth = rect.width / cols;
    cellHeight = parseFloat(style.lineHeight);
    const width = cellWidth * (cols + padding.x * 2);
    const height = cellHeight * (rows + padding.y * 2);
    // Native text stays vector all the way to browser painting: no glyph atlas,
    // bitmap scaling, device-pixel-ratio cap or image interpolation.
    set(svg, 'width', width); set(svg, 'height', height);
    set(svg, 'viewBox', `0 0 ${width} ${height}`);
    svg.style.width = `${width}px`; svg.style.height = `${height}px`;
    set(svg, 'font-family', style.fontFamily);
    set(svg, 'font-size', style.fontSize);
    set(svg, 'font-weight', style.fontWeight);
    svg.style.fontVariantLigatures = 'none';
    svg.style.left = `${rect.left - parent.left - padding.x * cellWidth}px`;
    svg.style.top = `${rect.top - parent.top - padding.y * cellHeight}px`;
    for (const [key, value] of Object.entries({ x: 0, y: 0, width, height })) set(maskNode, key, value);
    palette = document.documentElement.dataset.theme === 'light'
      ? [[35, 22, 65], [65, 42, 138], [105, 77, 180]]
      : [[88, 116, 43], [176, 218, 80], [238, 255, 190]];
    colors.clear();
  };

  const updateMask = () => {
    const origin = svg.getBoundingClientRect(), view = host.getBoundingClientRect();
    for (const [key, value] of Object.entries({
      x: view.left - origin.left, y: view.top - origin.top,
      width: view.width, height: view.height,
    })) set(visible, key, decimal(value));
    const regions = mask.regions();
    for (let i = 0; i < regions.length; i++) {
      if (!cutouts[i]) {
        cutouts[i] = create('rect'); cutouts[i].setAttribute('fill', 'black');
        maskNode.append(cutouts[i]);
      }
      const r = regions[i];
      for (const [key, value] of Object.entries({
        x: r.left - origin.left, y: r.top - origin.top,
        width: r.right - r.left, height: r.bottom - r.top,
      })) set(cutouts[i], key, decimal(value));
      cutouts[i].removeAttribute('display');
    }
    for (let i = regions.length; i < cutouts.length; i++) set(cutouts[i], 'display', 'none');
  };

  const draw = particles => {
    lastDraw = particles;
    prepare(); updateMask();
    // A native SVG text element can position every character independently via
    // x/y lists. Batch equal glyphs and opacity instead of updating thousands
    // of text elements (twice as many during a crossfade).
    const batches = new Map();
    const glyph = (particle, char, opacity) => {
      if (opacity < .001 || char === ' ') return;
      const alpha = Math.round(opacity * 32);
      if (!alpha) return;
      const key = `${char}:${alpha}`;
      let batch = batches.get(key);
      if (!batch) { batch = { char, alpha, x: [], y: [] }; batches.set(key, batch); }
      batch.x.push(decimal((particle.x + padding.x + .5) * cellWidth));
      batch.y.push(decimal((particle.y + padding.y + .5) * cellHeight));
    };
    for (const particle of particles) {
      if (particle.glyph === particle.targetGlyph) glyph(particle, particle.glyph, particle.opacity);
      else {
        glyph(particle, particle.glyph, particle.opacity * (1 - particle.glyphMix));
        glyph(particle, particle.targetGlyph, particle.opacity * particle.glyphMix);
      }
    }
    const used = new Map();
    for (const batch of batches.values()) {
      let pool = slots.get(batch.char);
      if (!pool) { pool = []; slots.set(batch.char, pool); }
      const at = used.get(batch.char) || 0;
      used.set(batch.char, at + 1);
      let slot = pool[at];
      if (!slot) {
        const node = create('text');
        slot = { node, count: 0 }; pool.push(slot); ink.append(node);
      }
      const { node } = slot;
      set(node, 'opacity', batch.alpha / 32);
      if (slot.count !== batch.x.length) {
        node.textContent = batch.char.repeat(batch.x.length); slot.count = batch.x.length;
      }
      set(node, 'x', batch.x.join(' ')); set(node, 'y', batch.y.join(' '));
      const color = shade(batch.char);
      set(node, 'fill', color);
      node.removeAttribute('display');
    }
    for (const [char, pool] of slots) {
      for (let i = used.get(char) || 0; i < pool.length; i++) set(pool[i].node, 'display', 'none');
    }
    host.setAttribute('data-ascii-vector', '');
  };
  const refresh = () => { dirty = true; if (lastDraw) draw(lastDraw); };
  const resize = new ResizeObserver(refresh);
  resize.observe(art); resize.observe(host);
  const theme = new MutationObserver(refresh);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.addEventListener('resize', refresh);
  let disposed = false;
  document.fonts.ready.then(() => { if (!disposed) refresh(); });
  // Use the same transform as the visible SVG, including viewBox scaling and
  // ancestor transforms. Particle coordinates describe character centres.
  const coordinates = (clientX, clientY) => {
    prepare();
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return {
      x: point.x / cellWidth - padding.x - .5,
      y: point.y / cellHeight - padding.y - .5,
    };
  };
  return {
    draw,
    coordinates,
    bounds() {
      const view = host.getBoundingClientRect();
      const start = coordinates(view.left, view.top), end = coordinates(view.right, view.bottom);
      if (!start || !end) return null;
      return {
        x0: start.x + .75, x1: end.x - .75,
        y0: start.y + .75, y1: end.y - .75,
      };
    },
    dispose() {
      disposed = true; resize.disconnect(); theme.disconnect(); mask.dispose();
      window.removeEventListener('resize', refresh);
      svg.remove(); host.removeAttribute('data-ascii-vector');
    },
  };
}
