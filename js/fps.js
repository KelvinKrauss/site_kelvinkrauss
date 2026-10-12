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
    '<button id="fps-r" type="button" style="all:unset;cursor:pointer;margin-top:8px;color:#74a6ff;text-decoration:underline">Testar de novo do zero</button>';
  document.body.appendChild(box);
  const nEl = box.querySelector('#fps-n'), tEl = box.querySelector('#fps-t'), g = box.querySelector('#fps-g').getContext('2d');
  box.querySelector('#fps-x').addEventListener('click', () => { box.remove(); running = false; });
  // the ink only lowers its quality (and remembers it for the tab): this starts the test again at the top level
  box.querySelector('#fps-r').addEventListener('click', () => { try { sessionStorage.removeItem('kk-ink-q'); } catch (e) {} location.reload(); });

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
