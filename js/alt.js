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

  /* ── The site always opens at the top (the KK), even after a reload or from an old address like /#sobre ──
     The menu links scroll to their section without writing "#sobre" in the address, so the browser never
     remembers (or autocompletes) an address that opens in the middle of the page. */
  // (window.history: further down, "history" is the chat's own list of messages)
  if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  if (location.hash) {
    window.history.replaceState(null, '', location.pathname + location.search);
    const toTop = () => scrollTo({ top: 0, behavior: 'instant' });
    toTop(); addEventListener('load', toTop, { once: true });
  }
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    const id = a && a.getAttribute('href').slice(1), target = id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: calm.matches ? 'auto' : 'smooth', block: 'start' });
    // keyboard users continue from the section they jumped to
    if (!target.matches('a, button, input, textarea, select, [tabindex]')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });

  /* ── Texts used by the script ── */
  const TXT = {
    pt: {
      hello: 'Oi! Sou a IA do portfólio do Kelvin. Pergunte o que quiser sobre ele: projetos, estudos ou como falar com ele.',
      sugg: ['O que ele fez no site da Ociani?', 'Quero um site: como funciona?', 'Quero falar com ele'],
      wait: 'pensando', offline: 'Não consegui responder agora. Tente de novo em instantes ou fale direto: kelvin.krauss.br@gmail.com',
      busy: 'Foram muitas perguntas seguidas. Espere um minuto e tente de novo.', done: 'Pronto!',
      copied: 'Copiado!', copy: 'Copiar',
      go: { ociani: 'Ver o projeto da Ociani', projetos: 'Ver os projetos', trajetoria: 'Ver a trajetória', habilidades: 'Ver as habilidades',
        contato: 'Ver o contato', curriculo: 'Abrir o currículo', antes_depois: 'Ver o antes e depois', whatsapp: 'Falar no WhatsApp',
        email: 'Mandar e-mail', linkedin: 'Abrir o LinkedIn', github: 'Ver o GitHub', codigo: 'Ver o código', copiar_email: 'Copiar o e-mail' },
    },
    en: {
      hello: "Hi! I'm the AI on Kelvin's portfolio. Ask me anything about him: projects, studies or how to reach him.",
      sugg: ['What did he build for Ociani?', 'I need a website: how does it work?', 'I want to talk to him'],
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
  const ATTRS = [['enAria', 'ptAria', 'aria-label'], ['enPh', 'ptPh', 'placeholder'], ['enAlt', 'ptAlt', 'alt'], ['enHref', 'ptHref', 'href'], ['enTitle', 'ptTitle', 'title']];
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


  /* ── Navigation: marks the section in view ── */
  const navLinks = [...document.querySelectorAll('.nav-cell[href^="#"]')];
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver(entries => entries.forEach(en => {
      const link = navLinks.find(a => a.getAttribute('href') === '#' + en.target.id);
      if (link) link.classList.toggle('on', en.isIntersecting);
    }), { rootMargin: '-45% 0px -50% 0px' });
    navLinks.forEach(a => { const s = document.querySelector(a.getAttribute('href')); if (s) obs.observe(s); });
  }

  /* ── The dot on the menu: how far you are through each section ──
     The reading line is the middle of the screen. Inside a section, the dot sits at the same fraction of that
     section's menu cell (halfway through the section = halfway under its name). Between sections it waits at the
     end of the cell, which is where the next cell starts, so it never jumps. Hidden above the first section and
     when the menu cells are hidden (phones). */
  (function navDot() {
    const nav = document.querySelector('.nav');
    const pairs = navLinks.map(a => [a, document.querySelector(a.getAttribute('href'))]).filter(p => p[1]);
    if (!nav || !pairs.length) return;
    const dot = document.createElement('span'), trace = document.createElement('span');
    dot.className = 'nav-dot'; trace.className = 'nav-trace';
    // a little pixel-art UFO (20 x 9 pixels, 2 px each) riding the line; its lights blink in turns
    dot.innerHTML = '<svg viewBox="0 0 20 9" width="40" height="18" shape-rendering="crispEdges"><rect x="8" y="0" width="4" height="1" fill="#0b0f0c"/><rect x="6" y="1" width="2" height="1" fill="#0b0f0c"/><rect x="8" y="1" width="1" height="1" fill="#a5f3e8"/><rect x="9" y="1" width="1" height="1" fill="#ffffff"/><rect x="10" y="1" width="2" height="1" fill="#a5f3e8"/><rect x="12" y="1" width="2" height="1" fill="#0b0f0c"/><rect x="5" y="2" width="1" height="1" fill="#0b0f0c"/><rect x="6" y="2" width="2" height="1" fill="#a5f3e8"/><rect x="8" y="2" width="1" height="1" fill="#ffffff"/><rect x="9" y="2" width="5" height="1" fill="#a5f3e8"/><rect x="14" y="2" width="1" height="1" fill="#0b0f0c"/><rect x="3" y="3" width="14" height="1" fill="#0b0f0c"/><rect x="1" y="4" width="1" height="1" fill="#0b0f0c"/><rect x="2" y="4" width="16" height="1" fill="#2dd4bf"/><rect x="18" y="4" width="1" height="1" fill="#0b0f0c"/><rect x="0" y="5" width="1" height="1" fill="#0b0f0c"/><rect x="1" y="5" width="2" height="1" fill="#0f766e"/><rect class="ufo-a" x="3" y="5" width="1" height="1"/><rect x="4" y="5" width="3" height="1" fill="#0f766e"/><rect class="ufo-b" x="7" y="5" width="1" height="1"/><rect x="8" y="5" width="4" height="1" fill="#0f766e"/><rect class="ufo-a" x="12" y="5" width="1" height="1"/><rect x="13" y="5" width="3" height="1" fill="#0f766e"/><rect class="ufo-b" x="16" y="5" width="1" height="1"/><rect x="17" y="5" width="2" height="1" fill="#0f766e"/><rect x="19" y="5" width="1" height="1" fill="#0b0f0c"/><rect x="1" y="6" width="1" height="1" fill="#0b0f0c"/><rect x="2" y="6" width="16" height="1" fill="#0f766e"/><rect x="18" y="6" width="1" height="1" fill="#0b0f0c"/><rect x="3" y="7" width="2" height="1" fill="#0b0f0c"/><rect x="5" y="7" width="10" height="1" fill="#0a4d47"/><rect x="15" y="7" width="2" height="1" fill="#0b0f0c"/><rect x="5" y="8" width="10" height="1" fill="#0b0f0c"/></svg>';
    dot.setAttribute('aria-hidden', 'true'); trace.setAttribute('aria-hidden', 'true');
    nav.append(trace, dot);
    let queued = false;
    function place() {
      queued = false;
      const navBox = nav.getBoundingClientRect(), y = innerHeight * .5;
      const atEnd = scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
      let x = null, cellLeft = 0;
      for (let i = pairs.length - 1; i >= 0; i--) {
        const [a, sec] = pairs[i], s = sec.getBoundingClientRect(), c = a.getBoundingClientRect();
        if (!c.width) break;                                   // the menu cells are hidden on this screen
        if (s.top > y && !(atEnd && i === pairs.length - 1)) continue;
        // the last section can't reach the middle of the screen at the bottom of the page: finish it there
        const p = atEnd && i === pairs.length - 1 ? 1 : Math.min(1, Math.max(0, (y - s.top) / s.height));
        x = c.left - navBox.left + p * c.width; cellLeft = c.left - navBox.left;
        break;
      }
      const on = x !== null;
      dot.classList.toggle('show', on); trace.classList.toggle('show', on);
      if (!on) return;
      dot.style.transform = 'translateX(' + x + 'px)';
      // a real width (not a stretched 1 px line): with Windows display scaling a stretched line came out short
      trace.style.transform = 'translateX(' + cellLeft + 'px)';
      trace.style.width = Math.max(0, x - cellLeft) + 'px';
    }
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(place); } };
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue);
    document.fonts && document.fonts.ready.then(queue);
    new MutationObserver(queue).observe(nav, { subtree: true, characterData: true, childList: true }); // language switch
    queue();
  })();

  /* ── Squares with programming symbols where the mouse passes ──
     Like the effect on githubuniverse.com, but drawn UNDER the page, so the text always stays on top:
     - a 20 px grid on the page; a new square when the mouse enters another cell. The squares belong to the page,
       so when you scroll they move with it;
     - at most 10 at once, each lit for 0.1–0.4 s, then it shrinks away;
     - full, strong color on empty space; behind text, a light version without the symbol, so reading isn't disturbed;
     - not over the tile mosaic on the left. Solid things (buttons, images, the terminal) simply cover them.
     One canvas behind the content, drawn only while some square is lit. Mouse only, off with "reduce motion". */
  (function symbolTrail() {
    const cv = $('#trail'), ctx = cv.getContext('2d');
    if (!ctx || calm.matches || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const SIZE = 20, MAX = 10, FADE = 260; // FADE: how long it takes to shrink away
    const SOFT = .32;                       // how strong a square is behind text
    const COLORS = ['#9b5cff', '#ff2e74', '#ff6a00', '#4b3bff', '#1fd65f', '#ffc400'];
    const DARK_TEXT = new Set(['#1fd65f', '#ffc400']); // the light colors get dark text, the strong ones white
    const SYMBOLS = ['-', '/', ')', '.', '+', '=', '>', '<', '*', '&', '('];
    const live = [];
    let raf = 0, dpr = 1, lastX = null, lastY = null;
    function size() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
    }
    // Where the text really is: the box of each line of words (not the whole paragraph or list row), in page
    // coordinates. Measured again only after something in the content changes.
    const main = document.querySelector('main') || document.body;
    let text = [], dirty = true;
    const markDirty = () => { dirty = true; };
    function measure() {
      dirty = false; text = [];
      const range = document.createRange(), walk = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        if (!n.nodeValue.trim()) continue;
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) if (r.width && r.height) text.push([r.left + scrollX - 3, r.top + scrollY - 3, r.right + scrollX + 3, r.bottom + scrollY + 3]);
      }
    }
    new MutationObserver(markDirty).observe(main, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'class', 'style'] });
    if ('ResizeObserver' in window) new ResizeObserver(markDirty).observe(document.body);
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', markDirty);
    const onText = (x, y) => { if (dirty) measure(); return text.some(([l, t, r, b]) => x < r && x + SIZE > l && y < b && y + SIZE > t); };
    const mosaicW = () => { const m = $('#mosaic'); return m ? m.offsetWidth : 0; };
    function draw(now) {
      raf = 0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = live.length - 1; i >= 0; i--) {
        const q = live[i], age = now - q.born;
        // at the end of its life the square shrinks into its center (like githubuniverse.com), it doesn't fade
        const k = age < q.life ? 1 : 1 - (age - q.life) / FADE;
        if (k <= 0) { live.splice(i, 1); continue; }
        const s = k * k * (3 - 2 * k), box = SIZE * s, cx = q.x - scrollX + SIZE / 2, cy = q.y - scrollY + SIZE / 2; // page → screen
        ctx.globalAlpha = q.soft ? SOFT : 1;
        ctx.fillStyle = q.color; ctx.fillRect(cx - box / 2, cy - box / 2, box, box);
        if (q.text && !q.soft && s > .25) {
          ctx.font = '600 ' + (13 * s).toFixed(1) + 'px "Geist Mono", ui-monospace, monospace';
          ctx.fillStyle = DARK_TEXT.has(q.color) ? '#0b0f0c' : '#fff'; ctx.fillText(q.text, cx, cy + s);
        }
      }
      ctx.globalAlpha = 1;
      if (live.length) raf = requestAnimationFrame(draw);
    }
    addEventListener('mousemove', e => {
      const x = SIZE * Math.floor((e.clientX + scrollX) / SIZE), y = SIZE * Math.floor((e.clientY + scrollY) / SIZE); // a grid on the page
      if (x === lastX && y === lastY) return;            // still in the same cell
      lastX = x; lastY = y;
      const t = e.target;
      if (!t || !t.closest || !t.closest('main') || t.closest('#ai-float') || e.clientX < mosaicW()) return;
      if (live.length >= MAX) live.shift();               // the oldest gives its place
      live.push({ x, y, born: performance.now(), life: 100 + 300 * Math.random(), soft: onText(x, y),
        color: COLORS[(Math.random() * COLORS.length) | 0], text: Math.random() < .3 ? '' : SYMBOLS[(Math.random() * SYMBOLS.length) | 0] });
      if (!raf) raf = requestAnimationFrame(draw);
    }, { passive: true });
    addEventListener('scroll', () => { lastX = lastY = null; }, { passive: true });
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

  /* ── Résumé: opens over the page on computers; on phones the PDF opens in a new tab (PDFs inside a page work badly there) ── */
  const cv = $('#cv'), cvBox = cv.querySelector('.cv-box'), cvFrame = $('#cv-frame');
  const bigScreen = matchMedia('(min-width: 760px) and (pointer: fine)');
  let cvReturn = null;
  function openCv(href, from) {
    if (!bigScreen.matches) return false;
    const want = href + '#view=FitH&navpanes=0'; // fit to width, without the thumbnails panel
    if (cvFrame.getAttribute('src') !== want) cvFrame.setAttribute('src', want);
    cvReturn = from || document.activeElement;
    cv.hidden = false;
    root.style.overflow = 'hidden'; // the page behind stays still
    if (!calm.matches && cv.animate) {
      cv.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
      cvBox.animate([{ transform: 'translateY(18px) scale(.97)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.2, .9, .3, 1.1)' });
    }
    $('#cv-close').focus({ preventScroll: true });
    return true;
  }
  function closeCv() {
    if (cv.hidden) return;
    const done = () => { cv.hidden = true; root.style.overflow = ''; if (cvReturn && cvReturn.focus) cvReturn.focus({ preventScroll: true }); };
    if (calm.matches || !cv.animate) return done();
    cvBox.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(12px) scale(.98)', opacity: 0 }], { duration: 180, easing: 'ease-in', fill: 'forwards' });
    cv.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-in', fill: 'forwards' }).finished.then(() => { done(); cv.getAnimations().forEach(a => a.cancel()); cvBox.getAnimations().forEach(a => a.cancel()); });
  }
  // any résumé link (navigation, contact row, the assistant's button), including ones created later
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[data-resume]');
    if (a && openCv(a.getAttribute('href'), a)) e.preventDefault();
  });
  $('#cv-close').addEventListener('click', closeCv);
  cv.addEventListener('click', e => { if (e.target === cv) closeCv(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCv(); });


  /* ── KK: back to the top, where the contacts are; they give a short blink so the eye finds them ── */
  $('#kk-link').addEventListener('click', e => {
    e.preventDefault();
    scrollTo({ top: 0, behavior: calm.matches ? 'auto' : 'smooth' });
    const links = $('.hero-links');
    if (!links || calm.matches) return;
    setTimeout(() => { links.classList.remove('flash'); void links.offsetWidth; links.classList.add('flash'); }, scrollY > 40 ? 500 : 0);
  });

  /* ── Mosaic of small tiles down the left margin ──
     Medium tiles (48 px), almost full, thinning toward the content; the same pattern every visit (fixed seed).
     Where the margin is too thin it takes one column and pushes the page a little; on phones it's off. */
  (function mosaic() {
    const box = document.createElement('div'); box.id = 'mosaic'; box.setAttribute('aria-hidden', 'true');
    document.body.prepend(box);
    const SIZE = 48, FILL = .95;
    // the same colors as the squares that follow the mouse, plus the theme teal
    const COLORS = ['#9b5cff', '#ff2e74', '#ff6a00', '#4b3bff', '#1fd65f', '#ffc400', '#0f766e'];
    const FG = { '#9b5cff': ['#4b3bff', '#ffc400'], '#ff2e74': ['#ffc400', '#4b3bff'], '#ff6a00': ['#4b3bff', '#ffc400'], '#4b3bff': ['#9b5cff', '#1fd65f'],
      '#1fd65f': ['#0f766e', '#4b3bff'], '#ffc400': ['#ff6a00', '#ff2e74'], '#0f766e': ['#1fd65f', '#ffc400'] };
    const KINDS = ['solid', 'solid', 'dots', 'cross', 'quarter', 'quarter', 'half', 'glyph'];
    const GLYPHS = ['{', '}', '>', '<', '/', '=', '+', '*'];
    let lastKey = '';
    function build() {
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      document.body.classList.remove('mosaic-pad'); document.body.style.removeProperty('--pad');
      if (innerWidth < 860) { box.innerHTML = ''; box.style.width = '0'; lastKey = ''; return; }
      const hero = document.querySelector('.hero');
      let room = hero.getBoundingClientRect().left + scrollX - 12;
      if (room < SIZE) { document.body.classList.add('mosaic-pad'); document.body.style.setProperty('--pad', (SIZE + 12) + 'px'); room = SIZE; }
      const H = Math.floor($('.foot').getBoundingClientRect().top + scrollY);
      const cols = Math.max(1, Math.floor(room / SIZE)), rows = Math.ceil(H / SIZE);
      const key = cols + 'x' + H; if (key === lastKey) return; lastKey = key;
      Object.assign(box.style, { width: cols * SIZE + 'px', height: H + 'px', gridTemplateColumns: 'repeat(' + cols + ', ' + SIZE + 'px)', gridAutoRows: SIZE + 'px' });
      box.style.setProperty('--ts', SIZE + 'px');
      const frag = document.createDocumentFragment();
      for (let i = 0; i < cols * rows; i++) {
        const t = document.createElement('div'), col = i % cols, fade = cols > 1 ? 1 - (col / cols) * .45 : 1;
        if (rnd() > FILL * fade) { t.className = 'mt empty'; frag.appendChild(t); continue; }
        const bg = COLORS[(rnd() * COLORS.length) | 0], kind = KINDS[(rnd() * KINDS.length) | 0], [fg, fg2] = FG[bg];
        t.className = 'mt ' + kind + (kind === 'quarter' ? ' r' + (1 + ((rnd() * 4) | 0)) : kind === 'half' ? ' r' + (1 + ((rnd() * 2) | 0)) : '');
        t.style.background = bg; t.style.setProperty('--fg', fg); t.style.setProperty('--fg2', fg2);
        if (kind === 'cross') t.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
        if (kind === 'glyph') t.textContent = GLYPHS[(rnd() * GLYPHS.length) | 0];
        frag.appendChild(t);
      }
      box.replaceChildren(frag);
    }
    let timer = 0; const later = () => { clearTimeout(timer); timer = setTimeout(build, 150); };
    addEventListener('resize', later);
    if ('ResizeObserver' in window) new ResizeObserver(later).observe(document.body); // the page grew (images, tabs, chat)
    build();
  })();

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
      if (href) { b.href = href; if (!href.startsWith('mailto:')) { b.target = '_blank'; b.rel = 'noopener'; } if (a.k === 'curriculo') b.dataset.resume = ''; }
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
      else if (k === 'abrir_curriculo') setTimeout(() => openCv(resumeHref()), 550); // the page's own viewer: no new tab

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
      if (!floating && !sectionInView) bubble.classList.add('unread'); // answered while out of sight
    } catch (err) {
      history.pop();
      live.classList.remove('wait'); live.classList.add('err');
      live.innerHTML = esc(err && err.status === 429 ? TXT[lang].busy : TXT[lang].offline);
    } finally {
      asking = false; sendBtn.disabled = false;
    }
  }
  $('#term-form').addEventListener('submit', e => { e.preventDefault(); const q = input.value; input.value = ''; ask(q); });

  /* ── The assistant from anywhere (like the main design's bubble) ──
     While the "Pergunte" section is off screen, a pixel-art bubble waits in the corner. Clicking it moves the same
     terminal (same conversation) into a floating window; ✕ or Escape puts it back, and so does the button left in
     its place. An answer that arrives while it's closed marks the bubble. */
  const term = $('#term'), away = $('#term-away'), aiFloat = $('#ai-float'), bubble = $('#ai-bubble'), askSec = $('#pergunte');
  let floating = false, sectionInView = false;
  let footInView = false;
  const syncBubble = () => { bubble.hidden = floating || sectionInView || footInView; };
  function openFloat() {
    if (floating) return;
    floating = true;
    away.hidden = false;
    aiFloat.appendChild(term);
    aiFloat.hidden = false;
    bubble.classList.remove('unread');
    syncBubble();
    if (!calm.matches && aiFloat.animate) aiFloat.animate([{ opacity: 0, transform: 'translateY(18px) scale(.95)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2, .9, .3, 1.1)' });
    out.scrollTop = out.scrollHeight;
    input.focus({ preventScroll: true });
  }
  function closeFloat(back) {
    if (!floating) return;
    const done = () => {
      floating = false; aiFloat.hidden = true;
      away.after(term); away.hidden = true;
      syncBubble();
      if (back) { term.scrollIntoView({ behavior: calm.matches ? 'auto' : 'smooth', block: 'center' }); input.focus({ preventScroll: true }); }
      else if (!bubble.hidden) bubble.focus({ preventScroll: true });
    };
    if (calm.matches || !aiFloat.animate) return done();
    aiFloat.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(14px) scale(.97)' }], { duration: 180, easing: 'ease-in' }).finished.then(done);
  }
  bubble.addEventListener('click', openFloat);
  $('#term-close').addEventListener('click', () => closeFloat(false));
  $('#term-back').addEventListener('click', () => closeFloat(true));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && floating && cv.hidden) closeFloat(false); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => { sectionInView = en.isIntersecting; syncBubble(); }, { threshold: .15 }).observe(askSec);
    // at the very end of the page the bubble would sit on the footer's links: it steps aside
    new IntersectionObserver(([en]) => { footInView = en.isIntersecting; syncBubble(); }).observe($('.foot'));
  }
  else syncBubble();
  // the hero's "ask my assistant" button: with the window open, it just focuses it
  document.querySelectorAll('a[href="#pergunte"]').forEach(a => a.addEventListener('click', e => { if (floating) { e.preventDefault(); input.focus(); } }));

  applyLang(lang);
})();

/* ── The capybara's life in the black bar ──
   1. When the page opens she walks in (facing left, 45 px per second, at most 360 px; on wide bars she fades in
      on the way) and stops next to the clock, where she blinks and flicks her ear now and then.
   2. Every 7–15 s a grass tuft grows somewhere to her right (never over the text). She turns to it, walks over,
      lowers her head and chews while the grass shrinks bite by bite. Then she stays where she is.
   Skipped with "reduce motion". ── */
(function capyLife() {
  const w = document.getElementById('capy'), bar = document.querySelector('.bar');
  if (!w || !bar || !w.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const SPEED = 45, GRASS = '<svg viewBox="0 0 12 10" width="12" height="10" shape-rendering="crispEdges" aria-hidden="true"><rect x="5" y="0" width="1" height="1" fill="#7ddc6a"/><rect x="2" y="1" width="1" height="1" fill="#7ddc6a"/><rect x="5" y="1" width="1" height="1" fill="#7ddc6a"/><rect x="9" y="1" width="1" height="1" fill="#7ddc6a"/><rect x="2" y="2" width="1" height="1" fill="#7ddc6a"/><rect x="5" y="2" width="2" height="1" fill="#7ddc6a"/><rect x="9" y="2" width="1" height="1" fill="#7ddc6a"/><rect x="2" y="3" width="2" height="1" fill="#7ddc6a"/><rect x="5" y="3" width="1" height="1" fill="#2f9e44"/><rect x="6" y="3" width="1" height="1" fill="#7ddc6a"/><rect x="8" y="3" width="2" height="1" fill="#7ddc6a"/><rect x="0" y="4" width="1" height="1" fill="#7ddc6a"/><rect x="3" y="4" width="1" height="1" fill="#7ddc6a"/><rect x="5" y="4" width="1" height="1" fill="#2f9e44"/><rect x="6" y="4" width="1" height="1" fill="#7ddc6a"/><rect x="8" y="4" width="1" height="1" fill="#7ddc6a"/><rect x="11" y="4" width="1" height="1" fill="#7ddc6a"/><rect x="0" y="5" width="2" height="1" fill="#7ddc6a"/><rect x="3" y="5" width="1" height="1" fill="#7ddc6a"/><rect x="4" y="5" width="2" height="1" fill="#2f9e44"/><rect x="6" y="5" width="1" height="1" fill="#7ddc6a"/><rect x="8" y="5" width="1" height="1" fill="#7ddc6a"/><rect x="9" y="5" width="1" height="1" fill="#2f9e44"/><rect x="11" y="5" width="1" height="1" fill="#7ddc6a"/><rect x="1" y="6" width="1" height="1" fill="#2f9e44"/><rect x="2" y="6" width="1" height="1" fill="#7ddc6a"/><rect x="3" y="6" width="2" height="1" fill="#2f9e44"/><rect x="5" y="6" width="1" height="1" fill="#7ddc6a"/><rect x="6" y="6" width="1" height="1" fill="#2f9e44"/><rect x="7" y="6" width="1" height="1" fill="#7ddc6a"/><rect x="8" y="6" width="2" height="1" fill="#2f9e44"/><rect x="10" y="6" width="1" height="1" fill="#7ddc6a"/><rect x="11" y="6" width="1" height="1" fill="#2f9e44"/><rect x="0" y="7" width="2" height="1" fill="#2f9e44"/><rect x="2" y="7" width="1" height="1" fill="#7ddc6a"/><rect x="3" y="7" width="2" height="1" fill="#2f9e44"/><rect x="5" y="7" width="1" height="1" fill="#7ddc6a"/><rect x="6" y="7" width="3" height="1" fill="#2f9e44"/><rect x="9" y="7" width="1" height="1" fill="#7ddc6a"/><rect x="10" y="7" width="2" height="1" fill="#2f9e44"/><rect x="0" y="8" width="12" height="1" fill="#2f9e44"/><rect x="0" y="9" width="12" height="1" fill="#2f9e44"/></svg>', GW = 12, GH = 10;
  const Wd = w.offsetWidth;
  let anim = null, pos = 0;                           // pos: how far right of her resting place she is, in px
  const pose = (p, d) => 'translateX(' + p + 'px) scaleX(' + d + ')';
  const restLeft = () => w.getBoundingClientRect().left - pos;
  const room = () => Math.min(380, bar.getBoundingClientRect().right - restLeft() - Wd - 16);
  function move(keys, ms, done) {
    if (anim) { anim.commitStyles(); anim.cancel(); }
    w.classList.add('walking');
    anim = w.animate(keys, { duration: ms, easing: 'linear', fill: 'forwards' });
    anim.onfinish = () => { w.classList.remove('walking'); done(); };
  }
  const later = ms => setTimeout(grass, ms);
  function grass() {
    const r = room();
    if (r < 60 || document.hidden) return later(5000);
    let t; do { t = 8 + Math.random() * (r - 8); } while (Math.abs(t - pos) < 45);   // where she will stand to eat
    const d = t > pos ? 1 : -1;
    const g = document.createElement('span');
    g.className = 'grass'; g.setAttribute('aria-hidden', 'true'); g.innerHTML = GRASS;
    // her mouth is at her right edge when she faces right, at her left edge when she faces left
    g.style.left = (w.offsetLeft + (d > 0 ? t + Wd - 3 : t - GW + 3)) + 'px';
    g.style.top = (w.offsetTop + w.offsetHeight - GH) + 'px';
    w.parentElement.appendChild(g);
    setTimeout(() => {                                 // she notices it after it has grown
      move([{ transform: pose(pos, d) }, { transform: pose(t, d) }], Math.abs(t - pos) / SPEED * 1000, () => {
        pos = t;
        w.classList.add('eating'); g.classList.add('eaten');
        setTimeout(() => { g.remove(); w.classList.remove('eating'); later(7000 + Math.random() * 8000); }, 2600);
      });
    }, 1600);
  }
  const enter = Math.min(bar.getBoundingClientRect().right - restLeft() + 10, 360), fade = enter === 360;
  if (enter < 40) return;
  move([{ transform: pose(enter, -1), opacity: fade ? 0 : 1 }, { opacity: 1, offset: fade ? .2 : 0 }, { transform: pose(0, -1), opacity: 1 }],
    enter / SPEED * 1000, () => later(4000 + Math.random() * 4000));
})();

/* ── "Why a capybara?": a small note on hover (mouse), tap (phone) or Enter, on the walking and the swimming one ── */
(function capyNote() {
  const tip = document.getElementById('capy-tip');
  if (!tip) return;
  let tipFor = null, raf = 0;
  function place() {
    if (!tipFor) return;
    const r = tipFor.getBoundingClientRect(), w = tip.offsetWidth;
    const left = Math.max(16, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 16));
    const below = r.bottom + 8 + tip.offsetHeight < innerHeight;
    tip.style.left = (left + scrollX) + 'px';
    tip.style.top = ((below ? r.bottom + 8 : r.top - tip.offsetHeight - 8) + scrollY) + 'px';
    raf = requestAnimationFrame(place);                // follows her while she walks
  }
  const show = el => { tipFor = el; tip.hidden = false; cancelAnimationFrame(raf); place(); };
  const hide = () => { tipFor = null; tip.hidden = true; cancelAnimationFrame(raf); };
  document.querySelectorAll('.capy-hit').forEach(el => {
    // hover only for a real mouse: on a phone a tap also fires "enter", which would open and then close the note
    el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') show(el); });
    el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hide(); });
    el.addEventListener('click', e => { e.stopPropagation(); if (tipFor === el && !matchMedia('(hover: hover)').matches) hide(); else show(el); });
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tipFor === el ? hide() : show(el); } });
    el.addEventListener('blur', hide);
  });
  document.addEventListener('click', hide);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
})();
