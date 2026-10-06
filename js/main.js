(() => {
  const $ = s => document.querySelector(s);
  const root = document.documentElement;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  /* ── Assistente: textos ── */
  // As instruções do assistente ficam no servidor (api/chat.js).

  const TXT = {
    pt: {
      hello: 'Oi! Sou o assistente do Kelvin. Pode perguntar sobre projetos, estudos ou como falar com ele.',
      sugg: ['O que ele fez no site da Ociani?', 'Quais tecnologias ele usa?', 'Ele aceita trabalho remoto?'],
      hintsLabel: 'Por exemplo:',
      wait: 'Pensando...',
      offline: 'Não consegui responder agora. Tente de novo em instantes ou fale direto com o Kelvin: kelvin.krauss.br@gmail.com',
      busy: 'Foram muitas perguntas seguidas. Espere um minuto e tente de novo, ou fale direto com o Kelvin: kelvin.krauss.br@gmail.com',
      go: { ociani: 'Ver o projeto da Ociani', projetos: 'Ver os projetos', trajetoria: 'Ver a trajetória', habilidades: 'Ver as habilidades', contato: 'Ver o contato', curriculo: 'Abrir o currículo' },
      copied: 'Copiado!', copy: 'Copiar',
    },
    en: {
      hello: "Hi! I'm Kelvin's assistant. Ask about his projects, studies or how to reach him.",
      sugg: ['What did he build for Ociani?', 'Which technologies does he use?', 'Is he open to remote work?'],
      hintsLabel: 'For example:',
      wait: 'Thinking...',
      offline: "I couldn't answer right now. Try again in a moment or reach Kelvin directly: kelvin.krauss.br@gmail.com",
      busy: "That was a lot of questions in a row. Wait a minute and try again, or reach Kelvin directly: kelvin.krauss.br@gmail.com",
      go: { ociani: 'See the Ociani project', projetos: 'See the projects', trajetoria: 'See the journey', habilidades: 'See the skills', contato: 'See the contact', curriculo: 'Open the resume' },
      copied: 'Copied!', copy: 'Copy',
    },
  };

  /* ── Idioma ── */
  let lang = store.get('kk-lang') === 'en' ? 'en' : 'pt';
  function applyLang(next) {
    lang = next;
    root.lang = lang === 'en' ? 'en' : 'pt-BR';
    document.querySelectorAll('[data-en]').forEach(el => {
      if (el.dataset.pt === undefined) el.dataset.pt = el.innerHTML;
      el.innerHTML = lang === 'en' ? el.dataset.en : el.dataset.pt;
    });
    document.querySelectorAll('[data-en-aria]').forEach(el => {
      if (el.dataset.ptAria === undefined) el.dataset.ptAria = el.getAttribute('aria-label') || '';
      el.setAttribute('aria-label', lang === 'en' ? el.dataset.enAria : el.dataset.ptAria);
    });
    document.querySelectorAll('[data-en-ph]').forEach(el => {
      if (el.dataset.ptPh === undefined) el.dataset.ptPh = el.placeholder;
      el.placeholder = lang === 'en' ? el.dataset.enPh : el.dataset.ptPh;
    });
    document.querySelectorAll('[data-en-title]').forEach(el => {
      if (el.dataset.ptTitle === undefined) el.dataset.ptTitle = el.title;
      el.title = lang === 'en' ? el.dataset.enTitle : el.dataset.ptTitle;
    });
    document.querySelectorAll('[data-en-tip]').forEach(el => {
      if (el.dataset.ptTip === undefined) el.dataset.ptTip = el.dataset.tip;
      el.dataset.tip = lang === 'en' ? el.dataset.enTip : el.dataset.ptTip;
    });
    document.querySelectorAll('[data-en-alt]').forEach(el => {
      if (el.dataset.ptAlt === undefined) el.dataset.ptAlt = el.alt;
      el.alt = lang === 'en' ? el.dataset.enAlt : el.dataset.ptAlt;
    });
    document.querySelectorAll('[data-en-href]').forEach(el => {
      if (el.dataset.ptHref === undefined) el.dataset.ptHref = el.getAttribute('href');
      el.setAttribute('href', lang === 'en' ? el.dataset.enHref : el.dataset.ptHref);
    });
    document.querySelectorAll('[data-en-download]').forEach(el => {
      if (el.dataset.ptDownload === undefined) el.dataset.ptDownload = el.getAttribute('download');
      el.setAttribute('download', lang === 'en' ? el.dataset.enDownload : el.dataset.ptDownload);
    });
    const btn = $('#lang-btn');
    btn.textContent = lang === 'en' ? 'PT' : 'EN';
    btn.setAttribute('aria-label', lang === 'en' ? 'Ler em português' : 'Read in English');
    renderHints();
    // a conversation already going on stays; an empty chat greets again in the new language
    if (!history.length) resetChat();
  }
  $('#lang-btn').addEventListener('click', () => {
    const swap = () => { applyLang(lang === 'en' ? 'pt' : 'en'); store.set('kk-lang', lang); };
    const page = $('.page');
    if (!page.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return swap();
    page.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(4px)' }], { duration: 140, easing: 'ease-in' }).finished.then(() => {
      swap();
      page.animate([{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'ease-out' });
    });
  });

  /* ── Tema: 5 paletas escolhidas pelas bolinhas do topo; troca com um fade de 450 ms ── */
  const themes = $('#themes'), swatches = [...themes.querySelectorAll('.sw')];
  const phoneThemes = matchMedia('(max-width: 560px)');
  let themeAnim = 0;
  // one Tab stop for the whole group (the current color); the arrow keys move between colors
  const markTheme = name => swatches.forEach(b => {
    const on = b.dataset.theme === name;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  });
  markTheme(kkTheme.current);
  function goTheme(name) {
    cancelAnimationFrame(themeAnim);
    const from = kkTheme.now, to = kkTheme.pal(name), t0 = performance.now(), ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450;
    kkTheme.current = name; markTheme(name); store.set('kk-theme', name);
    root.classList.add('shading');
    const step = now => {
      const k = ms ? Math.min(1, (now - t0) / ms) : 1, e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      kkTheme.paint(kkTheme.mix(from, to, e));
      if (k < 1) themeAnim = requestAnimationFrame(step);
      else { root.classList.remove('shading'); document.dispatchEvent(new Event('theme-done')); }
    };
    themeAnim = requestAnimationFrame(step);
  }
  themes.addEventListener('click', e => {
    const b = e.target.closest('.sw');
    if (!b) return;
    // no celular a fileira fica fechada mostrando só a cor atual: o primeiro toque abre
    if (phoneThemes.matches && !themes.classList.contains('open')) { themes.classList.add('open'); return; }
    themes.classList.remove('open');
    if (b.dataset.theme === kkTheme.current) return;
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    goTheme(b.dataset.theme);
  });
  document.addEventListener('pointerdown', e => { if (!themes.contains(e.target)) themes.classList.remove('open'); });
  themes.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const n = swatches.findIndex(b => b.dataset.theme === kkTheme.current), next = swatches[(n + (e.key === 'ArrowRight' ? 1 : -1) + swatches.length) % swatches.length];
    next.focus(); goTheme(next.dataset.theme);
  });

  /* ── Copiar e-mail ── */
  $('#copy-email').addEventListener('click', e => {
    const btn = e.currentTarget, email = $('#email').textContent.trim();
    const done = () => { if (btn.animate) btn.animate([{ transform: 'scale(.88)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' }); btn.textContent = TXT[lang].copied; setTimeout(() => { btn.textContent = TXT[lang].copy; }, 1800); };
    const fallback = () => { const r = document.createRange(); r.selectNodeContents($('#email')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
    if (navigator.clipboard) navigator.clipboard.writeText(email).then(done, fallback); else fallback();
  });

  /* ── Assistente ── */
  let history = [];
  const msgs = $('#msgs');
  const fmt = text => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  function bubble(text, who) {
    const div = document.createElement('div');
    div.className = 'msg ' + who;
    div.innerHTML = fmt(text);
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }
  // O assistente termina algumas respostas com marcações como [[ociani]] (regra no api/chat.js).
  // Elas viram botões e nunca aparecem no texto, nem pela metade enquanto a resposta chega.
  const GO_KEYS = ['ociani', 'projetos', 'trajetoria', 'habilidades', 'contato', 'curriculo'];
  function splitReply(raw, final) {
    const keys = [];
    let text = raw.replace(/\[\[\s*([a-zà-ú]+)\s*\]\]/gi, (m, k) => {
      k = k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (GO_KEYS.includes(k) && !keys.includes(k)) keys.push(k);
      return '';
    });
    if (!final) text = text.replace(/\[\[?[^\]\n]*\]?$/, ''); // marcação ainda chegando
    return { text: text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(), keys: keys.slice(0, 2) };
  }
  function addGoButtons(div, keys) {
    if (!keys.length) return;
    const row = document.createElement('div');
    row.className = 'go-row';
    keys.forEach((k, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'go'; b.textContent = TXT[lang].go[k];
      b.style.animationDelay = (i * 80) + 'ms';
      b.addEventListener('click', () => goTo(k));
      row.appendChild(b);
    });
    div.after(row);
    msgs.scrollTop = msgs.scrollHeight;
  }
  // Leva até a parte do site: a página rola até lá, o chat encolhe para o balão no canto e um anel
  // de luz contorna o destino.
  function goTo(key) {
    if (key === 'curriculo') { const a = document.querySelector('[data-resume]'); if (a) a.click(); return; }
    const el = document.getElementById(key === 'ociani' ? 'ociani' : key);
    if (!el) return;
    const smooth = !calm.matches;
    const r = el.getBoundingClientRect();
    const top = scrollY + r.top - (key === 'ociani' ? Math.max(24, (innerHeight - r.height) / 2) : 28);
    scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
    let fired = false;
    const arrived = () => {
      if (fired) return; fired = true;
      removeEventListener('scrollend', arrived);
      closeChat();
      setTimeout(() => spotlight(el), smooth ? 260 : 0);
    };
    if (!smooth || Math.abs(top - scrollY) < 4) return arrived();
    addEventListener('scrollend', arrived, { once: true });
    setTimeout(arrived, 1100); // navegadores sem o evento scrollend
  }
  function spotlight(el) {
    const r = el.getBoundingClientRect(), pad = el.matches('.card') ? 6 : 14;
    const ring = document.createElement('div');
    ring.className = 'spot-ring';
    Object.assign(ring.style, { left: (r.left + scrollX - pad) + 'px', top: (r.top + scrollY - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px' });
    document.body.appendChild(ring);
    if (calm.matches || !ring.animate) { setTimeout(() => ring.remove(), 1600); return; }
    ring.animate([
      { opacity: 0, transform: 'scale(1.035)' },
      { opacity: 1, transform: 'scale(1)', offset: .22 },
      { opacity: 1, offset: .7 },
      { opacity: 0, transform: 'scale(1.01)' },
    ], { duration: 1900, easing: 'cubic-bezier(.2, .8, .3, 1)' }).finished.then(() => ring.remove(), () => ring.remove());
  }
  function renderHints() {
    const box = $('#ask-hints');
    box.innerHTML = '';
    const label = document.createElement('span');
    label.textContent = TXT[lang].hintsLabel;
    box.appendChild(label);
    TXT[lang].sugg.forEach(q => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = q;
      b.addEventListener('click', () => openChat(q));
      box.appendChild(b);
    });
  }
  function resetChat() {
    history = [];
    msgs.innerHTML = '';
    bubble(TXT[lang].hello, 'ai');
    const sugg = $('#sugg');
    sugg.innerHTML = '';
    TXT[lang].sugg.forEach(q => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = q;
      b.addEventListener('click', () => ask(q));
      sugg.appendChild(b);
    });
  }
  async function ask(text) {
    text = (text || '').trim();
    if (!text) return;
    $('#sugg').innerHTML = '';
    bubble(text, 'me');
    history.push({ role: 'user', parts: [{ text }] });
    const wait = bubble(TXT[lang].wait, 'ai wait');
    $('#chat-send').disabled = true;
    let raw = '', live = null;
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history }),
      });
      const type = res.headers.get('content-type') || '';
      if (!res.ok || type.includes('json') || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw Object.assign(new Error(data.error || res.status), { status: res.status });
      }
      // a resposta chega em pedaços: o balão aparece no primeiro pedaço e vai crescendo
      const reader = res.body.getReader(), dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += dec.decode(value, { stream: true });
        const shown = splitReply(raw, false).text;
        if (!shown) continue;
        if (!live) { wait.remove(); live = bubble('', 'ai streaming'); }
        const nearEnd = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 40;
        live.innerHTML = fmt(shown);
        if (nearEnd) msgs.scrollTop = msgs.scrollHeight;
      }
      raw += dec.decode();
      const out = splitReply(raw, true);
      if (!out.text) throw new Error('empty');
      history.push({ role: 'model', parts: [{ text: raw }] });
      wait.remove();
      if (!live) live = bubble('', 'ai');
      live.classList.remove('streaming');
      live.innerHTML = fmt(out.text);
      addGoButtons(live, out.keys);
      if (!chatBubble.hidden) chatBubble.classList.add('unread');
    } catch (err) {
      wait.remove();
      if (live) live.remove();
      history.pop();
      bubble(err && err.status === 429 ? TXT[lang].busy : TXT[lang].offline, 'ai');
    } finally {
      $('#chat-send').disabled = false;
    }
  }
  /* Abre como uma bolha líquida: a janela cresce a partir da caixa de pergunta, balança como gelatina
     no fim. Fecha voltando para dentro da caixa. */
  const wrap = $('#chat-wrap'), panel = wrap.querySelector('.chat'), heroAsk = $('#hero-ask');
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  let lastFocus = null, running = [];
  const FULL = 'inset(0px 0px 0px 0px round 28px)';
  function stopAnims() { running.forEach(a => a.cancel()); running = []; }
  function originRect() {
    const r = heroAsk.getBoundingClientRect();
    if (r.bottom > 0 && r.top < innerHeight) return r;
    const s = 62, x = (autoPos ? autoPos.x : innerWidth - s - 24), y = (autoPos ? autoPos.y : innerHeight - s - 110); // fora da tela: o canto do balão
    return { left: x, right: x + s, top: y, bottom: y + s, width: s, height: s };
  }
  function clipFrom(o, r) {
    const c = v => Math.max(0, Math.round(v));
    return 'inset(' + c(o.top - r.top) + 'px ' + c(r.right - o.right) + 'px ' + c(r.bottom - o.bottom) + 'px ' + c(o.left - r.left) + 'px round ' + Math.round(o.height / 2) + 'px)';
  }
  // Janela nasce do retângulo "o" (a caixa ou o botão clicado) e balança no fim.
  function grow(w, pnl, o) {
    const r = pnl.getBoundingClientRect();
    const list = [
      w.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' }),
      pnl.animate([
        { clipPath: clipFrom(o, r), transform: 'scale(1)', easing: 'cubic-bezier(.3, .9, .35, 1)' },
        { clipPath: FULL, transform: 'scale(1.025, .975)', offset: 0.62, easing: 'ease-in-out' },
        { clipPath: FULL, transform: 'scale(.99, 1.01)', offset: 0.82, easing: 'ease-in-out' },
        { clipPath: FULL, transform: 'scale(1)' },
      ], { duration: 720 }),
    ];
    [...pnl.children].filter(el => el.id !== 'fluid').forEach((el, i) => list.push(el.animate(
      [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
      { duration: 360, delay: 240 + i * 60, easing: 'cubic-bezier(.2, .8, .2, 1)', fill: 'backwards' })));
    return list;
  }
  function shrinkTo(w, pnl, o) {
    const r = pnl.getBoundingClientRect();
    const a = pnl.animate([
      { clipPath: FULL, transform: 'scale(1)' },
      { clipPath: FULL, transform: 'scale(1.02, .98)', offset: 0.18 },
      { clipPath: clipFrom(o, r), transform: 'scale(1)' },
    ], { duration: 420, easing: 'cubic-bezier(.5, 0, .75, 0)', fill: 'forwards' });
    const b = w.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, delay: 180, easing: 'ease-in', fill: 'forwards' });
    return { list: [a, b], done: Promise.all([a.finished, b.finished]) };
  }
  // A tinta da caixa de pergunta vai junto para a janela do chat, e volta quando ela fecha.
  const ink = $('#fluid');
  function moveInk(target) {
    if (!ink || ink.parentElement === target) return;
    target.prepend(ink);
    if (window.fluidRelayout) window.fluidRelayout();
  }
  // Posição da janela flutuante (fica onde a pessoa deixou enquanto a página estiver aberta)
  let chatPos = null;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function placeChat() {
    const w = panel.offsetWidth, h = panel.offsetHeight;
    if (!chatPos) {
      const b = heroAsk.getBoundingClientRect();
      chatPos = b.bottom > 0 && b.top < innerHeight
        ? { x: b.left, y: b.bottom - h }                         // em cima da caixa: o campo fica onde a caixa estava
        : { x: (innerWidth - w) / 2, y: innerHeight - h - 96 };  // caixa fora da tela: perto da barra de baixo
    }
    chatPos.x = clamp(chatPos.x, 8, Math.max(8, innerWidth - w - 8));
    chatPos.y = clamp(chatPos.y, 8, Math.max(8, innerHeight - h - 8));
    panel.style.left = Math.round(chatPos.x) + 'px';
    panel.style.top = Math.round(chatPos.y) + 'px';
    if (window.fluidRefresh) window.fluidRefresh();
  }
  const chatHead = panel.querySelector('.chat-head');
  chatHead.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('button')) return;
    e.preventDefault();
    stopAnims();
    const dx = e.clientX - chatPos.x, dy = e.clientY - chatPos.y;
    wrap.classList.add('dragging');
    chatHead.setPointerCapture(e.pointerId);
    const move = ev => { chatPos.x = ev.clientX - dx; chatPos.y = ev.clientY - dy; placeChat(); };
    const up = () => {
      wrap.classList.remove('dragging');
      chatHead.removeEventListener('pointermove', move);
      chatHead.removeEventListener('pointerup', up);
      chatHead.removeEventListener('pointercancel', up);
    };
    chatHead.addEventListener('pointermove', move);
    chatHead.addEventListener('pointerup', up);
    chatHead.addEventListener('pointercancel', up);
  });
  // Redimensionar pelas bordas e cantos de baixo. Durante o arraste a tinta fica parada no tamanho antigo
  // (redimensionar o canvas a cada quadro apagaria a tinta) e é redesenhada quando a pessoa solta.
  let chatSize = null;
  const MIN_W = 300, MIN_H = 360;
  function applySize() {
    if (!chatSize) return;
    const maxW = innerWidth - 16, maxH = innerHeight - 16;
    chatSize.w = clamp(chatSize.w, Math.min(MIN_W, maxW), maxW);
    chatSize.h = clamp(chatSize.h, Math.min(MIN_H, maxH), maxH);
    panel.style.width = Math.round(chatSize.w) + 'px';
    panel.style.height = Math.round(chatSize.h) + 'px';
  }
  panel.querySelectorAll('[data-rz]').forEach(handle => handle.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    stopAnims();
    const dir = handle.dataset.rz;
    const start = { x: e.clientX, y: e.clientY, w: panel.offsetWidth, h: panel.offsetHeight, left: chatPos.x, right: chatPos.x + panel.offsetWidth };
    if (ink && ink.parentElement === panel) { ink.style.width = ink.offsetWidth + 'px'; ink.style.height = ink.offsetHeight + 'px'; }
    wrap.classList.add('resizing');
    handle.setPointerCapture(e.pointerId);
    const move = ev => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      chatSize = { w: start.w, h: start.h };
      if (dir.includes('r')) chatSize.w = start.w + dx;
      if (dir.includes('l')) chatSize.w = start.w - dx;
      if (dir.includes('b')) chatSize.h = start.h + dy;
      applySize();
      if (dir.includes('l')) chatPos.x = start.right - chatSize.w;
      placeChat();
    };
    const up = () => {
      wrap.classList.remove('resizing');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      if (ink) { ink.style.width = ''; ink.style.height = ''; }
      if (window.fluidRelayout && ink.parentElement === panel) window.fluidRelayout();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  }));
  addEventListener('resize', () => { if (!wrap.hidden) { applySize(); placeChat(); } });

  function openChat(question) {
    if (!chatBubble.hidden) { restoreChat(question); return; }
    if (!wrap.hidden) { // já aberto: só pergunta
      if (question) ask(question);
      $('#chat-input').focus({ preventScroll: true });
      return;
    }
    lastFocus = document.activeElement;
    stopAnims();
    const o = originRect();
    chatPos = null; // sempre nasce de onde a caixa está
    if (!chatSize && innerWidth >= 700) chatSize = { w: o.width, h: Math.min(580, Math.max(380, o.bottom - 70)) }; // abaixo da barra do topo
    wrap.hidden = false;
    applySize();
    placeChat();
    moveInk(panel);
    heroAsk.style.visibility = 'hidden';
    if (!calm.matches && panel.animate) running.push(...grow(wrap, panel, o));
    if (question) ask(question);
    $('#chat-input').focus({ preventScroll: true });
  }
  function closeChat() {
    if (wrap.hidden) return;
    const done = () => {
      wrap.hidden = true; stopAnims();
      heroAsk.style.visibility = '';
      moveInk(heroAsk);
      if (lastFocus) lastFocus.focus({ preventScroll: true });
      if (!heroOnScreen) return showAutoBubble();
      // a janela encolheu até a caixa: a caixa "pousa" com um pulinho e uma onda
      if (!calm.matches && heroAsk.animate) {
        ripple(heroAsk.getBoundingClientRect());
        heroAsk.animate([
          { opacity: 0, transform: 'scale(1.04, .86)' },
          { opacity: 1, transform: 'scale(.98, 1.05)', offset: .45 },
          { transform: 'scale(1.01, .99)', offset: .75 },
          { opacity: 1, transform: 'scale(1, 1)' },
        ], { duration: 460, easing: 'cubic-bezier(.2, .8, .3, 1)' });
      }
    };
    if (calm.matches || !panel.animate) return done();
    stopAnims();
    const s = shrinkTo(wrap, panel, originRect());
    running.push(...s.list);
    s.done.then(done, () => {});
  }
  $('#hero-ask').addEventListener('submit', e => {
    e.preventDefault();
    const input = $('#hero-input');
    const q = input.value; input.value = '';
    openChat(q);
  });
  $('#chat-form').addEventListener('submit', e => {
    e.preventDefault();
    const input = $('#chat-input');
    const q = input.value; input.value = '';
    ask(q);
  });
  $('#chat-close').addEventListener('click', closeChat);

  /* ── Minimizar: a janela vira um balão que dá para arrastar; clicar nele reabre ── */
  const chatBubble = $('#chat-bubble');
  const BUBBLE = 62;
  let bubblePos = { x: 0, y: 0 };
  function placeBubble() {
    bubblePos.x = clamp(bubblePos.x, 8, innerWidth - BUBBLE - 8);
    bubblePos.y = clamp(bubblePos.y, 8, innerHeight - BUBBLE - 8);
    chatBubble.style.left = Math.round(bubblePos.x) + 'px';
    chatBubble.style.top = Math.round(bubblePos.y) + 'px';
  }
  const bubbleRect = () => ({ left: bubblePos.x, top: bubblePos.y, right: bubblePos.x + BUBBLE, bottom: bubblePos.y + BUBBLE, width: BUBBLE, height: BUBBLE });
  function minimizeChat() {
    if (wrap.hidden) return;
    // Nunca dois atalhos ao mesmo tempo: com a caixa na tela, o chat volta para ela (a conversa fica guardada)
    if (heroOnScreen) return closeChat();
    stopAnims();
    const r = panel.getBoundingClientRect();
    bubblePos = { x: r.right - BUBBLE, y: r.bottom - BUBBLE };
    placeBubble();
    const show = () => {
      wrap.hidden = true; stopAnims();
      chatBubble.hidden = false;
      bubbleMode = 'auto'; // vira o mesmo balão do canto: volta para a caixa quando ela aparecer
      stopFlight();
      autoState = 'bubble';
      if (!calm.matches && chatBubble.animate) chatBubble.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: .7 }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' });
      heroAsk.style.visibility = '';
      moveInk(heroAsk);
    };
    if (calm.matches || !panel.animate) return show();
    const s = shrinkTo(wrap, panel, bubbleRect());
    running.push(...s.list);
    s.done.then(show, () => {});
  }
  function restoreChat(question) {
    stopFlight();
    autoState = 'box';
    const b = bubbleRect();
    if (bubbleMode === 'auto') autoPos = { x: bubblePos.x, y: bubblePos.y };
    bubbleMode = null;
    chatBubble.hidden = true;
    chatBubble.classList.remove('unread');
    wrap.hidden = false;
    applySize();
    chatPos = { x: b.right - panel.offsetWidth, y: b.bottom - panel.offsetHeight }; // reabre a partir do balão
    placeChat();
    moveInk(panel);
    heroAsk.style.visibility = 'hidden';
    stopAnims();
    if (!calm.matches && panel.animate) running.push(...grow(wrap, panel, b));
    if (question) ask(question);
    $('#chat-input').focus({ preventScroll: true });
  }
  chatBubble.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY, dx = sx - bubblePos.x, dy = sy - bubblePos.y;
    let moved = false;
    chatBubble.setPointerCapture(e.pointerId);
    const move = ev => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 5) { moved = true; chatBubble.classList.add('dragging'); }
      if (moved) { bubblePos.x = ev.clientX - dx; bubblePos.y = ev.clientY - dy; placeBubble(); }
    };
    const up = () => {
      chatBubble.classList.remove('dragging');
      chatBubble.removeEventListener('pointermove', move);
      chatBubble.removeEventListener('pointerup', up);
      chatBubble.removeEventListener('pointercancel', up);
      if (!moved) restoreChat();
    };
    chatBubble.addEventListener('pointermove', move);
    chatBubble.addEventListener('pointerup', up);
    chatBubble.addEventListener('pointercancel', up);
  });
  chatBubble.addEventListener('click', e => { if (e.detail === 0) restoreChat(); }); // teclado (Enter/Espaço)
  addEventListener('resize', () => { if (!chatBubble.hidden) placeBubble(); });

  /* ── Quando a caixa de pergunta sai da tela, o assistente fica como balão no canto, em todo o site ── */
  let bubbleMode = null;   // 'min' = minimizado pela pessoa, 'auto' = só porque a caixa saiu da tela
  let autoPos = null;      // onde a pessoa deixou o balão automático
  let heroOnScreen = true;
  // A caixa não voa mais: ela mergulha na página (encolhe, achata, desfoca e some, com uma onda no lugar)
  // e o balão emerge no canto (sobe de dentro da página com outra onda e dá um pulinho). O contrário ao voltar.
  // Estados: box, toBubble, bubble, toBox. Inverter no meio cancela o que estava rodando.
  let autoState = 'box';
  let diveAnims = [], diveTimer = 0;
  const DIVE_MS = 300, EMERGE_MS = 460, GAP_MS = 140;
  const boxRect = () => heroAsk.getBoundingClientRect();
  function stopFlight() {
    diveAnims.forEach(a => a.cancel()); diveAnims = [];
    clearTimeout(diveTimer);
    document.querySelectorAll('.ripple').forEach(r => r.remove());
  }
  function ripple(r, delay = 0) {
    const el = document.createElement('div');
    el.className = 'ripple';
    const w = r.width, h = r.height;
    el.style.cssText = 'left:' + r.left + 'px;top:' + r.top + 'px;width:' + w + 'px;height:' + h + 'px';
    document.body.appendChild(el);
    const a = el.animate([
      { transform: 'scale(.9)', opacity: 0 },
      { transform: 'scale(1)', opacity: 1, offset: .2 },
      { transform: 'scale(' + (1 + 60 / w) + ',' + (1 + 60 / h) + ')', opacity: 0 },
    ], { duration: 700, delay, easing: 'cubic-bezier(.2, .7, .3, 1)', fill: 'both' });
    a.onfinish = a.oncancel = () => el.remove();
    diveAnims.push(a);
  }
  const SINK = [
    { transform: 'translateY(0) scale(1, 1)', filter: 'blur(0px)', opacity: 1 },
    { transform: 'translateY(-3px) scale(1.03, .96)', filter: 'blur(0px)', opacity: 1, offset: .25 },
    { transform: 'translateY(10px) scale(.55, .25)', filter: 'blur(8px)', opacity: 0 },
  ];
  const RISE = [
    { transform: 'translateY(14px) scale(.35, .2)', filter: 'blur(8px)', opacity: 0 },
    { transform: 'translateY(-4px) scale(1.08, 1.12)', filter: 'blur(0px)', opacity: 1, offset: .65 },
    { transform: 'translateY(0) scale(.97, 1.02)', offset: .85 },
    { transform: 'translateY(0) scale(1, 1)', filter: 'blur(0px)', opacity: 1 },
  ];
  function dive(el, rect, then) {
    if (calm.matches || !el.animate) return then();
    ripple(rect);
    const a = el.animate(SINK, { duration: DIVE_MS, easing: 'cubic-bezier(.5, 0, .8, .4)', fill: 'forwards' });
    diveAnims.push(a);
    diveTimer = setTimeout(then, DIVE_MS - 40);
  }
  function emerge(el, rect) {
    if (calm.matches || !el.animate) return;
    ripple(rect);
    diveAnims.push(el.animate(RISE, { duration: EMERGE_MS, easing: 'cubic-bezier(.2, .8, .3, 1)' }));
  }
  function showAutoBubble() {
    if (!wrap.hidden || bubbleMode === 'min') return;
    if (autoState === 'bubble' || autoState === 'toBubble') return;
    stopFlight();
    bubblePos = autoPos ? { x: autoPos.x, y: autoPos.y } : { x: innerWidth - BUBBLE - 24, y: innerHeight - BUBBLE - 110 };
    placeBubble();
    bubbleMode = 'auto';
    autoState = 'toBubble';
    chatBubble.hidden = true;
    const appear = () => {
      if (autoState !== 'toBubble') return;
      heroAsk.style.visibility = 'hidden';
      diveAnims.forEach(a => { if (a.effect && a.effect.target === heroAsk) a.cancel(); });
      setTimeout(() => {
        if (autoState !== 'toBubble') return;
        autoState = 'bubble';
        chatBubble.hidden = false;
        emerge(chatBubble, bubbleRect());
      }, calm.matches ? 0 : GAP_MS);
    };
    const r = boxRect();
    if (r.bottom > 0 && r.top < innerHeight) dive(heroAsk, r, appear); else appear();
  }
  function hideAutoBubble() {
    if (bubbleMode !== 'auto') return;
    if (autoState === 'box' || autoState === 'toBox') return;
    const wasShown = !chatBubble.hidden;
    if (wasShown) autoPos = { x: bubblePos.x, y: bubblePos.y };
    stopFlight();
    bubbleMode = null;
    autoState = 'toBox';
    const appear = () => {
      if (autoState !== 'toBox') return;
      chatBubble.hidden = true;
      diveAnims.forEach(a => { if (a.effect && a.effect.target === chatBubble) a.cancel(); });
      setTimeout(() => {
        if (autoState !== 'toBox') return;
        autoState = 'box';
        if (!wrap.hidden) return;
        heroAsk.style.visibility = '';
        emerge(heroAsk, boxRect());
      }, calm.matches ? 0 : GAP_MS);
    };
    if (wasShown) dive(chatBubble, bubbleRect(), appear); else appear();
  }
  if ('IntersectionObserver' in window) {
    // a caixa vira balão quando metade dela já saiu da tela
    new IntersectionObserver(([en]) => {
      heroOnScreen = en.isIntersecting && en.intersectionRatio >= 0.5;
      dockAway();
      if (heroOnScreen) hideAutoBubble(); else showAutoBubble();
    }, { threshold: [0, 0.5, 1] }).observe(heroAsk);
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !wrap.hidden) closeChat(); });

  /* ── Projeto: abre e fecha os detalhes ── */
  const moreBtn = $('#ociani-toggle'), moreBody = $('#ociani-more');
  moreBtn.addEventListener('click', () => {
    const open = moreBtn.getAttribute('aria-expanded') !== 'true';
    moreBtn.setAttribute('aria-expanded', String(open));
    moreBody.classList.toggle('open', open);
    if (open) {
      moreBody.removeAttribute('inert');
      moreBody.querySelectorAll('img[loading=lazy]').forEach(img => { img.loading = 'eager'; });
      if (!cmpShown) { cmpShown = true; setTimeout(cmpHint, 650); }
    } else {
      moreBody.setAttribute('inert', '');
    }
  });

  /* ── Antes e depois do site da Ociani: o site antigo fica por cima, cortado na alça ── */
  const cmp = $('#cmp'), cmpRange = cmp.querySelector('.cmp-range');
  let cmpShown = false, cmpAnim = 0;
  function cmpSet(v) {
    cmp.style.setProperty('--pos', v + '%');
    cmp.classList.toggle('at-start', v < 8);
    cmp.classList.toggle('at-end', v > 92);
  }
  cmpRange.addEventListener('input', () => { cancelAnimationFrame(cmpAnim); cmpSet(+cmpRange.value); });
  cmpRange.addEventListener('pointerdown', () => { cancelAnimationFrame(cmpAnim); cmp.classList.add('dragging'); });
  addEventListener('pointerup', () => cmp.classList.remove('dragging'));
  // na primeira vez que os detalhes abrem, a alça passeia sozinha para mostrar que dá para arrastar
  function cmpHint() {
    if (calm.matches) return;
    const keys = [[0, 50], [.32, 78], [.68, 24], [1, 50]], ms = 1900, t0 = performance.now();
    const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    const step = now => {
      const k = Math.min(1, (now - t0) / ms);
      let i = 0; while (i < keys.length - 2 && k > keys[i + 1][0]) i++;
      const [ka, va] = keys[i], [kb, vb] = keys[i + 1];
      const v = va + (vb - va) * ease((k - ka) / (kb - ka));
      cmpRange.value = v; cmpSet(v);
      if (k < 1) cmpAnim = requestAnimationFrame(step);
    };
    cmpAnim = requestAnimationFrame(step);
  }

  /* ── Currículo: abre dentro do site no computador; no celular, nova aba (PDF em iframe não funciona bem) ── */
  const cvWrap = $('#cv-wrap'), cvFrame = $('#cv-frame');
  const bigScreen = matchMedia('(min-width: 760px) and (pointer: fine)');
  let cvReturn = null;
  const cvPanel = cvWrap.querySelector('.chat');
  let cvAnims = [];
  // A janela do currículo sai do botão: cresce com uma curva suave (transform, sem recorte), o fundo escurece
  // junto, e o conteúdo (título e PDF) só aparece no fim, para não ver o PDF esticado nem piscando em branco.
  function cvFrom(b) {
    const r = cvPanel.getBoundingClientRect();
    return 'translate(' + (b.left - r.left) + 'px,' + (b.top - r.top) + 'px) scale(' + (b.width / r.width) + ',' + (b.height / r.height) + ')';
  }
  const cvKids = () => [...cvPanel.children];
  function openCvAnim(b) {
    cvPanel.style.transformOrigin = '0 0';
    cvAnims = [
      cvWrap.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' }),
      cvPanel.animate([
        { transform: cvFrom(b), opacity: .4, borderRadius: '999px' },
        { opacity: 1, offset: .25 },
        { transform: 'none', opacity: 1, borderRadius: '28px' },
      ], { duration: 560, easing: 'cubic-bezier(.16, 1, .3, 1)' }),
      ...cvKids().map((el, i) => el.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
        { duration: 300, delay: 300 + i * 60, easing: 'ease-out', fill: 'backwards' })),
    ];
  }
  function closeCv() {
    if (cvWrap.hidden) return;
    const done = () => { cvWrap.hidden = true; cvAnims.forEach(a => a.cancel()); cvAnims = []; if (cvReturn) cvReturn.focus({ preventScroll: true }); };
    if (calm.matches || !cvPanel.animate || !cvReturn) return done();
    cvAnims.forEach(a => a.cancel());
    const b = cvReturn.getBoundingClientRect();
    const kids = cvKids().map(el => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: 'ease-in', fill: 'forwards' }));
    const shrink = cvPanel.animate([
      { transform: 'none', opacity: 1, borderRadius: '28px' },
      { transform: cvFrom(b), opacity: .3, borderRadius: '999px' },
    ], { duration: 380, delay: 80, easing: 'cubic-bezier(.7, 0, .84, 0)', fill: 'forwards' });
    const fade = cvWrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 160, easing: 'ease-in', fill: 'forwards' });
    cvAnims = [...kids, shrink, fade];
    Promise.all([shrink.finished, fade.finished]).then(done, () => {});
  }
  document.querySelectorAll('[data-resume]').forEach(a => a.addEventListener('click', e => {
    if (!bigScreen.matches) return;
    e.preventDefault();
    cvReturn = a;
    const want = a.getAttribute('href') + '#view=FitH';
    if (cvFrame.getAttribute('src') !== want) cvFrame.setAttribute('src', want);
    cvAnims.forEach(x => x.cancel());
    cvWrap.hidden = false;
    if (!calm.matches && cvPanel.animate) openCvAnim(a.getBoundingClientRect());
    $('#cv-close').focus({ preventScroll: true });
  }));
  // carrega o PDF com antecedência (quando a página está ociosa), para ele já estar pronto ao abrir
  if (bigScreen.matches) (window.requestIdleCallback || (fn => setTimeout(fn, 2500)))(() => {
    const first = document.querySelector('[data-resume]');
    if (first && !cvFrame.getAttribute('src')) cvFrame.setAttribute('src', first.getAttribute('href') + '#view=FitH');
  });
  $('#cv-close').addEventListener('click', closeCv);
  cvWrap.addEventListener('click', e => { if (e.target === cvWrap) closeCv(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !cvWrap.hidden) closeCv(); });

  /* ── Dock: marca a(s) seção(ões) no meio da tela. Em telas largas duas seções ficam lado a lado
     (Sobre + Trajetória, Habilidades + Contato): as duas acendem e a lente cobre as duas. ── */
  const dock = $('#dock'), lens = $('#dock-lens');
  const dockLinks = [...dock.querySelectorAll('a')];
  const dockSecs = dockLinks.map(a => document.querySelector(a.getAttribute('href')));
  let dockTick = 0;
  function updateDock() {
    dockTick = 0;
    const mid = innerHeight * .45;
    const lit = dockSecs.map(s => { if (!s) return false; const r = s.getBoundingClientRect(); return r.top < mid && r.bottom > mid; });
    dockLinks.forEach((a, i) => a.classList.toggle('on', lit[i]));
    const on = dockLinks.filter((a, i) => lit[i]);
    if (!on.length) { lens.style.opacity = 0; return; }
    const first = on[0], last = on[on.length - 1];
    lens.style.opacity = 1;
    lens.style.width = (last.offsetLeft + last.offsetWidth - first.offsetLeft) + 'px';
    lens.style.transform = 'translateX(' + first.offsetLeft + 'px)';
  }
  const queueDock = () => { if (!dockTick) dockTick = requestAnimationFrame(updateDock); };
  addEventListener('scroll', queueDock, { passive: true });
  addEventListener('resize', queueDock);
  $('#lang-btn').addEventListener('click', () => setTimeout(updateDock, 420)); // labels change width
  updateDock();
  // No celular, a barra cobria a caixa de IA na primeira tela: ela só aparece depois que a caixa sai de vista
  const phone = matchMedia('(max-width: 700px)');
  function dockAway() { dock.classList.toggle('away', phone.matches && heroOnScreen); }
  addEventListener('scroll', dockAway, { passive: true });
  phone.addEventListener ? phone.addEventListener('change', dockAway) : phone.addListener(dockAway);
  dockAway();

  /* ── Liquid glass: refração real no Chromium ──
     Para cada .glass[data-glass], gera um mapa de deslocamento do tamanho do elemento e usa como filtro SVG
     no backdrop-filter. Nos outros navegadores fica o vidro fosco do CSS. */
  (function liquidGlass() {
    const brands = navigator.userAgentData && navigator.userAgentData.brands;
    const chromium = brands ? brands.some(b => /Chromium/.test(b.brand)) : /Chrome\/\d+/.test(navigator.userAgent) && !/Firefox|FxiOS|CriOS|EdgiOS/.test(navigator.userAgent);
    if (!chromium || matchMedia('(prefers-reduced-transparency: reduce)').matches) return;
    const NS = 'http://www.w3.org/2000/svg';
    const defs = $('#lg-defs');
    let count = 0;
    function sdRoundRect(px, py, w, h, r) {
      const qx = Math.abs(px - w / 2) - (w / 2 - r), qy = Math.abs(py - h / 2) - (h / 2 - r);
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
    }
    function buildMap(w, h, r, bezel) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(w, h), d = img.data;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const px = x + 0.5, py = y + 0.5;
          const dist = -sdRoundRect(px, py, w, h, r);
          let R = 128, G = 128;
          if (dist > 0 && dist < bezel) {
            const gx = sdRoundRect(px + 1, py, w, h, r) - sdRoundRect(px - 1, py, w, h, r);
            const gy = sdRoundRect(px, py + 1, w, h, r) - sdRoundRect(px, py - 1, w, h, r);
            const len = Math.hypot(gx, gy) || 1;
            const m = Math.pow(1 - dist / bezel, 1.8); // convex lens: strongest at the rim
            R = 128 - (gx / len) * m * 127;           // sample inward, so the backdrop stretches at the rim
            G = 128 - (gy / len) * m * 127;
          }
          const i = (y * w + x) * 4;
          d[i] = R; d[i + 1] = G; d[i + 2] = 128; d[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      return c.toDataURL();
    }
    function apply(el) {
      const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
      if (!w || !h || el._lgSize === w + 'x' + h) return;
      el._lgSize = w + 'x' + h;
      const r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, w / 2, h / 2);
      const bezel = Math.min(w / 2, h / 2, Math.max(10, Math.min(w, h) * 0.42));
      const id = el._lgId || (el._lgId = 'lg-' + (++count));
      let f = document.getElementById(id);
      if (!f) {
        f = document.createElementNS(NS, 'filter');
        f.setAttribute('id', id);
        f.setAttribute('filterUnits', 'userSpaceOnUse');
        f.setAttribute('primitiveUnits', 'userSpaceOnUse');
        f.setAttribute('color-interpolation-filters', 'sRGB');
        const fi = document.createElementNS(NS, 'feImage');
        fi.setAttribute('result', 'map');
        fi.setAttribute('preserveAspectRatio', 'none');
        const fd = document.createElementNS(NS, 'feDisplacementMap');
        fd.setAttribute('in', 'SourceGraphic');
        fd.setAttribute('in2', 'map');
        fd.setAttribute('xChannelSelector', 'R');
        fd.setAttribute('yChannelSelector', 'G');
        f.append(fi, fd);
        defs.appendChild(f);
      }
      f.setAttribute('x', 0); f.setAttribute('y', 0); f.setAttribute('width', w); f.setAttribute('height', h);
      const fi = f.querySelector('feImage'), fd = f.querySelector('feDisplacementMap');
      fi.setAttribute('href', buildMap(w, h, r, bezel));
      fi.setAttribute('x', 0); fi.setAttribute('y', 0); fi.setAttribute('width', w); fi.setAttribute('height', h);
      fd.setAttribute('scale', el.dataset.glass || 40);
      el.style.backdropFilter = 'url(#' + id + ') blur(' + (el.dataset.blur || (h > 70 ? 4 : 2.5)) + 'px) saturate(1.8)';
    }
    const els = [...document.querySelectorAll('.glass[data-glass]')];
    const ro = new ResizeObserver(entries => entries.forEach(e => apply(e.target)));
    els.forEach(el => { apply(el); ro.observe(el); });
  })();

  /* ── Fundo: eco da tinta ──
     Um campo de ruído em baixa resolução (64x40) vira manchas nas cores da tinta do chat, só nas bordas
     da tela. A ampliação é feita na placa de vídeo (WebGL): suavização bicúbica com conta em ponto flutuante
     e um ruído de ±2 níveis antes da cor final (dithering), que tira as faixas (color banding) dos degradês
     escuros. Sem WebGL, o navegador amplia num canvas 2D como antes. Move-se devagar e para com a aba oculta. */
  (function inkEcho() {
    const cv = $('#ink-echo');
    if (!cv || !cv.getContext) return;
    const LW = 64, LH = 40;
    const low = document.createElement('canvas'); low.width = LW; low.height = LH;
    const lc = low.getContext('2d'), img = lc.createImageData(LW, LH), d = img.data;
    let gl = cv.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false });
    const ctx = gl ? null : cv.getContext('2d');
    let glProg = null, uDither = null, uRes = null;
    function setupGL() {
      const VS = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
      const FS = `precision highp float;
        uniform sampler2D tex; uniform vec2 texSize, res; uniform float dither;
        // B-spline bicúbico com 4 leituras bilineares: bem mais macio que a ampliação bilinear simples
        vec4 w(float v) { vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v, s = n * n * n; float x = s.x, y = s.y - 4.0 * s.x, z = s.z - 4.0 * s.y + 6.0 * s.x; return vec4(x, y, z, 6.0 - x - y - z) / 6.0; }
        vec4 bicubic(vec2 uv) {
          uv = uv * texSize - 0.5; vec2 f = fract(uv); uv -= f;
          vec4 xc = w(f.x), yc = w(f.y), c = uv.xxyy + vec2(-0.5, 1.5).xyxy;
          vec4 s = vec4(xc.xz + xc.yw, yc.xz + yc.yw), o = (c + vec4(xc.yw, yc.yw) / s) / texSize.xxyy;
          float sx = s.x / (s.x + s.y), sy = s.z / (s.z + s.w);
          return mix(mix(texture2D(tex, o.yw), texture2D(tex, o.xw), sx), mix(texture2D(tex, o.yz), texture2D(tex, o.xz), sx), sy);
        }
        float h(vec2 q) { return fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
          vec2 uv = vec2(gl_FragCoord.x / res.x, 1.0 - gl_FragCoord.y / res.y);
          vec3 col = bicubic(uv).rgb;
          vec2 q = floor(gl_FragCoord.xy);
          // ruído triangular por canal (amplitude = dither níveis): esconde os degraus de 8 bits, inclusive em telas de 6 bits
          vec3 n = vec3(h(q), h(q + 17.13), h(q + 41.71)) + vec3(h(q + 7.37), h(q + 29.93), h(q + 3.19)) - 1.0;
          gl_FragColor = vec4(col + n * dither / 255.0, 1.0);
        }`;
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
      const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
      if (!vs || !fs) return false;
      glProg = gl.createProgram(); gl.attachShader(glProg, vs); gl.attachShader(glProg, fs); gl.linkProgram(glProg);
      if (!gl.getProgramParameter(glProg, gl.LINK_STATUS)) return false;
      gl.useProgram(glProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // um triângulo cobre a tela
      const loc = gl.getAttribLocation(glProg, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform2f(gl.getUniformLocation(glProg, 'texSize'), LW, LH);
      uRes = gl.getUniformLocation(glProg, 'res'); uDither = gl.getUniformLocation(glProg, 'dither');
      return true;
    }
    if (gl && !setupGL()) gl = null;
    if (!gl && ctx === null) return; // o canvas já virou WebGL mas o shader falhou: fica só a cor de fundo da página
    cv.addEventListener('webglcontextlost', e => e.preventDefault());
    cv.addEventListener('webglcontextrestored', () => { if (setupGL()) { size(); draw(); } });
    // ruído de valor 3D (semente fixa)
    const P = new Uint8Array(512);
    let seed = 1981;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const perm = [...Array(256).keys()].sort(() => rnd() - .5);
    for (let i = 0; i < 512; i++) P[i] = perm[i & 255];
    const fd = q => q * q * (3 - 2 * q), L = (a, b, k) => a + (b - a) * k;
    const h3 = (x, y, z) => P[(P[(P[x & 255] + y) & 255] + z) & 255] / 255;
    function noise(x, y, z) {
      const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = fd(x - xi), v = fd(y - yi), w = fd(z - zi);
      return L(L(L(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), L(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v),
               L(L(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), L(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u), v), w);
    }
    const parse = v => { v = v.trim(); if (v[0] === '#') return [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16)); return (v.match(/\d+/g) || [0, 0, 0]).slice(0, 3).map(Number); };
    const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    let bg, light, cols, dither = 2, speed = 3;
    function readTheme() {
      const cs = getComputedStyle(root);
      bg = parse(cs.getPropertyValue('--bg'));
      light = (bg[0] + bg[1] + bg[2]) / 3 > 128;
      cols = ['--accent', '--i1', '--i2', '--i3'].map(n => parse(cs.getPropertyValue(n)));
      const dv = parseFloat(cs.getPropertyValue('--dither'));
      dither = isNaN(dv) ? 2 : dv;
      const sv = parseFloat(cs.getPropertyValue('--echo-speed'));
      speed = isNaN(sv) ? 3 : sv;
    }
    function size() {
      // WebGL: resolução cheia (o ruído do dithering precisa de 1 pixel de tela); 2D: metade basta, é borrado
      const dpr = Math.min(devicePixelRatio || 1, gl ? 2 : 1.5), k = gl ? 1 : .5;
      const W = Math.round(innerWidth * dpr * k), H = Math.round(innerHeight * dpr * k);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      if (gl) { gl.viewport(0, 0, W, H); gl.uniform2f(uRes, W, H); }
    }
    function draw() {
      const t = clock, strength = light ? .42 : .55;
      for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
        const u = x / LW, v = y / LH;
        const edge = Math.min(1, Math.pow(Math.hypot((u - .5) / .5, (v - .5) / .5) / 1.15, 2.4));
        const n = noise(u * 3, v * 2.4, t * .08), hue = noise(u * 1.6 + 9, v * 1.6, t * .05) * 4.8;
        const i0 = Math.floor(hue) % 4, col = mix(cols[i0], cols[(i0 + 1) % 4], hue % 1);
        const k = Math.min(1, Math.max(0, n - .35) * 1.9 * edge * strength);
        const o = mix(bg, col, k), i = (y * LW + x) * 4;
        d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; d[i + 3] = 255;
      }
      if (gl) {
        if (gl.isContextLost()) return;
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, LW, LH, 0, gl.RGBA, gl.UNSIGNED_BYTE, d);
        gl.uniform1f(uDither, dither);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        return;
      }
      lc.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(low, 0, 0, cv.width, cv.height);
    }
    // clock in seconds, advanced at the theme's speed
    let clock = performance.now() / 1000;
    readTheme(); size(); draw();
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let last = 0, prev = performance.now();
    (function loop(now) {
      const step = Math.min(now - prev, 100); prev = now;
      if (!still && !document.hidden) {
        clock += step / 1000 * speed;
        // more frames for faster speeds so they stay smooth (at 3x: one every ~17 ms)
        if (now - last > Math.max(16, 50 / speed)) { last = now; draw(); }
      }
      requestAnimationFrame(loop);
    })(performance.now());
    addEventListener('resize', () => { size(); draw(); });
    document.addEventListener('theme-done', () => { readTheme(); draw(); });
    // durante o fade de tema, acompanha a cor de fundo
    new MutationObserver(() => readTheme()).observe(root, { attributes: true, attributeFilter: ['style'] });
  })();

  applyLang(lang);
})();
