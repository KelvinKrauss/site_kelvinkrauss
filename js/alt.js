/* Alternative design (/tema_alternativo): name sized to the screen, Blumenau clock, squares that light up
   under the mouse, before/after slider, PT/EN, and the assistant as a terminal (same /api/chat as the main site). */
(() => {
  const $ = s => document.querySelector(s);
  const root = document.documentElement;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  /* ── Texts used by the script ── */
  const TXT = {
    pt: {
      hello: 'Oi! Sou a IA do portfólio do Kelvin. Pergunte o que quiser sobre ele: projetos, estudos ou como falar com ele.',
      sugg: ['O que ele fez no site da Ociani?', 'Tenho uma vaga: ele se encaixa?', 'Quero falar com ele'],
      wait: 'pensando', offline: 'Não consegui responder agora. Tente de novo em instantes ou fale direto: kelvin.krauss.br@gmail.com',
      busy: 'Foram muitas perguntas seguidas. Espere um minuto e tente de novo.', done: 'Pronto!',
      copied: 'Copiado!', copy: 'Copiar',
      go: { ociani: 'Ver o projeto da Ociani', projetos: 'Ver os projetos', trajetoria: 'Ver a trajetória', habilidades: 'Ver as habilidades',
        contato: 'Ver o contato', curriculo: 'Abrir o currículo', antes_depois: 'Ver o antes e depois', whatsapp: 'Falar no WhatsApp',
        email: 'Mandar e-mail', linkedin: 'Abrir o LinkedIn', github: 'Ver o GitHub', codigo: 'Ver o código', copiar_email: 'Copiar o e-mail' },
    },
    en: {
      hello: "Hi! I'm the AI on Kelvin's portfolio. Ask me anything about him: projects, studies or how to reach him.",
      sugg: ['What did he build for Ociani?', 'I have a job opening: is he a fit?', 'I want to talk to him'],
      wait: 'thinking', offline: "I couldn't answer right now. Try again in a moment or reach him directly: kelvin.krauss.br@gmail.com",
      busy: 'That was a lot of questions in a row. Wait a minute and try again.', done: 'Done!',
      copied: 'Copied!', copy: 'Copy',
      go: { ociani: 'See the Ociani project', projetos: 'See the projects', trajetoria: 'See the journey', habilidades: 'See the skills',
        contato: 'See the contact', curriculo: 'Open the resume', antes_depois: 'See the before and after', whatsapp: 'Talk on WhatsApp',
        email: 'Send an e-mail', linkedin: 'Open LinkedIn', github: 'See GitHub', codigo: 'See the code', copiar_email: 'Copy the e-mail' },
    },
  };

  /* ── Language (the same choice as the main site) ── */
  let lang = store.get('kk-lang') === 'en' ? 'en' : 'pt';
  const ATTRS = [['enAria', 'ptAria', 'aria-label'], ['enPh', 'ptPh', 'placeholder'], ['enAlt', 'ptAlt', 'alt'], ['enHref', 'ptHref', 'href']];
  function applyLang(next) {
    lang = next;
    root.lang = lang === 'en' ? 'en' : 'pt-BR';
    document.querySelectorAll('[data-en]').forEach(el => {
      if (el.dataset.pt === undefined) el.dataset.pt = el.innerHTML;
      el.innerHTML = lang === 'en' ? el.dataset.en : el.dataset.pt;
    });
    ATTRS.forEach(([en, pt, attr]) => document.querySelectorAll('[data-' + en.replace(/[A-Z]/g, c => '-' + c.toLowerCase()) + ']').forEach(el => {
      if (el.dataset[pt] === undefined) el.dataset[pt] = el.getAttribute(attr) || '';
      el.setAttribute(attr, lang === 'en' ? el.dataset[en] : el.dataset[pt]);
    }));
    const btn = $('#lang-btn');
    btn.textContent = lang === 'en' ? 'PT' : 'EN';
    btn.setAttribute('aria-label', lang === 'en' ? 'Ler em português' : 'Read in English');
    if (!history.length) resetChat();
  }
  $('#lang-btn').addEventListener('click', () => { applyLang(lang === 'en' ? 'pt' : 'en'); store.set('kk-lang', lang); });

  /* ── Clock: Kelvin's time, in Blumenau ── */
  const clock = $('#clock');
  const fmtTime = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const tickClock = () => { clock.textContent = fmtTime.format(new Date()).replace(/:/g, ' : '); };
  tickClock(); setInterval(tickClock, 1000);

  /* ── The footer name fills the width: measured once at 120px, then scaled. On phones, one word per line ── */
  const name = $('#foot-name'), nameBox = name;
  function fitName() {
    const words = [...name.children];
    const stack = innerWidth < 700;
    // "table" puts each word on its own line while keeping the box as wide as the word (a block would fill the line)
    words.forEach(w => { w.style.display = stack ? 'table' : 'inline-block'; });
    name.style.fontSize = '120px';
    const avail = nameBox.clientWidth - parseFloat(getComputedStyle(nameBox).paddingLeft) * 2;
    // the width of the letters themselves (the heading box is always as wide as the page)
    const boxes = words.map(w => w.getBoundingClientRect());
    const wide = stack ? Math.max(...boxes.map(b => b.width)) : boxes[boxes.length - 1].right - boxes[0].left;
    name.style.fontSize = Math.floor(120 * avail / wide * .995) + 'px';
  }
  fitName();
  // measured again once the real typeface has arrived (until then the width is the fallback font's)
  if (document.fonts) {
    document.fonts.load('900 120px "Mona Sans"').then(fitName, () => {});
    document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', fitName);
  }
  let fitTimer = 0;
  addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitName, 80); });

  /* ── Navigation: marks the section in view ── */
  const navLinks = [...document.querySelectorAll('.nav-cell[href^="#"]')];
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver(entries => entries.forEach(en => {
      const link = navLinks.find(a => a.getAttribute('href') === '#' + en.target.id);
      if (link) link.classList.toggle('on', en.isIntersecting);
    }), { rootMargin: '-45% 0px -50% 0px' });
    navLinks.forEach(a => { const s = document.querySelector(a.getAttribute('href')); if (s) obs.observe(s); });
  }

  /* ── Squares with programming symbols where the mouse passes ──
     Same rules as the effect on githubuniverse.com (read from its code, "CursorTrailAnimation"):
     - only inside the areas marked .trail-area, and only on empty space: never over a piece of text, a link,
       a button or anything inside .trail-ignore (labels, the lead text, buttons, images, the terminal...);
     - a 20 px grid on the screen; a new square only when the mouse enters another cell;
     - at most 10 at once, each lit for 0.1–0.4 s, then it fades;
     - one symbol per square from - / ) . + = > < * & (, and 30% of them empty.
     Drawn on one canvas above the content, only while a square is alive. Mouse only, off with "reduce motion". */
  (function symbolTrail() {
    const cv = $('#trail'), ctx = cv.getContext('2d');
    if (!ctx || calm.matches || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const SIZE = 20, MAX = 10, FADE = 220;
    const BOX = 20, INSET = (SIZE - BOX) / 2; // the colored square fills its grid cell
    const COLORS = ['#ae85ff', '#f73678', '#c05200', '#583af7', '#5fed83', '#bba00a'];
    const DARK_TEXT = new Set(['#ae85ff', '#5fed83', '#bba00a']); // the light colors get dark text, the strong ones white
    const SYMBOLS = ['-', '/', ')', '.', '+', '=', '>', '<', '*', '&', '('];
    const live = [];
    let raf = 0, dpr = 1, lastX = null, lastY = null;
    function size() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
    }
    // empty space = an element that holds other elements, or has no text of its own
    function emptySpot(t) {
      if (!t || !t.closest || !t.closest('.trail-area') || t.closest('.trail-ignore, a, button, input, textarea, label, img, .btn, .tag')) return false;
      return t.children.length !== 0 || !(t.textContent || '').trim();
    }
    function draw(now) {
      raf = 0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '600 13px "Geist Mono", ui-monospace, monospace';
      for (let i = live.length - 1; i >= 0; i--) {
        const q = live[i], age = now - q.born;
        const a = age < q.life ? 1 : 1 - (age - q.life) / FADE;
        if (a <= 0) { live.splice(i, 1); continue; }
        ctx.globalAlpha = a;
        ctx.fillStyle = q.color; ctx.fillRect(q.x + INSET, q.y + INSET, BOX, BOX);
        if (q.text) { ctx.fillStyle = DARK_TEXT.has(q.color) ? '#0b0f0c' : '#fff'; ctx.fillText(q.text, q.x + SIZE / 2, q.y + SIZE / 2 + 1); }
      }
      ctx.globalAlpha = 1;
      if (live.length) raf = requestAnimationFrame(draw);
    }
    addEventListener('mousemove', e => {
      const x = SIZE * Math.floor(e.clientX / SIZE), y = SIZE * Math.floor(e.clientY / SIZE);
      if (x === lastX && y === lastY) return;            // still in the same cell
      if (!emptySpot(e.target)) return;
      lastX = x; lastY = y;
      if (live.length >= MAX) live.shift();               // the oldest gives its place
      live.push({ x, y, born: performance.now(), life: 100 + 300 * Math.random(),
        color: COLORS[(Math.random() * COLORS.length) | 0], text: Math.random() < .3 ? '' : SYMBOLS[(Math.random() * SYMBOLS.length) | 0] });
      if (!raf) raf = requestAnimationFrame(draw);
    }, { passive: true });
    size();
    addEventListener('resize', size);
  })();

  /* ── Journey tabs: everything, work, or study ── */
  const tabs = [...document.querySelectorAll('.tab')], rows = [...document.querySelectorAll('.agenda .row')];
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.setAttribute('aria-selected', String(x === t)));
    const kind = t.dataset.kind;
    rows.forEach(r => {
      const show = kind === 'all' || r.dataset.kind === kind;
      if (show && r.hidden && r.animate && !calm.matches) { r.hidden = false; r.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' }); }
      else r.hidden = !show;
    });
  }));

  /* ── Before and after: the old site on top, cut at the line. When it comes into view, the line sweeps once ── */
  const cmp = $('#cmp'), cmpRange = cmp.querySelector('.cmp-range');
  let cmpAnim = 0;
  const cmpSet = v => cmp.style.setProperty('--pos', v + '%');
  cmpRange.addEventListener('input', () => { cancelAnimationFrame(cmpAnim); cmpSet(+cmpRange.value); });
  function sweep() {
    if (calm.matches) { cmpRange.value = 50; return cmpSet(50); }
    const keys = [[0, 0], [.45, 72], [1, 50]], ms = 1600, t0 = performance.now();
    const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    const step = now => {
      const k = Math.min(1, (now - t0) / ms), i = k > keys[1][0] ? 1 : 0;
      const [ka, va] = keys[i], [kb, vb] = keys[i + 1], v = va + (vb - va) * ease((k - ka) / (kb - ka));
      cmpRange.value = v; cmpSet(v);
      if (k < 1) cmpAnim = requestAnimationFrame(step);
    };
    cmpAnim = requestAnimationFrame(step);
  }
  if ('IntersectionObserver' in window) {
    const o = new IntersectionObserver(([en]) => { if (en.isIntersecting) { o.disconnect(); setTimeout(sweep, 250); } }, { threshold: .6 });
    o.observe(cmp);
  } else sweep();

  /* ── Copy e-mail ── */
  $('#copy-email').addEventListener('click', e => {
    const b = e.currentTarget, email = $('#email').textContent.trim();
    const ok = () => { b.textContent = TXT[lang].copied; setTimeout(() => { b.textContent = TXT[lang].copy; }, 1800); };
    const select = () => { const r = document.createRange(); r.selectNodeContents($('#email')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
    if (navigator.clipboard) navigator.clipboard.writeText(email).then(ok, select); else select();
  });

  /* ── Assistant as a terminal ──
     The same rules as the main site: the AI can end an answer with marks like [[ociani]] or [[rolar:fim]];
     only the marks on these lists do anything, and every link is built here, never taken from the AI. */
  const CONTACT = { email: 'kelvin.krauss.br@gmail.com', wa: '5547999104771', linkedin: 'https://www.linkedin.com/in/kelvin-krauss-04b7622b8/', github: 'https://github.com/KelvinKrauss' };
  const REPOS = {
    banco: 'https://github.com/KelvinKrauss/Aplicativo-de-Controle-de-Transacoes-Financeiras-com-Java',
    catalogo: 'https://github.com/KelvinKrauss/Catalogo-e-Simulacao-de-pedido-persistente-em-h2database',
    portfolio: 'https://github.com/KelvinKrauss/site_kelvinkrauss',
  };
  const BUTTONS = ['ociani', 'projetos', 'trajetoria', 'habilidades', 'contato', 'curriculo', 'antes_depois', 'whatsapp', 'email', 'linkedin', 'github', 'codigo', 'copiar_email'];
  const AUTO = ['abrir_curriculo', 'idioma', 'traduzir', 'mensagem', 'ir', 'rolar', 'tema'];
  const ICONS = { whatsapp: 'i-wa', email: 'i-mail', copiar_email: 'i-mail', linkedin: 'i-in', github: 'i-gh', codigo: 'i-gh', curriculo: 'i-doc' };
  const SECTIONS = { sobre: '#sobre', trajetoria: '#trajetoria', projetos: '#projetos', ociani: '#ociani', habilidades: '#habilidades', contato: '#contato' };
  const plain = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const cleanParam = p => (p || '').replace(/[\u0000-\u001f<>[\]{}]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  function splitReply(raw, final) {
    const acts = [], chips = [], auto = [];
    let text = raw.replace(/\[\[\s*([a-zà-ú_]+)\s*(?::([^\]\n]*))?\]\]/gi, (m, k, p) => {
      k = plain(k); p = cleanParam(p);
      if (k === 'pergunta') { if (p && chips.length < 2) chips.push(p); }
      else if (AUTO.includes(k)) { if (!auto.some(a => a.k === k)) auto.push({ k, p }); }
      else if (BUTTONS.includes(k) && !acts.some(a => a.k === k)) acts.push({ k, p });
      return '';
    });
    if (!final) text = text.replace(/\[\[?[^\]\n]*\]?$/, ''); // a mark still arriving
    // things this page does not do by itself become buttons: the resume, and a message (WhatsApp / e-mail)
    if (auto.some(a => a.k === 'abrir_curriculo') && !acts.some(a => a.k === 'curriculo')) acts.unshift({ k: 'curriculo', p: '' });
    if (auto.some(a => a.k === 'mensagem')) ['whatsapp', 'email'].forEach(k => { if (!acts.some(a => a.k === k)) acts.push({ k, p: '' }); });
    return { text: text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(), acts: acts.slice(0, 3), chips, auto };
  }
  const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = t => esc(t).replace(/^[ \t]*[*-][ \t]+/gm, '• ').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(“"])\*([^*\s][^*\n]*?)\*(?=[\s.,;:!?)”"]|$)/gm, '$1<em>$2</em>').replace(/\n/g, '<br>');
  const waText = s => lang === 'en'
    ? 'Hi Kelvin! I saw your portfolio and ' + (s ? 'would like to talk about ' + s + '.' : 'would like to talk with you.')
    : 'Oi, Kelvin! Vi seu portfólio e ' + (s ? 'queria conversar sobre ' + s + '.' : 'queria conversar com você.');
  const resumeHref = () => lang === 'en' ? 'images/resume-en.pdf' : 'images/curriculo.pdf';
  function actionHref({ k, p }) {
    if (k === 'whatsapp') return 'https://wa.me/' + CONTACT.wa + '?text=' + encodeURIComponent(waText(p));
    if (k === 'email') return 'mailto:' + CONTACT.email + '?subject=' + encodeURIComponent(p || (lang === 'en' ? 'Reaching out from your portfolio' : 'Contato pelo portfólio'));
    if (k === 'linkedin') return CONTACT.linkedin;
    if (k === 'github') return CONTACT.github;
    if (k === 'codigo') return REPOS[plain(p)] || CONTACT.github;
    if (k === 'curriculo') return resumeHref();
    return null;
  }
  function goSection(key) {
    const sel = key === 'antes_depois' ? '#cmp' : SECTIONS[key];
    const el = sel && document.querySelector(sel);
    if (!el) return;
    el.scrollIntoView({ behavior: calm.matches ? 'auto' : 'smooth', block: key === 'antes_depois' || key === 'ociani' ? 'center' : 'start' });
    if (key === 'antes_depois') setTimeout(sweep, 700);
  }

  const out = $('#term-out'), chipsBox = $('#term-chips'), input = $('#term-input'), sendBtn = $('#term-send');
  let history = [], asking = false;
  function line(html, cls) {
    const d = document.createElement('div'); d.className = cls; d.innerHTML = html;
    out.appendChild(d); out.scrollTop = out.scrollHeight;
    return d;
  }
  function chips(list) {
    chipsBox.innerHTML = '';
    list.forEach(q => { const b = document.createElement('button'); b.type = 'button'; b.textContent = q; b.addEventListener('click', () => ask(q)); chipsBox.appendChild(b); });
  }
  function buttons(acts) {
    if (!acts.length) return;
    const row = document.createElement('div'); row.className = 't-go';
    acts.forEach((a, i) => {
      const href = actionHref(a);
      const b = document.createElement(href ? 'a' : 'button');
      b.className = 'btn ' + (i === 0 ? 'btn-green' : 'btn-line');
      b.textContent = TXT[lang].go[a.k];
      const icon = ICONS[a.k];
      if (icon) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        svg.setAttribute('class', 'ico'); svg.setAttribute('aria-hidden', 'true'); use.setAttribute('href', '#' + icon);
        svg.appendChild(use); b.prepend(svg);
      }
      if (href) { b.href = href; if (!href.startsWith('mailto:')) { b.target = '_blank'; b.rel = 'noopener'; } }
      else {
        b.type = 'button';
        b.addEventListener('click', () => {
          if (a.k === 'copiar_email') {
            const ok = () => { b.textContent = TXT[lang].copied; };
            if (navigator.clipboard) navigator.clipboard.writeText(CONTACT.email).then(ok, () => { b.textContent = CONTACT.email; }); else b.textContent = CONTACT.email;
          } else goSection(a.k);
        });
      }
      row.appendChild(b);
    });
    out.appendChild(row); out.scrollTop = out.scrollHeight;
  }
  function runAuto(auto) {
    auto.forEach(({ k, p }) => {
      const pk = plain(p), behavior = calm.matches ? 'auto' : 'smooth';
      if (k === 'ir' && SECTIONS[pk]) setTimeout(() => goSection(pk), 500);
      else if (k === 'rolar') setTimeout(() => {
        if (/^(fim|final|embaixo|bottom|end|rodape)$/.test(pk)) scrollTo({ top: document.documentElement.scrollHeight, behavior });
        else if (/^(topo|inicio|comeco|top|start)$/.test(pk)) scrollTo({ top: 0, behavior });
        else if (/^(baixo|down|desce|descer)$/.test(pk)) scrollBy({ top: innerHeight * .8, behavior });
        else if (/^(cima|up|sobe|subir)$/.test(pk)) scrollBy({ top: -innerHeight * .8, behavior });
      }, 500);
      else if (k === 'idioma' || k === 'traduzir') {
        // this design has Portuguese and English; other languages stay on the main design
        const want = /^(en|en-us|english|ingles)$/.test(pk) ? 'en' : /^(pt|pt-br|portugues|portuguese|portugues do brasil|portugues brasileiro)$/.test(pk) ? 'pt' : null;
        if (want && want !== lang) setTimeout(() => { applyLang(want); store.set('kk-lang', lang); }, 350);
      }
    });
  }
  function resetChat() {
    history = [];
    out.innerHTML = '';
    line(fmt(TXT[lang].hello), 't-ai');
    chips(TXT[lang].sugg);
  }
  async function ask(text) {
    text = (text || '').trim();
    if (!text) return;
    if (asking) { input.value = text; input.focus(); return; } // one at a time: it waits in the input
    asking = true; sendBtn.disabled = true;
    chips([]);
    line(esc(text), 't-me');
    history.push({ role: 'user', parts: [{ text }] });
    const live = line(esc(TXT[lang].wait), 't-ai wait');
    let raw = '';
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ history }) });
      const type = res.headers.get('content-type') || '';
      if (!res.ok || type.includes('json') || !res.body) throw Object.assign(new Error('chat'), { status: res.status });
      const reader = res.body.getReader(), dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += dec.decode(value, { stream: true });
        const shown = splitReply(raw, false).text;
        if (shown) { live.classList.remove('wait'); live.innerHTML = fmt(shown); out.scrollTop = out.scrollHeight; }
      }
      raw += dec.decode();
      const r = splitReply(raw, true);
      if (!r.text && (r.auto.length || r.acts.length)) r.text = TXT[lang].done;
      if (!r.text) throw new Error('empty');
      history.push({ role: 'model', parts: [{ text: raw }] });
      live.classList.remove('wait');
      live.innerHTML = fmt(r.text);
      buttons(r.acts);
      runAuto(r.auto);
      chips(r.chips);
    } catch (err) {
      history.pop();
      live.classList.remove('wait'); live.classList.add('err');
      live.innerHTML = esc(err && err.status === 429 ? TXT[lang].busy : TXT[lang].offline);
    } finally {
      asking = false; sendBtn.disabled = false;
    }
  }
  $('#term-form').addEventListener('submit', e => { e.preventDefault(); const q = input.value; input.value = ''; ask(q); });

  applyLang(lang);
})();
