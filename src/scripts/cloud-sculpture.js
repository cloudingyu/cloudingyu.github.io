// A density field is sampled through a volume, giving the cloud depth and soft edges.
const vertexShader = `
  attribute vec2 position;
  varying vec2 vScreen;
  void main() {
    vScreen = position;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;
  uniform vec3 uCamera;
  uniform mat3 uInverseRotation;
  uniform vec2 uView;
  uniform vec3 uAcid;
  uniform vec3 uPurple;
  uniform float uTime;
  uniform float uMorph;
  uniform float uPulse;
  uniform float uDay;
  uniform float uExposure;
  uniform int uSteps;
  varying vec2 vScreen;

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
  vec3 displayColor(vec3 color) {
    // Match the existing ACES lighting and sRGB output without a rendering framework.
    mat3 inputMatrix = mat3(.59719, .07600, .02840, .35458, .90834, .13383, .04823, .01566, .83777);
    mat3 outputMatrix = mat3(1.60475, -.10208, -.00327, -.53108, 1.10813, -.07276, -.07367, -.00605, 1.07602);
    vec3 v = inputMatrix * (color * uExposure / .6);
    vec3 a = v * (v + .0245786) - .000090537;
    vec3 b = v * (.983729 * v + .4329510) + .238081;
    vec3 linear = clamp(outputMatrix * (a / b), 0.0, 1.0);
    return mix(1.055 * pow(linear, vec3(1.0 / 2.4)) - .055, linear * 12.92, step(linear, vec3(.0031308)));
  }
  void main() {
    vec3 ray = normalize(uInverseRotation * vec3(vScreen * uView, -1.0));
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
      if (distance > end) break;
      float shape = cloudShape(p);
      // Empty space needs no turbulence or lighting samples; the margin covers the soft edge.
      if (shape > .4) { distance += max(stepSize, shape - .35); continue; }
      float fog = densityAt(p, shape);
      if (fog > .005) {
        float slope = (cloudShape(p + sun * .25) - shape) / .25;
        float shade = clamp(.2 + slope * .8, .12, 1.0);
        vec3 shadowPoint = p + sun * .55;
        shade *= exp(-densityAt(shadowPoint, cloudShape(shadowPoint)) * .85);
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
    gl_FragColor = vec4(displayColor(sum.rgb / max(sum.a, .001)), sum.a);
  }
`;

export async function mountCloud(host, input, { signal } = {}) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false, depth: false, stencil: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WebGL unavailable');
  const shaders = [];
  const program = gl.createProgram();
  let buffer;
  const release = () => {
    if (buffer) gl.deleteBuffer(buffer);
    shaders.forEach((shader) => gl.deleteShader(shader));
    gl.deleteProgram(program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    canvas.remove();
  };
  const checkAbort = () => { if (signal?.aborted) throw new DOMException('Cloud initialization cancelled', 'AbortError'); };
  try {
    checkAbort();
    for (const [type, source] of [[gl.VERTEX_SHADER, vertexShader], [gl.FRAGMENT_SHADER, fragmentShader]]) {
      const shader = gl.createShader(type);
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
    }
    const parallel = gl.getExtension('KHR_parallel_shader_compile');
    gl.linkProgram(program);
    // Let the browser paint and respond while the driver compiles the volume shader.
    if (parallel) {
      while (!gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) {
        checkAbort();
        await new Promise((resolve) => setTimeout(resolve, 16));
      }
    }
    checkAbort();
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Cloud shader compilation failed');
    gl.useProgram(program);
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  } catch (error) { release(); throw error; }

  const uniform = Object.fromEntries(['uCamera', 'uInverseRotation', 'uView', 'uTime', 'uMorph', 'uPulse', 'uAcid', 'uPurple', 'uDay', 'uExposure', 'uSteps'].map((name) => [name, gl.getUniformLocation(program, name)]));
  const linearColor = (hex) => [16, 8, 0].map((shift) => {
    const s = ((hex >> shift) & 255) / 255;
    return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
  });
  gl.uniform3fv(uniform.uPurple, linearColor(0xbfa9ff));
  gl.clearColor(0, 0, 0, 0);
  host.append(canvas);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const inverseRotation = new Float32Array(9);
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
  let cameraZ = 11.5;
  let width = 0;
  let height = 0;

  const render = () => {
    if (disposed || !width || !height || gl.isContextLost()) return;
    const rx = .08 + y * .28 + Math.sin(elapsed * .18) * .045;
    const ry = -.12 + x * .5 + Math.sin(elapsed * .13) * .12 + input.scroll * .3;
    const rz = -.05 + Math.sin(elapsed * .16) * .03;
    const a = Math.cos(rx), b = Math.sin(rx), c = Math.cos(ry), d = Math.sin(ry), e = Math.cos(rz), f = Math.sin(rz);
    // Inverse of the sculpture's XYZ rotation, in column-major order.
    inverseRotation.set([c*e, -c*f, d, a*f+b*e*d, a*e-b*f*d, -b*c, b*f-a*e*d, b*e+a*f*d, a*c]);
    const offsetY = -(Math.sin(elapsed * .5) * .09 + input.scroll * .4);
    gl.uniformMatrix3fv(uniform.uInverseRotation, false, inverseRotation);
    gl.uniform3f(uniform.uCamera, inverseRotation[3]*offsetY+inverseRotation[6]*cameraZ, inverseRotation[4]*offsetY+inverseRotation[7]*cameraZ, inverseRotation[5]*offsetY+inverseRotation[8]*cameraZ);
    gl.uniform1f(uniform.uTime, elapsed);
    gl.uniform1f(uniform.uMorph, morph);
    gl.uniform1f(uniform.uPulse, reduced.matches ? 0 : pulse);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
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
    if (!w || !h || disposed || (width === w && height === h)) return;
    width = w; height = h;
    const mobile = innerWidth < 768;
    const budget = mobile ? 90000 : 240000;
    const ratio = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(budget / (w * h)));
    canvas.width = Math.max(1, Math.round(w * ratio));
    canvas.height = Math.max(1, Math.round(h * ratio));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1i(uniform.uSteps, mobile ? 36 : 48);
    gl.uniform2f(uniform.uView, w / h * Math.tan(Math.PI / 10), Math.tan(Math.PI / 10));
    cameraZ = Math.max(5.4, 7.1 / (w / h)) / (2 * Math.tan(Math.PI / 10));
    render();
  };
  const setPalette = () => {
    const day = document.documentElement.dataset.theme === 'light';
    gl.uniform3fv(uniform.uAcid, linearColor(day ? 0x5941bf : 0xd0ff45));
    gl.uniform1f(uniform.uDay, day ? 1 : 0);
    gl.uniform1f(uniform.uExposure, day ? .82 : 1.1);
  };
  const onPreference = () => {
    stop();
    if (reduced.matches) { morph = morphTarget; render(); }
    else start();
  };
  const onVisibility = () => { if (document.hidden) stop(); else start(); };
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start(); else stop();
  });
  const ro = new ResizeObserver(resize);
  const theme = new MutationObserver(() => { setPalette(); render(); });

  setPalette(); resize();
  host.setAttribute('data-canvas-ready', '');
  ro.observe(host); io.observe(host);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  reduced.addEventListener('change', onPreference);
  document.addEventListener('visibilitychange', onVisibility);

  return {
    reshape() {
      morphTarget += 1;
      pulse = 1;
      if (reduced.matches) { morph = morphTarget; render(); }
      else start();
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
