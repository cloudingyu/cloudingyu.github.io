import { group, mesh, parametric, scene } from 'ascii.rest/kit';

const TAU = Math.PI * 2;
const period = 60;
const spin = TAU / period;
export const ASCII_LIGHT_RAMP = '.,:;irsXA253hMHGS#9B&@';
const sceneOptions = {
  cols: 112, rows: 48, fps: 20,
  camera: { distance: 9, tilt: .2 },
  light: [-.7, .9, -1.2], ambient: .08,
  ramp: ASCII_LIGHT_RAMP, invert: false,
  period,
};

// Actual surfaces are projected, lit and depth-tested every frame.
function ellipsoid(at, radii, options = {}) {
  return parametric((u, v) => {
    const longitude = u * TAU, latitude = v * Math.PI;
    return [
      radii[0] * Math.sin(latitude) * Math.cos(longitude),
      radii[1] * Math.cos(latitude),
      radii[2] * Math.sin(latitude) * Math.sin(longitude),
    ];
  }, { at, segments: [72, 42], ...options });
}

const cloudShapes = [
  ellipsoid([0, -.45, 0], [2.25, .65, 1]),
  ellipsoid([-1.65, -.1, -.1], [.95, .85, .9]),
  ellipsoid([-.85, .65, .12], [1.15, 1.2, 1]),
  ellipsoid([.55, .9, .18], [1.3, 1.4, 1.1]),
  ellipsoid([1.7, .05, -.05], [1, .9, .85]),
  ellipsoid([-.2, .05, -.65], [1.3, .95, .8]),
  ellipsoid([.95, -.2, -.65], [1.15, .75, .7]),
];

// The forked tail and fins have thickness, so they remain visible as they turn.
function fin(outline, thickness = .1) {
  const vertices = [-thickness, thickness].flatMap(z => outline.map(([x, y]) => [x, y, z]));
  const n = outline.length;
  const faces = [Array.from({ length: n }, (_, i) => i), Array.from({ length: n }, (_, i) => i + n)];
  for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, (i + 1) % n + n, i + n]);
  return mesh(vertices, faces, { edges: false });
}

const fishShapes = [
  ellipsoid([.25, 0, 0], [1.65, .85, .78]),
  ellipsoid([-1.3, 0, 0], [.45, .28, .24]),
  fin([[-1.45, 0], [-2.55, 1.05], [-2.27, 0], [-2.55, -1.05]]),
  fin([[-.8, .58], [-.35, 1.3], [.65, .68]]),
  fin([[-.65, -.62], [-.3, -1.12], [.5, -.7]]),
  mesh([[.35, -.12, -.42], [-.45, -.65, -.95], [-.75, -.4, -.35]], [[0, 1, 2]], { edges: false }),
  mesh([[.35, -.12, .42], [-.45, -.65, .95], [-.75, -.4, .35]], [[0, 1, 2]], { edges: false }),
];

// Models rotate independently; pointer input only affects the rendered particles.
export function createHeroPieces() {
  return [[cloudShapes, 'cloud', .14, -.35], [fishShapes, 'fish', .14, -.45]].map(([shapes, name, pitch, yaw]) => {
    const model = group(shapes, {
      center: true,
      rotate: [pitch, yaw, -.08],
      spin: [0, spin, 0],
    });
    if (name === 'cloud') {
      // Enlarge the model in render space, then retain the same output grid as
      // the fish. Both pieces now use identical character sizes on the page.
      const cols = sceneOptions.cols * 1.5;
      const rows = sceneOptions.rows * 1.5;
      return scene({ ...sceneOptions, name, cols, rows }, model).crop({
        x: (cols - sceneOptions.cols) / 2,
        y: (rows - sceneOptions.rows) / 2,
        cols: sceneOptions.cols,
        rows: sceneOptions.rows,
      });
    }
    return scene({ ...sceneOptions, name }, model);
  });
}

export const heroPieces = /* @__PURE__ */ createHeroPieces();
export const cloudPiece = heroPieces[0];
export const fishPiece = heroPieces[1];
