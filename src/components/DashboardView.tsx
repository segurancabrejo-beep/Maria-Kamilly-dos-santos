import React, { useState, useMemo } from 'react';
import { 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  Award, 
  TrendingUp, 
  MessageSquare, 
  Clock, 
  ArrowRight,
  FileCheck2,
  Calendar,
  AlertTriangle,
  UserPlus,
  LayoutDashboard,
  Layers,
  BatteryCharging,
  Truck,
  HardHat,
  Flame,
  Lock,
  Activity
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { Employee, DTOExecution, DTOCategory, RoleType } from '../types/dto';
import { getCategoriesForRole } from '../utils/storage';
import { isEmployeeAdmittedInMonth, MONTH_NAMES } from '../utils/dateUtils';
import { getRecommendedDTOForMonth } from '../utils/dtoRecommendation';
import { isEmployeeMonitoredForDTO } from '../utils/employeeFilter';
import { FarolMatrixTable } from './FarolMatrixTable';
import { DTOCategoryDashboardTab } from './DTOCategoryDashboardTab';

interface DashboardViewProps {
  employees: Employee[];
  categories: DTOCategory[];
  executions: DTOExecution[];
  selectedMonth: number;
  selectedYear: number;
  selectedUnit: string;
  onNavigateTab: (tab: 'pendencies' | 'execute' | 'reports' | 'employees') => void;
  onStartDTOForEmployee?: (employeeId: string, categoryId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  employees,
  categories,
  executions,
  selectedMonth,
  selectedYear,
  selectedUnit,
  onNavigateTab,
  onStartDTOForEmployee
}) => {
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>('overview');

  // All active and monitored employees in selected unit
  const allUnitEmployees = useMemo(() => {
    return employees.filter(e => e.status === 'Ativo' && isEmployeeMonitoredForDTO(e) && (selectedUnit === 'Todas as Unidades' || e.unidade === selectedUnit));
  }, [employees, selectedUnit]);

  // Filter active employees who were ALREADY ADMITTED in the selected month/year
  const activeEmployeesInPeriod = useMemo(() => {
    return allUnitEmployees.filter(e => isEmployeeAdmittedInMonth(e.dataAdmissao, selectedMonth, selectedYear));
  }, [allUnitEmployees, selectedMonth, selectedYear]);

  const futureAdmissionsCount = allUnitEmployees.length - activeEmployeesInPeriod.length;

  // Filter executions by selected month, year, and unit
  const monthExecutions = useMemo(() => {
    return executions.filter(exec => {
      const matchMonth = exec.referenceMonth === selectedMonth && exec.referenceYear === selectedYear;
      const matchUnit = selectedUnit === 'Todas as Unidades' || exec.employeeUnit === selectedUnit;
      return matchMonth && matchUnit;
    });
  }, [executions, selectedMonth, selectedYear, selectedUnit]);

  // Count of executions per category in selected period
  const categoryExecutionsCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    categories.forEach(c => {
      map[c.id] = executions.filter(e => {
        const matchUnit = selectedUnit === 'Todas as Unidades' || e.employeeUnit === selectedUnit;
        const matchMonth = e.referenceMonth === selectedMonth && e.referenceYear === selectedYear;
        return e.categoryId === c.id && matchUnit && matchMonth;
      }).length;
    });
    return map;
  }, [categories, executions, selectedMonth, selectedYear, selectedUnit]);

  const selectedCategory = useMemo(() => {
    return categories.find(c => c.id === activeCategoryTab);
  }, [categories, activeCategoryTab]);

  const getCategoryIcon = (catId: string) => {
    if (catId.includes('bateria')) return <BatteryCharging className="w-4 h-4 text-emerald-400" />;
    if (catId.includes('nivel') || catId.includes('diferente')) return <Layers className="w-4 h-4 text-teal-400" />;
    if (catId.includes('transporte') || catId.includes('rota')) return <Truck className="w-4 h-4 text-blue-400" />;
    if (catId.includes('diesel') || catId.includes('abastecimento')) return <Flame className="w-4 h-4 text-amber-400" />;
    if (catId.includes('sam') || catId.includes('loto')) return <Lock className="w-4 h-4 text-purple-400" />;
    if (catId.includes('ergonomia') || catId.includes('manuseio')) return <Activity className="w-4 h-4 text-indigo-400" />;
    if (catId.includes('relato')) return <MessageSquare className="w-4 h-4 text-violet-400" />;
    if (catId.includes('epi')) return <HardHat className="w-4 h-4 text-cyan-400" />;
    return <ShieldAlert className="w-4 h-4 text-amber-400" />;
  };

  // Calculate global compliance %
  let totalConformes = 0;
  let totalNaoConformes = 0;
  let totalCoaching = 0;

  monthExecutions.forEach(e => {
    totalConformes += e.conformesCount;
    totalNaoConformes += e.naoConformesCount;
    totalCoaching += e.coachingCount;
  });

  const totalEvaluatedQuestions = totalConformes + totalNaoConformes;
  const globalComplianceRate = totalEvaluatedQuestions > 0 
    ? Math.round((totalConformes / totalEvaluatedQuestions) * 100) 
    : 100;

  // Calculate required DTOs for current month (Target: exactly 1 DTO per active employee per month)
  let totalRequiredDTOs = activeEmployeesInPeriod.length; // 1 DTO por pessoa no mês
  let completedDTOsCount = 0;

  activeEmployeesInPeriod.forEach(emp => {
    const hasExecution = monthExecutions.some(exec => exec.employeeId === emp.id && exec.status === 'Concluído');
    if (hasExecution) completedDTOsCount++;
  });

  const pendingDTOsCount = Math.max(0, totalRequiredDTOs - completedDTOsCount);
  const completionPercentage = totalRequiredDTOs > 0 ? Math.round((completedDTOsCount / totalRequiredDTOs) * 100) : 100;

  // Category compliance data for bar chart
  const categoryData = useMemo(() => {
    return categories.map(cat => {
      const catExecs = monthExecutions.filter(e => e.categoryId === cat.id);
      let cCount = 0;
      let ncCount = 0;
      catExecs.forEach(e => {
        cCount += e.conformesCount;
        ncCount += e.naoConformesCount;
      });
      const total = cCount + ncCount;
      const rate = total > 0 ? Math.round((cCount / total) * 100) : 100;

      return {
        id: cat.id,
        name: cat.title.replace(/^DTO\s*-\s*/i, ''),
        fullTitle: cat.title,
        rate,
        totalExecutions: catExecs.length,
        naoConformes: ncCount
      };
    });
  }, [categories, monthExecutions]);

  // Role compliance data for bar chart based on actual employees
  const roleData = useMemo(() => {
    const rolesMap = new Map<string, { role: string; executions: number; conformes: number; total: number; employees: number }>();

    activeEmployeesInPeriod.forEach(emp => {
      if (!rolesMap.has(emp.funcao)) {
        rolesMap.set(emp.funcao, { role: emp.funcao, executions: 0, conformes: 0, total: 0, employees: 0 });
      }
      rolesMap.get(emp.funcao)!.employees++;
    });

    monthExecutions.forEach(e => {
      if (!rolesMap.has(e.employeeRole)) {
        rolesMap.set(e.employeeRole, { role: e.employeeRole, executions: 0, conformes: 0, total: 0, employees: 0 });
      }
      const entry = rolesMap.get(e.employeeRole)!;
      entry.executions++;
      entry.conformes += e.conformesCount;
      entry.total += (e.conformesCount + e.naoConformesCount);
    });

    return Array.from(rolesMap.values())
      .map(r => ({
        role: r.role,
        rate: r.total > 0 ? Math.round((r.conformes / r.total) * 100) : 100,
        executions: r.executions,
        employees: r.employees
      }))
      .filter(r => r.employees > 0 || r.executions > 0)
      .sort((a, b) => b.employees - a.employees)
      .slice(0, 8);
  }, [activeEmployeesInPeriod, monthExecutions]);

  // Top non-conformities & coaching items
  const topNonConformities = useMemo(() => {
    const map: Record<string, { questionText: string; dtoTitle: string; count: number; categoryId: string }> = {};

    monthExecutions.forEach(exec => {
      exec.responses.forEach(resp => {
        if (resp.status === 'NC' || resp.coachingApplied) {
          const cat = categories.find(c => c.id === exec.categoryId);
          const q = cat?.questions.find(item => item.id === resp.questionId);
          const text = q ? q.questionText : resp.questionId;

          if (!map[resp.questionId]) {
            map[resp.questionId] = {
              questionText: text,
              dtoTitle: cat ? cat.title : exec.categoryId,
              categoryId: exec.categoryId,
              count: 0
            };
          }
          map[resp.questionId].count++;
        }
      });
    });

    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [monthExecutions, categories]);

  // Quick list of employees with pending DTOs in this month (1 DTO per month target)
  const pendingEmployees = useMemo(() => {
    return activeEmployeesInPeriod
      .map(emp => {
        const hasDoneInMonth = monthExecutions.some(exec => exec.employeeId === emp.id && exec.status === 'Concluído');
        const recommendation = getRecommendedDTOForMonth(emp, categories, executions, selectedMonth, selectedYear);
        return {
          employee: emp,
          isPending: !hasDoneInMonth,
          recommendation
        };
      })
      .filter(item => item.isPending)
      .slice(0, 6);
  }, [activeEmployeesInPeriod, categories, executions, monthExecutions, selectedMonth, selectedYear]);

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Banner / Welcome with period indicator */}
      <div className="relative overflow-hidden bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 text-white shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold uppercase tracking-wider backdrop-blur-md">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Painel de Indicadores de Segurança • DTO</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
              Gestão de DTO • {MONTH_NAMES[selectedMonth - 1]} / {selectedYear}
            </h1>
            <p className="text-slate-300 text-sm sm:text-base max-w-2xl">
              Acompanhamento em tempo real das conformidades de segurança do QLP Operacional ({selectedUnit}).
            </p>
            {futureAdmissionsCount > 0 && (
              <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-xs font-medium">
                <UserPlus className="w-3.5 h-3.5" />
                <span>{activeEmployeesInPeriod.length} colaboradores ativos no período ({futureAdmissionsCount} com admissão posterior ao mês selecionado).</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigateTab('execute')}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-5 py-3 rounded-2xl shadow-lg shadow-amber-500/20 text-sm flex items-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>Novo Checklist DTO</span>
            </button>

            <button
              onClick={() => onNavigateTab('pendencies')}
              className="bg-white/10 hover:bg-white/20 text-slate-100 font-semibold px-4 py-3 rounded-2xl text-sm border border-white/10 flex items-center gap-2 backdrop-blur-md transition cursor-pointer"
            >
              <span>Ver Matriz de Pendências</span>
              <ArrowRight className="w-4 h-4 text-amber-400" />
            </button>
          </div>
        </div>
      </div>

      {/* DTO Categories Navigation Tabs Bar */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-2.5 rounded-2xl shadow-xl space-y-2">
        <div className="flex flex-wrap items-center justify-between px-2 pt-1 gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            Abas de DTOs do Sistema ({categories.length} Checklists)
          </span>
          <span className="text-[11px] text-slate-400">
            Selecione uma aba para ver os <strong className="text-amber-300">DTOs feitos por colaborador</strong>
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-700">
          {/* Overview Tab */}
          <button
            onClick={() => setActiveCategoryTab('overview')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition cursor-pointer shrink-0 ${
              activeCategoryTab === 'overview'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Visão Geral & Farol</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeCategoryTab === 'overview' ? 'bg-slate-950 text-amber-300' : 'bg-slate-900 text-slate-400'
            }`}>
              {monthExecutions.length}
            </span>
          </button>

          {/* DTO Category Tabs */}
          {categories.map(cat => {
            const count = categoryExecutionsCountMap[cat.id] || 0;
            const isSelected = activeCategoryTab === cat.id;
            const shortName = cat.title.replace(/^DTO\s*-\s*/i, '');

            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryTab(cat.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60'
                }`}
                title={cat.title}
              >
                {getCategoryIcon(cat.id)}
                <span>{shortName}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  isSelected
                    ? 'bg-slate-950 text-amber-300'
                    : count > 0 
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                    : 'bg-slate-900 text-slate-500'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Render Selected DTO Category Tab OR Global Overview */}
      {activeCategoryTab !== 'overview' && selectedCategory ? (
        <DTOCategoryDashboardTab
          category={selectedCategory}
          categories={categories}
          employees={employees}
          executions={executions}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          selectedUnit={selectedUnit}
          onStartDTOForEmployee={onStartDTOForEmployee}
          onNavigateToExecution={() => onNavigateTab('execute')}
        />
      ) : (
        <>
          {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Global Compliance */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl hover:border-amber-400/40 transition">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Conformidade Global</span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">{globalComplianceRate}%</span>
            <span className="text-xs text-emerald-400 font-semibold">Meta: ≥ 95%</span>
          </div>
          <p className="text-slate-400 text-xs mt-2">
            {totalConformes} conformes de {totalEvaluatedQuestions} itens avaliados no mês.
          </p>
        </div>

        {/* KPI 2: Execution Progress */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl hover:border-amber-400/40 transition">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Aderência aos DTOs</span>
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">{completionPercentage}%</span>
            <span className="text-xs text-slate-400 font-semibold">({completedDTOsCount}/{totalRequiredDTOs})</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div 
              className="bg-amber-400 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: `${completionPercentage}%` }} 
            />
          </div>
        </div>

        {/* KPI 3: Pendencies Count */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl hover:border-amber-400/40 transition">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">DTOs Pendentes</span>
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">{pendingDTOsCount}</span>
            <span className="text-xs text-rose-400 font-semibold">checklist(s) pendentes</span>
          </div>
          <p className="text-slate-400 text-xs mt-2">
            {pendingEmployees.length} colaboradores elegíveis com pendências.
          </p>
        </div>

        {/* KPI 4: Coaching Applied */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl hover:border-amber-400/40 transition">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Coachings Aplicados</span>
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">{totalCoaching}</span>
            <span className="text-xs text-blue-400 font-semibold">orientações em campo</span>
          </div>
          <p className="text-slate-400 text-xs mt-2">
            Desvios corrigidos imediatamente com o funcionário.
          </p>
        </div>

      </div>

      {/* Prominent Visual Farol Matrix Section */}
      <FarolMatrixTable
        employees={employees}
        categories={categories}
        executions={executions}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        selectedUnit={selectedUnit}
        onStartDTOForEmployee={onStartDTOForEmployee}
      />

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Category Compliance Chart */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white">Conformidade por Tipo de DTO</h3>
              <p className="text-xs text-slate-400">Percentual de conformidade de cada checklist aplicado</p>
            </div>
            <span className="text-xs font-semibold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20">
              {MONTH_NAMES[selectedMonth - 1]} / {selectedYear}
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: '#94a3b8', fontSize: 10 }} 
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis 
                  tick={{ fill: '#94a3b8', fontSize: 11 }} 
                  domain={[0, 100]}
                  unit="%"
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                  formatter={(value: any) => [`${value}%`, 'Conformidade']}
                />
                <Bar dataKey="rate" radius={[6, 6, 0, 0]}>
                  {categoryData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.rate >= 90 ? '#10b981' : entry.rate >= 75 ? '#f59e0b' : '#ef4444'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Role Compliance Chart */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white">Aderência por Função QLP</h3>
              <p className="text-xs text-slate-400">Desempenho de segurança por cargo operacional</p>
            </div>
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-lg border border-emerald-400/20">
              {activeEmployeesInPeriod.length} Ativos
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roleData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
                <XAxis 
                  type="number" 
                  domain={[0, 100]} 
                  unit="%"
                  tick={{ fill: '#94a3b8', fontSize: 11 }} 
                />
                <YAxis 
                  dataKey="role" 
                  type="category" 
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  width={110}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                  formatter={(value: any, name: any, item: any) => [`${value}% (${item.payload.employees} colaboradores)`, 'Conformidade']}
                />
                <Bar dataKey="rate" radius={[0, 6, 6, 0]}>
                  {roleData.map((entry, index) => (
                    <Cell 
                      key={`role-cell-${index}`} 
                      fill={entry.rate >= 90 ? '#10b981' : entry.rate >= 75 ? '#f59e0b' : '#ef4444'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Bottom Section: Top Non-Conformities & Pending Collaborators */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top Non-Conformities */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Principais Desvios & Coachings Aplicados</h3>
          </div>

          {topNonConformities.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              Nenhum desvio crítico registrado para este mês!
            </div>
          ) : (
            <div className="space-y-2.5">
              {topNonConformities.map((item, idx) => (
                <div 
                  key={idx}
                  className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <span className="font-semibold text-amber-300 block">{item.dtoTitle}</span>
                    <p className="text-slate-300 line-clamp-2">{item.questionText}</p>
                  </div>
                  <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded-lg font-bold shrink-0">
                    {item.count} {item.count === 1 ? 'ocorrência' : 'ocorrências'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Priority Pending Employees */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-bold text-white">Colaboradores com Pendências Prioritárias</h3>
            </div>
            <button
              onClick={() => onNavigateTab('pendencies')}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>Ver Todos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {pendingEmployees.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              Todos os colaboradores elegíveis estão com a meta mensal de DTO em dia!
            </div>
          ) : (
            <div className="space-y-2.5">
              {pendingEmployees.map(({ employee, recommendation }) => (
                <div 
                  key={employee.id}
                  className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-amber-400/40 transition"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-100">{employee.nome}</div>
                    <div className="text-slate-400">{employee.funcao} • {employee.setor}</div>
                    <div className="text-[11px] text-amber-300 font-medium pt-0.5">
                      Indicado: <strong>{recommendation.categoryTitle.replace('DTO - ', '')}</strong>
                      {recommendation.isReapplication && (
                        <span className="ml-1.5 text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.2 rounded font-bold">
                          Reaplicação
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {onStartDTOForEmployee && (
                      <button
                        onClick={() => onStartDTOForEmployee(employee.id, recommendation.categoryId)}
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-[11px] transition active:scale-95 cursor-pointer shadow-md shadow-amber-500/10"
                      >
                        Lançar Indicado
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </>
  )}

</div>
  );
};
