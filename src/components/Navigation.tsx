import React from 'react';
import { LayoutDashboard, ClipboardCheck, FileCheck, FileSpreadsheet, Users, Settings, AlertTriangle, Trash2 } from 'lucide-react';

export type TabType = 'dashboard' | 'pendencies' | 'execute' | 'reports' | 'manage-executions' | 'sheets' | 'employees' | 'settings';

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  pendingCount: number;
  employeesCount: number;
  duplicateCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  pendingCount,
  employeesCount,
  duplicateCount = 0
}) => {
  const tabs = [
    {
      id: 'dashboard' as TabType,
      label: 'Dashboard Indicadores',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'pendencies' as TabType,
      label: 'Pendências Mensais',
      icon: ClipboardCheck,
      badge: pendingCount > 0 ? { count: pendingCount, color: 'bg-amber-500 text-slate-950 font-bold' } : null
    },
    {
      id: 'execute' as TabType,
      label: 'Realizar DTO',
      icon: FileCheck,
      badge: null
    },
    {
      id: 'reports' as TabType,
      label: 'Relatórios & Farol',
      icon: FileSpreadsheet,
      badge: null
    },
    {
      id: 'manage-executions' as TabType,
      label: 'Gerenciar / Apagar DTO',
      icon: Trash2,
      badge: duplicateCount > 0 ? { count: `${duplicateCount} Dupl.`, color: 'bg-rose-500 text-white font-bold animate-pulse' } : null
    },
    {
      id: 'sheets' as TabType,
      label: 'Planilha Google',
      icon: FileSpreadsheet,
      badge: { count: 'Sheets', color: 'bg-emerald-500 text-slate-950 font-black' }
    },
    {
      id: 'employees' as TabType,
      label: 'Cadastro QLP',
      icon: Users,
      badge: { count: employeesCount, color: 'bg-slate-700 text-slate-200' }
    },
    {
      id: 'settings' as TabType,
      label: 'Configurar DTOs',
      icon: Settings,
      badge: null
    }
  ];

  return (
    <div className="bg-slate-900/40 border-b border-white/10 backdrop-blur-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2.5 scrollbar-none" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`px-2 py-0.5 text-[11px] rounded-full font-extrabold leading-none ${tab.badge.color}`}>
                    {tab.badge.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
