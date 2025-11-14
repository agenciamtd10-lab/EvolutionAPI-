'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

export default function MessageChart() {
  // Dados de exemplo - substituir por dados reais da API
  const data = [
    { name: 'Seg', enviadas: 420, recebidas: 380 },
    { name: 'Ter', enviadas: 380, recebidas: 420 },
    { name: 'Qua', enviadas: 520, recebidas: 480 },
    { name: 'Qui', enviadas: 460, recebidas: 510 },
    { name: 'Sex', enviadas: 590, recebidas: 550 },
    { name: 'Sáb', enviadas: 320, recebidas: 280 },
    { name: 'Dom', enviadas: 280, recebidas: 240 },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-primary-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Mensagens por Dia
          </h3>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">Últimos 7 dias</span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
          <XAxis
            dataKey="name"
            stroke="#6B7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="#6B7280"
            style={{ fontSize: '12px' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: 'none',
              borderRadius: '8px',
              color: '#fff'
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="enviadas"
            stroke="#22c55e"
            strokeWidth={2}
            dot={{ fill: '#22c55e', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="recebidas"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
