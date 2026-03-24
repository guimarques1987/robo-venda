import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import path from 'path';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:5e42a6cc1a7b4854eaa3@easypanel.cardapioclick.com.br:2208/cadastro?sslmode=disable'
});

pool.query(`
  CREATE TABLE IF NOT EXISTS app_settings (
    id SERIAL PRIMARY KEY,
    evolution_api_url TEXT,
    evolution_api_key TEXT,
    evolution_instance TEXT,
    system_prompt TEXT,
    ai_provider VARCHAR(50) DEFAULT 'openai',
    openai_api_key TEXT,
    openai_model VARCHAR(50) DEFAULT 'gpt-4o-mini',
    gemini_api_key TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`).then(async () => {
  // Ensure the columns exist if the table was created previously
  try {
    await pool.query(`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS ai_provider VARCHAR(50) DEFAULT 'openai';`);
    await pool.query(`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS openai_api_key TEXT;`);
    await pool.query(`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS openai_model VARCHAR(50) DEFAULT 'gpt-4o-mini';`);
    await pool.query(`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;`);
  } catch (e) {
    console.error('Migration error:', e);
  }
}).catch(err => console.error('Error creating/updating table:', err));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// In-memory store for settings
let settings = {
  evolutionApiUrl: '',
  evolutionApiKey: '',
  evolutionInstance: '',
  systemPrompt: 'Você é um assistente virtual de vendas especializado em um sistema de cardápio digital para restaurantes e lanchonetes. Seu objetivo é apresentar os benefícios (sem taxas por pedido, fácil atualização, pedidos diretos no WhatsApp), tirar dúvidas e convencer o cliente a assinar o sistema. Seja educado, persuasivo e conciso.',
  aiProvider: 'openai', // 'gemini' or 'openai'
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  geminiApiKey: '',
};

// Load settings from DB on startup
pool.query('SELECT * FROM app_settings WHERE id = 1').then(result => {
  if (result.rows.length > 0) {
    const row = result.rows[0];
    settings = {
      evolutionApiUrl: row.evolution_api_url || '',
      evolutionApiKey: row.evolution_api_key || '',
      evolutionInstance: row.evolution_instance || '',
      systemPrompt: row.system_prompt || settings.systemPrompt,
      aiProvider: row.ai_provider || 'openai',
      openaiApiKey: row.openai_api_key || '',
      openaiModel: row.openai_model || 'gpt-4o-mini',
      geminiApiKey: row.gemini_api_key || '',
    };
  }
}).catch(err => console.error('Error loading settings:', err));

// In-memory store for chat sessions
const chatHistories: Record<string, any> = {};

// Store webhook logs for debugging
let webhookLogs: any[] = [];

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (email === 'guimarques1987etc@gmail.com' && password === '131199@Gui') {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'E-mail ou senha incorretos' });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM app_settings WHERE id = 1');
    if (result.rows.length > 0) {
      const row = result.rows[0];
      settings = {
        evolutionApiUrl: row.evolution_api_url || '',
        evolutionApiKey: row.evolution_api_key || '',
        evolutionInstance: row.evolution_instance || '',
        systemPrompt: row.system_prompt || settings.systemPrompt,
        aiProvider: row.ai_provider || 'openai',
        openaiApiKey: row.openai_api_key || '',
        openaiModel: row.openai_model || 'gpt-4o-mini',
        geminiApiKey: row.gemini_api_key || '',
      };
    }
    res.json(settings);
  } catch (error) {
    console.error('DB Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/settings', async (req, res) => {
  const newSettings = { ...settings, ...req.body };
  try {
    await pool.query(`
      INSERT INTO app_settings (id, evolution_api_url, evolution_api_key, evolution_instance, system_prompt, ai_provider, openai_api_key, openai_model, gemini_api_key)
      VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        evolution_api_url = EXCLUDED.evolution_api_url,
        evolution_api_key = EXCLUDED.evolution_api_key,
        evolution_instance = EXCLUDED.evolution_instance,
        system_prompt = EXCLUDED.system_prompt,
        ai_provider = EXCLUDED.ai_provider,
        openai_api_key = EXCLUDED.openai_api_key,
        openai_model = EXCLUDED.openai_model,
        gemini_api_key = EXCLUDED.gemini_api_key,
        updated_at = CURRENT_TIMESTAMP
    `, [
      newSettings.evolutionApiUrl,
      newSettings.evolutionApiKey,
      newSettings.evolutionInstance,
      newSettings.systemPrompt,
      newSettings.aiProvider,
      newSettings.openaiApiKey,
      newSettings.openaiModel,
      newSettings.geminiApiKey
    ]);
    settings = newSettings;
    // Reset chat histories when settings change to apply new prompt
    for (const key in chatHistories) {
      delete chatHistories[key];
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('DB Error:', error);
    res.status(500).json({ error: `Database error: ${error.message}` });
  }
});

app.post('/api/test-evolution', async (req, res) => {
  const { number } = req.body;
  if (!number) return res.status(400).json({ error: 'Número é obrigatório' });

  try {
    const remoteJid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
    
    if (!settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstance) {
      throw new Error('Configurações da Evolution API incompletas.');
    }

    const baseUrl = settings.evolutionApiUrl.replace(/\/$/, '');
    const url = `${baseUrl}/message/sendText/${settings.evolutionInstance}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': settings.evolutionApiKey
      },
      body: JSON.stringify({
        number: remoteJid.replace('@s.whatsapp.net', ''),
        text: '🤖 *Teste de Conexão*\n\nParabéns! Seu bot está configurado corretamente e conseguiu enviar esta mensagem.'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      // If the error is a huge HTML/JS file, truncate it so it doesn't break the UI
      const truncatedError = errorText.length > 200 ? errorText.substring(0, 200) + '...' : errorText;
      throw new Error(`Erro ${response.status}: ${truncatedError}`);
    }

    const data = await response.json();
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Test Evolution error:', error);
    res.status(500).json({ error: error.message || 'Falha ao enviar teste' });
  }
});

async function processMessageWithOpenAI(sessionId: string, userMessage: string, mediaData: any = null) {
  const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API Key não configurada. Por favor, insira sua chave nas configurações.');
  }

  const openai = new OpenAI({ apiKey });

  if (!chatHistories[sessionId] || !Array.isArray(chatHistories[sessionId])) {
    chatHistories[sessionId] = [
      { role: 'system', content: settings.systemPrompt }
    ];
  }

  const history = chatHistories[sessionId];
  
  let content: any = userMessage || "Mensagem vazia.";
  
  if (mediaData) {
    if (mediaData.mimeType.startsWith('image/')) {
      content = [
        { type: "text", text: userMessage || "Analise esta imagem." },
        { type: "image_url", image_url: { url: `data:${mediaData.mimeType};base64,${mediaData.data}` } }
      ];
    } else {
      // OpenAI gpt-4o-mini doesn't natively support audio/pdf in chat completions
      content = userMessage + `\n[O usuário enviou um arquivo do tipo ${mediaData.mimeType}, mas o modelo atual da OpenAI não suporta este formato diretamente. Por favor, avise o usuário.]`;
    }
  }

  history.push({ role: 'user', content });

  try {
    const response = await openai.chat.completions.create({
      model: settings.openaiModel,
      messages: history,
    });

    const reply = response.choices[0].message.content || '';
    history.push({ role: 'assistant', content: reply });
    
    // Keep history manageable
    if (history.length > 20) {
      chatHistories[sessionId] = [
        history[0],
        ...history.slice(-19)
      ];
    }

    return reply;
  } catch (error: any) {
    console.error('OpenAI error:', error);
    delete chatHistories[sessionId];
    throw error;
  }
}

async function processMessageWithGemini(sessionId: string, userMessage: string, mediaData: any = null) {
  const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error('Chave da API do Gemini não configurada. Por favor, insira sua chave nas configurações.');
  }

  const ai = new GoogleGenAI({ apiKey });
  
  if (!chatHistories[sessionId] || !Array.isArray(chatHistories[sessionId])) {
    chatHistories[sessionId] = [];
  }

  const history = chatHistories[sessionId];
  
  let parts: any[] = [];
  
  if (mediaData) {
    parts.push({
      inlineData: {
        mimeType: mediaData.mimeType,
        data: mediaData.data
      }
    });
  }
  
  if (userMessage) {
    parts.push({ text: userMessage });
  } else if (!mediaData) {
    parts.push({ text: "Mensagem vazia." });
  }

  history.push({ role: 'user', parts });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: history,
      config: {
        systemInstruction: settings.systemPrompt,
      }
    });

    const reply = response.text || '';
    history.push({ role: 'model', parts: [{ text: reply }] });
    
    // Keep history manageable (last 20 messages)
    if (history.length > 20) {
      chatHistories[sessionId] = history.slice(-20);
    }

    return reply;
  } catch (error: any) {
    console.error('Gemini error:', error);
    delete chatHistories[sessionId];
    throw error;
  }
}

async function getReply(sessionId: string, message: string, mediaData: any = null) {
  if (settings.aiProvider === 'openai') {
    return await processMessageWithOpenAI(sessionId, message, mediaData);
  } else {
    return await processMessageWithGemini(sessionId, message, mediaData);
  }
}

async function sendEvolutionMessage(remoteJid: string, text: string) {
  if (!settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstance) {
    console.warn('Evolution API not configured. Message not sent.');
    return;
  }

  const baseUrl = settings.evolutionApiUrl.replace(/\/$/, '');
  const url = `${baseUrl}/message/sendText/${settings.evolutionInstance}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': settings.evolutionApiKey
      },
      body: JSON.stringify({
        number: remoteJid.replace('@s.whatsapp.net', ''),
        text: text
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Evolution API error:', errorData);
    }
  } catch (error) {
    console.error('Failed to send message to Evolution API:', error);
  }
}

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  const sessionId = 'simulator'; // Use a fixed session ID for the simulator

  try {
    const replyText = await getReply(sessionId, message);
    res.json({ text: replyText });
  } catch (error: any) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({ error: error.message || 'Failed to process message' });
  }
});

app.get('/api/webhook/logs', (req, res) => {
  res.json(webhookLogs);
});

app.delete('/api/webhook/logs', (req, res) => {
  webhookLogs = [];
  res.json({ success: true });
});

async function getBase64FromMediaMessage(messageData: any) {
  if (!settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstance) {
    return null;
  }
  const baseUrl = settings.evolutionApiUrl.replace(/\/$/, '');
  const url = `${baseUrl}/chat/getBase64FromMediaMessage/${settings.evolutionInstance}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': settings.evolutionApiKey
      },
      body: JSON.stringify({ message: messageData })
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.base64;
    } else {
      console.error('Failed to get base64:', await response.text());
    }
  } catch (err) {
    console.error('Error fetching base64 media:', err);
  }
  return null;
}

app.post('/api/webhook/evolution', async (req, res) => {
  // Respond immediately to prevent Evolution API timeout
  res.status(200).send('OK');

  console.log('Webhook received!');

  try {
    const body = req.body;
    
    // Store log for debugging
    webhookLogs.unshift({
      timestamp: new Date().toISOString(),
      payload: body
    });
    // Keep only the last 20 logs
    if (webhookLogs.length > 20) {
      webhookLogs.pop();
    }

    // Handle both possible payload structures (Evolution API v1 and v2, and arrays)
    const payloads = Array.isArray(body) ? body : [body];
    
    for (const payload of payloads) {
      let messagesToProcess: any[] = [];

      // Extract body if it's wrapped in an n8n-style payload
      const actualPayload = payload.body ? payload.body : payload;

      // Evolution API v2 format
      if (actualPayload.data && actualPayload.data.message) {
        messagesToProcess.push(actualPayload.data);
      } 
      // Evolution API v1 format
      else if (actualPayload.data && Array.isArray(actualPayload.data.messages)) {
        messagesToProcess = actualPayload.data.messages;
      }
      // Direct message format
      else if (actualPayload.message) {
        messagesToProcess.push(actualPayload);
      }
      // Handle simple TEXT payload from n8n test
      else if (actualPayload.TEXT) {
        // Create a mock message structure for simple text tests
        messagesToProcess.push({
          key: {
            remoteJid: 'test@s.whatsapp.net',
            fromMe: false,
            id: 'test-msg-' + Date.now()
          },
          message: {
            conversation: actualPayload.TEXT
          }
        });
      }

      for (let messageData of messagesToProcess) {
        // In some Evolution API versions, the message is nested inside another message object
        if (messageData.message && messageData.message.message && messageData.message.key) {
           messageData = messageData.message;
        }

        const key = messageData.key;
        const messageContent = messageData.message;

        if (!key || !messageContent) {
          continue;
        }
        
        if (key.fromMe) {
          continue;
        }

        const remoteJid = key.remoteJid;
        if (!remoteJid || remoteJid.includes('@g.us') || remoteJid === 'status@broadcast') {
          continue; // Ignore groups and status updates
        }

        // Extract text and media info
        let text = '';
        let mimeType = '';
        let mediaData = null;

        if (messageContent.conversation) {
          text = messageContent.conversation;
        } else if (messageContent.extendedTextMessage?.text) {
          text = messageContent.extendedTextMessage.text;
        } else if (messageContent.imageMessage) {
          text = messageContent.imageMessage.caption || '';
          mimeType = messageContent.imageMessage.mimetype;
        } else if (messageContent.videoMessage) {
          text = messageContent.videoMessage.caption || '';
          mimeType = messageContent.videoMessage.mimetype;
        } else if (messageContent.audioMessage) {
          mimeType = messageContent.audioMessage.mimetype;
        } else if (messageContent.documentMessage) {
          text = messageContent.documentMessage.caption || messageContent.documentMessage.fileName || '';
          mimeType = messageContent.documentMessage.mimetype;
        }

        if (!text && !mimeType) {
          continue;
        }

        if (mimeType) {
          console.log(`Fetching media for ${remoteJid} (${mimeType})...`);
          
          let base64 = null;
          if (messageContent.imageMessage?.base64) base64 = messageContent.imageMessage.base64;
          else if (messageContent.videoMessage?.base64) base64 = messageContent.videoMessage.base64;
          else if (messageContent.audioMessage?.base64) base64 = messageContent.audioMessage.base64;
          else if (messageContent.documentMessage?.base64) base64 = messageContent.documentMessage.base64;

          if (!base64) {
            base64 = await getBase64FromMediaMessage(messageData);
          }
          
          if (base64) {
            mediaData = {
              mimeType: mimeType.split(';')[0],
              data: base64
            };
          } else {
            console.log('Failed to fetch media base64');
          }
        }

        console.log(`Processing message from ${remoteJid}: ${text || '[Media]'}`);

        // Process with AI
        const replyText = await getReply(remoteJid, text, mediaData);

        // Send back to Evolution API
        if (replyText) {
          console.log(`Sending reply to ${remoteJid}: ${replyText.substring(0, 50)}...`);
          await sendEvolutionMessage(remoteJid, replyText);
        }
      }
    }

  } catch (error) {
    console.error('Webhook error:', error);
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const isPipe = typeof PORT === 'string' && isNaN(Number(PORT));
  const host = isPipe ? undefined : "0.0.0.0";
  app.listen(PORT, host as any, () => {
    console.log(`Server running on port/pipe ${PORT}`);
  });
}

startServer();
