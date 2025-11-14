'use client';

import { useState, useEffect } from 'react';
import { Filter, Download, RefreshCw } from 'lucide-react';
import StatsCards from './StatsCards';
import MessageChart from './MessageChart';
import SentimentChart from './SentimentChart';
import TopContactsTable from './TopContactsTable';
import MessageTimeline from './MessageTimeline';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalMessages: 0,
    totalContacts: 0,
    avgResponseTime: '0min',
    activeConversations: 0,
  });

  const [filters, setFilters] = useState({
    instanceId: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    fetchDashboardData();
  }, [filters]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Construir query string com filtros
      const params = new URLSearchParams();
      if (filters.instanceId) params.append('instanceId', filters.instanceId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await fetch(`/api/stats?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Erro ao buscar dados');
      }

      const data = await response.json();

      setStats({
        totalMessages: data.totalMessages || 0,
        totalContacts: data.totalContacts || 0,
        avgResponseTime: data.avgResponseTime || '0min',
        activeConversations: data.activeConversations || 0,
      });

      setLoading(false);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      // Manter dados vazios em caso de erro
      setStats({
        totalMessages: 0,
        totalContacts: 0,
        avgResponseTime: '0min',
        activeConversations: 0,
      });
      setLoading(false);
    }
  };

  const handleExport = () => {
    // Implementar exportação
    console.log('Exportando dados...');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Filtros
            </h2>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={fetchDashboardData}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Atualizar</span>
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Exportar</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Instância
            </label>
            <input
              type="text"
              placeholder="Todas as instâncias"
              value={filters.instanceId}
              onChange={(e) => setFilters({ ...filters, instanceId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Data Inicial
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Data Final
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <StatsCards stats={stats} />

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MessageChart />
        <SentimentChart />
      </div>

      {/* Timeline e Top Contatos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MessageTimeline />
        <TopContactsTable />
      </div>
    </div>
  );
}
