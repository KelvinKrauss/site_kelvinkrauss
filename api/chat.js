export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Agora o back-end puxa exatamente os nomes que o front-end envia
    const { history, systemPrompt } = req.body;
    
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Chave de API não configurada no servidor.' });
    }

    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: history, // O index.html já envia no formato exato que o Gemini pede
        generationConfig: { maxOutputTokens: 600, temperature: 0.5 }
      })
    });

    const data = await geminiRes.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Desculpe, ocorreu um erro ao processar a resposta.';
    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(500).json({ error: 'Falha na comunicação com o servidor da API.' });
  }
}