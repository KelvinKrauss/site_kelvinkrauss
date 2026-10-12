/* Medidor de desempenho: só carrega em kelvinkrauss.me/fps (ou ?fps). Mostra quadros por segundo da página
   inteira, o pior quadro (as travadas), um gráfico dos últimos quadros, o nível de qualidade da tinta e a placa
   de vídeo. Tem fundo sólido de propósito: vidro (blur) custaria desempenho e atrapalharia a própria medida. */
(function () {
  const box = document.createElement('div');
  box.id = 'fps-meter';
  box.setAttribute('aria-hidden', 'true');
  box.style.cssText = 'position:fixed;top:12px;left:12px;z-index:9999;width:236px;padding:10px 12px 12px;border-radius:12px;' +
    'background:rgba(8,10,14,.92);color:#e8ebf2;font:12px/1.5 ui-monospace,Consolas,monospace;box-shadow:0 0 0 1px rgba(255,255,255,.12),0 10px 30px rgba(0,0,0,.4);';
  box.innerHTML =
    '<div style="display:flex;align-items:baseline;gap:8px"><b id="fps-n" style="font-size:26px;line-height:1">--</b><span>fps</span>' +
    '<button id="fps-x" type="button" title="Fechar" style="all:unset;margin-left:auto;cursor:pointer;padding:0 4px;color:#8d94a6">✕</button></div>' +
    '<canvas id="fps-g" width="212" height="44" style="display:block;width:212px;height:44px;margin:8px 0 6px;background:#11151d;border-radius:6px"></canvas>' +
    '<div id="fps-t"></div>' +
    '<div id="fps-sw" style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,.12);display:flex;flex-direction:column;gap:5px">' +
    '<span style="color:#8d94a6">efeitos (desmarque para ver sem):</span></div>' +
    '<button id="fps-r" type="button" style="all:unset;cursor:pointer;margin-top:8px;color:#74a6ff;text-decoration:underline">Testar de novo do zero</button>';
  document.body.appendChild(box);

  /* Switches: each one turns one effect off on this page only (nothing is saved), so the look and the fps can be
     compared on the real computer. */
  const css = document.createElement('style');
  document.head.appendChild(css);
  const off = {};
  const rules = {
    glass: '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
    float: '.now-card,.now-card::after{animation:none!important}',
    small: '.now-dot,.themes .sw i{animation:none!important}',
    ink: '#fluid{visibility:hidden!important}',
  };
  // the "bending" of the glass is an SVG filter set by the page on each element; without it, plain blur stays
  const glassEls = [...document.querySelectorAll('.glass[data-glass]')];
  function refraction(on) {
    glassEls.forEach(el => {
      if (!on) { el._fpsOrig = el.style.backdropFilter; el.style.backdropFilter = el.style.backdropFilter.replace(/url\([^)]*\)\s*/, ''); }
      else if (el._fpsOrig != null) el.style.backdropFilter = el._fpsOrig;
    });
  }
  const switches = [
    ['echo', 'Fundo se mexendo', on => { window.kkEchoStill = !on; }],
    ['glass', 'Vidro (desfoque atrás)', null],
    ['refr', 'Vidro entortando (refração)', refraction],
    ['inkidle', 'Tinta se mexendo sozinha', on => { window.kkInkIdleOff = !on; }],
    ['ink', 'Tinta na caixa de pergunta', on => { window.kkInkHidden = !on; }],
    ['float', 'Card "Agora" flutuando', null],
    ['small', 'Bolinha verde pulsando', null],
  ];
  const swBox = box.querySelector('#fps-sw');
  switches.forEach(([key, label, fn]) => {
    const lab = document.createElement('label');
    lab.style.cssText = 'display:flex;gap:7px;align-items:center;cursor:pointer';
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = true; cb.style.cssText = 'margin:0;accent-color:#74a6ff';
    // in light mode only the background is on; the others are off by the mode itself
    if (document.documentElement.classList.contains('lite') && key !== 'echo') { cb.checked = false; cb.disabled = true; lab.style.opacity = '.5'; lab.style.cursor = 'default'; }
    cb.addEventListener('change', () => {
      off[key] = !cb.checked;
      if (fn) fn(cb.checked);
      css.textContent = Object.keys(rules).filter(k => off[k]).map(k => rules[k]).join('\n');
      worstReset = true;
    });
    lab.append(cb, document.createTextNode(label));
    swBox.appendChild(lab);
  });
  let worstReset = false;
  const nEl = box.querySelector('#fps-n'), tEl = box.querySelector('#fps-t'), g = box.querySelector('#fps-g').getContext('2d');
  box.querySelector('#fps-x').addEventListener('click', () => { box.remove(); running = false; });
  // the ink only lowers its quality (and remembers it for the tab): this starts the test again at the top level
  // forgets everything the site decided about this computer (ink level and light mode) and measures again
  box.querySelector('#fps-r').addEventListener('click', () => {
    try { sessionStorage.removeItem('kk-ink-q'); localStorage.removeItem('kk-lite'); } catch (e) {}
    location.href = location.pathname + (location.pathname.replace(/\/$/, '') === '/fps' ? '' : '?fps');
  });
  // light mode: which one is on, why, and a link to see the other one
  const lite = document.documentElement.classList.contains('lite');
  const modeEl = document.createElement('div');
  modeEl.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.12)';
  const other = location.pathname + '?' + (location.pathname.replace(/\/$/, '') === '/fps' ? '' : 'fps&') + (lite ? 'full' : 'lite');
  modeEl.innerHTML = 'modo: <b style="color:' + (lite ? '#facc15' : '#6ee7a8') + '">' + (lite ? 'leve' : 'completo') + '</b>' +
    (lite && window.kkLite ? '<br><span style="color:#8d94a6">motivo: ' + String(window.kkLite).replace(/[&<>]/g, '') + '</span>' : '') +
    '<br><a href="' + other + '" style="color:#74a6ff">ver o modo ' + (lite ? 'completo' : 'leve') + '</a>';
  box.querySelector('#fps-sw').before(modeEl);

  // graphics card name (Chrome and Edge show it; other browsers may hide it)
  let gpu = 'desconhecida';
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) gpu = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL).replace(/^ANGLE \((.*)\)$/, '$1').replace(/\s*\(0x[0-9a-f]+\)/i, '').replace(/,?\s*(Direct3D|D3D)\S*.*$/i, '');
    const lose = gl && gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
  } catch (e) {}

  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const times = []; // duration of the last 120 frames, in ms
  let running = true, prev = performance.now(), count = 0, windowStart = prev, worst = 0;
  function frame(now) {
    if (!running) return;
    const dt = now - prev; prev = now;
    if (worstReset) { worstReset = false; times.length = 0; worst = 0; } // a switch changed: the graph starts fresh
    if (dt < 1000) { times.push(dt); if (times.length > 120) times.shift(); worst = Math.max(worst, dt); count++; }
    if (now - windowStart >= 500) {
      const fps = Math.round(count * 1000 / (now - windowStart));
      nEl.textContent = fps;
      nEl.style.color = fps >= 55 ? '#6ee7a8' : fps >= 40 ? '#facc15' : '#ff7b7b';
      const q = window.fluidQuality ? window.fluidQuality() : null;
      tEl.innerHTML =
        'pior quadro: <b style="color:' + (worst > 50 ? '#ff7b7b' : worst > 25 ? '#facc15' : '#e8ebf2') + '">' + Math.round(worst) + ' ms</b><br>' +
        'tinta: ' + (q ? 'nível ' + q.level + ' de 4' + (q.level ? ' (reduzida)' : ' (máxima)') : 'sem WebGL') + '<br>' +
        'tela: ' + innerWidth + '×' + innerHeight + ' @' + (devicePixelRatio || 1).toFixed(2) + 'x<br>' +
        '<span style="color:#8d94a6">placa: ' + esc(gpu) + '</span>';
      count = 0; windowStart = now; worst = 0;
      draw();
    }
    requestAnimationFrame(frame);
  }
  // graph: each bar is one frame; the taller, the slower. The line marks 60 fps (16.7 ms), the dashed one 30 fps.
  function draw() {
    const W = 212, H = 44, max = 50;
    g.clearRect(0, 0, W, H);
    const bw = W / 120;
    times.forEach((t, i) => {
      const h = Math.min(H, t / max * H);
      g.fillStyle = t > 33.4 ? '#ff7b7b' : t > 20 ? '#facc15' : '#4b84f0';
      g.fillRect(i * bw, H - h, Math.max(1, bw - .4), h);
    });
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, H - 16.7 / max * H, W, 1);
    for (let x = 0; x < W; x += 6) g.fillRect(x, H - 33.3 / max * H, 3, 1);
  }
  requestAnimationFrame(frame);
})();
