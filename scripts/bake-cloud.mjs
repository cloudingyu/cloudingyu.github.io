// Run `npm run cloud:bake` after changing the cloud's shape or lighting.
// Bake once for all visitors instead of evaluating these fields for every pixel.
import { mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { VOLUME_SIZE, VOLUME_SHAPES } from '../src/scripts/cloud-volume.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const fract = x => x - Math.floor(x);
const f32 = Math.fround;
function hash(x, y, z) {
  const px = f32(fract(f32(x * f32(.1031))));
  const py = f32(fract(f32(y * f32(.1031))));
  const pz = f32(fract(f32(z * f32(.1031))));
  const dot = f32(f32(f32(px * f32(py + f32(33.33))) + f32(py * f32(pz + f32(33.33)))) + f32(pz * f32(px + f32(33.33))));
  return Math.round(fract(f32(f32(f32(px + dot) + f32(py + dot)) * f32(pz + dot))) * 255) / 255;
}
const lattice = new Map();
function cachedHash(x, y, z) {
  const key = `${x},${y},${z}`;
  if (!lattice.has(key)) lattice.set(key, hash(x, y, z));
  return lattice.get(key);
}
function noise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = smooth(fract(x)), fy = smooth(fract(y)), fz = smooth(fract(z));
  return mix(
    mix(mix(cachedHash(ix, iy, iz), cachedHash(ix + 1, iy, iz), fx), mix(cachedHash(ix, iy + 1, iz), cachedHash(ix + 1, iy + 1, iz), fx), fy),
    mix(mix(cachedHash(ix, iy, iz + 1), cachedHash(ix + 1, iy, iz + 1), fx), mix(cachedHash(ix, iy + 1, iz + 1), cachedHash(ix + 1, iy + 1, iz + 1), fx), fy), fz,
  );
}
function puff(p, center, radius) {
  return (Math.hypot(...p.map((n, i) => (n - center[i]) / radius[i])) - 1) * Math.min(...radius);
}
function join(a, b) {
  const h = Math.max(.45 - Math.abs(a - b), 0) / .45;
  return Math.min(a, b) - h * h * .1125;
}
function triangle(p, a, b, c) {
  const vertices = [a, b, c];
  const orientation = Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  let distance = Infinity, inside = true;
  for (let i = 0; i < 3; i++) {
    const start = vertices[i], end = vertices[(i + 1) % 3];
    const e = [end[0] - start[0], end[1] - start[1]];
    const v = [p[0] - start[0], p[1] - start[1]];
    const t = clamp((v[0] * e[0] + v[1] * e[1]) / (e[0] ** 2 + e[1] ** 2), 0, 1);
    distance = Math.min(distance, Math.hypot(v[0] - e[0] * t, v[1] - e[1] * t));
    if (orientation * (e[0] * v[1] - e[1] * v[0]) < 0) inside = false;
  }
  return inside ? -distance : distance;
}
function rounded(outline, z, depth, rounding) {
  const edge = Math.abs(z) - depth;
  return Math.hypot(Math.max(outline, 0), Math.max(edge, 0)) + Math.min(Math.max(outline, edge), 0) - rounding;
}
function shape(p, id) {
  if (id === 0) {
    return [
      [[-2.1, -.15, 0], [.95, .8, .9]],
      [[-1.15, .45, -.1], [1.25, 1.15, 1.12]],
      [[.35, .9, 0], [1.38, 1.3, 1.18]],
      [[1.8, .1, .1], [1.03, .9, .95]],
      [[-.05, -.4, .25], [2.25, .65, 1.02]],
      [[.9, -.22, .8], [1.1, .8, .78]],
    ].map(([c, r]) => puff(p, c, r)).reduce(join);
  }
  if (id === 1) {
    let d = puff(p, [.55, 0, 0], [1.9, 1.02, .88]);
    d = join(d, rounded(triangle(p, [-1.2, 0], [-2.85, 1.03], [-2.85, -1.03]), p[2], .22, .14));
    return join(d, rounded(triangle(p, [-.35, .65], [.05, 1.48], [.9, .7]), p[2], .12, .12));
  }
  let d = [
    [[0, -.3, 0], [1.78, 1.32, 1.5]],
    [[-.55, .18, .4], [1.05, .9, 1.28]],
    [[.5, -.25, .5], [1.08, 1, 1.3]],
    [[0, -.75, .2], [1.35, .76, 1.28]],
  ].map(([c, r]) => puff(p, c, r)).reduce(join);
  const ear = triangle([Math.abs(p[0]), p[1]], [.6, .55], [1.55, 1.9], [1.7, .15]);
  d = join(d, rounded(ear + p[2] ** 2 * .25, p[2], .6, .2));
  d = join(d, puff(p, [-1, -.48, .12], [.72, .75, 1.08]));
  return join(d, puff(p, [1, -.48, .12], [.72, .75, 1.08]));
}
function density(p, id, outline = shape(p, id)) {
  const roughness = id === 0 ? .42 : .22;
  if (outline >= .1 + roughness * .5) return 0;
  const q = p.map((n, i) => n * 3.1 + id * [3.1, 1.7, -2.4][i]);
  const texture = noise(...q) * .57 + noise(...q.map(n => n * 2.03 + 17)) * .29 + noise(...q.map(n => n * 4.11 + 31)) * .14;
  return clamp((.1 - outline - (texture - .5) * roughness) * 2.7, 0, 1);
}

const [width, height, depth] = VOLUME_SIZE;
const data = new Uint8Array(width * height * depth * VOLUME_SHAPES * 2);
const sunLength = Math.hypot(-.6, .85, .4);
const sun = [-.6, .85, .4].map(n => n / sunLength);
let offset = 0;
for (let id = 0; id < VOLUME_SHAPES; id++) {
  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = [(x + .5) / width * 8 - 4, (y + .5) / height * 5 - 2.5, (z + .5) / depth * 5 - 2.5];
        const outline = shape(p, id);
        const fog = density(p, id, outline);
        const slope = (shape(p.map((n, i) => n + sun[i] * .25), id) - outline) / .25;
        const shade = clamp(.2 + slope * .8, .12, 1) * Math.exp(-density(p.map((n, i) => n + sun[i] * .55), id) * .85);
        data[offset++] = Math.round(fog * 255);
        // Premultiply lighting by density so empty texels compress and filter cleanly.
        data[offset++] = Math.round(shade * fog * 255);
      }
    }
  }
  console.log(`Baked cloud shape ${id + 1}/${VOLUME_SHAPES}`);
}
const compressed = gzipSync(data, { level: 9 });
await mkdir(new URL('../src/assets/', import.meta.url), { recursive: true });
// Use .bin so static hosts don't implicitly advertise Content-Encoding: gzip.
// The client decompresses this payload once, independent of transport compression.
await writeFile(new URL('../src/assets/cloud-volume.bin', import.meta.url), compressed);
console.log(`Cloud volume: ${compressed.length} bytes compressed (${data.length} bytes decoded)`);
