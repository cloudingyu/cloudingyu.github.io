// Build the same hash lattice in a worker instead of submitting 128 GPU passes.
// Float32 rounding follows GLSL's highp arithmetic; texels remain normalized bytes.
const size = 128;
const data = new Uint8Array(size ** 3);
const f32 = Math.fround;
const fract = value => value - Math.floor(value);
const lattice = Array.from({ length: size }, (_, i) => f32(fract(f32((i - 32) * f32(.1031)))));
let index = 0;
for (let z = 0; z < size; z++) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = lattice[x], py = lattice[y], pz = lattice[z];
      const dot = f32(f32(f32(px * f32(py + f32(33.33))) + f32(py * f32(pz + f32(33.33)))) + f32(pz * f32(px + f32(33.33))));
      const value = fract(f32(f32(f32(px + dot) + f32(py + dot)) * f32(pz + dot)));
      data[index++] = Math.round(value * 255);
    }
  }
}
self.postMessage(data, [data.buffer]);
