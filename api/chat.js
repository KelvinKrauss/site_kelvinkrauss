const { GoogleGenerativeAI } = require('@google/generative-ai');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { history, systemPrompt } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'A variável GEMINI_API_KEY não foi encontrada no painel da Vercel.' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Configurado com o Gemini 3.1 Flash Lite para liberar as 500 perguntas diárias da sua cota
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3.1-flash-lite',
      systemInstruction: systemPrompt 
    });

    const incomingHistory = history || [];
    if (incomingHistory.length === 0) {
      return res.status(400).json({ error: 'O histórico enviado está vazio.' });
    }

    const lastUserMessage = incomingHistory[incomingHistory.length - 1].parts[0].text;
    const pastHistory = incomingHistory.slice(0, -1);

    const chat = model.startChat({
      history: pastHistory
    });

    const result = await chat.sendMessage(lastUserMessage);
    const response = await result.response;
    const reply = response.text();

    return res.status(200).json({ reply });

  } catch (error) {
    console.error("ERRO DETALHADO NO BACKEND:", error);
    return res.status(500).json({ error: error.message || 'Erro interno no servidor' });
  }
};