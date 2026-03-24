import { useState, useEffect, useRef } from 'react';
import { Settings, MessageSquare, Send, Save, AlertCircle, Activity, Lock, LogOut } from 'lucide-react';
import './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'simulator' | 'settings' | 'logs'>('simulator');

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('auth_token') === 'true';
  });
  const [loginEmail, setLoginEmail] = useState('guimarques1987etc@gmail.com');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Settings State
  const [evolutionApiUrl, setEvolutionApiUrl] = useState('');
  const [evolutionApiKey, setEvolutionApiKey] = useState('');
  const [evolutionInstance, setEvolutionInstance] = useState('');
  const [testNumber, setTestNumber] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai'>('openai');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Simulator State
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string }[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Logs State
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTab === 'logs') {
      fetchLogs();
      interval = setInterval(fetchLogs, 3000);
    }
    return () => clearInterval(interval);
  }, [activeTab]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setEvolutionApiUrl(data.evolutionApiUrl || '');
      setEvolutionApiKey(data.evolutionApiKey || '');
      setEvolutionInstance(data.evolutionInstance || '');
      setSystemPrompt(data.systemPrompt || '');
      setAiProvider(data.aiProvider || 'openai');
      setOpenaiApiKey(data.openaiApiKey || '');
      setOpenaiModel(data.openaiModel || 'gpt-4o-mini');
      setGeminiApiKey(data.geminiApiKey || '');
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/webhook/logs');
      const data = await res.json();
      setWebhookLogs(data);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  };

  const clearLogs = async () => {
    try {
      await fetch('/api/webhook/logs', { method: 'DELETE' });
      setWebhookLogs([]);
    } catch (err) {
      console.error('Failed to clear logs:', err);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evolutionApiUrl,
          evolutionApiKey,
          evolutionInstance,
          systemPrompt,
          aiProvider,
          openaiApiKey,
          openaiModel,
          geminiApiKey,
        }),
      });
      if (res.ok) {
        setSaveMessage('Configurações salvas com sucesso!');
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setSaveMessage(`Erro ao salvar configurações: ${errData.error || res.statusText}`);
      }
    } catch (err: any) {
      setSaveMessage(`Erro de conexão ao salvar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async () => {
    if (!testNumber) {
      setSaveMessage('Por favor, insira um número para teste.');
      return;
    }
    setIsTesting(true);
    setSaveMessage('');
    try {
      const res = await fetch('/api/test-evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: testNumber }),
      });
      const data = await res.json();
      if (res.ok) {
        setSaveMessage('Mensagem de teste enviada com sucesso! Verifique seu WhatsApp.');
      } else {
        setSaveMessage(`Erro no teste: ${data.error}`);
      }
    } catch (err) {
      setSaveMessage('Erro de conexão ao testar.');
    } finally {
      setIsTesting(false);
    }
  };

  const testWebhook = async () => {
    if (!testNumber) {
      setSaveMessage('Por favor, insira um número para simular o webhook.');
      return;
    }
    setIsTestingWebhook(true);
    setSaveMessage('');
    try {
      const remoteJid = testNumber.includes('@') ? testNumber : `${testNumber}@s.whatsapp.net`;
      const mockPayload = {
        data: {
          key: {
            remoteJid: remoteJid,
            fromMe: false,
            id: `mock_${Date.now()}`
          },
          message: {
            conversation: "Oi, gostaria de saber mais sobre o cardápio digital."
          }
        }
      };

      const res = await fetch('/api/webhook/evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockPayload),
      });
      
      if (res.ok) {
        setSaveMessage('Webhook simulado com sucesso! O bot deve processar e enviar uma resposta para o seu WhatsApp em instantes.');
      } else {
        setSaveMessage(`Erro ao simular webhook: ${res.statusText}`);
      }
    } catch (err) {
      setSaveMessage('Erro de conexão ao simular webhook.');
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMsg = inputMessage.trim();
    setInputMessage('');
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao processar mensagem');
      }

      setMessages((prev) => [...prev, { role: 'bot', text: data.text }]);
    } catch (err: any) {
      console.error('Chat error:', err);
      setError(err.message || 'Erro ao comunicar com o servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      if (res.ok) {
        setIsAuthenticated(true);
        localStorage.setItem('auth_token', 'true');
      } else {
        const data = await res.json();
        setLoginError(data.error || 'Erro ao fazer login');
      }
    } catch (err) {
      setLoginError('Erro de conexão');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('auth_token');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-zinc-200 w-full max-w-md">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-zinc-900 mb-2">Acesso Restrito</h1>
          <p className="text-center text-zinc-500 mb-6">Faça login para acessar o painel</p>

          {loginError && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-100 rounded-lg text-sm text-center">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">E-mail</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full border border-zinc-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Senha</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full border border-zinc-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-70 mt-4"
            >
              {isLoggingIn ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-sm">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-lg leading-tight">Bot de Vendas</h1>
            <p className="text-xs text-zinc-500">Cardápio Digital via WhatsApp</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-zinc-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('simulator')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'simulator' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Simulador
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'settings' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Configurações
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === 'logs' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Activity className="w-4 h-4" />
              Logs (Webhook)
            </button>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-zinc-500 hover:text-red-600 transition-colors text-sm font-medium"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6 flex flex-col">
        
        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
            <div className="bg-zinc-50 px-6 py-4 border-b border-zinc-200 flex justify-between items-center">
              <div>
                <h2 className="font-medium text-zinc-800">Logs do Webhook</h2>
                <p className="text-sm text-zinc-500">Acompanhe em tempo real os dados que a Evolution API envia para o sistema.</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={fetchLogs}
                  className="px-3 py-1.5 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors"
                >
                  Atualizar
                </button>
                <button 
                  onClick={clearLogs}
                  className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                >
                  Limpar Logs
                </button>
              </div>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto bg-zinc-900">
              {webhookLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                  <Activity className="w-12 h-12 mb-4 opacity-20" />
                  <p>Nenhum log recebido ainda.</p>
                  <p className="text-sm mt-2">Envie uma mensagem no WhatsApp para ver os dados aparecerem aqui.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {webhookLogs.map((log, idx) => (
                    <div key={idx} className="bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden">
                      <div className="bg-zinc-800 px-4 py-2 text-xs font-mono text-zinc-400 border-b border-zinc-700 flex justify-between">
                        <span>Recebido em:</span>
                        <span>{new Date(log.timestamp).toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="p-4 overflow-x-auto">
                        <pre className="text-emerald-400 text-xs font-mono">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Simulator Tab */}
        {activeTab === 'simulator' && (
          <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
            <div className="bg-zinc-50 px-6 py-4 border-b border-zinc-200">
              <h2 className="font-medium text-zinc-800">Simulador de Chat</h2>
              <p className="text-sm text-zinc-500">Teste as respostas do seu bot antes de conectar ao WhatsApp.</p>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4 bg-zinc-50/50">
              {messages.length === 0 ? (
                <div className="m-auto text-center text-zinc-400 max-w-sm">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>Envie uma mensagem para começar a testar o seu bot de vendas de cardápio digital.</p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div 
                    key={idx} 
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-[80%] rounded-2xl px-5 py-3 ${
                        msg.role === 'user' 
                          ? 'bg-indigo-600 text-white rounded-tr-sm' 
                          : 'bg-white border border-zinc-200 text-zinc-800 rounded-tl-sm shadow-sm'
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-zinc-200 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm flex items-center gap-2">
                    <div className="w-2 h-2 bg-zinc-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-zinc-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-zinc-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              )}
              {error && (
                <div className="flex justify-center my-2">
                  <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg flex items-center gap-2 border border-red-100">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            
            <div className="p-4 bg-white border-t border-zinc-200">
              <form 
                onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                className="flex items-center gap-3"
              >
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Digite uma mensagem para o bot..."
                  className="flex-1 bg-zinc-100 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-xl px-4 py-3 outline-none transition-all"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-colors flex items-center justify-center"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col">
            <div className="bg-zinc-50 px-6 py-4 border-b border-zinc-200 flex justify-between items-center">
              <div>
                <h2 className="font-medium text-zinc-800">Configurações do Bot</h2>
                <p className="text-sm text-zinc-500">Configure a conexão com o WhatsApp e o comportamento da IA.</p>
              </div>
              <button
                onClick={saveSettings}
                disabled={isSaving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-70"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {saveMessage && (
                <div className={`mb-6 p-4 rounded-lg text-sm font-medium ${
                  saveMessage.includes('Erro') ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                }`}>
                  {saveMessage}
                </div>
              )}

              <div className="space-y-8 max-w-3xl">
                {/* Evolution API Section */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                      <Settings className="w-4 h-4" />
                    </div>
                    <h3 className="text-lg font-medium text-zinc-900">Conexão Evolution API</h3>
                  </div>
                  
                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 space-y-4">
                    <div className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
                      <strong>Webhook URL:</strong> Configure esta URL na sua Evolution API (evento: <code>messages.upsert</code>):<br/>
                      <code className="bg-white px-2 py-1 rounded mt-2 block border border-blue-200 select-all">
                        {window.location.origin}/api/webhook/evolution
                      </code>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">URL da API (Base URL)</label>
                      <input
                        type="text"
                        value={evolutionApiUrl}
                        onChange={(e) => setEvolutionApiUrl(e.target.value)}
                        placeholder="Ex: https://api.suaevolution.com"
                        className="w-full border border-zinc-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Global API Key</label>
                        <input
                          type="password"
                          value={evolutionApiKey}
                          onChange={(e) => setEvolutionApiKey(e.target.value)}
                          placeholder="Sua Global API Key"
                          className="w-full border border-zinc-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Nome da Instância</label>
                        <input
                          type="text"
                          value={evolutionInstance}
                          onChange={(e) => setEvolutionInstance(e.target.value)}
                          placeholder="Ex: VendasCardapio"
                          className="w-full border border-zinc-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-zinc-200">
                      <label className="block text-sm font-medium text-zinc-700 mb-2">Testar Conexão e Webhook</label>
                      <div className="flex flex-col gap-3">
                        <input
                          type="text"
                          value={testNumber}
                          onChange={(e) => setTestNumber(e.target.value)}
                          placeholder="Número com DDD (ex: 5511999999999)"
                          className="w-full border border-zinc-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={testConnection}
                            disabled={isTesting || !evolutionApiUrl}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            {isTesting ? 'Testando...' : '1. Testar Envio'}
                          </button>
                          <button
                            onClick={testWebhook}
                            disabled={isTestingWebhook || !testNumber}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            {isTestingWebhook ? 'Simulando...' : '2. Simular Webhook'}
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-2 italic">
                        * O "Testar Envio" verifica se o app consegue mandar mensagem. O "Simular Webhook" finge que o cliente mandou "Oi" para ver se o bot responde.
                      </p>
                    </div>
                  </div>
                </section>

                {/* AI Provider Section */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
                      <Settings className="w-4 h-4" />
                    </div>
                    <h3 className="text-lg font-medium text-zinc-900">Provedor de Inteligência Artificial</h3>
                  </div>
                  
                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-2">Escolha o Provedor</label>
                      <div className="flex gap-4">
                        <button
                          onClick={() => setAiProvider('openai')}
                          className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                            aiProvider === 'openai'
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                              : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300'
                          }`}
                        >
                          <span className="font-bold">OpenAI</span>
                          <span className="text-xs opacity-70">GPT-4o, GPT-4o-mini</span>
                        </button>
                        <button
                          onClick={() => setAiProvider('gemini')}
                          className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                            aiProvider === 'gemini'
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                              : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300'
                          }`}
                        >
                          <span className="font-bold">Google Gemini</span>
                          <span className="text-xs opacity-70">Gemini 3 Flash (Grátis)</span>
                        </button>
                      </div>
                    </div>

                    {aiProvider === 'openai' ? (
                      <div className="space-y-4 pt-4 border-t border-zinc-200">
                        <div>
                          <label className="block text-sm font-medium text-zinc-700 mb-1">OpenAI API Key</label>
                          <input
                            type="password"
                            value={openaiApiKey}
                            onChange={(e) => setOpenaiApiKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full border border-zinc-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                          />
                          <p className="text-[11px] text-zinc-500 mt-1">
                            Sua chave fica salva apenas no servidor desta aplicação.
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-zinc-700 mb-1">Modelo</label>
                          <select
                            value={openaiModel}
                            onChange={(e) => setOpenaiModel(e.target.value)}
                            className="w-full border border-zinc-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
                          >
                            <option value="gpt-5">gpt-5 (Mais Avançado e Recente)</option>
                            <option value="gpt-5-turbo">gpt-5-turbo (Rápido e Eficiente)</option>
                            <option value="gpt-5-mini">gpt-5-mini (Custo-benefício)</option>
                            <option value="gpt-5-nano">gpt-5-nano (Ultra rápido e leve)</option>
                            <option value="gpt-4o">gpt-4o (Alta Inteligência)</option>
                            <option value="gpt-4o-mini">gpt-4o-mini (Recomendado - Barato e Rápido)</option>
                            <option value="gpt-3.5-turbo">gpt-3.5-turbo (Legado)</option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 pt-4 border-t border-zinc-200">
                        <div>
                          <label className="block text-sm font-medium text-zinc-700 mb-1">Gemini API Key</label>
                          <input
                            type="password"
                            value={geminiApiKey}
                            onChange={(e) => setGeminiApiKey(e.target.value)}
                            placeholder="AIzaSy..."
                            className="w-full border border-zinc-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                          />
                          <p className="text-[11px] text-zinc-500 mt-1">
                            Sua chave fica salva apenas no servidor desta aplicação.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                {/* Prompt Section */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <h3 className="text-lg font-medium text-zinc-900">Comportamento da IA (Prompt)</h3>
                  </div>
                  
                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5">
                    <label className="block text-sm font-medium text-zinc-700 mb-2">
                      Instruções do Sistema (System Prompt)
                    </label>
                    <p className="text-xs text-zinc-500 mb-3">
                      Defina como o bot deve se comportar, o que ele está vendendo, os preços e as regras de negócio.
                    </p>
                    <textarea
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      rows={10}
                      className="w-full border border-zinc-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-y font-mono text-sm"
                      placeholder="Você é um assistente de vendas..."
                    />
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
