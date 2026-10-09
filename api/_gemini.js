// Chamada ao Gemini usada por chat.js e translate.js. Arquivos que começam com "_" dentro de /api
// não viram rotas na Vercel: este só é importado pelas outras funções.
//
// Tenta os modelos em ordem: um mais forte primeiro (segue melhor instruções longas e inventa menos),
// e cai para o seguinte se ele não existir, estiver sem cota ou fora do ar. GEMINI_MODEL (variável de
// ambiente opcional) força um modelo específico na frente da lista.
const MODELS = [process.env.GEMINI_MODEL, 'gemini-3.1-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'].filter(Boolean);
const FALLBACK_STATUS = new Set([400, 403, 404, 429, 500, 503]);

// stream: true usa streamGenerateContent (SSE); false, generateContent (resposta inteira)
export async function callGemini({ apiKey, body, stream = false, signal }) {
  let last = null;
  for (const model of [...new Set(MODELS)]) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal,
    });
    if (res.ok && res.body) return { res, model };
    let detail = '';
    try { detail = (await res.json()).error?.message || ''; } catch {}
    console.error('Gemini', model, res.status, detail.slice(0, 200));
    last = { res, model };
    // a request problem that is not about the model (bad key, malformed body) would fail on every model
    if (!FALLBACK_STATUS.has(res.status) || (res.status === 400 && !/model|not found|not supported/i.test(detail))) break;
  }
  return { res: last && last.res, model: last && last.model, failed: true };
}
