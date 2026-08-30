import React, { useState, useMemo } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Clock, 
  Search, 
  Filter, 
  Download, 
  Printer, 
  Play, 
  ChevronRight, 
  Eye, 
  Calendar, 
  Layers, 
  ShieldCheck, 
  Info, 
  X, 
  Sparkles, 
  Building2, 
  UserCheck, 
  ArrowUpDown,
  Table as TableIcon,
  LayoutGrid
} from 'lucide-react';
import { Employee, DTOExecution, DTOCategory } from '../types/dto';
import { isEmployeeAdmittedInMonth, formatBRDate, MONTH_NAMES, MONTH_NAMES_SHORT } from '../utils/dateUtils';
import { getRecommendedDTOForMonth } from '../utils/dtoRecommendation';
import { isEmployeeMonitoredForDTO } from '../utils/employeeFilter';
import { exportFarolMatrixToCSV } from '../utils/export';

interface FarolMatrixTableProps {
  employees: Employee[];
  categories: DTOCategory[];
  executions: DTOExecution[];
  selectedMonth: number;
  selectedYear: number;
  selectedUnit: string;
  onStartDTOForEmployee?: (employeeId: string, categoryId: string) => void;
}

type FarolStatusFilter = 'Todos' | 'EmDia' | 'Pendentes' | 'Atencao' | 'NaoAdmitidos';
type ViewMode = 'matrix12' | 'detailedMonth';

interface CellDetailModalData {
  employee: Employee;
  month: number;
  year: number;
  execution?: DTOExecution;
  isAdmitted: boolean;
  recommendedCategoryTitle?: string;
  recommendedCategoryId?: string;
}

export const FarolMatrixTable: React.FC<FarolMatrixTableProps> = ({
  employees,
  categories,
  executions,
  selectedMonth,
  selectedYear,
  selectedUnit,
  onStartDTOForEmployee
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('matrix12');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('Todas');
  const [categoryFilter, setCategoryFilter] = useState<string>('Todas');
  const [statusFilter, setStatusFilter] = useState<FarolStatusFilter>('Todos');
  const [selectedCellDetail, setSelectedCellDetail] = useState<CellDetailModalData | null>(null);

  // Available roles for filter dropdown (monitored only)
  const availableRoles = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.funcao && isEmployeeMonitoredForDTO(e)) set.add(e.funcao);
    });
    return Array.from(set).sort();
  }, [employees]);

  // Unit filtered employees (active & monitored only)
  const unitEmployees = useMemo(() => {
    return employees.filter(e => {
      const isMonitored = isEmployeeMonitoredForDTO(e);
      const matchUnit = selectedUnit === 'Todas as Unidades' || e.unidade === selectedUnit;
      return e.status === 'Ativo' && isMonitored && matchUnit;
    });
  }, [employees, selectedUnit]);

  // Helper to find matching executions for an employee in a given month/year
  const findEmployeeExecutions = (emp: Employee, month: number, year: number) => {
    const empNameClean = emp.nome.trim().toLowerCase();
    return executions.filter(e => {
      const execNameClean = (e.employeeName || '').trim().toLowerCase();
      const matchId = e.employeeId === emp.id;
      const matchName = execNameClean === empNameClean || 
                        (execNameClean.length > 5 && empNameClean.includes(execNameClean)) || 
                        (empNameClean.length > 5 && execNameClean.includes(empNameClean));
      return (matchId || matchName) && 
             e.referenceMonth === month && 
             e.referenceYear === year && 
             e.status === 'Concluído';
    });
  };

  // Compute status summary for selected month
  const monthSummary = useMemo(() => {
    let emDiaCount = 0;
    let atencaoCount = 0;
    let pendenteCount = 0;
    let naoAdmitidoCount = 0;

    // If a specific DTO category is selected, only consider eligible employees for that DTO
    const relevantEmployees = categoryFilter === 'Todas' 
      ? unitEmployees 
      : unitEmployees.filter(emp => {
          const selectedCat = categories.find(c => c.id === categoryFilter);
          if (!selectedCat || !selectedCat.requiredForRoles || selectedCat.requiredForRoles.length === 0) return true;
          return selectedCat.requiredForRoles.includes(emp.funcao);
        });

    relevantEmployees.forEach(emp => {
      const isAdmitted = isEmployeeAdmittedInMonth(emp.dataAdmissao, selectedMonth, selectedYear);
      if (!isAdmitted) {
        naoAdmitidoCount++;
        return;
      }

      const allMonthExecs = findEmployeeExecutions(emp, selectedMonth, selectedYear);
      const exec = categoryFilter === 'Todas' ? allMonthExecs[0] : allMonthExecs.find(e => e.categoryId === categoryFilter);

      if (!exec) {
        pendenteCount++;
      } else {
        if (exec.naoConformesCount > 0 || exec.coachingCount > 0 || exec.conformityScore < 90) {
          atencaoCount++;
        } else {
          emDiaCount++;
        }
      }
    });

    const activeTotal = emDiaCount + atencaoCount + pendenteCount;
    const completedTotal = emDiaCount + atencaoCount;
    const completionPercent = activeTotal > 0 ? Math.round((completedTotal / activeTotal) * 100) : 100;

    return {
      emDiaCount,
      atencaoCount,
      pendenteCount,
      naoAdmitidoCount,
      activeTotal,
      completedTotal,
      completionPercent
    };
  }, [unitEmployees, executions, selectedMonth, selectedYear, categoryFilter, categories]);

  // Compute complete matrix data per employee
  const employeeRows = useMemo(() => {
    // If a specific DTO category is selected, only include employees whose role is eligible for this DTO
    const relevantEmployees = categoryFilter === 'Todas'
      ? unitEmployees
      : unitEmployees.filter(emp => {
          const selectedCat = categories.find(c => c.id === categoryFilter);
          if (!selectedCat || !selectedCat.requiredForRoles || selectedCat.requiredForRoles.length === 0) return true;
          return selectedCat.requiredForRoles.includes(emp.funcao);
        });

    return relevantEmployees.map(emp => {
      const isAdmittedCurrentMonth = isEmployeeAdmittedInMonth(emp.dataAdmissao, selectedMonth, selectedYear);
      
      // Calculate month by month status for 12 months
      const monthlyStatus = Array.from({ length: 12 }, (_, i) => {
        const monthNum = i + 1;
        const isAdmittedInThisMonth = isEmployeeAdmittedInMonth(emp.dataAdmissao, monthNum, selectedYear);
        const allMonthExecs = findEmployeeExecutions(emp, monthNum, selectedYear);
        const exec = categoryFilter === 'Todas' ? allMonthExecs[0] : allMonthExecs.find(e => e.categoryId === categoryFilter);

        let statusType: 'concluido' | 'atencao' | 'pendente' | 'nao_admitido' | 'futuro' = 'pendente';
        
        if (!isAdmittedInThisMonth) {
          statusType = 'nao_admitido';
        } else if (exec) {
          if (exec.naoConformesCount > 0 || exec.coachingCount > 0 || exec.conformityScore < 90) {
            statusType = 'atencao';
          } else {
            statusType = 'concluido';
          }
        } else if (selectedYear === 2026 && monthNum > 8) {
          statusType = 'futuro';
        } else {
          statusType = 'pendente';
        }

        return {
          monthNum,
          monthName: MONTH_NAMES_SHORT[i],
          isAdmitted: isAdmittedInThisMonth,
          execution: exec,
          allExecutions: allMonthExecs,
          statusType
        };
      });

      const currentMonthExec = monthlyStatus[selectedMonth - 1]?.execution;
      const currentMonthStatusType = monthlyStatus[selectedMonth - 1]?.statusType || 'pendente';

      // Total DTOs executed in year
      const totalYearDTOs = monthlyStatus.filter(m => m.execution).length;
      const executedMonths = monthlyStatus.filter(m => m.execution);
      const avgYearScore = executedMonths.length > 0
        ? Math.round(executedMonths.reduce((acc, m) => acc + (m.execution?.conformityScore || 0), 0) / executedMonths.length)
        : null;

      // Smart recommendation for selected month
      const recommendation = getRecommendedDTOForMonth(emp, categories, executions, selectedMonth, selectedYear);

      return {
        employee: emp,
        isAdmittedCurrentMonth,
        monthlyStatus,
        currentMonthExec,
        currentMonthStatusType,
        totalYearDTOs,
        avgYearScore,
        recommendation
      };
    });
  }, [unitEmployees, selectedMonth, selectedYear, executions, categories, categoryFilter]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return employeeRows.filter(row => {
      const emp = row.employee;
      const matchRole = roleFilter === 'Todas' || emp.funcao === roleFilter;
      const term = searchTerm.toLowerCase().trim();
      const matchSearch = !term ||
        emp.nome.toLowerCase().includes(term) ||
        emp.matricula.toLowerCase().includes(term) ||
        emp.funcao.toLowerCase().includes(term) ||
        emp.setor.toLowerCase().includes(term) ||
        row.monthlyStatus.some(m => 
          m.execution?.categoryTitle.toLowerCase().includes(term) ||
          m.allExecutions?.some(ex => ex.categoryTitle.toLowerCase().includes(term))
        );

      let matchStatus = true;
      if (statusFilter === 'EmDia') {
        matchStatus = row.currentMonthStatusType === 'concluido';
      } else if (statusFilter === 'Atencao') {
        matchStatus = row.currentMonthStatusType === 'atencao';
      } else if (statusFilter === 'Pendentes') {
        matchStatus = row.currentMonthStatusType === 'pendente';
      } else if (statusFilter === 'NaoAdmitidos') {
        matchStatus = row.currentMonthStatusType === 'nao_admitido';
      }

      return matchRole && matchSearch && matchStatus;
    });
  }, [employeeRows, roleFilter, searchTerm, statusFilter]);

  const handleOpenCellDetail = (row: typeof employeeRows[0], monthNum: number) => {
    const cell = row.monthlyStatus[monthNum - 1];
    setSelectedCellDetail({
      employee: row.employee,
      month: monthNum,
      year: selectedYear,
      execution: cell?.execution,
      isAdmitted: cell?.isAdmitted ?? true,
      recommendedCategoryTitle: row.recommendation.categoryTitle,
      recommendedCategoryId: row.recommendation.categoryId
    });
  };

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 text-white">
      
      {/* Header & Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-bold tracking-wide">
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Matriz Visual de Faróis DTO • QLP Operacional</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Farol Mensal por Colaborador • {selectedYear}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300">
            Visualização consolidada de cumprimento dos DTOs obrigatórios mensais por colaborador em tempo real.
          </p>
        </div>

        {/* View Mode Switcher & Export */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="bg-slate-900/70 p-1 rounded-2xl border border-white/10 flex items-center gap-1">
            <button
              onClick={() => setViewMode('matrix12')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                viewMode === 'matrix12'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Matriz Anual (12 Meses)</span>
            </button>
            <button
              onClick={() => setViewMode('detailedMonth')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                viewMode === 'detailedMonth'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Visão Mês ({MONTH_NAMES_SHORT[selectedMonth - 1]})</span>
            </button>
          </div>

          <button
            onClick={() => exportFarolMatrixToCSV(unitEmployees, executions, selectedYear, selectedUnit)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition active:scale-95 cursor-pointer"
            title="Exportar tabela completa dos 12 meses em Excel/CSV"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Matriz Farol</span>
          </button>
        </div>
      </div>

      {/* Farol KPI Distribution Cards & Status Bar */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Em dia */}
          <button
            onClick={() => setStatusFilter(statusFilter === 'EmDia' ? 'Todos' : 'EmDia')}
            className={`p-3.5 rounded-2xl border transition text-left cursor-pointer ${
              statusFilter === 'EmDia'
                ? 'bg-emerald-500/25 border-emerald-400 ring-2 ring-emerald-400/40'
                : 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15'
            }`}
          >
            <div className="flex items-center justify-between text-emerald-400 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                Em Dia / 100%
              </span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-2xl font-extrabold text-white">{monthSummary.emDiaCount}</div>
            <div className="text-[11px] text-emerald-300/80">Conformidade total no mês</div>
          </button>

          {/* Com Atenção / NC */}
          <button
            onClick={() => setStatusFilter(statusFilter === 'Atencao' ? 'Todos' : 'Atencao')}
            className={`p-3.5 rounded-2xl border transition text-left cursor-pointer ${
              statusFilter === 'Atencao'
                ? 'bg-amber-500/25 border-amber-400 ring-2 ring-amber-400/40'
                : 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/15'
            }`}
          >
            <div className="flex items-center justify-between text-amber-400 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                Com Atenção / NC
              </span>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="text-2xl font-extrabold text-white">{monthSummary.atencaoCount}</div>
            <div className="text-[11px] text-amber-300/80">Com Coaching / NC aplicada</div>
          </button>

          {/* Pendentes */}
          <button
            onClick={() => setStatusFilter(statusFilter === 'Pendentes' ? 'Todos' : 'Pendentes')}
            className={`p-3.5 rounded-2xl border transition text-left cursor-pointer ${
              statusFilter === 'Pendentes'
                ? 'bg-rose-500/25 border-rose-400 ring-2 ring-rose-400/40'
                : 'bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/15'
            }`}
          >
            <div className="flex items-center justify-between text-rose-400 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping" />
                Pendentes
              </span>
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-2xl font-extrabold text-white">{monthSummary.pendenteCount}</div>
            <div className="text-[11px] text-rose-300/80">Aguardando checklist DTO</div>
          </button>

          {/* Não admitidos */}
          <button
            onClick={() => setStatusFilter(statusFilter === 'NaoAdmitidos' ? 'Todos' : 'NaoAdmitidos')}
            className={`p-3.5 rounded-2xl border transition text-left cursor-pointer ${
              statusFilter === 'NaoAdmitidos'
                ? 'bg-slate-700/50 border-slate-400 ring-2 ring-slate-400/40'
                : 'bg-slate-800/40 border-white/10 hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                Não Admitidos
              </span>
              <Calendar className="w-4 h-4" />
            </div>
            <div className="text-2xl font-extrabold text-slate-200">{monthSummary.naoAdmitidoCount}</div>
            <div className="text-[11px] text-slate-400">Admissão posterior ao mês</div>
          </button>
        </div>

        {/* Progress Bar of Farol */}
        <div className="bg-slate-900/60 p-3 rounded-2xl border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-2">
              <span>Farol Geral de Aderência Operacional:</span>
              <strong className="text-amber-400 font-bold">{monthSummary.completionPercent}%</strong>
              <span className="text-slate-400 font-normal">
                ({monthSummary.completedTotal} de {monthSummary.activeTotal} ativos no mês de {MONTH_NAMES[selectedMonth - 1]})
              </span>
            </span>
            {statusFilter !== 'Todos' && (
              <button
                onClick={() => setStatusFilter('Todos')}
                className="text-amber-400 hover:underline flex items-center gap-1 text-[11px]"
              >
                <span>Limpar Filtro ({statusFilter})</span>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex border border-white/10">
            {monthSummary.activeTotal > 0 && (
              <>
                <div 
                  style={{ width: `${(monthSummary.emDiaCount / monthSummary.activeTotal) * 100}%` }} 
                  className="bg-emerald-500 transition-all duration-500" 
                  title={`Em dia: ${monthSummary.emDiaCount}`}
                />
                <div 
                  style={{ width: `${(monthSummary.atencaoCount / monthSummary.activeTotal) * 100}%` }} 
                  className="bg-amber-400 transition-all duration-500" 
                  title={`Com Atenção / NC: ${monthSummary.atencaoCount}`}
                />
                <div 
                  style={{ width: `${(monthSummary.pendenteCount / monthSummary.activeTotal) * 100}%` }} 
                  className="bg-rose-500 transition-all duration-500" 
                  title={`Pendentes: ${monthSummary.pendenteCount}`}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Visual Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 bg-white/5 px-4 py-2.5 rounded-2xl border border-white/10">
        <span className="font-bold text-slate-200 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-amber-400" />
          Legenda do Farol:
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
          <strong>Verde:</strong> DTO Concluído (Conforme)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
          <strong>Amarelo:</strong> DTO com Não Conformidade / Coaching
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
          <strong>Vermelho:</strong> DTO Pendente no Mês
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-slate-600" />
          <strong>Cinza:</strong> Não Admitido no Período
        </span>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por colaborador, matrícula, cargo, setor ou nome do DTO (ex: bateria, empilhadeira)..."
              className="w-full bg-slate-900/80 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* DTO Category Filter */}
            <div className="flex items-center gap-1.5 bg-slate-900/80 border border-white/10 rounded-2xl px-3 py-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none cursor-pointer max-w-[190px]"
              >
                <option value="Todas" className="bg-slate-900 text-white">Todos os DTOs (Geral)</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id} className="bg-slate-900 text-white">
                    {cat.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Role Filter */}
            <div className="flex items-center gap-1.5 bg-slate-900/80 border border-white/10 rounded-2xl px-3 py-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none cursor-pointer max-w-[180px]"
              >
                <option value="Todas" className="bg-slate-900 text-white">Todos os Cargos ({availableRoles.length})</option>
                {availableRoles.map(role => (
                  <option key={role} value={role} className="bg-slate-900 text-white">{role}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Quick Role Selection Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-semibold text-slate-400 mr-1">Filtrar por grupo:</span>
          <button
            onClick={() => { setRoleFilter('Todas'); setCategoryFilter('Todas'); }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
              roleFilter === 'Todas' && categoryFilter === 'Todas'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            Todos ({unitEmployees.length})
          </button>
          <button
            onClick={() => { 
              const empRole = availableRoles.find(r => r.toLowerCase().includes('empilhadeira')) || 'Operador de Empilhadeira';
              setRoleFilter(empRole); 
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
              roleFilter.toLowerCase().includes('empilhadeira')
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            Operadores de Empilhadeira
          </button>
          <button
            onClick={() => { 
              const motRole = availableRoles.find(r => r.toLowerCase().includes('motorista')) || 'Motorista de Distribuição';
              setRoleFilter(motRole); 
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
              roleFilter.toLowerCase().includes('motorista')
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            Motoristas
          </button>
          <button
            onClick={() => { 
              const ajudRole = availableRoles.find(r => r.toLowerCase().includes('ajudante')) || 'Ajudante de Distribuição';
              setRoleFilter(ajudRole); 
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
              roleFilter.toLowerCase().includes('ajudante')
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            Ajudantes
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: MATRIZ ANUAL 12 MESES */}
      {viewMode === 'matrix12' && (
        <div className="overflow-x-auto rounded-2xl border border-white/10 shadow-xl bg-slate-950/40">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900/90 text-slate-300 font-bold border-b border-white/10 uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4 sticky left-0 z-20 bg-slate-900/95 min-w-[220px]">
                  Colaborador QLP
                </th>
                <th className="py-3.5 px-3 min-w-[140px]">Cargo / Setor</th>
                {MONTH_NAMES_SHORT.map((mShort, idx) => {
                  const isCurrent = idx + 1 === selectedMonth;
                  return (
                    <th 
                      key={mShort} 
                      className={`py-3.5 px-2 text-center min-w-[68px] ${
                        isCurrent ? 'bg-amber-500/20 text-amber-300 border-x border-amber-500/30' : ''
                      }`}
                    >
                      {mShort}
                    </th>
                  );
                })}
                <th className="py-3.5 px-3 text-center min-w-[80px]">Total Ano</th>
                <th className="py-3.5 px-3 text-center min-w-[80px]">Média</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={16} className="py-12 text-center text-slate-400">
                    Nenhum colaborador encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const emp = row.employee;

                  return (
                    <tr 
                      key={emp.id}
                      className="hover:bg-white/5 transition group"
                    >
                      {/* Fixed Colaborador Column */}
                      <td className="py-3 px-4 sticky left-0 z-10 bg-slate-950/95 group-hover:bg-slate-900 transition border-r border-white/5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-bold text-[11px] text-amber-400 shrink-0">
                            {emp.nome.charAt(0)}
                          </div>
                          <div className="space-y-0.5 overflow-hidden">
                            <div className="font-bold text-white truncate max-w-[170px]" title={emp.nome}>
                              {emp.nome}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <span>Mat: {emp.matricula}</span>
                              <span>•</span>
                              <span>Adm: {formatBRDate(emp.dataAdmissao)}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Cargo / Setor */}
                      <td className="py-3 px-3">
                        <div className="text-slate-200 font-medium truncate max-w-[130px]" title={emp.funcao}>
                          {emp.funcao}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[130px]">
                          {emp.setor}
                        </div>
                      </td>

                      {/* 12 Months Cells */}
                      {row.monthlyStatus.map((mStatus) => {
                        const isCurrentMonthCol = mStatus.monthNum === selectedMonth;
                        const exec = mStatus.execution;

                        return (
                          <td 
                            key={mStatus.monthNum}
                            onClick={() => handleOpenCellDetail(row, mStatus.monthNum)}
                            className={`py-2 px-1.5 text-center cursor-pointer transition relative ${
                              isCurrentMonthCol ? 'bg-amber-500/5' : ''
                            }`}
                          >
                            {mStatus.statusType === 'concluido' && exec && (
                              <div 
                                className="w-full py-1.5 px-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 hover:scale-105 transition flex flex-col items-center justify-center gap-0.5 shadow-sm"
                                title={`Concluído: ${exec.categoryTitle}\nNota: ${exec.conformityScore.toFixed(0)}%\nAvaliador: ${exec.evaluatorName}`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-[10px] font-extrabold">{exec.conformityScore.toFixed(0)}%</span>
                              </div>
                            )}

                            {mStatus.statusType === 'atencao' && exec && (
                              <div 
                                className="w-full py-1.5 px-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 hover:scale-105 transition flex flex-col items-center justify-center gap-0.5 shadow-sm"
                                title={`Com Atenção / NC: ${exec.categoryTitle}\nNota: ${exec.conformityScore.toFixed(0)}%\n${exec.naoConformesCount} NCs / ${exec.coachingCount} Coachings`}
                              >
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                <span className="text-[10px] font-extrabold">{exec.conformityScore.toFixed(0)}%</span>
                              </div>
                            )}

                            {mStatus.statusType === 'pendente' && (
                              <div 
                                className="w-full py-1.5 px-1 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500/25 hover:scale-105 transition flex flex-col items-center justify-center gap-0.5"
                                title={`Pendente em ${mStatus.monthName}/${selectedYear}. Clique para Lançar DTO.`}
                              >
                                <Clock className="w-3.5 h-3.5 text-rose-400" />
                                <span className="text-[9px] font-bold">Pendente</span>
                              </div>
                            )}

                            {mStatus.statusType === 'futuro' && (
                              <div 
                                className="w-full py-1.5 px-1 rounded-xl bg-slate-800/20 border border-slate-700/20 text-slate-400 hover:bg-slate-800/40 hover:scale-105 transition flex flex-col items-center justify-center gap-0.5"
                                title={`Mês posterior/planejado (${mStatus.monthName}/${selectedYear}). Clique para lançar se necessário.`}
                              >
                                <span className="text-[9px] font-medium text-slate-400">Previsto</span>
                              </div>
                            )}

                            {mStatus.statusType === 'nao_admitido' && (
                              <div 
                                className="w-full py-1.5 px-1 rounded-xl bg-slate-800/30 border border-slate-700/30 text-slate-500 flex flex-col items-center justify-center gap-0.5"
                                title={`Não admitido neste mês (Admissão: ${formatBRDate(emp.dataAdmissao)})`}
                              >
                                <span className="text-[10px] font-bold">—</span>
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Total Ano */}
                      <td className="py-3 px-3 text-center font-extrabold text-slate-100">
                        <span className="bg-white/10 px-2.5 py-1 rounded-lg text-xs">
                          {row.totalYearDTOs} / 12
                        </span>
                      </td>

                      {/* Média */}
                      <td className="py-3 px-3 text-center font-bold">
                        {row.avgYearScore !== null ? (
                          <span className={`px-2 py-1 rounded-lg text-xs ${
                            row.avgYearScore >= 90 
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                              : row.avgYearScore >= 75 
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}>
                            {row.avgYearScore}%
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">-</span>
                        )}
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* VIEW MODE 2: VISÃO DETALHADA DO MÊS SELECIONADO */}
      {viewMode === 'detailedMonth' && (
        <div className="overflow-x-auto rounded-2xl border border-white/10 shadow-xl bg-slate-950/40">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900/90 text-slate-300 font-bold border-b border-white/10 uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Colaborador QLP</th>
                <th className="py-3.5 px-3">Cargo & Setor</th>
                <th className="py-3.5 px-3 text-center">Status do Farol</th>
                <th className="py-3.5 px-3">DTO Realizado no Mês</th>
                <th className="py-3.5 px-3 text-center">Conformidade</th>
                <th className="py-3.5 px-3">DTO Indicado / Sugerido</th>
                <th className="py-3.5 px-3 text-right">Ações Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Nenhum colaborador encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const emp = row.employee;
                  const exec = row.currentMonthExec;
                  const isAdmitted = row.isAdmittedCurrentMonth;

                  return (
                    <tr key={emp.id} className="hover:bg-white/5 transition">
                      
                      {/* Colaborador */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-bold text-xs text-amber-400 shrink-0">
                            {emp.nome.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-white">{emp.nome}</div>
                            <div className="text-[11px] text-slate-400">Matrícula: {emp.matricula}</div>
                          </div>
                        </div>
                      </td>

                      {/* Cargo & Setor */}
                      <td className="py-3.5 px-3">
                        <div className="text-slate-200 font-semibold">{emp.funcao}</div>
                        <div className="text-[11px] text-slate-400">{emp.setor} • {emp.unidade}</div>
                      </td>

                      {/* Status do Farol */}
                      <td className="py-3.5 px-3 text-center">
                        {!isAdmitted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 text-slate-400 border border-white/10 text-[11px] font-semibold">
                            Não Admitido
                          </span>
                        ) : exec ? (
                          exec.naoConformesCount > 0 || exec.coachingCount > 0 || exec.conformityScore < 90 ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Com Atenção
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Concluído
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold">
                            <Clock className="w-3.5 h-3.5" />
                            Pendente
                          </span>
                        )}
                      </td>

                      {/* DTO Realizado */}
                      <td className="py-3.5 px-3">
                        {exec ? (
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-100">{exec.categoryTitle}</div>
                            <div className="text-[11px] text-slate-400">
                              Aplicado em {exec.date} por {exec.evaluatorName}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-xs">Nenhum DTO realizado</span>
                        )}
                      </td>

                      {/* Conformidade */}
                      <td className="py-3.5 px-3 text-center">
                        {exec ? (
                          <div className="flex flex-col items-center">
                            <span className={`font-extrabold text-sm ${
                              exec.conformityScore >= 90 ? 'text-emerald-400' : exec.conformityScore >= 75 ? 'text-amber-400' : 'text-rose-400'
                            }`}>
                              {exec.conformityScore.toFixed(0)}%
                            </span>
                            <div className="w-16 bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
                              <div 
                                className={`h-1.5 rounded-full ${
                                  exec.conformityScore >= 90 ? 'bg-emerald-400' : exec.conformityScore >= 75 ? 'bg-amber-400' : 'bg-rose-400'
                                }`} 
                                style={{ width: `${exec.conformityScore}%` }} 
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>

                      {/* DTO Indicado */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-amber-300">
                            {row.recommendation.categoryTitle.replace('DTO - ', '')}
                          </span>
                          {row.recommendation.isReapplication && (
                            <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[9px] px-1.5 py-0.5 rounded font-bold">
                              Reaplicação
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">{row.recommendation.reason}</div>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {onStartDTOForEmployee && isAdmitted && (
                            <button
                              onClick={() => onStartDTOForEmployee(emp.id, row.recommendation.categoryId)}
                              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-amber-500/10 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Lançar DTO</span>
                            </button>
                          )}

                          {exec && (
                            <button
                              onClick={() => handleOpenCellDetail(row, selectedMonth)}
                              className="bg-white/10 hover:bg-white/20 text-slate-200 p-2 rounded-xl text-xs transition cursor-pointer"
                              title="Ver Detalhes da Avaliação"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CELL DETAIL MODAL */}
      {selectedCellDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/15 rounded-3xl p-6 max-w-lg w-full text-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
                  {selectedCellDetail.employee.nome.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{selectedCellDetail.employee.nome}</h3>
                  <p className="text-xs text-slate-400">{selectedCellDetail.employee.funcao} • {selectedCellDetail.employee.setor}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCellDetail(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-3 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span>Período Consultado:</span>
                <strong className="text-amber-400 font-bold text-sm">
                  {MONTH_NAMES[selectedCellDetail.month - 1]} / {selectedCellDetail.year}
                </strong>
              </div>

              {!selectedCellDetail.isAdmitted ? (
                <div className="p-3 bg-slate-800/80 rounded-xl text-slate-300 space-y-1">
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    Colaborador Não Admitido no Mês
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Data de admissão registrada: {formatBRDate(selectedCellDetail.employee.dataAdmissao)}.
                  </p>
                </div>
              ) : selectedCellDetail.execution ? (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-1">
                    <div className="text-[11px] uppercase font-bold text-emerald-400">DTO Concluído</div>
                    <div className="text-sm font-bold text-white">{selectedCellDetail.execution.categoryTitle}</div>
                    <div className="text-[11px] text-slate-300">
                      Realizado em {selectedCellDetail.execution.date} por {selectedCellDetail.execution.evaluatorName}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-800/60 p-2.5 rounded-xl border border-white/5">
                      <div className="text-[10px] text-slate-400">Conformidade</div>
                      <div className="text-base font-extrabold text-emerald-400">
                        {selectedCellDetail.execution.conformityScore.toFixed(0)}%
                      </div>
                    </div>
                    <div className="bg-slate-800/60 p-2.5 rounded-xl border border-white/5">
                      <div className="text-[10px] text-slate-400">Conformes (C)</div>
                      <div className="text-base font-extrabold text-slate-200">
                        {selectedCellDetail.execution.conformesCount}
                      </div>
                    </div>
                    <div className="bg-slate-800/60 p-2.5 rounded-xl border border-white/5">
                      <div className="text-[10px] text-slate-400">Não Conformes (NC)</div>
                      <div className={`text-base font-extrabold ${selectedCellDetail.execution.naoConformesCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                        {selectedCellDetail.execution.naoConformesCount}
                      </div>
                    </div>
                  </div>

                  {selectedCellDetail.execution.notes && (
                    <div className="p-2.5 bg-slate-800/40 rounded-xl text-slate-300 text-[11px]">
                      <strong>Observações / Feedback:</strong> {selectedCellDetail.execution.notes}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-2">
                  <div className="font-bold text-rose-300 flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    Avaliação DTO Pendente neste Mês
                  </div>
                  <p className="text-slate-300 text-[11px]">
                    Este colaborador estava ativo no período e ainda não possui checklist DTO registrado.
                  </p>
                  {selectedCellDetail.recommendedCategoryTitle && (
                    <div className="pt-2 border-t border-white/10 text-[11px] text-amber-300">
                      <strong>Checklist Indicado:</strong> {selectedCellDetail.recommendedCategoryTitle}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-white/10">
              <button
                onClick={() => setSelectedCellDetail(null)}
                className="bg-white/10 hover:bg-white/20 text-slate-200 font-semibold px-4 py-2 rounded-xl text-xs"
              >
                Fechar
              </button>

              {onStartDTOForEmployee && selectedCellDetail.isAdmitted && !selectedCellDetail.execution && (
                <button
                  onClick={() => {
                    const empId = selectedCellDetail.employee.id;
                    const catId = selectedCellDetail.recommendedCategoryId || 'dto-manuseio-materiais';
                    setSelectedCellDetail(null);
                    onStartDTOForEmployee(empId, catId);
                  }}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Lançar DTO Agora</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
