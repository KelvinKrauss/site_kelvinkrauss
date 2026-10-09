// Recado deixado pelo chat do portfólio: chega no e-mail do Kelvin pelo Resend (resend.com).
// Configuração na Vercel (Settings > Environment Variables):
//   RESEND_API_KEY  chave criada em resend.com/api-keys
//   CONTACT_TO      e-mail que recebe os recados (o mesmo da conta do Resend, enquanto não houver domínio verificado)
// Sem essas variáveis a função responde 503 e o chat oferece WhatsApp e e-mail no lugar.

const ALLOWED_ORIGIN = /^(https:\/\/(www\.)?kelvinkrauss\.me|https:\/\/kelvinkrauss[a-z0-9-]*\.vercel\.app|http:\/\/localhost(:\d+)?)$/;

// No máximo 3 recados por hora por visitante (na memória da função: proteção básica, não exata).
const WINDOW_MS = 60 * 60 * 1000, MAX_PER_WINDOW = 3;
const sent = new Map();
function tooMany(ip) {
  const now = Date.now();
  const list = (sent.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) { sent.set(ip, list); return true; }
  list.push(now);
  sent.set(ip, list);
  if (sent.size > 5000) sent.clear();
  return false;
}

const field = (v, max) => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').trim().slice(0, max) : '');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  if (!ALLOWED_ORIGIN.test(req.headers.origin || '')) return res.status(403).json({ error: 'Origem não permitida.' });

  const body = req.body || {};
  const name = field(body.name, 80).replace(/\s+/g, ' ');
  const contact = field(body.contact, 120).replace(/\s+/g, ' ');
  const message = field(body.message, 2000);
  const lang = body.lang === 'en' ? 'en' : 'pt';
  if (!name || !contact || message.length < 5) return res.status(400).json({ error: 'Preencha nome, contato e mensagem.' });

  const key = process.env.RESEND_API_KEY, to = process.env.CONTACT_TO;
  if (!key || !to) return res.status(503).json({ error: 'not_configured' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  if (tooMany(ip)) return res.status(429).json({ error: 'Muitos recados seguidos.' });

  // texto puro: nada do que o visitante escreve vira HTML no e-mail
  const replyTo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ? contact : undefined;
  const text = [
    `Nome: ${name}`,
    `Contato: ${contact}`,
    `Idioma do site: ${lang === 'en' ? 'inglês' : 'português'}`,
    '',
    message,
    '',
    '— Enviado pelo chat do kelvinkrauss.me',
  ].join('\n');

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Portfólio <onboarding@resend.dev>',
        to: [to],
        subject: `Recado pelo portfólio: ${name}`,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) {
      console.error('Resend', r.status, await r.text().catch(() => ''));
      return res.status(502).json({ error: 'Não foi possível enviar agora.' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('message', err && err.message);
    return res.status(502).json({ error: 'Não foi possível enviar agora.' });
  }
}
