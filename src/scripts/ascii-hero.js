import { mount } from 'ascii.rest';
import { createHeroPieces } from '../data/ascii-pieces.mjs';
import { ParticleMotion } from './ascii-particles.mjs';
import { createParticleSvg } from './ascii-particle-svg.js';
import { bindAsciiViewport } from './ascii-viewport.js';

export function mountAscii(host, button) {
  const art = host.querySelector('[data-ascii-art]');
  const stopViewport = bindAsciiViewport(host, button);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pieces = createHeroPieces();
  const renderers = pieces.map(piece => piece.default());
  const { cols, rows } = pieces[0].meta;
  const layer = createParticleSvg(art, cols, rows);
  const cursor = { x: 0, y: 0, strength: 0 };
  let pointer = null;
  let modelTime = 0;
  let index = 0;
  let requestedIndex = 0;
  let age = 0;
  let reformStarted = 0;
  let reformFrame = '';
  let phase = 'idle';
  let motion = new ParticleMotion(renderers[0](0), cols, rows);
  let disposed = false;

  const publish = () => {
    host.dataset.asciiPiece = pieces[index].meta.name;
    host.dataset.asciiPhase = phase;
    button.setAttribute('aria-label', index === 0 ? '切换为鱼' : '切换为云');
    button.setAttribute('aria-busy', String(phase !== 'idle'));
  };
  const beginReform = env => {
    index = requestedIndex;
    reformFrame = renderers[index](modelTime, env);
    motion.reform(reformFrame);
    phase = 'morph'; age = 0; reformStarted = performance.now(); publish();
  };
  const updateCursor = delta => {
    let strength = 0;
    if (pointer && !reduced.matches) {
      const rect = art.getBoundingClientRect();
      const view = host.getBoundingClientRect();
      if (rect.width && rect.height && pointer.x >= view.left && pointer.x < view.right
        && pointer.y >= view.top && pointer.y < view.bottom) {
        const point = layer?.coordinates(pointer.x, pointer.y) || {
          x: (pointer.x - rect.left) / rect.width * cols - .5,
          y: (pointer.y - rect.top) / rect.height * rows - .5,
        };
        // Only particles have inertia. Delaying the hit-test centre makes a
        // fast-moving pointer appear to disturb the wrong characters.
        cursor.x = point.x; cursor.y = point.y;
        strength = 1;
      }
    }
    cursor.strength += (strength - cursor.strength) * (1 - Math.exp(-(strength ? 7 : 4) * delta));
  };
  const player = {
    meta: pieces[0].meta,
    default() {
      let previous = null;
      return (time, env) => {
        const delta = previous === null ? 0 : Math.min(.1, Math.max(0, time - previous));
        previous = time;
        updateCursor(delta);
        if (requestedIndex !== index) beginReform(env);
        if (phase === 'idle') {
          if (!reduced.matches) modelTime += delta;
        }
        // The model clock is paused during a reform, so its projected target
        // stays identical; only the particles need updating during this phase.
        const frame = phase === 'morph' ? reformFrame : renderers[index](modelTime, env);
        if (phase === 'idle') motion.sync(frame);
        else age = (performance.now() - reformStarted) / 1000;
        motion.step(delta, cursor, phase === 'morph', Math.min(1, age / .55), layer?.bounds());
        if (phase === 'morph' && age >= .55) {
          motion.finish(); phase = 'idle'; age = 0; publish();
        }
        layer?.draw(motion.particles);
        return frame;
      };
    },
  };
  const settle = () => {
    index = requestedIndex; phase = 'idle'; age = 0;
    pointer = null; cursor.strength = 0;
    publish();
    const frame = renderers[index](modelTime);
    motion = new ParticleMotion(frame, cols, rows);
    layer?.draw(motion.particles);
    art.textContent = frame;
  };
  const onMotion = () => { if (reduced.matches && !disposed) settle(); };
  publish();
  const stop = mount(art, player, { fps: 30 });
  reduced.addEventListener('change', onMotion);
  return {
    setCursor(x, y) {
      pointer = Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
    },
    reshape() {
      requestedIndex = (requestedIndex + 1) % pieces.length;
      if (reduced.matches) settle();
    },
    dispose() {
      disposed = true;
      stop();
      layer?.dispose();
      stopViewport();
      reduced.removeEventListener('change', onMotion);
      host.removeAttribute('data-ascii-phase');
      button.removeAttribute('aria-busy');
    },
  };
}
