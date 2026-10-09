// Chamada ao Gemini usada por chat.js e translate.js. Arquivos que começam com "_" dentro de /api
// não viram rotas na Vercel: este só é importado pelas outras funções.
//
// No plano gratuito cada modelo tem a sua própria cota (por minuto e por dia). Por isso a lista tem
// vários: os Flash (melhores, ~20 por dia cada) vão primeiro e, quando acabam, os Flash Lite
// (~500 por dia cada) seguram o site. Se um modelo não existe ou está sem cota, passa para o próximo.
// GEMINI_MODEL / GEMINI_FAST_MODEL (variáveis de ambiente opcionais) colocam um modelo na frente.
const MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3-flash',
  'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest',
].filter(Boolean);

// For simple jobs (translation) speed matters more than reasoning: the Lite models first.
export const FAST_MODELS = [
  process.env.GEMINI_FAST_MODEL,
  'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-flash-latest',
].filter(Boolean);

const FALLBACK_STATUS = new Set([400, 403, 404, 429, 500, 503]);

// A model that just said "no quota" (429) is skipped for a minute, and one that does not exist (404) for
// an hour, so a question does not wait for the same refusals every time. Kept in the function's memory.
const skipUntil = new Map();
const SKIP_MS = { 404: 60 * 60 * 1000, 429: 60 * 1000 };

// stream: true usa streamGenerateContent (SSE); false, generateContent (resposta inteira)
export async function callGemini({ apiKey, body, stream = false, signal, models = MODELS }) {
  let last = null;
  const tried = []; // "model:status" of each failed attempt (no secrets), returned so a 502 can be diagnosed
  const now = Date.now();
  const list = [...new Set(models)];
  // if every model is cooling down, try them all anyway (better a slow answer than none)
  const ready = list.filter(m => !(skipUntil.get(m) > now));
  for (const model of ready.length ? ready : list) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal,
    });
    if (res.ok && res.body) return { res, model, tried: tried.join(',') };
    let detail = '';
    try { detail = (await res.json()).error?.message || ''; } catch {}
    console.error('Gemini', model, res.status, detail.slice(0, 200));
    tried.push(model + ':' + res.status);
    if (SKIP_MS[res.status]) skipUntil.set(model, Date.now() + SKIP_MS[res.status]);
    last = { res, model };
    // a request problem that is not about the model (bad key, malformed body) would fail on every model
    if (!FALLBACK_STATUS.has(res.status) || (res.status === 400 && !/model|not found|not supported/i.test(detail))) break;
  }
  return { res: last && last.res, model: last && last.model, failed: true, tried: tried.join(',') };
}
