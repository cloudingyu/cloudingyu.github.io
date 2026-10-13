import { Scene, Camera, PerspectiveCamera, WebGLRenderer, WebGLRenderTarget, WebGL3DRenderTarget, BoxGeometry, PlaneGeometry, ShaderMaterial, Mesh, Color, Vector3, Vector4, BackSide, NoBlending, RedFormat, LinearFilter, HalfFloatType, UnsignedByteType, ACESFilmicToneMapping } from 'three';

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
  uniform vec3 uDrift;
  uniform vec4 uShape;
  uniform float uBreathing;
  uniform float uDay;
  uniform int uSteps;
  uniform highp sampler3D uNoise;
  uniform float uEncoded;
  varying vec3 vLocal;

  ${hashShader}
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    // The common range uses cached lattice values and hardware interpolation.
    // Outside the cache, keep the original noise rather than repeating its pattern.
    if (all(greaterThanEqual(i, vec3(-32.0))) && all(lessThan(i, vec3(95.0)))) {
      return texture(uNoise, (i + 32.0 + f + .5) / 128.0).r;
    }
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float billow(vec3 p) {
    return noise(p) * .57 + noise(p * 2.03 + 17.0) * .29 + noise(p * 4.11 + 31.0) * .14;
  }
  float puff(vec3 p, vec3 center, vec3 radius) {
    return (length((p - center) / radius) - 1.0) * min(radius.x, min(radius.y, radius.z));
  }
  float joinPuffs(float a, float b) {
    float h = max(.45 - abs(a - b), 0.0) / .45;
    return min(a, b) - h * h * .1125;
  }
  float cumulus(vec3 p, float breathing) {
    float d = puff(p, vec3(-2.1, -.15, .0), vec3(.95, .8, .9));
    d = joinPuffs(d, puff(p, vec3(-1.15, .45, -.1), vec3(1.25, 1.15 + breathing, 1.12)));
    d = joinPuffs(d, puff(p, vec3(.35, .9, .0), vec3(1.38, 1.3 + breathing, 1.18)));
    d = joinPuffs(d, puff(p, vec3(1.8, .1, .1), vec3(1.03, .9, .95)));
    d = joinPuffs(d, puff(p, vec3(-.05, -.4, .25), vec3(2.25, .65, 1.02)));
    d = joinPuffs(d, puff(p, vec3(.9, -.22, .8), vec3(1.1, .8, .78)));
    return d;
  }
  float roundedVolume(float outline, float z, float depth, float rounding) {
    vec2 q = vec2(outline, abs(z) - depth);
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rounding;
  }
  float triangle(vec2 p, vec2 a, vec2 b, vec2 c) {
    vec2 e0 = b - a, e1 = c - b, e2 = a - c;
    vec2 v0 = p - a, v1 = p - b, v2 = p - c;
    vec2 q0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
    vec2 q1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
    vec2 q2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
    float s = sign(e0.x * e2.y - e0.y * e2.x);
    vec2 d = min(min(vec2(dot(q0,q0), s * (v0.x*e0.y-v0.y*e0.x)),
                     vec2(dot(q1,q1), s * (v1.x*e1.y-v1.y*e1.x))),
                     vec2(dot(q2,q2), s * (v2.x*e2.y-v2.y*e2.x)));
    return -sqrt(d.x) * sign(d.y);
  }
  float fish(vec3 p, float breathing) {
    float d = puff(p, vec3(.55, .0, .0), vec3(1.9, 1.02 + breathing, .88));
    float tail = triangle(p.xy, vec2(-1.2, .0), vec2(-2.85, 1.03), vec2(-2.85, -1.03));
    d = joinPuffs(d, roundedVolume(tail, p.z, .22, .14));
    float fin = triangle(p.xy, vec2(-.35, .65), vec2(.05, 1.48), vec2(.9, .7));
    d = joinPuffs(d, roundedVolume(fin, p.z, .12, .12));
    return d;
  }
  float cat(vec3 p, float breathing) {
    float d = puff(p, vec3(.0, -.3, .0), vec3(1.78, 1.32 + breathing, 1.5));
    d = joinPuffs(d, puff(p, vec3(-.55, .18, .4), vec3(1.05, .9, 1.28)));
    d = joinPuffs(d, puff(p, vec3(.5, -.25, .5), vec3(1.08, 1.0, 1.3)));
    d = joinPuffs(d, puff(p, vec3(.0, -.75, .2), vec3(1.35, .76, 1.28)));
    vec2 q = vec2(abs(p.x), p.y);
    float ear = triangle(q, vec2(.6, .55), vec2(1.55, 1.9), vec2(1.7, .15));
    d = joinPuffs(d, roundedVolume(ear + p.z * p.z * .25, p.z, .6, .2));
    d = joinPuffs(d, puff(p, vec3(-1.0, -.48, .12), vec3(.72, .75, 1.08)));
    d = joinPuffs(d, puff(p, vec3(1.0, -.48, .12), vec3(.72, .75, 1.08)));
    return d;
  }
  float shapeAt(vec3 p, float id, float breathing) {
    if (id < .5) return cumulus(p, breathing);
    if (id < 1.5) return fish(p, breathing);
    return cat(p, breathing);
  }
  float cloudShape(vec3 p) {
    if (uShape.z < .000003) return shapeAt(p, uShape.x, uBreathing);
    if (uShape.z > .999997) return shapeAt(p, uShape.y, uBreathing);
    return mix(shapeAt(p, uShape.x, uBreathing), shapeAt(p, uShape.y, uBreathing), uShape.z);
  }
  float densityAt(vec3 p, float shape) {
    // Noise is in [0, 1]; beyond this bound density is exactly zero.
    // Keep every ray step and the original lighting, only omit zero-density work.
    if (shape >= .1 + uShape.w * .5) return 0.0;
    float texture = billow(p * 3.1 + uDrift);
    float d = shape + (texture - .5) * uShape.w;
    return clamp((.1 - d) * 2.7, 0.0, 1.0);
  }
  float density(vec3 p) {
    return densityAt(p, cloudShape(p));
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
    vec3 sun = normalize(vec3(-.6, .85, .4));
    for (int i = 0; i < 56; i++) {
      if (i >= uSteps || sum.a > .985) break;
      vec3 p = uCamera + ray * distance;
      float shape = cloudShape(p);
      float fog = densityAt(p, shape);
      if (fog > .005) {
        float slope = (cloudShape(p + sun * .25) - shape) / .25;
        float shade = clamp(.2 + slope * .8, .12, 1.0);
        shade *= exp(-density(p + sun * .55) * .85);
        float under = smoothstep(-.9, .9, p.y);
        shade *= mix(.58, 1.0, under);
        // Cool shadows and lower highlights separate the daylight cloud from the paper.
        vec3 shadow = mix(vec3(.09, .12, .22), vec3(.035, .055, .13), uDay);
        vec3 highlight = mix(vec3(1.7, 1.72, 1.8), vec3(1.05, 1.17, 1.5), uDay);
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
const noiseFragment = `
  uniform float uLayer;
  ${hashShader}
  void main() {
    float value = hash(vec3(floor(gl_FragCoord.xy) - 32.0, uLayer - 32.0));
    gl_FragColor = vec4(value, 0.0, 0.0, 1.0);
  }
`;

export async function mountCloud(host, input, { signal } = {}) {
  const checkAbort = () => { if (signal?.aborted) throw new DOMException('Cloud initialization cancelled', 'AbortError'); };
  checkAbort();
  const renderer = new WebGLRenderer({ alpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
  const gl = renderer.getContext();
  const hdr = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
  const noiseTarget = new WebGL3DRenderTarget(128, 128, 128, { format: RedFormat, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false, stencilBuffer: false });
  renderer.setClearAlpha(0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(36, 1, .1, 30);
  camera.position.z = 11.5;
  const geometry = new BoxGeometry(8, 5, 5);
  const uniforms = { uDrift: { value: new Vector3() }, uShape: { value: new Vector4(0, 1, 0, .42) }, uBreathing: { value: 0 }, uAcid: { value: new Color('#d0ff45') }, uPurple: { value: new Color('#bfa9ff') }, uDay: { value: 0 }, uCamera: { value: new Vector3() }, uSteps: { value: 48 } };
  uniforms.uNoise = { value: noiseTarget.texture };
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
  const noiseScene = new Scene();
  const noiseMaterial = new ShaderMaterial({ uniforms: { uLayer: { value: 0 } }, vertexShader: presentVertex, fragmentShader: noiseFragment, blending: NoBlending, depthTest: false, depthWrite: false, toneMapped: false });
  const noiseScreen = new Mesh(presentGeometry, noiseMaterial);
  noiseScreen.frustumCulled = false;
  noiseScene.add(noiseScreen);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  let disposed = false;
  let frame = 0;
  let previous = performance.now();
  let elapsed = 0;
  let morph = 0;
  let morphTarget = 0;
  let pulse = 0;
  let x = 0;
  let y = 0;
  let scrolling = false;
  let interacting = false;
  let dirty = true;
  let quality = 1;
  let width = 0;
  let height = 0;
  let lastQualityChange = performance.now();
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
    if (reduced.matches || scrolling || !interacting || now - lastQualityChange < 500) return;
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

  const render = () => {
    if (disposed || gl.isContextLost()) return;
    const now = performance.now();
    if (query && gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
      if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) {
        const cost = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
        gpuCost = gpuSamples ? gpuCost * .6 + cost * .4 : cost;
        gpuSamples += 1;
        if (gpuSamples >= 3) adaptQuality(gpuCost, now, true);
      } else { gpuCost = 0; gpuSamples = 0; }
      gl.deleteQuery(query);
      query = null;
    }
    const amount = morph - Math.floor(morph);
    const id = Math.floor(morph) % 3;
    const position = morph % 3;
    const original = 1 - smooth(Math.min(position, 3 - position));
    uniforms.uShape.value.set(id, (id + 1) % 3, smooth(amount), .22 + .2 * original);
    uniforms.uBreathing.value = Math.sin(elapsed * .35) * .06 + (reduced.matches ? 0 : pulse) * .08;
    uniforms.uDrift.value.set(elapsed * .045 + morph * 3.1, -elapsed * .035 + morph * 1.7, elapsed * .025 - morph * 2.4);
    sculpture.updateMatrixWorld();
    uniforms.uCamera.value.copy(camera.position);
    sculpture.worldToLocal(uniforms.uCamera.value);
    const measure = timer && !query && renderCount++ % 4 === 0 && interacting && !reduced.matches;
    if (measure) { query = gl.createQuery(); gl.beginQuery(timer.TIME_ELAPSED_EXT, query); }
    const target = interacting ? interactionTarget : detailTarget;
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
    const cadence = Math.max(1, Math.ceil((1000 / 90 - .5) / refreshInterval));
    cadenceFrame += 1;
    if (cadenceFrame < cadence || !gpuReady()) { frame = requestAnimationFrame(tick); return; }
    cadenceFrame = 0;
    const dt = Math.min((now - previous) / 1000, .08);
    previous = now;
    elapsed += dt;
    const follow = 1 - Math.exp(-18 * dt);
    x += (input.x - x) * follow;
    y += (input.y - y) * follow;
    morph += (morphTarget - morph) * (1 - Math.exp(-10 * dt));
    pulse *= Math.exp(-3.3 * dt);
    const pending = Math.abs(input.x - x) + Math.abs(input.y - y) > .002 || Math.abs(morphTarget - morph) > .00001 || pulse > .005;
    if (!pending) {
      x = input.x; y = input.y; morph = morphTarget; pulse = 0;
      setInteracting(false);
    }
    sculpture.rotation.set(.08 + y * .28 + Math.sin(elapsed * .18) * .045, -.12 + x * .5 + Math.sin(elapsed * .13) * .12 + input.scroll * .3, -.05 + Math.sin(elapsed * .16) * .03);
    sculpture.position.y = Math.sin(elapsed * .5) * .09 + input.scroll * .4;
    render();
    dirty = false;
    // Idle movement belongs to the compositor; stop all volume draws and JS frames.
    if (pending) frame = requestAnimationFrame(tick);
  };
  const start = () => {
    if (disposed || frame || !visible || document.hidden || scrolling) return;
    if (reduced.matches) { if (dirty) render(); dirty = false; return; }
    if (!dirty && Math.abs(input.x - x) + Math.abs(input.y - y) <= .002 && morph === morphTarget && pulse === 0) return;
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
    noiseTarget.dispose(); noiseMaterial.dispose();
    presentGeometry.dispose(); presentMaterial.dispose();
    geometry.dispose(); material.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
  };

  try {
    resize(); palette();
    renderer.initRenderTarget(detailTarget);
    renderer.initRenderTarget(interactionTarget);
    renderer.setRenderTarget(noiseTarget);
    await renderer.compileAsync(noiseScene, presentCamera);
    for (let layer = 0; layer < 128; layer++) {
      checkAbort();
      noiseMaterial.uniforms.uLayer.value = layer;
      renderer.setRenderTarget(noiseTarget, layer);
      renderer.render(noiseScene, presentCamera);
      if (layer % 16 === 15) await new Promise(resolve => setTimeout(resolve, 0));
    }
    renderer.setRenderTarget(detailTarget);
    await renderer.compileAsync(scene, camera);
    renderer.setRenderTarget(null);
    await renderer.compileAsync(presentScene, presentCamera);
    checkAbort();
    render(); dirty = false;
    noiseMaterial.dispose();
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
      if (scrolling) stop(); else wake();
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
