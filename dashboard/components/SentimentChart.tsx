'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Smile } from 'lucide-react';

export default function SentimentChart() {
  // Dados de exemplo - substituir por dados reais da API
  const data = [
    { name: 'Muito Positivo', value: 850, color: '#10b981' },
    { name: 'Positivo', value: 1240, color: '#22c55e' },
    { name: 'Neutro', value: 2130, color: '#6b7280' },
    { name: 'Negativo', value: 420, color: '#f59e0b' },
    { name: 'Muito Negativo', value: 183, color: '#ef4444' },
  ];

  const COLORS = data.map(item => item.color);

  const renderCustomLabel = (entry: any) => {
    const percent = ((entry.value / data.reduce((a, b) => a + b.value, 0)) * 100).toFixed(1);
    return `${percent}%`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Smile className="w-5 h-5 text-primary-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Análise de Sentimento
          </h3>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Total: {data.reduce((a, b) => a + b.value, 0).toLocaleString('pt-BR')}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: 'none',
              borderRadius: '8px',
              color: '#fff'
            }}
            formatter={(value: any) => value.toLocaleString('pt-BR')}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            formatter={(value) => <span className="text-sm text-gray-700 dark:text-gray-300">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
