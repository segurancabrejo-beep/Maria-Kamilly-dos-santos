import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Building, 
  Eye, 
  Plus, 
  Download, 
  Clock, 
  Award, 
  TrendingUp, 
  MessageSquare, 
  HelpCircle,
  Users,
  ChevronRight,
  BatteryCharging,
  Truck,
  HardHat,
  Flame,
  Lock,
  Layers,
  Activity,
  FileCheck2,
  ListChecks,
  AlertCircle,
  UserCheck
} from 'lucide-react';
import { Employee, DTOExecution, DTOCategory } from '../types/dto';
import { formatBRDate, isEmployeeAdmittedInMonth, MONTH_NAMES } from '../utils/dateUtils';
import { isCategoryApplicableForEmployee } from '../utils/storage';
import { DTODetailModal } from './DTODetailModal';
import { exportExecutionsToCSV, exportSingleDTOWorkbook } from '../utils/export';

interface DTOCategoryDashboardTabProps {
  category: DTOCategory;
  categories: DTOCategory[];
  employees: Employee[];
  executions: DTOExecution[];
  selectedMonth: number;
  selectedYear: number;
  selectedUnit: string;
  onStartDTOForEmployee?: (employeeId: string, categoryId: string) => void;
  onNavigateToExecution?: () => void;
}

export const DTOCategoryDashboardTab: React.FC<DTOCategoryDashboardTabProps> = ({
  category,
  categories,
  employees,
  executions,
  selectedMonth,
  selectedYear,
  selectedUnit,
  onStartDTOForEmployee,
  onNavigateToExecution
}) => {
  const [periodMode, setPeriodMode] = useState<'month' | 'year' | 'all'>('month');
  const [subView, setSubView] = useState<'evaluations' | 'questions' | 'pending'>('evaluations');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'conforme' | 'nc' | 'coaching'>('all');
  const [selectedExecution, setSelectedExecution] = useState<DTOExecution | null>(null);

  // Active employees in unit
  const unitEmployees = useMemo(() => {
    return employees.filter(e => {
      const matchUnit = selectedUnit === 'Todas as Unidades' || e.unidade === selectedUnit;
      return e.status === 'Ativo' && matchUnit;
    });
  }, [employees, selectedUnit]);

  // Active employees who were admitted by the period
  const admittedUnitEmployees = useMemo(() => {
    if (periodMode === 'month') {
      return unitEmployees.filter(e => isEmployeeAdmittedInMonth(e.dataAdmissao, selectedMonth, selectedYear));
    }
    return unitEmployees;
  }, [unitEmployees, periodMode, selectedMonth, selectedYear]);

  // Executions for this specific category and filtered period/unit
  const categoryExecutions = useMemo(() => {
    return executions.filter(exec => {
      if (exec.categoryId !== category.id) return false;
      if (selectedUnit !== 'Todas as Unidades' && exec.employeeUnit !== selectedUnit) return false;
      
      // Restrict DTO de Baterias e DTO de Carregamento/Descarregamento strictly to Empilhadores
      if (category.id === 'dto-carregamento-baterias' || category.id === 'dto-carregamento-descarregamento') {
        const roleLower = (exec.employeeRole || '').toLowerCase();
        if (!roleLower.includes('empilhadeira') && !roleLower.includes('empilhador') && !roleLower.includes('empilh')) {
          return false;
        }
      }

      // Restrict DTO de Abastecimento strictly to authorized personnel
      if (category.id === 'dto-abastecimento-diesel') {
        const nameNorm = (exec.employeeName || '').toUpperCase();
        if (!nameNorm.includes('DIOGENES') && !nameNorm.includes('DEJEAN')) {
          return false;
        }
      }

      if (periodMode === 'month') {
        return exec.referenceMonth === selectedMonth && exec.referenceYear === selectedYear;
      }
      if (periodMode === 'year') {
        return exec.referenceYear === selectedYear;
      }
      return true;
    });
  }, [executions, category.id, selectedUnit, periodMode, selectedMonth, selectedYear]);

  // Metrics for this category
  const metrics = useMemo(() => {
    let totalConformes = 0;
    let totalNaoConformes = 0;
    let totalCoaching = 0;
    let totalScoreSum = 0;

    categoryExecutions.forEach(exec => {
      totalConformes += exec.conformesCount;
      totalNaoConformes += exec.naoConformesCount;
      totalCoaching += exec.coachingCount;
      totalScoreSum += exec.conformityScore;
    });

    const totalEvaluatedItems = totalConformes + totalNaoConformes;
    const conformityRate = totalEvaluatedItems > 0 
      ? Math.round((totalConformes / totalEvaluatedItems) * 100) 
      : 100;

    const uniqueEmployeesCount = new Set(categoryExecutions.map(e => e.employeeId)).size;

    const targetEmployees = admittedUnitEmployees.filter(e => isCategoryApplicableForEmployee(category, e));
    const targetEvaluatedCount = targetEmployees.filter(emp => 
      categoryExecutions.some(exec => exec.employeeId === emp.id && exec.status === 'Concluído')
    ).length;

    const coverageRate = targetEmployees.length > 0
      ? Math.round((targetEvaluatedCount / targetEmployees.length) * 100)
      : 100;

    return {
      totalExecutions: categoryExecutions.length,
      uniqueEmployeesCount,
      totalConformes,
      totalNaoConformes,
      totalCoaching,
      conformityRate,
      averageScore: categoryExecutions.length > 0 ? Math.round((totalScoreSum / categoryExecutions.length) * 10) / 10 : 100,
      targetEmployeesCount: targetEmployees.length,
      targetEvaluatedCount,
      coverageRate
    };
  }, [categoryExecutions, category, admittedUnitEmployees]);

  // Filtered evaluations for display
  const filteredExecutions = useMemo(() => {
    return categoryExecutions.filter(exec => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = exec.employeeName.toLowerCase().includes(q);
        const matchRole = exec.employeeRole.toLowerCase().includes(q);
        const matchEval = exec.evaluatorName.toLowerCase().includes(q);
        const matchNotes = (exec.notes || '').toLowerCase().includes(q);
        if (!matchName && !matchRole && !matchEval && !matchNotes) return false;
      }

      // Status filter
      if (statusFilter === 'conforme' && exec.naoConformesCount > 0) return false;
      if (statusFilter === 'nc' && exec.naoConformesCount === 0) return false;
      if (statusFilter === 'coaching' && exec.coachingCount === 0) return false;

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [categoryExecutions, searchQuery, statusFilter]);

  // Question by question analysis
  const questionsAnalysis = useMemo(() => {
    return category.questions.map((q, idx) => {
      let conformes = 0;
      let naoConformes = 0;
      let na = 0;
      let coachings = 0;

      categoryExecutions.forEach(exec => {
        const resp = exec.responses.find(r => r.questionId === q.id);
        if (resp) {
          if (resp.status === 'C') conformes++;
          else if (resp.status === 'NC') naoConformes++;
          else if (resp.status === 'NA') na++;

          if (resp.coachingApplied) coachings++;
        }
      });

      const totalValid = conformes + naoConformes;
      const rate = totalValid > 0 ? Math.round((conformes / totalValid) * 100) : 100;

      return {
        question: q,
        index: idx + 1,
        conformes,
        naoConformes,
        na,
        coachings,
        totalValid,
        rate
      };
    });
  }, [category.questions, categoryExecutions]);

  // Pending employees for this specific DTO
  const pendingEmployees = useMemo(() => {
    return admittedUnitEmployees
      .filter(emp => isCategoryApplicableForEmployee(category, emp))
      .filter(emp => {
        const hasDone = categoryExecutions.some(exec => exec.employeeId === emp.id && exec.status === 'Concluído');
        return !hasDone;
      })
      .filter(emp => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return emp.nome.toLowerCase().includes(q) || emp.funcao.toLowerCase().includes(q) || emp.matricula.toLowerCase().includes(q);
      });
  }, [admittedUnitEmployees, category, categoryExecutions, searchQuery]);

  // Get icon for category
  const getCategoryIcon = () => {
    const id = category.id;
    if (id.includes('bateria')) return <BatteryCharging className="w-6 h-6 text-emerald-400" />;
    if (id.includes('nivel') || id.includes('diferente')) return <Layers className="w-6 h-6 text-teal-400" />;
    if (id.includes('transporte') || id.includes('rota')) return <Truck className="w-6 h-6 text-blue-400" />;
    if (id.includes('diesel') || id.includes('abastecimento')) return <Flame className="w-6 h-6 text-amber-400" />;
    if (id.includes('sam') || id.includes('loto')) return <Lock className="w-6 h-6 text-purple-400" />;
    if (id.includes('ergonomia') || id.includes('manuseio')) return <Activity className="w-6 h-6 text-indigo-400" />;
    if (id.includes('epi')) return <HardHat className="w-6 h-6 text-cyan-400" />;
    return <ShieldCheck className="w-6 h-6 text-amber-400" />;
  };

  return (
    <div className="space-y-6">
      
      {/* Category Hero Header */}
      <div className="relative overflow-hidden bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 text-white shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/30">
                {getCategoryIcon()}
              </div>
              <span className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-amber-300 text-xs font-bold tracking-wide">
                {category.questions.length} ITENS DE SEGURANÇA
              </span>
              <span className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-semibold">
                Unidade: {selectedUnit}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
              {category.title}
            </h1>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              {category.description}
            </p>

            {/* Applicable Roles / Specific Designated Collaborators Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {category.id === 'dto-abastecimento-diesel' || (category.requiredForEmployeeNames && category.requiredForEmployeeNames.length > 0) ? (
                <>
                  <span className="text-xs font-semibold text-amber-400 mr-1 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5" />
                    Colaboradores Autorizados / Exclusivos:
                  </span>
                  {(category.requiredForEmployeeNames || ['DIOGENES PEREIRA DA SILVA', 'DEJEAN SILVA DE OLIVEIRA']).map((name, idx) => (
                    <span 
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-bold"
                    >
                      <UserCheck className="w-3 h-3 text-amber-400" />
                      {name}
                    </span>
                  ))}
                </>
              ) : (
                <>
                  <span className="text-xs font-semibold text-slate-400 mr-1">Cargos Exigidos / Monitorados:</span>
                  {category.requiredForRoles && category.requiredForRoles.length > 0 ? (
                    category.requiredForRoles.map((role, idx) => (
                      <span 
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[11px] font-medium"
                      >
                        {role}
                      </span>
                    ))
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium">
                      Todos os Cargos Operacionais
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Action and Period Controls */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 shrink-0">
            {/* Period Selector Tabs */}
            <div className="bg-slate-900/80 p-1 rounded-2xl border border-slate-700/80 flex items-center gap-1 text-xs">
              <button
                onClick={() => setPeriodMode('month')}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                  periodMode === 'month'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {MONTH_NAMES[selectedMonth - 1]}/{selectedYear}
              </button>
              <button
                onClick={() => setPeriodMode('year')}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                  periodMode === 'year'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Ano {selectedYear}
              </button>
              <button
                onClick={() => setPeriodMode('all')}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                  periodMode === 'all'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Histórico Geral
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (onNavigateToExecution) {
                    onNavigateToExecution();
                  }
                }}
                className="flex-1 sm:flex-initial bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-amber-500/20 text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Lançar Este DTO</span>
              </button>

              <button
                onClick={() => exportSingleDTOWorkbook(category, executions, selectedYear, selectedUnit)}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 hover:text-emerald-200 border border-emerald-500/40 text-xs font-bold transition cursor-pointer"
                title="Baixar Planilha Excel (.xlsx) deste DTO com itens e respostas"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Baixar Planilha DTO (.XLSX)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Total Evaluations */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl hover:border-amber-400/40 transition">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Avaliações Realizadas</span>
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">{metrics.totalExecutions}</span>
            <span className="text-xs text-amber-300 font-semibold">
              ({metrics.uniqueEmployeesCount} colaboradores)
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-2">
            DTOs executados e assinados no período.
          </p>
        </div>

        {/* KPI 2: Conformity Score */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl hover:border-amber-400/40 transition">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Conformidade no DTO</span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">{metrics.conformityRate}%</span>
            <span className="text-xs text-emerald-400 font-semibold">Meta: ≥ 95%</span>
          </div>
          <p className="text-slate-400 text-xs mt-2">
            {metrics.totalConformes} itens conformes em {metrics.totalConformes + metrics.totalNaoConformes} checagens.
          </p>
        </div>

        {/* KPI 3: Non-conformities & Coachings */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl hover:border-amber-400/40 transition">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Desvios & Coachings</span>
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">{metrics.totalNaoConformes}</span>
            <span className="text-xs text-amber-300 font-semibold">
              ({metrics.totalCoaching} coachings)
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-2">
            Correções e orientações efetuadas na hora.
          </p>
        </div>

        {/* KPI 4: Coverage of Required Roles */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl hover:border-amber-400/40 transition">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Cobertura dos Cargos</span>
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">{metrics.coverageRate}%</span>
            <span className="text-xs text-slate-400 font-semibold">
              ({metrics.targetEvaluatedCount}/{metrics.targetEmployeesCount})
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div 
              className="bg-blue-400 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: `${metrics.coverageRate}%` }} 
            />
          </div>
        </div>

      </div>

      {/* Sub-View Navigation Tabs */}
      <div className="bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSubView('evaluations')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
              subView === 'evaluations'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>DTOs Feitos por Colaborador</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
              subView === 'evaluations' ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-400'
            }`}>
              {categoryExecutions.length}
            </span>
          </button>

          <button
            onClick={() => setSubView('questions')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
              subView === 'questions'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ListChecks className="w-4 h-4" />
            <span>Raio-X das Perguntas ({category.questions.length})</span>
          </button>

          <button
            onClick={() => setSubView('pending')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
              subView === 'pending'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Colaboradores Pendentes</span>
            {pendingEmployees.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {pendingEmployees.length}
              </span>
            )}
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px] flex-1 max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar colaborador ou cargo..."
            className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
          />
        </div>
      </div>

      {/* SUB-VIEW 1: EVALUATIONS BY COLLABORATOR */}
      {subView === 'evaluations' && (
        <div className="space-y-4">
          
          {/* Quick Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-semibold mr-1">Filtrar:</span>
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-xl font-semibold transition cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-slate-700 text-white border border-slate-600'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Todos ({categoryExecutions.length})
              </button>
              <button
                onClick={() => setStatusFilter('conforme')}
                className={`px-3 py-1 rounded-xl font-semibold transition cursor-pointer ${
                  statusFilter === 'conforme'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                100% Conforme
              </button>
              <button
                onClick={() => setStatusFilter('nc')}
                className={`px-3 py-1 rounded-xl font-semibold transition cursor-pointer ${
                  statusFilter === 'nc'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Com Não Conformidade ({metrics.totalNaoConformes})
              </button>
              <button
                onClick={() => setStatusFilter('coaching')}
                className={`px-3 py-1 rounded-xl font-semibold transition cursor-pointer ${
                  statusFilter === 'coaching'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Com Coaching ({metrics.totalCoaching})
              </button>
            </div>

            <div className="text-slate-400 text-xs">
              Exibindo <strong className="text-white">{filteredExecutions.length}</strong> de {categoryExecutions.length} avaliações
            </div>
          </div>

          {/* Evaluations List Table */}
          {filteredExecutions.length === 0 ? (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center text-slate-400">
              <AlertCircle className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white mb-1">Nenhuma avaliação encontrada para os filtros selecionados</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mb-5">
                Não há registros de <strong className="text-slate-300">{category.title}</strong> para este colaborador ou período selecionado.
              </p>
              {onNavigateToExecution && (
                <button
                  onClick={onNavigateToExecution}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-2 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Realizar Novo Checklist DTO</span>
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-3.5 px-4">Colaborador / Cargo</th>
                      <th className="py-3.5 px-4">Data da Aplicação</th>
                      <th className="py-3.5 px-4">Avaliador SST</th>
                      <th className="py-3.5 px-4 text-center">Conformidade</th>
                      <th className="py-3.5 px-4 text-center">Resumo Itens</th>
                      <th className="py-3.5 px-4">Observações / Coaching</th>
                      <th className="py-3.5 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-xs">
                    {filteredExecutions.map(exec => {
                      const isHigh = exec.conformityScore >= 90;
                      const isMedium = exec.conformityScore >= 75 && exec.conformityScore < 90;
                      const isLow = exec.conformityScore < 75;

                      return (
                        <tr 
                          key={exec.id} 
                          className="hover:bg-white/5 transition-colors group"
                        >
                          {/* Colaborador */}
                          <td className="py-3 px-4">
                            <div className="space-y-0.5">
                              <span className="font-bold text-white group-hover:text-amber-300 transition-colors block">
                                {exec.employeeName}
                              </span>
                              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                                <span>{exec.employeeRole}</span>
                                <span>•</span>
                                <span className="font-mono text-slate-500">{exec.employeeUnit}</span>
                              </div>
                            </div>
                          </td>

                          {/* Data */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="space-y-0.5">
                              <span className="font-semibold text-slate-200">
                                {formatBRDate(exec.date)}
                              </span>
                              <div className="text-[10px] text-slate-400">
                                Mês {MONTH_NAMES[exec.referenceMonth - 1]}/{exec.referenceYear}
                              </div>
                            </div>
                          </td>

                          {/* Avaliador */}
                          <td className="py-3 px-4">
                            <div className="space-y-0.5">
                              <span className="font-medium text-slate-300">{exec.evaluatorName}</span>
                              <div className="text-[10px] text-slate-500">{exec.evaluatorRole || 'Avaliador'}</div>
                            </div>
                          </td>

                          {/* Conformidade Badge */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="inline-flex flex-col items-center">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-black border ${
                                isHigh
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : isMedium
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              }`}>
                                {exec.conformityScore}%
                              </span>
                            </div>
                          </td>

                          {/* Resumo Itens */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2 text-[11px]">
                              <span className="text-emerald-400 font-semibold" title="Itens Conformes">
                                {exec.conformesCount} C
                              </span>
                              <span>•</span>
                              <span className={exec.naoConformesCount > 0 ? 'text-rose-400 font-bold' : 'text-slate-500'} title="Não Conformes">
                                {exec.naoConformesCount} NC
                              </span>
                              {exec.coachingCount > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-amber-400 font-bold" title="Coachings Aplicados">
                                    {exec.coachingCount} Coaching
                                  </span>
                                </>
                              )}
                            </div>
                          </td>

                          {/* Observações */}
                          <td className="py-3 px-4 max-w-xs">
                            {exec.notes ? (
                              <p className="text-slate-300 line-clamp-2 text-[11px] italic" title={exec.notes}>
                                "{exec.notes}"
                              </p>
                            ) : (
                              <span className="text-slate-500 text-[11px] italic">Sem observações</span>
                            )}
                          </td>

                          {/* Ações */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setSelectedExecution(exec)}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition active:scale-95 cursor-pointer"
                                title="Ver checklist completo com todas as perguntas e respostas"
                              >
                                <Eye className="w-3.5 h-3.5 text-amber-400" />
                                <span>Ver Checklist</span>
                              </button>

                              {onStartDTOForEmployee && (
                                <button
                                  onClick={() => onStartDTOForEmployee(exec.employeeId, category.id)}
                                  className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-amber-500/30 transition active:scale-95 cursor-pointer"
                                  title="Lançar nova avaliação deste DTO para este colaborador"
                                >
                                  + Reaplicar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW 2: QUESTIONS RAIO-X BREAKDOWN */}
      {subView === 'questions' && (
        <div className="space-y-4">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-amber-400" />
                  Estatísticas Detalhadas por Pergunta ({category.questions.length} Itens)
                </h3>
                <p className="text-xs text-slate-400">
                  Desempenho histórico de conformidade e itens críticos de segurança avaliados neste checklist
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-xl bg-slate-800 text-slate-300 border border-slate-700">
                Total de {categoryExecutions.length} auditorias analisadas
              </span>
            </div>

            <div className="space-y-3">
              {questionsAnalysis.map((item) => {
                const hasIssues = item.naoConformes > 0 || item.coachings > 0;
                return (
                  <div
                    key={item.question.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      hasIssues
                        ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                            #{item.index}
                          </span>
                          <span className="text-sm font-semibold text-slate-100">
                            {item.question.questionText}
                          </span>
                        </div>
                      </div>

                      {/* Stats Badges */}
                      <div className="flex items-center gap-3 shrink-0 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                            {item.conformes} C
                          </span>
                          {item.naoConformes > 0 && (
                            <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 animate-pulse">
                              {item.naoConformes} NC
                            </span>
                          )}
                          {item.coachings > 0 && (
                            <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                              {item.coachings} Coachings
                            </span>
                          )}
                        </div>

                        {/* Question Conformity Score */}
                        <div className="text-right min-w-[70px]">
                          <span className={`text-base font-black ${
                            item.rate >= 90 ? 'text-emerald-400' : item.rate >= 75 ? 'text-amber-400' : 'text-rose-400'
                          }`}>
                            {item.rate}%
                          </span>
                          <span className="block text-[10px] text-slate-500 font-medium">Conformidade</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          item.rate >= 90 ? 'bg-emerald-400' : item.rate >= 75 ? 'bg-amber-400' : 'bg-rose-500'
                        }`}
                        style={{ width: `${item.rate}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: PENDING EMPLOYEES */}
      {subView === 'pending' && (
        <div className="space-y-4">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-400" />
                  Colaboradores Elegíveis Pendentes deste DTO
                </h3>
                <p className="text-xs text-slate-400">
                  Colaboradores ativos nos cargos exigidos que ainda não realizaram este checklist no período ({MONTH_NAMES[selectedMonth - 1]}/{selectedYear})
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {pendingEmployees.length} Pendentes
              </span>
            </div>

            {pendingEmployees.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <h4 className="text-base font-bold text-white mb-1">100% de Cobertura Concluída!</h4>
                <p className="text-xs text-slate-400">
                  Todos os colaboradores dos cargos monitorados já executaram este DTO no período.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {pendingEmployees.map(emp => (
                  <div
                    key={emp.id}
                    className="bg-slate-900/70 border border-slate-800 hover:border-amber-500/40 p-4 rounded-2xl flex flex-col justify-between gap-3 transition group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm group-hover:text-amber-300 transition-colors">
                          {emp.nome}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                          {emp.matricula}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">{emp.funcao}</p>
                      <p className="text-[11px] text-slate-500">{emp.setor} • {emp.unidade}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Pendente no período
                      </span>

                      {onStartDTOForEmployee && (
                        <button
                          onClick={() => onStartDTOForEmployee(emp.id, category.id)}
                          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-md shadow-amber-500/10"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Lançar DTO</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* DTODetailModal for viewing full checklist */}
      {selectedExecution && (
        <DTODetailModal
          execution={selectedExecution}
          category={category}
          onClose={() => setSelectedExecution(null)}
          onNewDTO={onStartDTOForEmployee}
        />
      )}

    </div>
  );
};
