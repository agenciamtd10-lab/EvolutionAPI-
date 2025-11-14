'use client';

import { Clock, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function MessageTimeline() {
  // Dados de exemplo - substituir por dados reais da API
  const recentMessages = [
    {
      id: 1,
      contact: 'João Silva',
      message: 'Olá, gostaria de saber mais sobre o produto...',
      time: new Date(Date.now() - 5 * 60 * 1000),
      sentiment: 'positive',
      type: 'received'
    },
    {
      id: 2,
      contact: 'Maria Santos',
      message: 'Obrigada pelo atendimento!',
      time: new Date(Date.now() - 15 * 60 * 1000),
      sentiment: 'very_positive',
      type: 'received'
    },
    {
      id: 3,
      contact: 'Pedro Oliveira',
      message: 'Ainda não recebi meu pedido',
      time: new Date(Date.now() - 30 * 60 * 1000),
      sentiment: 'negative',
      type: 'received'
    },
    {
      id: 4,
      contact: 'Ana Costa',
      message: 'Qual o prazo de entrega?',
      time: new Date(Date.now() - 45 * 60 * 1000),
      sentiment: 'neutral',
      type: 'received'
    },
    {
      id: 5,
      contact: 'Carlos Souza',
      message: 'Produto excelente, recomendo!',
      time: new Date(Date.now() - 60 * 60 * 1000),
      sentiment: 'very_positive',
      type: 'received'
    },
  ];

  const getSentimentColor = (sentiment: string) => {
    const colors: { [key: string]: string } = {
      very_positive: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      positive: 'bg-green-50 text-green-700 dark:bg-green-800 dark:text-green-300',
      neutral: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
      negative: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      very_negative: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return colors[sentiment] || colors.neutral;
  };

  const getSentimentLabel = (sentiment: string) => {
    const labels: { [key: string]: string } = {
      very_positive: 'Muito Positivo',
      positive: 'Positivo',
      neutral: 'Neutro',
      negative: 'Negativo',
      very_negative: 'Muito Negativo',
    };
    return labels[sentiment] || 'Neutro';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Clock className="w-5 h-5 text-primary-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Mensagens Recentes
          </h3>
        </div>
        <button className="text-sm text-primary-500 hover:text-primary-600 font-medium">
          Ver todas
        </button>
      </div>

      <div className="space-y-4">
        {recentMessages.map((msg) => (
          <div
            key={msg.id}
            className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex-shrink-0 mt-1">
              <MessageCircle className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {msg.contact}
                </p>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDistanceToNow(msg.time, { addSuffix: true, locale: ptBR })}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-2">
                {msg.message}
              </p>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getSentimentColor(msg.sentiment)}`}>
                {getSentimentLabel(msg.sentiment)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
