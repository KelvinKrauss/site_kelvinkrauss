/* ───────────────────────── Fluid simulation (WebGL) ─────────────────────────
   Based on Pavel Dobryakov's WebGL-Fluid-Simulation: https://github.com/PavelDoGreat/WebGL-Fluid-Simulation
   Adapted here to run inside the AI question box and the chat window.

   MIT License

   Copyright (c) 2017 Pavel Dobryakov

   Permission is hereby granted, free of charge, to any person obtaining a copy
   of this software and associated documentation files (the "Software"), to deal
   in the Software without restriction, including without limitation the rights
   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   copies of the Software, and to permit persons to whom the Software is
   furnished to do so, subject to the following conditions:

   The above copyright notice and this permission notice shall be included in all
   copies or substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   SOFTWARE. */
(function fluid() {
  const canvas = document.getElementById('fluid');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // The same settings as aaabadcode.com, whose fluid fills the screen. In the chat they fill the window
  // (same proportions at a smaller size, following its resizes); the question box is too small for that,
  // so there the simulation is the size of the screen and the box shows its part of it. Only the ink lasts longer:
  // DENSITY_DISSIPATION 0.5 -> 0.36 keeps it visible about 2 s more (exp(-d*t): 10% left at 4.6 s -> 6.4 s).
  const config = {
    SIM_RESOLUTION: 128,
    DYE_RESOLUTION: 1440,
    DENSITY_DISSIPATION: 0.36,
    VELOCITY_DISSIPATION: 3,
    PRESSURE: 0.1,
    PRESSURE_ITERATIONS: 20,
    CURL: 3,
    SPLAT_RADIUS: 0.2,
    SPLAT_FORCE: 6000,
    COLOR_UPDATE_SPEED: 10,
  };

  const params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
  let gl = canvas.getContext('webgl2', params);
  const isWebGL2 = !!gl;
  if (!gl) gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);
  if (!gl) return;

  let halfFloat, supportLinearFiltering;
  if (isWebGL2) {
    gl.getExtension('EXT_color_buffer_float');
    supportLinearFiltering = gl.getExtension('OES_texture_float_linear');
  } else {
    halfFloat = gl.getExtension('OES_texture_half_float');
    supportLinearFiltering = gl.getExtension('OES_texture_half_float_linear');
  }
  gl.clearColor(0, 0, 0, 0);
  const halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : halfFloat && halfFloat.HALF_FLOAT_OES;
  if (!halfFloatTexType) return;

  function supportRenderTextureFormat(internalFormat, format, type) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  }
  function getSupportedFormat(internalFormat, format, type) {
    if (!supportRenderTextureFormat(internalFormat, format, type)) {
      if (!isWebGL2) return null;
      switch (internalFormat) {
        case gl.R16F: return getSupportedFormat(gl.RG16F, gl.RG, type);
        case gl.RG16F: return getSupportedFormat(gl.RGBA16F, gl.RGBA, type);
        default: return null;
      }
    }
    return { internalFormat, format };
  }
  let formatRGBA, formatRG, formatR;
  if (isWebGL2) {
    formatRGBA = getSupportedFormat(gl.RGBA16F, gl.RGBA, halfFloatTexType);
    formatRG = getSupportedFormat(gl.RG16F, gl.RG, halfFloatTexType);
    formatR = getSupportedFormat(gl.R16F, gl.RED, halfFloatTexType);
  } else {
    formatRGBA = getSupportedFormat(gl.RGBA, gl.RGBA, halfFloatTexType);
    formatRG = formatRGBA;
    formatR = formatRGBA;
  }
  if (!formatRGBA || !formatRG || !formatR) return;

  function compileShader(type, source, keywords) {
    if (keywords) source = keywords.map(k => '#define ' + k + '\n').join('') + source;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(shader));
    return shader;
  }
  function createProgram(vs, fs) {
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) console.warn(gl.getProgramInfoLog(program));
    const uniforms = {};
    const n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(program, i).name;
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    return { program, uniforms, bind() { gl.useProgram(program); } };
  }

  const baseVertex = compileShader(gl.VERTEX_SHADER, `
    precision highp float;
    attribute vec2 aPosition;
    varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
    uniform vec2 texelSize;
    void main () {
      vUv = aPosition * 0.5 + 0.5;
      vL = vUv - vec2(texelSize.x, 0.0);
      vR = vUv + vec2(texelSize.x, 0.0);
      vT = vUv + vec2(0.0, texelSize.y);
      vB = vUv - vec2(0.0, texelSize.y);
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }`);
  const frag = (src, kw) => compileShader(gl.FRAGMENT_SHADER, src, kw);

  const clearProgram = createProgram(baseVertex, frag(`
    precision mediump float; precision mediump sampler2D;
    varying highp vec2 vUv; uniform sampler2D uTexture; uniform float value;
    void main () { gl_FragColor = value * texture2D(uTexture, vUv); }`));

  // uRect = the canvas' place inside the simulation area (x, y from the bottom-left, width, height)
  const displayVertex = compileShader(gl.VERTEX_SHADER, `
    precision highp float;
    attribute vec2 aPosition;
    varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
    uniform vec2 texelSize; uniform vec4 uRect;
    void main () {
      vUv = uRect.xy + (aPosition * 0.5 + 0.5) * uRect.zw;
      vL = vUv - vec2(texelSize.x, 0.0);
      vR = vUv + vec2(texelSize.x, 0.0);
      vT = vUv + vec2(0.0, texelSize.y);
      vB = vUv - vec2(0.0, texelSize.y);
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }`);
  const displayProgram = createProgram(displayVertex, frag(`
    precision highp float; precision highp sampler2D;
    varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
    uniform sampler2D uTexture; uniform vec2 texelSize;
    void main () {
      vec3 c = texture2D(uTexture, vUv).rgb;
      vec3 lc = texture2D(uTexture, vL).rgb;
      vec3 rc = texture2D(uTexture, vR).rgb;
      vec3 tc = texture2D(uTexture, vT).rgb;
      vec3 bc = texture2D(uTexture, vB).rgb;
      float dx = length(rc) - length(lc);
      float dy = length(tc) - length(bc);
      vec3 n = normalize(vec3(dx, dy, length(texelSize)));
      float diffuse = clamp(dot(n, vec3(0.0, 0.0, 1.0)) + 0.7, 0.7, 1.0);
      c *= diffuse;
      float a = max(c.r, max(c.g, c.b));
      gl_FragColor = vec4(c, a);
    }`));

  const copyProgram = createProgram(baseVertex, frag(`
    precision mediump float; precision mediump sampler2D;
    varying highp vec2 vUv; uniform sampler2D uTexture;
    void main () { gl_FragColor = texture2D(uTexture, vUv); }`));

  const splatProgram = createProgram(baseVertex, frag(`
    precision highp float; precision highp sampler2D;
    varying vec2 vUv; uniform sampler2D uTarget; uniform float aspectRatio;
    uniform vec3 color; uniform vec2 point; uniform float radius;
    void main () {
      vec2 p = vUv - point.xy;
      p.x *= aspectRatio;
      vec3 splat = exp(-dot(p, p) / radius) * color;
      vec3 base = texture2D(uTarget, vUv).xyz;
      gl_FragColor = vec4(base + splat, 1.0);
    }`));

  const advectionProgram = createProgram(baseVertex, frag(`
    precision highp float; precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uVelocity; uniform sampler2D uSource;
    uniform vec2 texelSize; uniform vec2 dyeTexelSize; uniform float dt; uniform float dissipation;
    vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
      vec2 st = uv / tsize - 0.5;
      vec2 iuv = floor(st);
      vec2 fuv = fract(st);
      vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
      vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
      vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
      vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
      return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
    }
    void main () {
    #ifdef MANUAL_FILTERING
      vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
      vec4 result = bilerp(uSource, coord, dyeTexelSize);
    #else
      vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
      vec4 result = texture2D(uSource, coord);
    #endif
      float decay = 1.0 + dissipation * dt;
      gl_FragColor = result / decay;
    }`, supportLinearFiltering ? null : ['MANUAL_FILTERING']));

  const divergenceProgram = createProgram(baseVertex, frag(`
    precision mediump float; precision mediump sampler2D;
    varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB;
    uniform sampler2D uVelocity;
    void main () {
      float L = texture2D(uVelocity, vL).x;
      float R = texture2D(uVelocity, vR).x;
      float T = texture2D(uVelocity, vT).y;
      float B = texture2D(uVelocity, vB).y;
      vec2 C = texture2D(uVelocity, vUv).xy;
      if (vL.x < 0.0) { L = -C.x; }
      if (vR.x > 1.0) { R = -C.x; }
      if (vT.y > 1.0) { T = -C.y; }
      if (vB.y < 0.0) { B = -C.y; }
      float div = 0.5 * (R - L + T - B);
      gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
    }`));

  const curlProgram = createProgram(baseVertex, frag(`
    precision mediump float; precision mediump sampler2D;
    varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB;
    uniform sampler2D uVelocity;
    void main () {
      float L = texture2D(uVelocity, vL).y;
      float R = texture2D(uVelocity, vR).y;
      float T = texture2D(uVelocity, vT).x;
      float B = texture2D(uVelocity, vB).x;
      float vorticity = R - L - T + B;
      gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
    }`));

  const vorticityProgram = createProgram(baseVertex, frag(`
    precision highp float; precision highp sampler2D;
    varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
    uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt;
    void main () {
      float L = texture2D(uCurl, vL).x;
      float R = texture2D(uCurl, vR).x;
      float T = texture2D(uCurl, vT).x;
      float B = texture2D(uCurl, vB).x;
      float C = texture2D(uCurl, vUv).x;
      vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
      force /= length(force) + 0.0001;
      force *= curl * C;
      force.y *= -1.0;
      vec2 velocity = texture2D(uVelocity, vUv).xy;
      velocity += force * dt;
      velocity = min(max(velocity, -1000.0), 1000.0);
      gl_FragColor = vec4(velocity, 0.0, 1.0);
    }`));

  const pressureProgram = createProgram(baseVertex, frag(`
    precision mediump float; precision mediump sampler2D;
    varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB;
    uniform sampler2D uPressure; uniform sampler2D uDivergence;
    void main () {
      float L = texture2D(uPressure, vL).x;
      float R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x;
      float B = texture2D(uPressure, vB).x;
      float divergence = texture2D(uDivergence, vUv).x;
      float pressure = (L + R + B + T - divergence) * 0.25;
      gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
    }`));

  const gradientSubtractProgram = createProgram(baseVertex, frag(`
    precision mediump float; precision mediump sampler2D;
    varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB;
    uniform sampler2D uPressure; uniform sampler2D uVelocity;
    void main () {
      float L = texture2D(uPressure, vL).x;
      float R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x;
      float B = texture2D(uPressure, vB).x;
      vec2 velocity = texture2D(uVelocity, vUv).xy;
      velocity.xy -= vec2(R - L, T - B);
      gl_FragColor = vec4(velocity, 0.0, 1.0);
    }`));

  // Full-screen quad
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);
  function blit(target) {
    if (target == null) {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    } else {
      gl.viewport(0, 0, target.width, target.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }

  function createFBO(w, h, internalFormat, format, type, param) {
    gl.activeTexture(gl.TEXTURE0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return {
      texture, fbo, width: w, height: h, texelSizeX: 1 / w, texelSizeY: 1 / h,
      attach(id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, texture); return id; },
    };
  }
  function createDoubleFBO(w, h, internalFormat, format, type, param) {
    let a = createFBO(w, h, internalFormat, format, type, param);
    let b = createFBO(w, h, internalFormat, format, type, param);
    return {
      width: w, height: h, texelSizeX: a.texelSizeX, texelSizeY: a.texelSizeY,
      get read() { return a; }, set read(v) { a = v; },
      get write() { return b; }, set write(v) { b = v; },
      swap() { const t = a; a = b; b = t; },
    };
  }
  // new size, same content (stretched): used while the chat window is being resized
  function resizeFBO(target, w, h, internalFormat, format, type, param) {
    const next = createFBO(w, h, internalFormat, format, type, param);
    copyProgram.bind();
    gl.uniform1i(copyProgram.uniforms.uTexture, target.attach(0));
    blit(next);
    return next;
  }
  function resizeDoubleFBO(target, w, h, internalFormat, format, type, param) {
    if (target.width === w && target.height === h) return target;
    target.read = resizeFBO(target.read, w, h, internalFormat, format, type, param);
    target.write = createFBO(w, h, internalFormat, format, type, param);
    target.width = w; target.height = h; target.texelSizeX = 1 / w; target.texelSizeY = 1 / h;
    return target;
  }

  // ── Automatic quality ──
  // Strong graphics cards keep level 0 (the reference's settings). On weaker ones (notebooks with
  // integrated graphics) the frame rate is measured and the quality drops one level at a time, cutting
  // first what shows least: pressure passes, then ink resolution, then the simulation grid and pixel density.
  const QUALITY = [
    { iter: 20, dye: 1, sim: 1, dpr: 4 },
    { iter: 12, dye: 1, sim: 1, dpr: 4 },
    { iter: 10, dye: 0.7, sim: 1, dpr: 1.5 },
    { iter: 8, dye: 0.5, sim: 0.75, dpr: 1 },
    { iter: 6, dye: 0.4, sim: 0.6, dpr: 1 },
  ];
  let level = 0;
  try { level = Math.min(QUALITY.length - 1, Math.max(0, +sessionStorage.getItem('kk-ink-q') || 0)); } catch (e) {}
  let Q = QUALITY[level];
  const fullDpr = window.devicePixelRatio || 1;
  let dpr = Math.min(fullDpr, Q.dpr);
  // Simulation area, in CSS pixels. Chat: the window itself. Question box: an area of BOX_AREA x the screen,
  // centered on the box (never smaller than the box); the drops grow with this number
  // (1 = as big as on a full-screen canvas, which was too big; the box alone was too small).
  const BOX_AREA = 0.5;
  let screenMode = canvas.clientHeight <= 150;
  let rect = canvas.getBoundingClientRect();
  const boxArea = () => {
    const w = Math.max(innerWidth * BOX_AREA, rect.width + 48), h = Math.max(innerHeight * BOX_AREA, rect.height + 48);
    return { left: rect.left + rect.width / 2 - w / 2, top: rect.top + rect.height / 2 - h / 2, width: w, height: h };
  };
  const area = () => screenMode ? boxArea() : rect;
  let simW = 1, simH = 1; // the area in device pixels
  const aspectRatio = () => simW / simH;
  function getResolution(resolution) {
    let aspect = aspectRatio();
    if (aspect < 1) aspect = 1 / aspect;
    const min = Math.round(resolution), max = Math.round(resolution * aspect);
    return simW > simH ? { width: max, height: min } : { width: min, height: max };
  }

  let dye, velocity, divergence, curl, pressure;
  // keep = stretch the current ink to the new size (resizing); otherwise start empty (box <-> chat)
  function initFramebuffers(keep) {
    const simRes = getResolution(Math.round(config.SIM_RESOLUTION * Q.sim));
    // the reference draws 1440 dye pixels over a ~900 px screen (1.6 per pixel); same density here,
    // without building a texture far bigger than the window
    const dyeRes = getResolution(Math.round(Math.min(config.DYE_RESOLUTION, Math.ceil(Math.min(simW, simH) * 1.6)) * Q.dye));
    const filtering = supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
    const rgba = [formatRGBA.internalFormat, formatRGBA.format, halfFloatTexType, filtering];
    const rg = [formatRG.internalFormat, formatRG.format, halfFloatTexType, filtering];
    const r = [formatR.internalFormat, formatR.format, halfFloatTexType, gl.NEAREST];
    gl.disable(gl.BLEND);
    if (keep && dye) {
      dye = resizeDoubleFBO(dye, dyeRes.width, dyeRes.height, ...rgba);
      velocity = resizeDoubleFBO(velocity, simRes.width, simRes.height, ...rg);
    } else {
      dye = createDoubleFBO(dyeRes.width, dyeRes.height, ...rgba);
      velocity = createDoubleFBO(simRes.width, simRes.height, ...rg);
    }
    divergence = createFBO(simRes.width, simRes.height, ...r);
    curl = createFBO(simRes.width, simRes.height, ...r);
    pressure = createDoubleFBO(simRes.width, simRes.height, ...r);
  }
  // true when the simulation area changed size (the canvas pixels follow the canvas either way)
  function resizeCanvas() {
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr)), h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    rect = canvas.getBoundingClientRect();
    // chat: the canvas' own size (its on-screen box changes during the open/close animation)
    const b = screenMode && boxArea();
    const aw = screenMode ? Math.max(1, Math.floor(b.width * dpr)) : w, ah = screenMode ? Math.max(1, Math.floor(b.height * dpr)) : h;
    if (aw === simW && ah === simH) return false;
    simW = aw; simH = ah;
    return true;
  }

  function HSVtoRGB(h, s, v) {
    const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    const m = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
    return { r: m[0], g: m[1], b: m[2] };
  }
  function generateColor() {
    const c = HSVtoRGB(Math.random(), 1, 1);
    return { r: c.r * 0.15, g: c.g * 0.15, b: c.b * 0.15 };
  }

  function correctRadius(radius) {
    const aspect = aspectRatio();
    if (aspect > 1) radius *= aspect;
    return radius;
  }
  function splat(x, y, dx, dy, color) {
    splatProgram.bind();
    gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
    gl.uniform1f(splatProgram.uniforms.aspectRatio, aspectRatio());
    gl.uniform2f(splatProgram.uniforms.point, x, y);
    gl.uniform3f(splatProgram.uniforms.color, dx, dy, 0);
    gl.uniform1f(splatProgram.uniforms.radius, correctRadius(config.SPLAT_RADIUS / 100));
    blit(velocity.write);
    velocity.swap();
    gl.uniform1i(splatProgram.uniforms.uTarget, dye.read.attach(0));
    gl.uniform3f(splatProgram.uniforms.color, color.r, color.g, color.b);
    blit(dye.write);
    dye.swap();
  }

  function step(dt) {
    gl.disable(gl.BLEND);
    curlProgram.bind();
    gl.uniform2f(curlProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
    blit(curl);

    vorticityProgram.bind();
    gl.uniform2f(vorticityProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
    gl.uniform1f(vorticityProgram.uniforms.curl, config.CURL);
    gl.uniform1f(vorticityProgram.uniforms.dt, dt);
    blit(velocity.write);
    velocity.swap();

    divergenceProgram.bind();
    gl.uniform2f(divergenceProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
    blit(divergence);

    clearProgram.bind();
    gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read.attach(0));
    gl.uniform1f(clearProgram.uniforms.value, config.PRESSURE);
    blit(pressure.write);
    pressure.swap();

    pressureProgram.bind();
    gl.uniform2f(pressureProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(0));
    for (let i = 0; i < Q.iter; i++) {
      gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(1));
      blit(pressure.write);
      pressure.swap();
    }

    gradientSubtractProgram.bind();
    gl.uniform2f(gradientSubtractProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(gradientSubtractProgram.uniforms.uPressure, pressure.read.attach(0));
    gl.uniform1i(gradientSubtractProgram.uniforms.uVelocity, velocity.read.attach(1));
    blit(velocity.write);
    velocity.swap();

    advectionProgram.bind();
    gl.uniform2f(advectionProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    if (!supportLinearFiltering) gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
    const velocityId = velocity.read.attach(0);
    gl.uniform1i(advectionProgram.uniforms.uVelocity, velocityId);
    gl.uniform1i(advectionProgram.uniforms.uSource, velocityId);
    gl.uniform1f(advectionProgram.uniforms.dt, dt);
    gl.uniform1f(advectionProgram.uniforms.dissipation, config.VELOCITY_DISSIPATION);
    blit(velocity.write);
    velocity.swap();

    if (!supportLinearFiltering) gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
    gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(advectionProgram.uniforms.uSource, dye.read.attach(1));
    gl.uniform1f(advectionProgram.uniforms.dissipation, config.DENSITY_DISSIPATION);
    blit(dye.write);
    dye.swap();
  }

  function render() {
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);
    displayProgram.bind();
    const a = area();
    gl.uniform2f(displayProgram.uniforms.texelSize, 1 / simW, 1 / simH);
    if (screenMode) gl.uniform4f(displayProgram.uniforms.uRect, (rect.left - a.left) / a.width, 1 - (rect.bottom - a.top) / a.height, rect.width / a.width, rect.height / a.height);
    else gl.uniform4f(displayProgram.uniforms.uRect, 0, 0, 1, 1);
    gl.uniform1i(displayProgram.uniforms.uTexture, dye.read.attach(0));
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }

  // ── Input: the same handling as the reference, measured inside the window (box or chat) ──
  const pointer = { texcoordX: 0, texcoordY: 0, prevTexcoordX: 0, prevTexcoordY: 0, deltaX: 0, deltaY: 0, down: false, moved: false, color: generateColor() };
  const toX = clientX => { const a = area(); return (clientX - a.left) / a.width; };
  const toY = clientY => { const a = area(); return 1 - (clientY - a.top) / a.height; };
  const over = (x, y, pad) => x > rect.left - pad && x < rect.right + pad && y > rect.top - pad && y < rect.bottom + pad;
  function correctDeltaX(delta) { const a = aspectRatio(); if (a < 1) delta *= a; return delta; }
  function correctDeltaY(delta) { const a = aspectRatio(); if (a > 1) delta /= a; return delta; }
  function pointerDown(clientX, clientY) {
    pointer.down = true; pointer.moved = false;
    pointer.texcoordX = pointer.prevTexcoordX = toX(clientX);
    pointer.texcoordY = pointer.prevTexcoordY = toY(clientY);
    pointer.deltaX = pointer.deltaY = 0;
    pointer.color = generateColor();
  }
  function pointerMove(clientX, clientY) {
    pointer.prevTexcoordX = pointer.texcoordX; pointer.prevTexcoordY = pointer.texcoordY;
    pointer.texcoordX = toX(clientX); pointer.texcoordY = toY(clientY);
    pointer.deltaX = correctDeltaX(pointer.texcoordX - pointer.prevTexcoordX);
    pointer.deltaY = correctDeltaY(pointer.texcoordY - pointer.prevTexcoordY);
    pointer.moved = Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
  }
  let lastInput = performance.now(), inside = false;
  // entering the window only places the pointer, so the ink doesn't jump from where the mouse left
  function track(clientX, clientY) {
    rect = canvas.getBoundingClientRect();
    if (!over(clientX, clientY, 24)) { inside = false; return; }
    if (!inside) { inside = true; pointerDown(clientX, clientY); pointer.down = false; }
    else pointerMove(clientX, clientY);
    lastInput = performance.now();
  }
  window.addEventListener('mousemove', e => track(e.clientX, e.clientY), { passive: true });
  // a click inside the window drops a bigger, brighter burst of ink, like the reference
  window.addEventListener('mousedown', e => {
    rect = canvas.getBoundingClientRect();
    if (!over(e.clientX, e.clientY, 0)) return;
    pointerDown(e.clientX, e.clientY);
    const c = generateColor();
    c.r *= 10; c.g *= 10; c.b *= 10;
    splat(pointer.texcoordX, pointer.texcoordY, 10 * (Math.random() - 0.5), 30 * (Math.random() - 0.5), c);
    lastInput = performance.now();
  });
  window.addEventListener('mouseup', () => { pointer.down = false; });
  window.addEventListener('touchstart', e => { const t = e.targetTouches[0]; inside = false; if (t) track(t.clientX, t.clientY); }, { passive: true });
  window.addEventListener('touchmove', e => { const t = e.targetTouches[0]; if (t) track(t.clientX, t.clientY); }, { passive: true });
  window.addEventListener('touchend', () => { pointer.down = false; });

  // Kept from before: an opening sweep along the box, and a soft stir every few seconds while nobody is
  // moving the mouse, so the box is never empty. Both go through the same simulation.
  const boxStroke = (k, r) => [r.left + r.width * (0.04 + 0.92 * k), r.top + r.height * (0.5 + 0.32 * Math.sin(k * Math.PI * 3))];
  let introT = 0;
  function intro(dt) {
    if (introT > 1.4) return;
    rect = canvas.getBoundingClientRect();
    const first = introT === 0;
    introT += dt;
    const [x, y] = boxStroke(Math.min(introT / 1.4, 1), rect);
    if (first) { pointerDown(x, y); pointer.down = false; } else pointerMove(x, y);
  }
  let visible = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(canvas);
  setInterval(() => {
    if (!visible || document.hidden || introT <= 1.4 || performance.now() - lastInput < 2500) return;
    const dir = Math.random() < 0.5 ? -1 : 1;
    rect = canvas.getBoundingClientRect();
    const x = toX(rect.left + rect.width * (0.15 + Math.random() * 0.7)), y = toY(rect.top + rect.height * (0.2 + Math.random() * 0.6));
    splat(x, y, dir * (60 + Math.random() * 50), (Math.random() - 0.5) * 30, generateColor());
    lastInput = performance.now();
  }, 3200);

  // Called by the page when the canvas moves between the question box and the chat window.
  // Called by the page when the canvas moves between the question box and the chat window: fresh ink.
  let fresh = false;
  window.fluidRelayout = function () { screenMode = canvas.clientHeight <= 150; fresh = true; introT = 0; inside = false; lastInput = performance.now(); };
  window.fluidRefresh = function () { rect = canvas.getBoundingClientRect(); lastInput = performance.now(); };

  // Frames are counted in 1.5 s windows while the ink is working. Two windows under 48 fps: one level down (the ink
  // is stretched to the new size, nothing blinks), then a short pause before measuring again.
  // Only downwards, so it never keeps switching; the level is kept until the tab is closed.
  let meterStart = 0, meterFrames = 0, badWindows = 0, settleUntil = performance.now() + 1500; // page load is not a fair sample
  function meter(now, gap) {
    if (gap > 250 || now < settleUntil) { meterStart = 0; return; } // tab switch, idle, or just changed
    if (!meterStart) { meterStart = now; meterFrames = 0; return; }
    meterFrames++;
    if (now - meterStart < 1500) return;
    const fps = meterFrames * 1000 / (now - meterStart);
    meterStart = 0;
    // two slow windows in a row: one stutter (opening the chat, a page load) doesn't count
    badWindows = fps < 48 ? badWindows + 1 : 0;
    if (badWindows < 2 || level >= QUALITY.length - 1) return;
    badWindows = 0;
    level++;
    Q = QUALITY[level];
    dpr = Math.min(fullDpr, Q.dpr);
    simW = -1; // forces the framebuffers to be rebuilt (stretching the current ink) on the next frame
    settleUntil = now + 600;
    try { sessionStorage.setItem('kk-ink-q', String(level)); } catch (e) {}
  }
  window.fluidQuality = () => ({ level, ...Q });

  resizeCanvas();
  initFramebuffers(false);
  let last = performance.now(), colorTimer = 0;
  function frame() {
    const now = performance.now();
    const gap = now - last;
    const dt = Math.min(gap / 1000, 0.016666);
    last = now;
    // nothing on screen to show, or nothing moving for a while: skip the work
    if (!visible || document.hidden || (now - lastInput > 12000 && introT > 1.4)) { meterStart = 0; requestAnimationFrame(frame); return; }
    meter(now, gap);
    // resizing the chat window stretches the ink with it; moving between box and chat starts over
    if (resizeCanvas() || fresh) { initFramebuffers(!fresh); fresh = false; }
    colorTimer += dt * config.COLOR_UPDATE_SPEED;
    if (colorTimer >= 1) { colorTimer %= 1; pointer.color = generateColor(); }
    intro(dt);
    if (pointer.moved) {
      pointer.moved = false;
      splat(pointer.texcoordX, pointer.texcoordY, pointer.deltaX * config.SPLAT_FORCE, pointer.deltaY * config.SPLAT_FORCE, pointer.color);
    }
    step(dt);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
