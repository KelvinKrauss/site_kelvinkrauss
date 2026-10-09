// Traduz os textos do site para qualquer idioma, quando o visitante pede pelo chat ("traduz o site pra italiano").
// O navegador manda os textos originais em português; a resposta é uma lista do mesmo tamanho, na mesma ordem.
// O HTML da tradução é limpo no navegador antes de ir para a página (main.js, translateSite).
import { callGemini, FAST_MODELS } from './_gemini.js';

const ALLOWED_ORIGIN = /^(https:\/\/(www\.)?kelvinkrauss\.me|https:\/\/kelvinkrauss[a-z0-9-]*\.vercel\.app|http:\/\/localhost(:\d+)?)$/;
const MAX_SEGMENTS = 300, MAX_TOTAL = 30000, MAX_LANG = 40;

// cada tradução do site inteiro é uma chamada grande: no máximo 6 por hora por visitante
const WINDOW_MS = 60 * 60 * 1000, MAX_PER_WINDOW = 6;
const hits = new Map();
function tooMany(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) { hits.set(ip, list); return true; }
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return false;
}

const INSTRUCTIONS = `You translate the text of a personal portfolio website, written in Brazilian Portuguese, into the target language the user names.
Rules:
- Return JSON: {"code": "<BCP 47 code of the target language, e.g. it, es, ja, pt-PT>", "items": [<one translated string per input string>]}.
- "items" must have exactly the same number of strings as the input, in the same order. Never merge, split, drop or add items.
- Keep every HTML tag exactly as it is (same tags, same attributes, same order); translate only the text between them.
- Do not translate: people's names, company and school names (Kelvin Krauss, Ociani Transportadora, IFSC, IFC, Instituto Federal de Santa Catarina, Instituto Federal Catarinense, SEST SENAT, Entra21, NTT DATA, SSW, Sanity), technology names, code, e-mail addresses, URLs, phone numbers, the symbols ↗ and ·.
- Keep the tone: natural, short website copy, first person where the original is in first person.
- If an item is only a name, a number or a symbol, return it unchanged.`;

// splits the list into n parts of similar size (by characters), keeping the order
function chunk(list, n) {
  const total = list.reduce((a, s) => a + s.length, 0), target = total / n, parts = [[]];
  let size = 0;
  for (const s of list) {
    if (size >= target && parts.length < n) { parts.push([]); size = 0; }
    parts[parts.length - 1].push(s); size += s.length;
  }
  return parts.filter(p => p.length);
}

async function translatePart(apiKey, lang, segments, signal) {
  const { res: g, model, failed } = await callGemini({
    apiKey, signal, models: FAST_MODELS,
    body: {
      system_instruction: { parts: [{ text: INSTRUCTIONS }] },
      contents: [{ role: 'user', parts: [{ text: `Target language: ${lang}\nNumber of items: ${segments.length}\nInput (JSON array):\n${JSON.stringify(segments)}` }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: { code: { type: 'STRING' }, items: { type: 'ARRAY', items: { type: 'STRING' } } },
          required: ['code', 'items'],
        },
      },
    },
  });
  if (failed) throw new Error('gemini');
  const data = await g.json();
  const out = JSON.parse((data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join(''));
  if (!Array.isArray(out.items) || out.items.length !== segments.length) {
    console.error('translate: wrong item count', out.items && out.items.length, 'expected', segments.length);
    throw new Error('count');
  }
  return { code: out.code, items: out.items.map(s => (typeof s === 'string' ? s : '')), model };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  if (!ALLOWED_ORIGIN.test(req.headers.origin || '')) return res.status(403).json({ error: 'Origem não permitida.' });

  const body = req.body || {};
  const lang = typeof body.lang === 'string' ? body.lang.replace(/[\u0000-\u001f<>{}[\]"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_LANG) : '';
  const segments = Array.isArray(body.segments) ? body.segments : null;
  if (!lang || !/\p{L}/u.test(lang) || !segments || !segments.length || segments.length > MAX_SEGMENTS
    || segments.some(s => typeof s !== 'string') || segments.reduce((n, s) => n + s.length, 0) > MAX_TOTAL) {
    return res.status(400).json({ error: 'Pedido de tradução inválido.' });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Chave de API não configurada no servidor.' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  if (tooMany(ip)) return res.status(429).json({ error: 'Muitas traduções seguidas.' });

  try {
    // The site is split into a few parts translated at the same time, with the fast model: one big call
    // took ~30 s; parallel parts take a few seconds. A part that comes back wrong is tried once more.
    const parts = chunk(segments, 4);
    const signal = AbortSignal.timeout(50000);
    const results = await Promise.all(parts.map(p => translatePart(apiKey, lang, p, signal).catch(() => translatePart(apiKey, lang, p, signal))));
    const items = results.flatMap(r => r.items);
    if (items.length !== segments.length) return res.status(502).json({ error: 'A tradução veio incompleta.' });
    const code = results.map(r => r.code).find(c => /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(c || '')) || '';
    res.setHeader('X-Model', results[0].model);
    return res.status(200).json({ code, items });
  } catch (err) {
    console.error('translate', err && err.name, err && err.message);
    return res.status(502).json({ error: 'A tradução falhou agora.' });
  }
}
