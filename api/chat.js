export default async function handler(req, res) {
  // Permite apenas requisições POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Puxa as mensagens que o seu front-end (index.html) envia
    const { messages } = req.body;
    
    // Puxa a chave da Vercel
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Chave de API não configurada no servidor.' });
    }

    // O seu currículo e regras da IA fixados diretamente no servidor
    const systemInstruction = `Você é o assistente do portfólio de Kelvin Krauss. Responda em português de forma profissional, direta e concisa.
    Formação: Ciência da Computação no IFC (2025), Entra21 (Back End Java 220h), Bootcamp NTT DATA Java+IA (48h).
    Stack: Java, Python, JavaScript, HTML, CSS, SQL, H2, Spring Boot, Git, Maven, Postman.
    Projetos: Controle financeiro (Java OO), Catálogo com H2, Microsserviços Spring Boot (Eureka/Gateway), Jogo da Forca ASCII.
    Contato: kelvin.krauss.br@gmail.com | (47) 99910-4771.`;

    // Formata as mensagens para o padrão que o Gemini exige
    const formattedHistory = messages ? messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    })) : [];

    // URL correta com o modelo exato que funciona sem dar o erro 404
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

    // Faz a chamada para a inteligência artificial
    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: formattedHistory,
        generationConfig: { maxOutputTokens: 600, temperature: 0.5 }
      })
    });

    const data = await geminiRes.json();

    // Se o Google reclamar de algo, devolvemos o erro para ver na tela
    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    // Pega a resposta do Gemini e devolve para o seu site
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Desculpe, ocorreu um erro ao processar a resposta.';
    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(500).json({ error: 'Falha na comunicação com o servidor da API.' });
  }
}