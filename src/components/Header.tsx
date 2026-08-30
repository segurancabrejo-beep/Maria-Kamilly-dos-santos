import React from 'react';
import { ShieldCheck, Calendar, MapPin, PlusCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { UnitType } from '../types/dto';

interface HeaderProps {
  selectedMonth: number;
  selectedYear: number;
  selectedUnit: string;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  onUnitChange: (unit: string) => void;
  onNewDTO: () => void;
  pendingCount: number;
  onResetData: () => void;
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const UNITS: (string | UnitType)[] = [
  'Todas as Unidades',
  'Filial Brejo',
  'Armazém Central',
  'Filial Matriz',
  'Centro de Distribuição Norte',
  'Unidade Logística Sul'
];

export const Header: React.FC<HeaderProps> = ({
  selectedMonth,
  selectedYear,
  selectedUnit,
  onMonthChange,
  onYearChange,
  onUnitChange,
  onNewDTO,
  pendingCount,
  onResetData
}) => {
  return (
    <header className="bg-slate-900/60 text-white border-b border-white/10 backdrop-blur-2xl shadow-2xl sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center space-x-3.5">
            <div className="bg-amber-500 p-2.5 rounded-xl text-slate-950 font-extrabold shadow-lg shadow-amber-500/20 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-7 h-7 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md backdrop-blur-md">
                  Grupo Pau Brasil
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">| Segurança Operacional SST</span>
              </div>
              <h1 className="text-xl font-extrabold text-slate-100 tracking-tight">
                Gestão DTO <span className="text-slate-400 font-normal text-sm sm:text-base">- Diagnóstico de Trabalho Operacional</span>
              </h1>
            </div>
          </div>

          {/* Controls: Month/Year, Unit, New DTO */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            
            {/* Unit Selector */}
            <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs sm:text-sm backdrop-blur-md hover:border-white/20 transition">
              <MapPin className="w-4 h-4 text-amber-400 mr-1.5 shrink-0" />
              <select
                value={selectedUnit}
                onChange={(e) => onUnitChange(e.target.value)}
                className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer pr-1"
              >
                {UNITS.map(u => (
                  <option key={u} value={u} className="bg-slate-900 text-slate-100">{u}</option>
                ))}
              </select>
            </div>

            {/* Month & Year Selector */}
            <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs sm:text-sm backdrop-blur-md hover:border-white/20 transition">
              <Calendar className="w-4 h-4 text-amber-400 mr-1.5 shrink-0" />
              <select
                value={selectedMonth}
                onChange={(e) => onMonthChange(Number(e.target.value))}
                className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer mr-1.5"
              >
                {MONTHS.map((m, idx) => (
                  <option key={idx} value={idx + 1} className="bg-slate-900 text-slate-100">{m}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => onYearChange(Number(e.target.value))}
                className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
              >
                {[2025, 2026, 2027].map(y => (
                  <option key={y} value={y} className="bg-slate-900 text-slate-100">{y}</option>
                ))}
              </select>
            </div>

            {/* Reset Data Button */}
            <button
              onClick={() => {
                if (confirm('Deseja restaurar os dados originais de demonstração do sistema?')) {
                  onResetData();
                }
              }}
              title="Restaurar dados de demonstração"
              className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition backdrop-blur-md"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* New DTO Action Button */}
            <button
              onClick={onNewDTO}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-sm shadow-lg shadow-amber-500/20 border border-amber-400/40 transition transform active:scale-95"
            >
              <PlusCircle className="w-4 h-4 stroke-[2.5]" />
              <span>Novo DTO</span>
              {pendingCount > 0 && (
                <span className="bg-slate-950 text-amber-300 text-xs px-2 py-0.5 rounded-full font-bold ml-1">
                  {pendingCount}
                </span>
              )}
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};
