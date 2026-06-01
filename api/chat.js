const { GoogleGenerativeAI } = require('@google/generative-ai');

module.exports = async (req, res) => {
  // Bloqueia qualquer requisição que não seja POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { history, systemPrompt } = req.body;

    // Valida se a chave existe no painel da Vercel
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'A variável GEMINI_API_KEY não foi encontrada no painel da Vercel.' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Configura o modelo estável com a cota de 500 requisições diárias disponível na sua conta
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3.1-flash-lite',
      systemInstruction: systemPrompt 
    });

    if (!history || history.length === 0) {
      return res.status(400).json({ error: 'O histórico enviado está vazio.' });
    }

    // Método direto e universal para chat: envia todo o histórico de forma limpa e sem fatiamento
    const result = await model.generateContent({
      contents: history
    });
    
    const response = await result.response;
    const reply = response.text();

    // Devolve a resposta com sucesso para o seu index.html
    return res.status(200).json({ reply });

  } catch (error) {
    // Registra qualquer problema no console sem derrubar a execução da função
    console.error("ERRO DETALHADO NO BACKEND:", error);
    return res.status(500).json({ error: error.message || 'Erro interno no servidor' });
  }
};