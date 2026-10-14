import { Scene, Camera, PerspectiveCamera, WebGLRenderer, WebGLRenderTarget, Data3DTexture, BoxGeometry, PlaneGeometry, ShaderMaterial, Mesh, Color, Vector3, Vector4, BackSide, NoBlending, RGFormat, LinearFilter, HalfFloatType, UnsignedByteType, ACESFilmicToneMapping } from 'three';
import volumeUrl from '../assets/cloud-volume.bin?url';
import { VOLUME_SIZE, VOLUME_SHAPES } from './cloud-volume.js';

const hashShader = `
  float hash(vec3 p) {
    p = fract(p * .1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
`;

// A density field is sampled through a volume, giving the cloud depth and soft edges.
const vertexShader = `
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform vec3 uCamera;
  uniform vec3 uAcid;
  uniform vec3 uPurple;
  uniform vec4 uShape;
  uniform float uDay;
  uniform int uSteps;
  uniform highp sampler3D uVolume;
  uniform float uEncoded;
  varying vec3 vLocal;

  ${hashShader}
  vec2 sampleShape(vec3 uv, float id) {
    // Clamp within each shape's texel centres to avoid mixing adjacent atlas slices.
    uv = clamp(uv, vec3(${VOLUME_SIZE.map(n => .5 / n).join(', ')}), vec3(${VOLUME_SIZE.map(n => 1 - .5 / n).join(', ')}));
    uv.z = (uv.z + id) / ${VOLUME_SHAPES.toFixed(1)};
    return texture(uVolume, uv).rg;
  }
  vec2 cloudAt(vec3 p) {
    vec3 uv = p / vec3(8.0, 5.0, 5.0) + .5;
    if (uShape.z < .000003) return sampleShape(uv, uShape.x);
    if (uShape.z > .999997) return sampleShape(uv, uShape.y);
    return mix(sampleShape(uv, uShape.x), sampleShape(uv, uShape.y), uShape.z);
  }
  void main() {
    vec3 ray = normalize(vLocal - uCamera);
    vec3 safeRay = sign(ray + vec3(.000001)) * max(abs(ray), vec3(.00001));
    vec3 nearBox = (vec3(-4.0, -2.5, -2.5) - uCamera) / safeRay;
    vec3 farBox = (vec3(4.0, 2.5, 2.5) - uCamera) / safeRay;
    vec3 entry = min(nearBox, farBox), leave = max(nearBox, farBox);
    float begin = max(max(entry.x, entry.y), max(entry.z, 0.0));
    float end = min(min(leave.x, leave.y), leave.z);
    if (end <= begin) discard;
    float stepSize = (end - begin) / float(uSteps);
    float distance = begin + stepSize * hash(vec3(gl_FragCoord.xy, .7));
    vec4 sum = vec4(0.0);
    vec3 shadow = mix(vec3(.09, .12, .22), vec3(.035, .055, .13), uDay);
    vec3 highlight = mix(vec3(1.7, 1.72, 1.8), vec3(1.05, 1.17, 1.5), uDay);
    for (int i = 0; i < 56; i++) {
      if (i >= uSteps || sum.a > .985) break;
      vec3 p = uCamera + ray * distance;
      vec2 field = cloudAt(p);
      float fog = field.r;
      if (fog > .005) {
        float shade = clamp(field.g / fog, .0, 1.0);
        float under = smoothstep(-.9, .9, p.y);
        shade *= mix(.58, 1.0, under);
        // Cool shadows and lower highlights separate the daylight cloud from the paper.
        float lighting = mix(shade, pow(shade, 1.35), uDay);
        vec3 light = mix(shadow, highlight, lighting);
        light += uPurple * max(p.x / 3.0, 0.0) * .12 + uAcid * max(-p.x / 3.0, 0.0) * .055;
        float alpha = 1.0 - exp(-fog * stepSize * 3.8);
        sum.rgb += (1.0 - sum.a) * alpha * light;
        sum.a += (1.0 - sum.a) * alpha;
      }
      distance += stepSize;
    }
    if (sum.a < .008) discard;
    gl_FragColor = vec4(sum.rgb / max(sum.a, .001), sum.a);
    if (uEncoded > .5) gl_FragColor.rgb /= 1.0 + gl_FragColor.rgb;
    // Filter premultiplied colour to keep transparent cloud edges clean.
    gl_FragColor.rgb *= gl_FragColor.a;
  }
`;

// Keep the visible canvas fixed; only the volume texture changes during interaction.
// Apply the original tone mapping once, after upscaling the linear cloud colour.
const presentVertex = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const presentFragment = `
  uniform sampler2D uCloud;
  uniform float uEncoded;
  varying vec2 vUv;
  void main() {
    gl_FragColor = texture2D(uCloud, vUv);
    gl_FragColor.rgb /= max(gl_FragColor.a, .00001);
    if (uEncoded > .5) gl_FragColor.rgb /= max(vec3(.001), 1.0 - gl_FragColor.rgb);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
async function loadVolume(signal) {
  const response = await fetch(volumeUrl, { signal });
  if (!response.ok || !response.body) throw new Error('Cloud volume unavailable');
  const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
  const data = new Uint8Array(await new Response(stream).arrayBuffer());
  if (data.length !== VOLUME_SIZE.reduce((a, b) => a * b) * VOLUME_SHAPES * 2) throw new Error('Invalid cloud volume');
  return data;
}

export async function mountCloud(host, { signal } = {}) {
  const checkAbort = () => { if (signal?.aborted) throw new DOMException('Cloud initialization cancelled', 'AbortError'); };
  checkAbort();
  const volumeData = await loadVolume(signal);
  checkAbort();
  const renderer = new WebGLRenderer({ alpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
  const gl = renderer.getContext();
  const hdr = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
  const [volumeWidth, volumeHeight, volumeDepth] = VOLUME_SIZE;
  const volumeTexture = new Data3DTexture(volumeData, volumeWidth, volumeHeight, volumeDepth * VOLUME_SHAPES);
  volumeTexture.format = RGFormat;
  volumeTexture.minFilter = volumeTexture.magFilter = LinearFilter;
  volumeTexture.needsUpdate = true;
  renderer.setClearAlpha(0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  (host.querySelector('[data-cloud-view]') || host).append(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(36, 1, .1, 30);
  camera.position.z = 11.5;
  const geometry = new BoxGeometry(8, 5, 5);
  const uniforms = { uShape: { value: new Vector4(0, 1, 0, 0) }, uAcid: { value: new Color('#d0ff45') }, uPurple: { value: new Color('#bfa9ff') }, uDay: { value: 0 }, uCamera: { value: new Vector3() }, uSteps: { value: 48 } };
  uniforms.uVolume = { value: volumeTexture };
  uniforms.uEncoded = { value: hdr ? 0 : 1 };
  const material = new ShaderMaterial({ uniforms, vertexShader, fragmentShader, blending: NoBlending, depthTest: false, depthWrite: false, side: BackSide });
  const sculpture = new Mesh(geometry, material);
  scene.add(sculpture);
  sculpture.rotation.set(.08, -.12, -.05);

  // Byte targets keep WebGL2 devices without float colour buffers interactive.
  const targetOptions = { type: hdr ? HalfFloatType : UnsignedByteType, depthBuffer: false, stencilBuffer: false };
  const detailTarget = new WebGLRenderTarget(1, 1, targetOptions);
  const interactionTarget = new WebGLRenderTarget(1, 1, targetOptions);
  const presentScene = new Scene();
  const presentCamera = new Camera();
  const presentGeometry = new PlaneGeometry(2, 2);
  const presentMaterial = new ShaderMaterial({
    uniforms: { uCloud: { value: detailTarget.texture }, uEncoded: { value: hdr ? 0 : 1 } },
    vertexShader: presentVertex, fragmentShader: presentFragment,
    transparent: true, depthTest: false, depthWrite: false,
  });
  const screen = new Mesh(presentGeometry, presentMaterial);
  screen.frustumCulled = false;
  presentScene.add(screen);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  let disposed = false;
  let frame = 0;
  let previous = performance.now();
  let morph = 0;
  let morphTarget = 0;
  let pulse = 0;
  let scrolling = false;
  let interacting = false;
  let dirty = true;
  // Start within a small GPU budget, before any performance samples are available.
  let quality = .35;
  let width = 0;
  let height = 0;
  let lastQualityChange = 0;
  let lastFrame = 0;
  let frameCost = 16.7;
  let gpuCost = 0;
  let gpuSamples = 0;
  let renderCount = 0;
  let refreshInterval = 1000 / 60;
  let cadenceFrame = 0;
  let gpuFence = null;
  let submittedAt = 0;
  const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  let query = null;
  let queryScale = 1;
  const smooth = (value) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
  const sizeFor = (budget) => {
    const ratio = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(budget / (width * height)));
    return [Math.max(1, Math.floor(width * ratio)), Math.max(1, Math.floor(height * ratio))];
  };
  const setResolution = () => {
    const mobile = innerWidth < 768;
    const [w, h] = sizeFor((mobile ? 65000 : 100000) * quality);
    interactionTarget.setSize(w, h);
    const [dw, dh] = sizeFor((mobile ? 120000 : 280000) * quality);
    detailTarget.setSize(dw, dh);
  };
  const setInteracting = (value) => {
    interacting = value;
    const mobile = innerWidth < 768;
    uniforms.uSteps.value = interacting ? (mobile ? 28 : 32) : (mobile ? 36 : 48);
  };
  const adaptQuality = (cost, now, measuredGPU) => {
    if (reduced.matches || scrolling || now - lastQualityChange < 500) return;
    const slow = cost > (measuredGPU ? 6 : 24);
    const fast = measuredGPU && cost < 3 && now - lastQualityChange > 8000;
    const next = slow ? Math.max(.1, quality * Math.min(.85, (measuredGPU ? 6 : 24) / cost)) : fast ? Math.min(1, quality + .05) : quality;
    if (next === quality) return;
    quality = next;
    lastQualityChange = now;
    setResolution();
  };

  const gpuReady = () => {
    if (!gpuFence) return true;
    // A zero timeout polls without blocking the UI or queuing stale pointer poses.
    const status = gl.clientWaitSync(gpuFence, 0, 0);
    if (status === gl.TIMEOUT_EXPIRED) return false;
    if (!timer && submittedAt) {
      const now = performance.now();
      // Privacy settings can disable GPU timers; fence completion still bounds work.
      adaptQuality(Math.max(refreshInterval, now - submittedAt - refreshInterval), now, false);
    }
    gl.deleteSync(gpuFence);
    gpuFence = null;
    return true;
  };

  const collectTiming = (now) => {
    if (query && gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
      if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) {
        // Compare settled detail draws against the same interaction budget.
        const cost = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6 * queryScale;
        gpuCost = gpuSamples ? gpuCost * .6 + cost * .4 : cost;
        gpuSamples += 1;
        adaptQuality(gpuCost, now, true);
      } else { gpuCost = 0; gpuSamples = 0; }
      gl.deleteQuery(query);
      query = null;
    }
  };
  const render = () => {
    if (disposed || gl.isContextLost()) return;
    const now = performance.now();
    collectTiming(now);
    const amount = morph - Math.floor(morph);
    const id = Math.floor(morph) % VOLUME_SHAPES;
    uniforms.uShape.value.set(id, (id + 1) % VOLUME_SHAPES, smooth(amount), 0);
    sculpture.scale.setScalar(1 + (reduced.matches ? 0 : pulse) * .025);
    sculpture.updateMatrixWorld();
    uniforms.uCamera.value.copy(camera.position);
    sculpture.worldToLocal(uniforms.uCamera.value);
    const measure = timer && !query && (renderCount++ % 4 === 0 || !interacting) && !reduced.matches;
    const target = interacting ? interactionTarget : detailTarget;
    if (measure) {
      queryScale = interacting ? 1 : (interactionTarget.width * interactionTarget.height * (innerWidth < 768 ? 28 : 32)) / (target.width * target.height * uniforms.uSteps.value);
      query = gl.createQuery(); gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
    }
    renderer.setRenderTarget(target);
    try { renderer.render(scene, camera); }
    finally { if (measure) gl.endQuery(timer.TIME_ELAPSED_EXT); }
    renderer.setRenderTarget(null);
    presentMaterial.uniforms.uCloud.value = target.texture;
    renderer.render(presentScene, presentCamera);
    if (gpuFence) gl.deleteSync(gpuFence);
    gpuFence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    submittedAt = performance.now();
    gl.flush();
  };
  const tick = (now) => {
    frame = 0;
    if (disposed || !visible || document.hidden || reduced.matches || scrolling) return;
    if (lastFrame) {
      const interval = now - lastFrame;
      if (interval > 3) refreshInterval = Math.min(refreshInterval, interval);
      frameCost = frameCost * .95 + Math.min(interval, 100) * .05;
      if (!timer || gpuSamples === 0) adaptQuality(frameCost, now, false);
    }
    lastFrame = now;
    // Use whole display frames (e.g. every second frame at 165 Hz), avoiding drift.
    // Only shape transitions animate on the GPU, with a 30 fps maximum.
    const cadence = Math.max(1, Math.ceil((1000 / 30 - .5) / refreshInterval));
    cadenceFrame += 1;
    if (cadenceFrame < cadence || !gpuReady()) { frame = requestAnimationFrame(tick); return; }
    cadenceFrame = 0;
    const dt = Math.min((now - previous) / 1000, .08);
    previous = now;
    morph += (morphTarget - morph) * (1 - Math.exp(-10 * dt));
    pulse *= Math.exp(-3.3 * dt);
    const pending = Math.abs(morphTarget - morph) > .00001 || pulse > .005;
    if (!pending) {
      morph = morphTarget; pulse = 0;
      setInteracting(false);
    }
    render();
    dirty = false;
    // Idle movement belongs to the compositor; stop all volume draws and JS frames.
    if (pending) frame = requestAnimationFrame(tick);
  };
  const start = () => {
    if (disposed || frame || !visible || document.hidden || scrolling) return;
    if (reduced.matches) { if (dirty) render(); dirty = false; return; }
    if (!dirty && morph === morphTarget && pulse === 0) return;
    setInteracting(true);
    previous = performance.now();
    lastFrame = 0;
    cadenceFrame = 0;
    frame = requestAnimationFrame(tick);
  };
  const wake = () => { dirty = true; start(); };
  const stop = () => { cancelAnimationFrame(frame); frame = 0; };
  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h || disposed || (width === w && height === h)) return;
    width = w; height = h;
    const [detailWidth, detailHeight] = sizeFor(innerWidth < 768 ? 120000 : 280000);
    renderer.setDrawingBufferSize(detailWidth, detailHeight, 1);
    setResolution();
    setInteracting(interacting);
    camera.position.z = Math.max(5.4, 7.1 / (w / h)) / (2 * Math.tan(Math.PI / 10));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    wake();
  };
  const palette = () => {
    const day = document.documentElement.dataset.theme === 'light';
    uniforms.uAcid.value.set(day ? '#5941bf' : '#d0ff45');
    uniforms.uDay.value = day ? 1 : 0;
    renderer.toneMappingExposure = day ? .82 : 1.1;
    wake();
  };
  const onPreference = () => {
    stop();
    if (reduced.matches) {
      pulse = 0;
      morph = morphTarget;
      setInteracting(false);
      render();
      dirty = false;
    } else wake();
  };
  const onVisibility = () => { if (document.hidden) stop(); else start(); };
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start(); else stop();
  });
  const ro = new ResizeObserver(resize);
  const theme = new MutationObserver(palette);
  const release = () => {
    if (query) gl.deleteQuery(query);
    if (gpuFence) gl.deleteSync(gpuFence);
    detailTarget.dispose(); interactionTarget.dispose();
    volumeTexture.dispose();
    presentGeometry.dispose(); presentMaterial.dispose();
    geometry.dispose(); material.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
  };

  try {
    resize(); palette();
    renderer.initRenderTarget(detailTarget);
    renderer.initRenderTarget(interactionTarget);
    renderer.setRenderTarget(detailTarget);
    await renderer.compileAsync(scene, camera);
    checkAbort();
    renderer.setRenderTarget(null);
    await renderer.compileAsync(presentScene, presentCamera);
    checkAbort();
    setInteracting(false);
    render(); dirty = false;
    // Keep the preview until the first low-cost draw has actually completed.
    // Poll the fence without blocking the main thread or building a GPU queue.
    while (!gpuReady()) {
      await new Promise(resolve => setTimeout(resolve, 16));
      checkAbort();
    }
    checkAbort();
    collectTiming(performance.now());
  }
  catch (error) {
    release();
    throw error;
  }
  host.setAttribute('data-canvas-ready', '');
  ro.observe(host);
  io.observe(host);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  reduced.addEventListener('change', onPreference);
  document.addEventListener('visibilitychange', onVisibility);

  return {
    wake,
    setScrolling(value) {
      scrolling = value;
      if (scrolling) stop(); else start();
    },
    reshape() {
      morphTarget += 1;
      pulse = 1;
      if (reduced.matches) { morph = morphTarget; render(); }
      else wake();
    },
    dispose() {
      disposed = true;
      stop(); io.disconnect(); ro.disconnect(); theme.disconnect();
      reduced.removeEventListener('change', onPreference);
      document.removeEventListener('visibilitychange', onVisibility);
      release();
      host.removeAttribute('data-canvas-ready');
    },
  };
}
