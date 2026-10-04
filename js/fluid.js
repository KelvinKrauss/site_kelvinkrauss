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
  // Sized for a small, wide canvas (the question box), not the whole screen.
  const config = {
    SIM_RESOLUTION: 64,
    DYE_RESOLUTION: 256,
    DENSITY_DISSIPATION: 0.9,
    VELOCITY_DISSIPATION: 1.4,
    PRESSURE: 0.1,
    PRESSURE_ITERATIONS: 20,
    CURL: 3,
    SPLAT_RADIUS: 0.2,
    SPLAT_SIZE: 0.1,
    SPLAT_FORCE: 3500,
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

  const displayProgram = createProgram(baseVertex, frag(`
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
      // soft roll-off instead of a hard clamp: thick ink stays bright but keeps its gradient and gloss
      // (a hard clamp turned it into flat neon patches with sharp edges)
      c = vec3(1.0) - exp(-c * 2.2);
      float a = max(c.r, max(c.g, c.b));
      gl_FragColor = vec4(c, a);
    }`));

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

  // Solid barrier: inside the (rounded) rectangle the ink is erased and the flow stops; just outside,
  // velocity pointing into the wall is reflected, so the ink bounces off instead of passing through.
  const MAX_WALLS = 10;
  const obstacleProgram = createProgram(baseVertex, frag(`
    precision highp float; precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uTarget; uniform vec4 rects[10]; uniform int count; uniform float aspectRatio; uniform float mode;
    float sdBox (vec2 p, vec2 b, float r) {
      vec2 d = abs(p) - (b - r);
      return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
    }
    float dist (vec2 uv) {
      float best = 10.0;
      for (int i = 0; i < 10; i++) {
        if (i >= count) break;
        vec4 rc = rects[i];
        vec2 c = (rc.xy + rc.zw) * 0.5;
        vec2 h = (rc.zw - rc.xy) * 0.5;
        vec2 p = uv - c;
        p.x *= aspectRatio; h.x *= aspectRatio;
        best = min(best, sdBox(p, h, min(0.03, min(h.x, h.y))));
      }
      return best;
    }
    void main () {
      vec4 v = texture2D(uTarget, vUv);
      float d = dist(vUv);
      if (mode < 0.5) {
        if (d < 0.0) {
          v.xy = vec2(0.0);
        } else if (d < 0.04) {
          vec2 e = vec2(0.002, 0.0);
          vec2 n = vec2(dist(vUv + e.xy) - dist(vUv - e.xy), dist(vUv + e.yx) - dist(vUv - e.yx));
          n = normalize(n + 1e-6);
          float vn = dot(v.xy, n);
          if (vn < 0.0) v.xy -= 1.7 * vn * n;
        }
        gl_FragColor = vec4(v.xy, 0.0, 1.0);
      } else {
        gl_FragColor = vec4(v.rgb * smoothstep(-0.002, 0.012, d), 1.0);
      }
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
      get read() { return a; }, get write() { return b; },
      swap() { const t = a; a = b; b = t; },
    };
  }
  function getResolution(resolution) {
    let aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    if (aspect < 1) aspect = 1 / aspect;
    const min = Math.round(resolution), max = Math.round(resolution * aspect);
    return gl.drawingBufferWidth > gl.drawingBufferHeight ? { width: max, height: min } : { width: min, height: max };
  }

  let dye, velocity, divergence, curl, pressure;
  function initFramebuffers() {
    const simRes = getResolution(config.SIM_RESOLUTION);
    const dyeRes = getResolution(config.DYE_RESOLUTION);
    const filtering = supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
    gl.disable(gl.BLEND);
    dye = createDoubleFBO(dyeRes.width, dyeRes.height, formatRGBA.internalFormat, formatRGBA.format, halfFloatTexType, filtering);
    velocity = createDoubleFBO(simRes.width, simRes.height, formatRG.internalFormat, formatRG.format, halfFloatTexType, filtering);
    divergence = createFBO(simRes.width, simRes.height, formatR.internalFormat, formatR.format, halfFloatTexType, gl.NEAREST);
    curl = createFBO(simRes.width, simRes.height, formatR.internalFormat, formatR.format, halfFloatTexType, gl.NEAREST);
    pressure = createDoubleFBO(simRes.width, simRes.height, formatR.internalFormat, formatR.format, halfFloatTexType, gl.NEAREST);
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  function resizeCanvas() {
    const w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; return true; }
    return false;
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

  const pointer = { x: 0, y: 0, prevX: 0, prevY: 0, dx: 0, dy: 0, moved: false, down: false, color: generateColor(), started: false };

  // Fixed blob size relative to the box height (the default scales with the aspect ratio, which is huge here).
  function correctRadius() { return config.SPLAT_SIZE; }
  function splat(x, y, dx, dy, color) {
    splatProgram.bind();
    gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
    gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
    gl.uniform2f(splatProgram.uniforms.point, x, y);
    gl.uniform3f(splatProgram.uniforms.color, dx, dy, 0);
    gl.uniform1f(splatProgram.uniforms.radius, correctRadius(config.SPLAT_RADIUS / 100));
    blit(velocity.write);
    velocity.swap();
    gl.uniform1i(splatProgram.uniforms.uTarget, dye.read.attach(0));
    gl.uniform3f(splatProgram.uniforms.color, color.r * dyeBoost, color.g * dyeBoost, color.b * dyeBoost);
    blit(dye.write);
    dye.swap();
  }

  // One box per on-screen [data-barrier] element, in texture coordinates (y up). Off on narrow screens,
  // where the text takes the whole width.
  const wallData = new Float32Array(MAX_WALLS * 4);
  function barrierRects() {
    const els = document.querySelectorAll('[data-barrier]');
    if (!els.length || innerWidth < 700) return 0;
    const W = canvas.clientWidth, H = canvas.clientHeight, pad = 16;
    let n = 0;
    for (const el of els) {
      if (n >= MAX_WALLS) break;
      const q = el.getBoundingClientRect();
      if (q.bottom < -pad || q.top > H + pad || !q.width || !q.height) continue;
      const t = Math.max(q.top - pad, -40), b = Math.min(q.bottom + pad, H + 40);
      wallData.set([(q.left - pad) / W, 1 - b / H, (q.right + pad) / W, 1 - t / H], n * 4);
      n++;
    }
    return n;
  }
  function applyObstacle(count, target, mode) {
    obstacleProgram.bind();
    gl.uniform1i(obstacleProgram.uniforms.uTarget, target.read.attach(0));
    gl.uniform4fv(obstacleProgram.uniforms['rects[0]'], wallData);
    gl.uniform1i(obstacleProgram.uniforms.count, count);
    gl.uniform1f(obstacleProgram.uniforms.aspectRatio, canvas.width / canvas.height);
    gl.uniform1f(obstacleProgram.uniforms.mode, mode);
    blit(target.write);
    target.swap();
  }

  function step(dt) {
    gl.disable(gl.BLEND);
    const wall = barrierRects();
    if (wall) { applyObstacle(wall, velocity, 0); applyObstacle(wall, dye, 1); }
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
    for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
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
    if (wall) applyObstacle(wall, velocity, 0);

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
    if (wall) applyObstacle(wall, dye, 1);
  }

  function render() {
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);
    displayProgram.bind();
    gl.uniform2f(displayProgram.uniforms.texelSize, 1 / gl.drawingBufferWidth, 1 / gl.drawingBufferHeight);
    gl.uniform1i(displayProgram.uniforms.uTexture, dye.read.attach(0));
    blit(null);
  }

  // ── Input (only near the box) ──
  let box = canvas.getBoundingClientRect(), inside = false;
  const refreshBox = () => { box = canvas.getBoundingClientRect(); };
  addEventListener('scroll', refreshBox, { passive: true });
  addEventListener('resize', refreshBox);
  window.fluidRefresh = refreshBox; // canvas moved (e.g. chat window dragged)
  // Called by the page when the canvas moves between the question box and the chat window.
  let stirScale = 1, dyeBoost = 1;
  window.fluidRelayout = function () {
    const big = canvas.clientHeight > 150;
    // In the chat window the ink is finer: smaller drops and more resolution.
    // Motion settles fast (high velocity dissipation) and swirls are gentle (low curl), so strokes stay
    // smooth and silky instead of breaking into small turbulent curls, as on aaabadcode.com.
    config.SIM_RESOLUTION = big ? 160 : 64;
    config.DYE_RESOLUTION = big ? 1024 : 256;
    config.SPLAT_SIZE = big ? 0.003 : 0.1;
    config.SPLAT_FORCE = big ? 3000 : 3500;
    config.VELOCITY_DISSIPATION = big ? 2.6 : 1.4;
    config.DENSITY_DISSIPATION = big ? 0.75 : 0.9;
    config.CURL = big ? 4 : 3;
    stirScale = big ? 0.45 : 1;
    dyeBoost = big ? 3 : 1; // smaller drops carry less dye, so each one is brighter
    canvas.width = 0; // forces resizeCanvas() -> initFramebuffers() on the next frame
    refreshBox();
    pointer.started = false;
    introT = 0;
    lastInput = performance.now();
  };
  const near = (x, y) => x > box.left - 24 && x < box.right + 24 && y > box.top - 24 && y < box.bottom + 24;
  function updatePointer(clientX, clientY) {
    const x = (clientX - box.left) * dpr, y = (clientY - box.top) * dpr;
    const tx = x / canvas.width, ty = 1 - y / canvas.height;
    if (!pointer.started) { pointer.x = tx; pointer.y = ty; pointer.started = true; }
    pointer.prevX = pointer.x; pointer.prevY = pointer.y;
    pointer.x = tx; pointer.y = ty;
    const aspect = canvas.width / canvas.height;
    let dx = pointer.x - pointer.prevX, dy = pointer.y - pointer.prevY;
    if (aspect < 1) dx *= aspect;
    if (aspect > 1) dy /= aspect;
    pointer.dx = dx; pointer.dy = dy;
    pointer.moved = Math.abs(dx) > 0 || Math.abs(dy) > 0;
  }
  let lastInput = performance.now();
  function track(clientX, clientY) {
    refreshBox(); // the box can move without a scroll/resize (e.g. language switch changes the text above it)
    if (!near(clientX, clientY)) { inside = false; return; }
    if (!inside) { inside = true; pointer.started = false; }
    updatePointer(clientX, clientY);
    lastInput = performance.now();
  }
  window.addEventListener('mousemove', e => track(e.clientX, e.clientY), { passive: true });
  window.addEventListener('touchstart', e => { inside = false; const t = e.touches[0]; track(t.clientX, t.clientY); }, { passive: true });
  window.addEventListener('touchmove', e => { const t = e.touches[0]; track(t.clientX, t.clientY); }, { passive: true });

  // Opening flourish: one sweep along the box so it is visible before anyone moves the mouse.
  let introT = 0;
  const intro = (dt) => {
    if (introT > 1.4) return;
    introT += dt;
    refreshBox();
    const k = Math.min(introT / 1.4, 1);
    updatePointer(box.left + box.width * (0.04 + 0.92 * k), box.top + box.height * (0.5 + 0.32 * Math.sin(k * Math.PI * 3)));
  };

  // A soft stir every few seconds while the box is on screen, so the glass looks alive.
  let visible = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(canvas);
  setInterval(() => {
    if (!visible || document.hidden || introT <= 1.4 || performance.now() - lastInput < 2500) return;
    const dir = Math.random() < 0.5 ? -1 : 1;
    splat(0.15 + Math.random() * 0.7, stirScale < 1 ? 0.15 + Math.random() * 0.7 : 0.5, dir * (250 + Math.random() * 250) * stirScale, (Math.random() - 0.5) * 150 * stirScale, generateColor());
    lastInput = performance.now();
  }, 3200);

  resizeCanvas();
  initFramebuffers();
  let last = performance.now(), colorTimer = 0;
  function frame() {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.016666);
    last = now;
    if (now - lastInput > 10000 && introT > 1.4) { requestAnimationFrame(frame); return; }
    if (resizeCanvas()) initFramebuffers();
    colorTimer += dt * config.COLOR_UPDATE_SPEED;
    if (colorTimer >= 1) { colorTimer = 0; pointer.color = generateColor(); }
    intro(dt);
    if (pointer.moved) {
      pointer.moved = false;
      splat(pointer.x, pointer.y, pointer.dx * config.SPLAT_FORCE, pointer.dy * config.SPLAT_FORCE, pointer.color);
    }
    step(dt);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
