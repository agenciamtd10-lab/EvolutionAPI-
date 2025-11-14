'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, TrendingUp, MessageSquare } from 'lucide-react';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  data?: any;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: 'assistant',
      content: 'Olá! Sou seu assistente de análise de dados do WhatsApp. Posso te ajudar a:\n\n• Analisar sentimentos das mensagens\n• Identificar padrões de conversação\n• Detectar spam e mensagens suspeitas\n• Gerar relatórios personalizados\n• Responder perguntas sobre suas métricas\n\nO que você gostaria de saber?',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const suggestedQuestions = [
    { icon: TrendingUp, text: 'Quais são os horários de pico de mensagens?' },
    { icon: MessageSquare, text: 'Mostre-me o sentimento geral das conversas' },
    { icon: Sparkles, text: 'Detecte padrões nas mensagens recebidas' },
  ];

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: messages.length + 1,
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Chamar API real do chat
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          instanceId: null, // Pode ser configurado para filtrar por instância
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao processar mensagem');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: messages.length + 2,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      setLoading(false);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);

      const errorMessage: Message = {
        id: messages.length + 2,
        role: 'assistant',
        content: '❌ Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
      setLoading(false);
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Chat Principal */}
      <div className="lg:col-span-2">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col h-[700px]">
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Assistente IA
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Análise inteligente de dados
                </p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start space-x-3 ${
                  message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  message.role === 'user'
                    ? 'bg-primary-500'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500'
                }`}>
                  {message.role === 'user' ? (
                    <User className="w-5 h-5 text-white" />
                  ) : (
                    <Bot className="w-5 h-5 text-white" />
                  )}
                </div>
                <div className={`flex-1 ${message.role === 'user' ? 'flex justify-end' : ''}`}>
                  <div className={`max-w-[80%] rounded-lg p-4 ${
                    message.role === 'user'
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <span className={`text-xs mt-2 block ${
                      message.role === 'user'
                        ? 'text-primary-100'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {message.timestamp.toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="max-w-[80%] rounded-lg p-4 bg-gray-100 dark:bg-gray-700">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite sua pergunta..."
                disabled={loading}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-50"
              />
              <button
                onClick={handleSendMessage}
                disabled={!input.trim() || loading}
                className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sugestões */}
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Perguntas Sugeridas
          </h3>
          <div className="space-y-3">
            {suggestedQuestions.map((q, index) => (
              <button
                key={index}
                onClick={() => handleSuggestedQuestion(q.text)}
                className="w-full text-left p-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-start space-x-3"
              >
                <q.icon className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {q.text}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-primary-500 to-emerald-500 rounded-xl shadow-sm p-6 text-white">
          <Sparkles className="w-8 h-8 mb-3" />
          <h3 className="text-lg font-semibold mb-2">
            Dica Pro
          </h3>
          <p className="text-sm text-primary-50">
            Faça perguntas específicas para obter análises mais precisas. Você pode perguntar sobre períodos, contatos, sentimentos e muito mais!
          </p>
        </div>
      </div>
    </div>
  );
}
