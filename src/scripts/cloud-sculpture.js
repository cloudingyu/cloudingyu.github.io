import { Scene, PerspectiveCamera, WebGLRenderer, BoxGeometry, ShaderMaterial, Mesh, Color, Vector3, BackSide, ACESFilmicToneMapping } from 'three';

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
  uniform float uTime;
  uniform float uMorph;
  uniform float uPulse;
  uniform float uDay;
  uniform int uSteps;
  varying vec3 vLocal;

  float hash(vec3 p) {
    p = fract(p * .1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
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
    float breathing = sin(uTime * .35) * .06 + uPulse * .08;
    // Cycle forward, including the transition from the cat back to the original cloud.
    float id = mod(floor(uMorph), 3.0), amount = fract(uMorph);
    if (amount < .001) return shapeAt(p, id, breathing);
    float next = mod(id + 1.0, 3.0);
    if (amount > .999) return shapeAt(p, next, breathing);
    return mix(shapeAt(p, id, breathing), shapeAt(p, next, breathing), smoothstep(0.0, 1.0, amount));
  }
  float densityAt(vec3 p, float shape) {
    vec3 drift = vec3(uTime * .045, -uTime * .035, uTime * .025) + uMorph * vec3(3.1, 1.7, -2.4);
    float texture = billow(p * 3.1 + drift);
    float original = 1.0 - smoothstep(0.0, 1.0, min(mod(uMorph, 3.0), 3.0 - mod(uMorph, 3.0)));
    float d = shape + (texture - .5) * mix(.22, .42, original);
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
      float fog = density(p);
      if (fog > .005) {
        float slope = (cloudShape(p + sun * .25) - cloudShape(p)) / .25;
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
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export async function mountCloud(host, input, { signal } = {}) {
  const checkAbort = () => { if (signal?.aborted) throw new DOMException('Cloud initialization cancelled', 'AbortError'); };
  checkAbort();
  const renderer = new WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'high-performance' });
  renderer.setClearAlpha(0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(36, 1, .1, 30);
  camera.position.z = 11.5;
  const geometry = new BoxGeometry(8, 5, 5);
  const uniforms = { uTime: { value: 0 }, uMorph: { value: 0 }, uPulse: { value: 0 }, uAcid: { value: new Color('#d0ff45') }, uPurple: { value: new Color('#bfa9ff') }, uDay: { value: 0 }, uCamera: { value: new Vector3() }, uSteps: { value: 48 } };
  const material = new ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, side: BackSide });
  const sculpture = new Mesh(geometry, material);
  scene.add(sculpture);
  sculpture.rotation.set(.08, -.12, -.05);

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

  const render = () => {
    sculpture.updateMatrixWorld();
    uniforms.uCamera.value.copy(camera.position);
    sculpture.worldToLocal(uniforms.uCamera.value);
    renderer.render(scene, camera);
  };
  const tick = (now) => {
    frame = 0;
    if (disposed || !visible || document.hidden || reduced.matches) return;
    if (now - previous < 1000 / 30) { frame = requestAnimationFrame(tick); return; }
    const dt = Math.min((now - previous) / 1000, .08);
    previous = now;
    elapsed += dt;
    const follow = 1 - Math.exp(-10 * dt);
    x += (input.x - x) * follow;
    y += (input.y - y) * follow;
    morph += (morphTarget - morph) * follow;
    pulse *= Math.exp(-3.3 * dt);
    uniforms.uTime.value = elapsed;
    uniforms.uMorph.value = morph;
    uniforms.uPulse.value = pulse;
    sculpture.rotation.set(.08 + y * .28 + Math.sin(elapsed * .18) * .045, -.12 + x * .5 + Math.sin(elapsed * .13) * .12 + input.scroll * .3, -.05 + Math.sin(elapsed * .16) * .03);
    sculpture.position.y = Math.sin(elapsed * .5) * .09 + input.scroll * .4;
    render();
    frame = requestAnimationFrame(tick);
  };
  const start = () => {
    if (disposed || frame || !visible || document.hidden) return;
    if (reduced.matches) { render(); return; }
    previous = performance.now();
    frame = requestAnimationFrame(tick);
  };
  const stop = () => { cancelAnimationFrame(frame); frame = 0; };
  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h || disposed) return;
    const budget = innerWidth < 768 ? 120000 : 280000;
    uniforms.uSteps.value = innerWidth < 768 ? 36 : 48;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(budget / (w * h))));
    renderer.setSize(w, h, false);
    camera.position.z = Math.max(5.4, 7.1 / (w / h)) / (2 * Math.tan(Math.PI / 10));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    render();
  };
  const palette = () => {
    const day = document.documentElement.dataset.theme === 'light';
    uniforms.uAcid.value.set(day ? '#5941bf' : '#d0ff45');
    uniforms.uDay.value = day ? 1 : 0;
    renderer.toneMappingExposure = day ? .82 : 1.1;
    render();
  };
  const onPreference = () => {
    stop();
    if (reduced.matches) {
      pulse = 0;
      morph = morphTarget;
      uniforms.uPulse.value = 0;
      uniforms.uMorph.value = morphTarget;
      render();
    } else start();
  };
  const onVisibility = () => { if (document.hidden) stop(); else start(); };
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start(); else stop();
  });
  const ro = new ResizeObserver(resize);
  const theme = new MutationObserver(palette);

  try {
    await renderer.compileAsync(scene, camera);
    checkAbort();
    resize(); palette();
  }
  catch (error) {
    geometry.dispose(); material.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    throw error;
  }
  host.setAttribute('data-canvas-ready', '');
  ro.observe(host);
  io.observe(host);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  reduced.addEventListener('change', onPreference);
  document.addEventListener('visibilitychange', onVisibility);

  return {
    reshape() {
      morphTarget += 1;
      pulse = 1;
      if (reduced.matches) { morph = morphTarget; uniforms.uMorph.value = morphTarget; render(); }
      else start();
    },
    dispose() {
      disposed = true;
      stop(); io.disconnect(); ro.disconnect(); theme.disconnect();
      reduced.removeEventListener('change', onPreference);
      document.removeEventListener('visibilitychange', onVisibility);
      geometry.dispose(); material.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
      host.removeAttribute('data-canvas-ready');
    },
  };
}
