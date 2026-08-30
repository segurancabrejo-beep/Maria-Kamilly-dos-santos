import React, { useState, useMemo } from 'react';
import { 
  ClipboardList, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Play, 
  Building2, 
  UserCheck, 
  UserX,
  FileCheck2,
  CalendarCheck,
  CalendarX,
  Sparkles,
  RotateCcw,
  Compass,
  Check,
  Layers
} from 'lucide-react';
import { Employee, DTOExecution, DTOCategory, RoleType } from '../types/dto';
import { getCategoriesForEmployee } from '../utils/storage';
import { isEmployeeAdmittedInMonth, formatBRDate, MONTH_NAMES } from '../utils/dateUtils';
import { getRecommendedDTOForMonth, getPreviousExecution } from '../utils/dtoRecommendation';
import { generateAllPendingDTOs } from '../utils/autoFillPending';
import { isEmployeeMonitoredForDTO } from '../utils/employeeFilter';

interface PendenciesViewProps {
  employees: Employee[];
  categories: DTOCategory[];
  executions: DTOExecution[];
  selectedMonth: number;
  selectedYear: number;
  selectedUnit: string;
  onStartDTO: (employeeId: string, categoryId: string) => void;
  onUpdateExecutions?: (newExecs: DTOExecution[]) => void;
}

export const PendenciesView: React.FC<PendenciesViewProps> = ({
  employees,
  categories,
  executions,
  selectedMonth,
  selectedYear,
  selectedUnit,
  onStartDTO,
  onUpdateExecutions
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('Todas');
  const [categoryFilter, setCategoryFilter] = useState<string>('Todas');
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Pendentes' | 'Concluidos' | 'NaoAdmitidos'>('Todos');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const handleFillAll = () => {
    const res = generateAllPendingDTOs(employees, categories, executions, selectedYear, 8);
    if (res.filledCount > 0 && onUpdateExecutions) {
      onUpdateExecutions([...executions, ...res.newExecutions]);
      setFeedbackMsg(`${res.filledCount} gabaritos pendentes preenchidos com sucesso (exceto relatos) até Agosto/${selectedYear}!`);
      setTimeout(() => setFeedbackMsg(null), 5000);
    } else {
      setFeedbackMsg(`Todos os colaboradores já possuem gabaritos preenchidos até Agosto/${selectedYear}!`);
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  // Extract unique roles from monitored employees list
  const availableRoles = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.funcao && isEmployeeMonitoredForDTO(e)) set.add(e.funcao);
    });
    return Array.from(set).sort();
  }, [employees]);

  // Filter employees by unit, search, role and DTO monitoring scope
  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const isMonitored = isEmployeeMonitoredForDTO(e);
      const matchStatus = e.status === 'Ativo';
      const matchUnit = selectedUnit === 'Todas as Unidades' || e.unidade === selectedUnit;
      const matchRole = roleFilter === 'Todas' || e.funcao === roleFilter;
      
      let matchCat = true;
      if (categoryFilter !== 'Todas') {
        const cat = categories.find(c => c.id === categoryFilter);
        if (cat && cat.requiredForRoles && cat.requiredForRoles.length > 0) {
          matchCat = cat.requiredForRoles.includes(e.funcao);
        }
      }

      const matchSearch = e.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          e.matricula.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          e.setor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          e.funcao.toLowerCase().includes(searchTerm.toLowerCase());
      return isMonitored && matchStatus && matchUnit && matchRole && matchCat && matchSearch;
    });
  }, [employees, selectedUnit, roleFilter, categoryFilter, categories, searchTerm]);

  // Calculate detailed pendency status per employee with admission date rule and 1 DTO per month rule
  const employeePendencyMatrix = useMemo(() => {
    return filteredEmployees.map(emp => {
      const isAdmitted = isEmployeeAdmittedInMonth(emp.dataAdmissao, selectedMonth, selectedYear);
      const eligibleCategories = getCategoriesForEmployee(categories, emp);

      // Smart Recommendation for this employee in this month
      const recommendation = getRecommendedDTOForMonth(emp, categories, executions, selectedMonth, selectedYear);

      // Check executions in THIS month for this employee
      const monthExecsForEmployee = executions.filter(exec => 
        exec.employeeId === emp.id && 
        exec.referenceMonth === selectedMonth && 
        exec.referenceYear === selectedYear &&
        exec.status === 'Concluído'
      );

      // Employee is considered completed for the month if they have AT LEAST 1 DTO executed in the month
      const totalCompletedInMonth = monthExecsForEmployee.length;
      const isFullyCompleted = isAdmitted && totalCompletedInMonth >= 1;
      const hasPending = isAdmitted && totalCompletedInMonth === 0;
      const isNotYetAdmitted = !isAdmitted;

      // Map status of each category (for display & manual selection)
      const dtoStatuses = eligibleCategories.map(cat => {
        const execution = monthExecsForEmployee.find(exec => exec.categoryId === cat.id);
        const isRecommended = cat.id === recommendation.categoryId;

        return {
          category: cat,
          isCompleted: !!execution,
          isRecommended,
          execution
        };
      });

      return {
        employee: emp,
        isAdmitted,
        isNotYetAdmitted,
        eligibleCategories,
        recommendation,
        dtoStatuses,
        monthExecsForEmployee,
        totalCompletedInMonth,
        isFullyCompleted,
        hasPending
      };
    });
  }, [filteredEmployees, categories, executions, selectedMonth, selectedYear]);

  // Filter matrix by status option
  const filteredMatrix = useMemo(() => {
    return employeePendencyMatrix.filter(item => {
      if (statusFilter === 'Pendentes') return item.hasPending;
      if (statusFilter === 'Concluidos') return item.isFullyCompleted;
      if (statusFilter === 'NaoAdmitidos') return item.isNotYetAdmitted;
      return true;
    });
  }, [employeePendencyMatrix, statusFilter]);

  // Summary counts for the reference month (Goal: 1 DTO per active employee)
  const totalEmployeesCount = employeePendencyMatrix.length;
  const admittedInPeriodCount = employeePendencyMatrix.filter(i => i.isAdmitted).length;
  const notAdmittedCount = employeePendencyMatrix.filter(i => i.isNotYetAdmitted).length;
  const fullyDoneCount = employeePendencyMatrix.filter(i => i.isFullyCompleted).length;
  const pendingEmployeesCount = employeePendencyMatrix.filter(i => i.hasPending).length;

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Banner */}
      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 sm:p-6 text-white shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
            <ClipboardList className="w-4 h-4" />
            <span>Acompanhamento Mensal • 1 DTO por Colaborador/Mês</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Matriz de Controle QLP • {MONTH_NAMES[selectedMonth - 1]} / {selectedYear}
          </h2>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            Meta operacional: <strong>1 DTO mensal por colaborador ativo</strong>. O sistema sugere automaticamente o próximo tema em rodízio (se conforme) ou a <strong>reaplicação imediata</strong> do checklist caso tenha ocorrido Não Conformidade no mês anterior.
          </p>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full sm:w-auto">
            <div className="bg-white/5 border border-white/10 backdrop-blur-md px-3 py-2 rounded-xl text-center">
              <span className="text-[11px] text-slate-400 font-medium block">Ativos no Mês</span>
              <span className="text-base sm:text-lg font-bold text-slate-100">{admittedInPeriodCount}</span>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 backdrop-blur-md px-3 py-2 rounded-xl text-center">
              <span className="text-[11px] text-amber-400 font-medium block">Com Pendência</span>
              <span className="text-base sm:text-lg font-bold text-amber-300">{pendingEmployeesCount}</span>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md px-3 py-2 rounded-xl text-center">
              <span className="text-[11px] text-emerald-400 font-medium block">100% Concluídos</span>
              <span className="text-base sm:text-lg font-bold text-emerald-300">{fullyDoneCount}</span>
            </div>
            <div className="bg-indigo-500/10 border border-indigo-500/20 backdrop-blur-md px-3 py-2 rounded-xl text-center">
              <span className="text-[11px] text-indigo-300 font-medium block">Admissão Futura</span>
              <span className="text-base sm:text-lg font-bold text-indigo-300">{notAdmittedCount}</span>
            </div>
          </div>

          {onUpdateExecutions && (
            <button
              onClick={handleFillAll}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all shadow-lg whitespace-nowrap"
              title="Preenche todos os gabaritos pendentes do ano com 100% de conformidade (exceto relatos)"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Preencher Todos os Pendentes</span>
            </button>
          )}
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar colaborador, matrícula ou função..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-amber-400 text-slate-100 placeholder-slate-500"
            />
          </div>

          {/* Role Filter & Status Tabs */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            
            {/* DTO Category Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>DTO:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-900 border border-white/10 rounded-xl text-xs px-3 py-2 focus:outline-none focus:border-amber-400 font-medium text-slate-100 max-w-[200px]"
              >
                <option value="Todas">Todos os DTOs</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.title}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Função:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-slate-900 border border-white/10 rounded-xl text-xs px-3 py-2 focus:outline-none focus:border-amber-400 font-medium text-slate-100 max-w-[180px]"
              >
                <option value="Todas">Todas as Funções ({availableRoles.length})</option>
                {availableRoles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            {/* Status Filter Buttons */}
            <div className="flex flex-wrap bg-white/5 border border-white/10 p-1 rounded-xl text-xs font-semibold backdrop-blur-md">
              <button
                onClick={() => setStatusFilter('Todos')}
                className={`px-2.5 py-1.5 rounded-lg transition ${statusFilter === 'Todos' ? 'bg-white/20 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Todos ({totalEmployeesCount})
              </button>
              <button
                onClick={() => setStatusFilter('Pendentes')}
                className={`px-2.5 py-1.5 rounded-lg transition ${statusFilter === 'Pendentes' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-amber-400 hover:text-amber-300'}`}
              >
                Pendentes ({pendingEmployeesCount})
              </button>
              <button
                onClick={() => setStatusFilter('Concluidos')}
                className={`px-2.5 py-1.5 rounded-lg transition ${statusFilter === 'Concluidos' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-emerald-400 hover:text-emerald-300'}`}
              >
                Concluídos ({fullyDoneCount})
              </button>
              {notAdmittedCount > 0 && (
                <button
                  onClick={() => setStatusFilter('NaoAdmitidos')}
                  className={`px-2.5 py-1.5 rounded-lg transition ${statusFilter === 'NaoAdmitidos' ? 'bg-indigo-500 text-white font-bold' : 'text-indigo-400 hover:text-indigo-300'}`}
                >
                  Admissão Futura ({notAdmittedCount})
                </button>
              )}
            </div>

          </div>

        </div>

        {/* Quick Role Selection Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/5">
          <span className="text-[11px] font-semibold text-slate-400 mr-1">Filtrar por grupo:</span>
          <button
            onClick={() => { setRoleFilter('Todas'); setCategoryFilter('Todas'); }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
              roleFilter === 'Todas' && categoryFilter === 'Todas'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => { 
              const empRole = availableRoles.find(r => r.toLowerCase().includes('empilhadeira')) || 'Operador de Empilhadeira';
              setRoleFilter(empRole);
              setCategoryFilter('dto-carregamento-baterias');
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
              categoryFilter === 'dto-carregamento-baterias'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            Carregamento de Baterias (Empilhadeiras)
          </button>
          <button
            onClick={() => { 
              const motRole = availableRoles.find(r => r.toLowerCase().includes('motorista')) || 'Motorista de Distribuição';
              setRoleFilter(motRole);
              setCategoryFilter('Todas');
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
              roleFilter.toLowerCase().includes('motorista') && categoryFilter === 'Todas'
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
              setCategoryFilter('Todas');
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
              roleFilter.toLowerCase().includes('ajudante') && categoryFilter === 'Todas'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            Ajudantes
          </button>
        </div>

      </div>

      {/* Main Pendency Table */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl overflow-hidden">
        {filteredMatrix.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <UserCheck className="w-12 h-12 mx-auto text-slate-500 mb-3" />
            <p className="text-base font-semibold text-slate-200">Nenhum colaborador encontrado com os filtros selecionados.</p>
            <p className="text-xs text-slate-400 mt-1">Tente ajustar a busca ou os filtros acima.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-white/5 border-b border-white/10 text-slate-300 font-bold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Colaborador / QLP</th>
                  <th className="py-3.5 px-4">Função / Setor</th>
                  <th className="py-3.5 px-4">DTO Indicado para o Mês</th>
                  <th className="py-3.5 px-4">Realizado no Mês</th>
                  <th className="py-3.5 px-4 text-center">Meta Mensal</th>
                  <th className="py-3.5 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredMatrix.map(({ 
                  employee, 
                  isAdmitted, 
                  isNotYetAdmitted, 
                  recommendation,
                  dtoStatuses, 
                  monthExecsForEmployee,
                  totalCompletedInMonth,
                  isFullyCompleted 
                }) => (
                  <tr 
                    key={employee.id} 
                    className={`transition ${isNotYetAdmitted ? 'bg-slate-900/40 opacity-75 hover:opacity-100 hover:bg-slate-900/60' : 'hover:bg-white/5'}`}
                  >
                    
                    {/* Employee Info */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                        <span>{employee.nome}</span>
                        {isNotYetAdmitted && (
                          <span className="bg-indigo-500/20 text-indigo-300 text-[10px] px-1.5 py-0.2 rounded font-normal border border-indigo-500/30">
                            Admissão Futura
                          </span>
                        )}
                      </div>
                      <div className="text-slate-400 font-mono text-[11px] flex items-center gap-2 mt-0.5">
                        <span>Matrícula: {employee.matricula}</span>
                        <span>•</span>
                        <span>{employee.unidade}</span>
                      </div>
                    </td>

                    {/* Role & Sector */}
                    <td className="py-3.5 px-4">
                      <span className="inline-block bg-white/10 border border-white/10 text-slate-200 font-semibold px-2.5 py-0.5 rounded-md text-[11px] mb-0.5">
                        {employee.funcao}
                      </span>
                      <div className="text-slate-400">{employee.setor}</div>
                    </td>

                    {/* Recommended DTO for this Month */}
                    <td className="py-3.5 px-4 max-w-xs">
                      {isNotYetAdmitted ? (
                        <div className="text-indigo-300 text-xs flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>Admissão em {formatBRDate(employee.dataAdmissao)}</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            {recommendation.isReapplication ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-md">
                                <RotateCcw className="w-3 h-3 text-rose-400 animate-spin-slow" />
                                Reaplicação (Houve NC)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md">
                                <Compass className="w-3 h-3 text-amber-400" />
                                Sugestão do Ciclo
                              </span>
                            )}
                          </div>
                          <div className="font-bold text-slate-100 text-xs">
                            {recommendation.categoryTitle}
                          </div>
                          <p className="text-[10px] text-slate-400 leading-tight">
                            {recommendation.reason}
                          </p>
                        </div>
                      )}
                    </td>

                    {/* Executed in This Month */}
                    <td className="py-3.5 px-4">
                      {isNotYetAdmitted ? (
                        <span className="text-slate-500 text-xs italic">Sem pendência no período</span>
                      ) : monthExecsForEmployee.length === 0 ? (
                        <div className="inline-flex items-center gap-1 text-amber-400 text-xs font-semibold bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Pendente no Mês</span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {monthExecsForEmployee.map(exec => (
                            <div
                              key={exec.id}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                                exec.conformityScore === 100
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>{exec.categoryTitle.replace('DTO - ', '')}: <strong>{exec.conformityScore.toFixed(0)}%</strong></span>
                              {exec.naoConformesCount > 0 && (
                                <span className="bg-rose-500 text-white text-[9px] px-1 py-0.2 rounded font-black">
                                  {exec.naoConformesCount} NC
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Monthly Goal Progress (1/1) */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {isNotYetAdmitted ? (
                        <span className="text-indigo-300/80 text-xs font-medium">-</span>
                      ) : (
                        <div>
                          <div className="flex items-center justify-center gap-1.5 font-extrabold text-xs">
                            <span className={isFullyCompleted ? 'text-emerald-400' : 'text-amber-400'}>
                              {totalCompletedInMonth} / 1 DTO
                            </span>
                          </div>
                          <div className="w-16 bg-white/10 rounded-full h-1.5 mx-auto mt-1 overflow-hidden">
                            <div 
                              className={`h-1.5 rounded-full ${isFullyCompleted ? 'bg-emerald-400' : 'bg-amber-400'}`}
                              style={{ width: `${isFullyCompleted ? 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Action Button */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {isFullyCompleted ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="inline-flex items-center gap-1 text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-lg font-semibold text-xs border border-emerald-500/20">
                            <Check className="w-3.5 h-3.5" /> Meta Atingida
                          </span>
                          <button
                            onClick={() => onStartDTO(employee.id, recommendation.categoryId)}
                            className="text-[10px] text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-2 py-1 rounded-lg transition"
                            title="Lançar DTO adicional"
                          >
                            + Extra
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onStartDTO(employee.id, recommendation.categoryId)}
                          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs inline-flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition active:scale-95 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-slate-950" />
                          <span>Lançar Indicado</span>
                        </button>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
