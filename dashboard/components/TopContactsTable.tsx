'use client';

import { Users, TrendingUp, TrendingDown } from 'lucide-react';

export default function TopContactsTable() {
  // Dados de exemplo - substituir por dados reais da API
  const topContacts = [
    { name: 'João Silva', phone: '+55 11 99999-1234', messages: 1245, trend: 'up', change: 12 },
    { name: 'Maria Santos', phone: '+55 21 98888-5678', messages: 982, trend: 'up', change: 8 },
    { name: 'Pedro Oliveira', phone: '+55 31 97777-9012', messages: 856, trend: 'down', change: -3 },
    { name: 'Ana Costa', phone: '+55 41 96666-3456', messages: 734, trend: 'up', change: 15 },
    { name: 'Carlos Souza', phone: '+55 51 95555-7890', messages: 628, trend: 'up', change: 5 },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-primary-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Top Contatos
          </h3>
        </div>
        <button className="text-sm text-primary-500 hover:text-primary-600 font-medium">
          Ver todos
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Contato
              </th>
              <th className="text-right py-3 px-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Mensagens
              </th>
              <th className="text-right py-3 px-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Tendência
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {topContacts.map((contact, index) => (
              <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <td className="py-4 px-2">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {contact.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {contact.phone}
                    </p>
                  </div>
                </td>
                <td className="py-4 px-2 text-right">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {contact.messages.toLocaleString('pt-BR')}
                  </span>
                </td>
                <td className="py-4 px-2 text-right">
                  <div className="flex items-center justify-end space-x-1">
                    {contact.trend === 'up' ? (
                      <>
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium text-green-500">
                          +{contact.change}%
                        </span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="w-4 h-4 text-red-500" />
                        <span className="text-sm font-medium text-red-500">
                          {contact.change}%
                        </span>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
