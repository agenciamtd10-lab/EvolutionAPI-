'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Users, TrendingUp, Activity, Send } from 'lucide-react';
import Dashboard from '@/components/Dashboard';
import ChatInterface from '@/components/ChatInterface';
import StatsCards from '@/components/StatsCards';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chat'>('dashboard');

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-2 rounded-lg">
                <MessageSquare className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Evolution Dashboard
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Análise Inteligente de Mensagens WhatsApp
                </p>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex space-x-2 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-4 py-2 rounded-md flex items-center space-x-2 transition-all ${
                  activeTab === 'dashboard'
                    ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span className="font-medium">Dashboard</span>
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`px-4 py-2 rounded-md flex items-center space-x-2 transition-all ${
                  activeTab === 'chat'
                    ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Send className="w-4 h-4" />
                <span className="font-medium">Chat IA</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' ? <Dashboard /> : <ChatInterface />}
      </div>

      {/* Footer */}
      <footer className="mt-12 py-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Evolution Dashboard v1.0 - Powered by IA & Next.js</p>
        </div>
      </footer>
    </main>
  );
}
