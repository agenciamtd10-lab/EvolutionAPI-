'use client';

import { MessageSquare, Users, TrendingUp, Activity } from 'lucide-react';

interface StatsCardsProps {
  stats: {
    totalMessages: number;
    totalContacts: number;
    avgResponseTime: string;
    activeConversations: number;
  };
}

export default function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: 'Total de Mensagens',
      value: stats.totalMessages.toLocaleString('pt-BR'),
      icon: MessageSquare,
      color: 'from-blue-500 to-blue-600',
      change: '+12.5%',
    },
    {
      title: 'Contatos Ativos',
      value: stats.totalContacts.toLocaleString('pt-BR'),
      icon: Users,
      color: 'from-green-500 to-green-600',
      change: '+8.2%',
    },
    {
      title: 'Tempo Médio de Resposta',
      value: stats.avgResponseTime,
      icon: Activity,
      color: 'from-purple-500 to-purple-600',
      change: '-5.3%',
    },
    {
      title: 'Conversas Ativas',
      value: stats.activeConversations.toLocaleString('pt-BR'),
      icon: TrendingUp,
      color: 'from-orange-500 to-orange-600',
      change: '+15.8%',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card, index) => (
        <div
          key={index}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-lg bg-gradient-to-r ${card.color}`}>
              <card.icon className="w-6 h-6 text-white" />
            </div>
            <span className={`text-sm font-medium ${
              card.change.startsWith('+') ? 'text-green-600' : 'text-red-600'
            }`}>
              {card.change}
            </span>
          </div>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            {card.title}
          </h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
