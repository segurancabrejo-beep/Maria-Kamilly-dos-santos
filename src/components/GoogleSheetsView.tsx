import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Copy, 
  Check, 
  ExternalLink, 
  Sparkles, 
  FileText, 
  Table, 
  Search, 
  Filter, 
  Users, 
  Layers, 
  Calendar, 
  CheckCircle2,
  ShieldCheck,
  ArrowUpRight,
  Info,
  RefreshCw,
  FolderDown,
  ChevronDown
} from 'lucide-react';
import { Employee, DTOExecution, DTOCategory } from '../types/dto';
import { 
  exportGoogleSheetsWorkbook, 
  exportSingleDTOWorkbook,
  exportExecutionsToCSV, 
  exportFarolMatrixToCSV, 
  copyTableToGoogleSheetsClipboard 
} from '../utils/export';
import { generateAllPendingDTOs } from '../utils/autoFillPending';
import { isEmployeeMonitoredForDTO, isRoleExcludedFromDTO } from '../utils/employeeFilter';
import { MONTH_NAMES } from '../utils/dateUtils';

interface GoogleSheetsViewProps {
  employees: Employee[];
  categories: DTOCategory[];
  executions: DTOExecution[];
  onUpdateExecutions: (newExecutions: DTOExecution[]) => void;
  selectedMonth: number;
  selectedYear: number;
  selectedUnit: string;
}

type SubTabType = 'by_dto' | 'dto_matrix' | 'summary' | 'base' | 'farol' | 'qlp';

export const GoogleSheetsView: React.FC<GoogleSheetsViewProps> = ({
  employees,
  categories,
  executions,
  onUpdateExecutions,
  selectedMonth,
  selectedYear,
  selectedUnit
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('by_dto');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDTOId, setSelectedDTOId] = useState<string>(categories[0]?.id || 'dto-epi');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [fillFeedback, setFillFeedback] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const activeEmployees = useMemo(() => {
    return employees.filter(e => 
      e.status === 'Ativo' && 
      isEmployeeMonitoredForDTO(e) &&
      (selectedUnit === 'Todas as Unidades' || e.unidade === selectedUnit)
    );
  }, [employees, selectedUnit]);

  // Selected Category Object
  const currentCategory = useMemo(() => {
    return categories.find(c => c.id === selectedDTOId) || categories[0];
  }, [categories, selectedDTOId]);

  // Handle Fill All Pending DTOs (excluding Relatos)
  const handleAutoFillPending = () => {
    const result = generateAllPendingDTOs(employees, categories, executions, selectedYear, 8);
    if (result.filledCount > 0) {
      const merged = [...executions, ...result.newExecutions];
      onUpdateExecutions(merged);
      setFillFeedback(`Sucesso! ${result.filledCount} gabaritos pendentes foram preenchidos (exceto relatos) para ${result.employeesCovered} colaboradores até Agosto/${selectedYear}.`);
      setTimeout(() => setFillFeedback(null), 6000);
    } else {
      setFillFeedback('Todos os colaboradores já possuem gabaritos preenchidos para os meses aplicáveis até Agosto/' + selectedYear + '!');
      setTimeout(() => setFillFeedback(null), 4000);
    }
  };

  // Download Main Workbook (.xlsx) Organized by DTO
  const handleDownloadFullWorkbook = () => {
    exportGoogleSheetsWorkbook(
      employees, 
      executions, 
      categories, 
      selectedYear, 
      selectedUnit, 
      `Planilha_DTO_Grupo_Pau_Brasil_por_DTO_${selectedYear}.xlsx`
    );
  };

  // Download Single DTO Workbook
  const handleDownloadSingleDTO = (catId?: string) => {
    const target = categories.find(c => c.id === (catId || selectedDTOId)) || currentCategory;
    if (target) {
      exportSingleDTOWorkbook(target, executions, selectedYear, selectedUnit);
    }
  };

  // Copy Specific DTO Table to Clipboard
  const handleCopyCurrentDTOTable = async () => {
    if (!currentCategory) return;
    const catExecs = executions.filter(e => {
      if (e.categoryId !== currentCategory.id) return false;
      if (currentCategory.id !== 'dto-relatos' && isRoleExcludedFromDTO(e.employeeRole)) return false;
      if (selectedUnit !== 'Todas as Unidades' && e.employeeUnit !== selectedUnit) return false;
      if (currentCategory.id === 'dto-carregamento-baterias' || currentCategory.id === 'dto-carregamento-descarregamento') {
        const roleLower = (e.employeeRole || '').toLowerCase();
        if (!roleLower.includes('empilhadeira') && !roleLower.includes('empilhador') && !roleLower.includes('empilh')) {
          return false;
        }
      }
      if (currentCategory.id === 'dto-abastecimento-diesel') {
        const nameNorm = (e.employeeName || '').toUpperCase();
        if (!nameNorm.includes('DIOGENES') && !nameNorm.includes('DEJEAN')) {
          return false;
        }
      }
      return true;
    });

    const headers = [
      'ID Execução',
      'Data',
      'Mês/Ano',
      'Matrícula',
      'Colaborador',
      'Função',
      'Unidade',
      'Avaliador',
      'Conformidade (%)',
      'Status',
      'Conformes (C)',
      'Não Conformes (NC)',
      'Não Aplicáveis (NA)',
      'Coaching',
      ...currentCategory.questions.map((q, idx) => `Item ${idx + 1}: ${q.questionText}`),
      'Observações'
    ];

    const rows = catExecs.map(e => {
      const qCols = currentCategory.questions.map(q => {
        const resp = e.responses.find(r => r.questionId === q.id);
        if (resp) {
          const val = resp.status === 'C' ? 'C' : resp.status === 'NC' ? 'NC' : 'NA';
          return resp.observation ? `${val} (${resp.observation})` : val;
        }
        return '-';
      });

      return [
        e.id,
        e.date,
        `${e.referenceMonth}/${e.referenceYear}`,
        e.employeeId,
        e.employeeName,
        e.employeeRole,
        e.employeeUnit,
        e.evaluatorName,
        `${e.conformityScore.toFixed(1)}%`,
        e.status,
        e.conformesCount,
        e.naoConformesCount,
        e.naCount,
        e.coachingCount,
        ...qCols,
        e.notes || ''
      ];
    });

    const success = await copyTableToGoogleSheetsClipboard(headers, rows);
    if (success) {
      setCopiedSection('current_dto');
      setTimeout(() => setCopiedSection(null), 3000);
    }
  };

  // Copy DTO Monthly Matrix to Clipboard
  const handleCopyDTOMatrix = async () => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const headers = [
      'Código',
      'Tipo de DTO',
      'Cargos Elegíveis',
      ...months.map(m => `Qtd ${m}`),
      ...months.map(m => `% Conf ${m}`),
      'Total Ano',
      '% Anual'
    ];

    const rows = categories.map(cat => {
      let totalAno = 0;
      let sumScoreAno = 0;
      const countCols: number[] = [];
      const scoreCols: string[] = [];

      for (let m = 1; m <= 12; m++) {
        const mExecs = executions.filter(e => 
          e.categoryId === cat.id && 
          e.referenceMonth === m && 
          e.referenceYear === selectedYear &&
          e.status === 'Concluído' &&
          (selectedUnit === 'Todas as Unidades' || e.employeeUnit === selectedUnit)
        );
        const count = mExecs.length;
        totalAno += count;
        countCols.push(count);

        if (count > 0) {
          const avg = mExecs.reduce((acc, c) => acc + c.conformityScore, 0) / count;
          sumScoreAno += mExecs.reduce((acc, c) => acc + c.conformityScore, 0);
          scoreCols.push(`${avg.toFixed(0)}%`);
        } else {
          scoreCols.push('-');
        }
      }

      return [
        cat.id,
        cat.title,
        cat.requiredForRoles && cat.requiredForRoles.length > 0 ? cat.requiredForRoles.join(', ') : 'Geral',
        ...countCols,
        ...scoreCols,
        totalAno,
        totalAno > 0 ? `${(sumScoreAno / totalAno).toFixed(1)}%` : '-'
      ];
    });

    const success = await copyTableToGoogleSheetsClipboard(headers, rows);
    if (success) {
      setCopiedSection('dto_matrix');
      setTimeout(() => setCopiedSection(null), 3000);
    }
  };

  // Open sheets.new in new tab
  const handleOpenGoogleSheetsNew = () => {
    window.open('https://sheets.new', '_blank');
  };

  // Filtered executions for current DTO
  const filteredCurrentDTOExecutions = useMemo(() => {
    return executions.filter(e => {
      if (e.categoryId !== selectedDTOId) return false;
      if (selectedDTOId !== 'dto-relatos' && isRoleExcludedFromDTO(e.employeeRole)) return false;
      if (selectedUnit !== 'Todas as Unidades' && e.employeeUnit !== selectedUnit) return false;

      // Restrict DTO de Baterias e DTO de Carregamento/Descarregamento strictly to Empilhadores
      if (selectedDTOId === 'dto-carregamento-baterias' || selectedDTOId === 'dto-carregamento-descarregamento') {
        const roleLower = (e.employeeRole || '').toLowerCase();
        if (!roleLower.includes('empilhadeira') && !roleLower.includes('empilhador') && !roleLower.includes('empilh')) {
          return false;
        }
      }

      // Restrict DTO de Abastecimento strictly to authorized personnel
      if (selectedDTOId === 'dto-abastecimento-diesel') {
        const nameNorm = (e.employeeName || '').toUpperCase();
        if (!nameNorm.includes('DIOGENES') && !nameNorm.includes('DEJEAN')) {
          return false;
        }
      }

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchName = e.employeeName.toLowerCase().includes(term);
        const matchRole = e.employeeRole.toLowerCase().includes(term);
        const matchId = e.employeeId.toLowerCase().includes(term);
        const matchEval = e.evaluatorName.toLowerCase().includes(term);
        if (!matchName && !matchRole && !matchId && !matchEval) return false;
      }
      return true;
    });
  }, [executions, selectedDTOId, selectedUnit, searchTerm]);

  // Pagination for current DTO
  const totalPagesCurrentDTO = Math.ceil(filteredCurrentDTOExecutions.length / itemsPerPage) || 1;
  const paginatedCurrentDTOExecutions = filteredCurrentDTOExecutions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const monthsHeader = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 border border-emerald-500/30 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold tracking-wide">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              PLANILHAS & EXPORTAÇÃO POR TIPO DE DTO
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Exportação para Planilhas Estruturadas por DTO
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Baixe a base organizada <span className="text-emerald-400 font-semibold">por tipo de DTO</span> com abas dedicadas para cada checklist (EPI, Telemetria, Manuseio Seguro, 5S, Diesel, Relatos), matrizes mensais consolidadas e gabaritos completos de perguntas e respostas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleDownloadFullWorkbook}
              className="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Baixar Todas as Planilhas por DTO (.XLSX)
            </button>

            <button
              onClick={handleOpenGoogleSheetsNew}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-medium text-sm transition-all cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 text-emerald-400" />
              Abrir Google Sheets
            </button>

            <button
              onClick={handleAutoFillPending}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-semibold text-sm transition-all cursor-pointer"
              title="Preenche automaticamente todos os colaboradores pendentes nos 12 meses com gabaritos conformes (exceto relatos)"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              Preencher Pendentes
            </button>
          </div>
        </div>

        {/* Feedback Alert if Action Performed */}
        {fillFeedback && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{fillFeedback}</span>
          </div>
        )}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-white/10">
          <div className="p-3 rounded-xl bg-white/5 border border-white/5">
            <span className="text-xs text-slate-400 block font-medium">Categorias de DTO Ativas</span>
            <span className="text-xl font-extrabold text-teal-300">{categories.length}</span>
            <span className="text-[11px] text-slate-400 block">planilhas e checklists</span>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/5">
            <span className="text-xs text-slate-400 block font-medium">Total de Avaliações DTO</span>
            <span className="text-xl font-extrabold text-emerald-400">{executions.length}</span>
            <span className="text-[11px] text-slate-400 block">gabaritos preenchidos</span>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/5">
            <span className="text-xs text-slate-400 block font-medium">Colaboradores Monitorados</span>
            <span className="text-xl font-extrabold text-white">{activeEmployees.length}</span>
            <span className="text-[11px] text-slate-400 block">em {selectedUnit}</span>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/5">
            <span className="text-xs text-slate-400 block font-medium">Ciclo / Exercício</span>
            <span className="text-xl font-extrabold text-amber-400">{selectedYear}</span>
            <span className="text-[11px] text-slate-400 block">12 meses de rotinas</span>
          </div>
        </div>
      </div>

      {/* Quick Actions / Download Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Baixar DTO Selecionado */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <FolderDown className="w-4 h-4" />
              Baixar DTO Selecionado (.XLSX)
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Faça o download da planilha individual contendo apenas os dados, itens e respostas de <strong className="text-white">{currentCategory?.title}</strong>.
            </p>
            <div className="pt-1">
              <select
                value={selectedDTOId}
                onChange={e => { setSelectedDTOId(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={() => handleDownloadSingleDTO()}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Baixar {currentCategory?.title.replace('DTO - ', '')} (.xlsx)
          </button>
        </div>

        {/* Card 2: Copiar Matriz Mensal por DTO */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-teal-400 font-bold text-sm">
              <Copy className="w-4 h-4" />
              Copiar Matriz por DTO (Ctrl+V)
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Copie o consolidado mensal de todos os DTOs nos 12 meses (quantidade e % conformidade) para colar direto no Google Sheets.
            </p>
          </div>
          <button
            onClick={handleCopyDTOMatrix}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 text-xs font-bold transition-all cursor-pointer"
          >
            {copiedSection === 'dto_matrix' ? (
              <>
                <Check className="w-3.5 h-3.5 text-teal-400" />
                <span>Copiado com Sucesso!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Matriz Mensal por DTO (TSV)</span>
              </>
            )}
          </button>
        </div>

        {/* Card 3: Copiar Gabaritos deste DTO */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
              <Table className="w-4 h-4" />
              Copiar Tabela deste DTO com Questões
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Copie todas as avaliações de <strong className="text-white">{currentCategory?.title}</strong> com colunas para cada uma das perguntas e observações.
            </p>
          </div>
          <button
            onClick={handleCopyCurrentDTOTable}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs font-bold transition-all cursor-pointer"
          >
            {copiedSection === 'current_dto' ? (
              <>
                <Check className="w-3.5 h-3.5 text-indigo-400" />
                <span>Copiado com Sucesso!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Gabaritos com Questões (TSV)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Interactive Sheet Navigation & Table Viewer */}
      <div className="rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-xl overflow-hidden shadow-xl">
        {/* Sub Navigation Tabs */}
        <div className="border-b border-slate-800 bg-slate-950/40 p-4 sm:flex sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
            <button
              onClick={() => { setActiveSubTab('by_dto'); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeSubTab === 'by_dto'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              Planilhas por DTO (Gabarito & Itens)
            </button>

            <button
              onClick={() => { setActiveSubTab('dto_matrix'); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeSubTab === 'dto_matrix'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Matriz Mensal por DTO
            </button>

            <button
              onClick={() => { setActiveSubTab('summary'); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeSubTab === 'summary'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Resumo por DTO
            </button>

            <button
              onClick={() => { setActiveSubTab('base'); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeSubTab === 'base'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Base Geral DTOs ({executions.length})
            </button>

            <button
              onClick={() => { setActiveSubTab('farol'); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeSubTab === 'farol'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Farol Colaboradores
            </button>
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-2 mt-3 sm:mt-0">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar colaborador, cargo..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Tab Content 1: Planilha do DTO Selecionado com Respostas por Item */}
        {activeSubTab === 'by_dto' && (
          <div className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-800/40 p-3 rounded-xl border border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold">Visualizando Checklist:</span>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedDTOId(c.id); setCurrentPage(1); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        selectedDTOId === c.id 
                          ? 'bg-emerald-500 text-slate-950 shadow'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {c.title.replace('DTO - ', '')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleDownloadSingleDTO(selectedDTOId)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold border border-emerald-500/40 cursor-pointer"
                >
                  <Download className="w-3 h-3 text-emerald-400" />
                  Baixar Este DTO (.XLSX)
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-400">
              Mostrando <span className="text-white font-bold">{filteredCurrentDTOExecutions.length}</span> avaliações de <span className="text-emerald-400 font-bold">{currentCategory?.title}</span> (Página {currentPage} de {totalPagesCurrentDTO})
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800/80 text-slate-300 font-semibold border-b border-slate-700">
                    <th className="p-3 sticky left-0 bg-slate-800 z-10 min-w-[160px]">Colaborador</th>
                    <th className="p-3 min-w-[130px]">Função</th>
                    <th className="p-3 min-w-[90px]">Data</th>
                    <th className="p-3 min-w-[90px]">Mês/Ano</th>
                    <th className="p-3 min-w-[130px]">Avaliador</th>
                    <th className="p-3 text-center min-w-[90px]">Conformidade</th>
                    {currentCategory?.questions.map((q, idx) => (
                      <th key={q.id} className="p-2.5 text-center min-w-[140px] border-l border-slate-700/50" title={q.questionText}>
                        <span className="block font-bold text-teal-300">Item {idx + 1}</span>
                        <span className="text-[10px] text-slate-400 line-clamp-1">{q.questionText}</span>
                      </th>
                    ))}
                    <th className="p-3 min-w-[180px] border-l border-slate-700">Observações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {paginatedCurrentDTOExecutions.length > 0 ? (
                    paginatedCurrentDTOExecutions.map(exec => (
                      <tr key={exec.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3 font-bold text-white sticky left-0 bg-slate-900 z-10">{exec.employeeName}</td>
                        <td className="p-3 text-slate-300">{exec.employeeRole}</td>
                        <td className="p-3 font-mono text-slate-400">{exec.date}</td>
                        <td className="p-3 text-slate-300">{MONTH_NAMES[exec.referenceMonth - 1] || exec.referenceMonth}/{exec.referenceYear}</td>
                        <td className="p-3 text-slate-300">{exec.evaluatorName}</td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            exec.conformityScore >= 90 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {exec.conformityScore.toFixed(1)}%
                          </span>
                        </td>

                        {/* Question response columns */}
                        {currentCategory?.questions.map(q => {
                          const resp = exec.responses.find(r => r.questionId === q.id);
                          if (!resp) {
                            return <td key={q.id} className="p-2 text-center border-l border-slate-800 text-slate-500">-</td>;
                          }
                          const isC = resp.status === 'C';
                          const isNC = resp.status === 'NC';
                          return (
                            <td key={q.id} className={`p-2 text-center border-l border-slate-800 ${
                              isC ? 'bg-emerald-500/5 text-emerald-300' : isNC ? 'bg-rose-500/10 text-rose-300' : 'text-slate-400'
                            }`}>
                              <span className="font-bold text-[11px]">
                                {isC ? 'C' : isNC ? 'NC' : 'NA'}
                              </span>
                              {resp.observation && (
                                <span className="block text-[9px] text-amber-300/80 truncate max-w-[120px]" title={resp.observation}>
                                  {resp.observation}
                                </span>
                              )}
                            </td>
                          );
                        })}

                        <td className="p-3 text-slate-400 text-xs border-l border-slate-700 max-w-[220px] truncate" title={exec.notes}>
                          {exec.notes || 'Conforme'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7 + (currentCategory?.questions.length || 0)} className="p-8 text-center text-slate-400">
                        Nenhuma avaliação encontrada para este DTO com os filtros atuais.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPagesCurrentDTO > 1 && (
              <div className="flex items-center justify-between pt-3">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  Anterior
                </button>
                <span className="text-xs text-slate-400 font-medium">
                  Página {currentPage} de {totalPagesCurrentDTO}
                </span>
                <button
                  disabled={currentPage === totalPagesCurrentDTO}
                  onClick={() => setCurrentPage(prev => Math.min(totalPagesCurrentDTO, prev + 1))}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  Próxima
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab Content 2: Matriz Mensal por DTO (DTO x 12 Meses) */}
        {activeSubTab === 'dto_matrix' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-400">
                Acompanhamento consolidado de cada DTO ao longo dos 12 meses de {selectedYear}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyDTOMatrix}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
                >
                  <Copy className="w-3 h-3 text-teal-400" />
                  Copiar Matriz
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800/80 text-slate-300 font-semibold border-b border-slate-700">
                    <th className="p-3 sticky left-0 bg-slate-800 z-10 min-w-[200px]">Tipo de DTO</th>
                    <th className="p-3 min-w-[180px]">Público Alvo</th>
                    {monthsHeader.map((m, idx) => (
                      <th key={idx} className="p-2.5 text-center min-w-[95px] border-l border-slate-700/50">
                        {m}/{selectedYear}
                      </th>
                    ))}
                    <th className="p-3 text-center min-w-[80px] bg-slate-800/90 border-l border-slate-700">Total Ano</th>
                    <th className="p-3 text-center min-w-[80px] bg-slate-800/90">% Média</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {categories.map(cat => {
                    let totalAno = 0;
                    let sumScoreAno = 0;

                    return (
                      <tr key={cat.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3 font-bold text-white sticky left-0 bg-slate-900 z-10">{cat.title}</td>
                        <td className="p-3 text-slate-300 text-[11px]">
                          {cat.id === 'dto-abastecimento-diesel' ? (
                            <span className="text-amber-400 font-bold">Diógenes Pereira / Dejean Silva</span>
                          ) : cat.requiredForRoles && cat.requiredForRoles.length > 0 ? (
                            cat.requiredForRoles.join(', ')
                          ) : (
                            'Geral'
                          )}
                        </td>

                        {monthsHeader.map((_, idx) => {
                          const m = idx + 1;
                          const mExecs = executions.filter(e => 
                            e.categoryId === cat.id && 
                            e.referenceMonth === m && 
                            e.referenceYear === selectedYear &&
                            e.status === 'Concluído' &&
                            (selectedUnit === 'Todas as Unidades' || e.employeeUnit === selectedUnit)
                          );

                          const count = mExecs.length;
                          totalAno += count;

                          if (count > 0) {
                            const avg = mExecs.reduce((acc, c) => acc + c.conformityScore, 0) / count;
                            sumScoreAno += mExecs.reduce((acc, c) => acc + c.conformityScore, 0);
                            return (
                              <td key={idx} className="p-2 text-center border-l border-slate-800 bg-emerald-500/10">
                                <span className="block font-bold text-[11px] text-emerald-300">
                                  {count} aval.
                                </span>
                                <span className="text-[10px] font-bold text-emerald-400">
                                  {avg.toFixed(0)}%
                                </span>
                              </td>
                            );
                          }

                          return (
                            <td key={idx} className="p-2 text-center border-l border-slate-800 bg-slate-900/40 text-slate-500">
                              -
                            </td>
                          );
                        })}

                        <td className="p-3 text-center font-extrabold text-white border-l border-slate-700 bg-slate-900/50">
                          {totalAno}
                        </td>
                        <td className="p-3 text-center font-extrabold text-emerald-400 bg-slate-900/50">
                          {totalAno > 0 ? `${(sumScoreAno / totalAno).toFixed(1)}%` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content 3: Resumo Consolidado por DTO */}
        {activeSubTab === 'summary' && (
          <div className="p-4 space-y-4">
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800/80 text-slate-300 font-semibold border-b border-slate-700">
                    <th className="p-3">Tipo de DTO</th>
                    <th className="p-3">Descrição Operacional</th>
                    <th className="p-3 text-center">Nº Perguntas</th>
                    <th className="p-3 text-center">Total Execuções</th>
                    <th className="p-3 text-center">Conformidade Média</th>
                    <th className="p-3">Cargos / Público-Alvo</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {categories.map(cat => {
                    const catExecs = executions.filter(e => 
                      e.categoryId === cat.id && 
                      (selectedUnit === 'Todas as Unidades' || e.employeeUnit === selectedUnit)
                    );
                    const avgScore = catExecs.length > 0 
                      ? (catExecs.reduce((acc, c) => acc + c.conformityScore, 0) / catExecs.length).toFixed(1)
                      : '0.0';

                    return (
                      <tr key={cat.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3 font-bold text-white min-w-[200px]">{cat.title}</td>
                        <td className="p-3 text-slate-400 max-w-md">{cat.description}</td>
                        <td className="p-3 text-center font-mono text-slate-300">{cat.questions.length}</td>
                        <td className="p-3 text-center font-extrabold text-emerald-400">{catExecs.length}</td>
                        <td className="p-3 text-center">
                          <span className="inline-flex px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold">
                            {avgScore}%
                          </span>
                        </td>
                        <td className="p-3 text-slate-300">
                          {cat.id === 'dto-abastecimento-diesel' ? (
                            <span className="text-amber-400 font-bold">Exclusivo: Diógenes Pereira e Dejean Silva</span>
                          ) : cat.requiredForRoles && cat.requiredForRoles.length > 0 ? (
                            cat.requiredForRoles.join(', ')
                          ) : (
                            <span className="text-slate-400">Todos os Cargos Operacionais</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleDownloadSingleDTO(cat.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-[11px] font-bold border border-emerald-500/30 transition cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            XLSX
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content 4: Base Geral DTOs */}
        {activeSubTab === 'base' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-400">
                Mostrando <span className="text-white font-bold">{executions.length}</span> DTOs executados
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportExecutionsToCSV(executions)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
                >
                  <Download className="w-3 h-3 text-emerald-400" />
                  Exportar CSV Geral
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800/80 text-slate-300 font-semibold border-b border-slate-700">
                    <th className="p-3">Tipo de DTO</th>
                    <th className="p-3">Data</th>
                    <th className="p-3">Mês/Ano</th>
                    <th className="p-3">Colaborador</th>
                    <th className="p-3">Função</th>
                    <th className="p-3">Avaliador (SST)</th>
                    <th className="p-3 text-center">Conformidade</th>
                    <th className="p-3 text-center">Perguntas (C / NC)</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {executions.slice(0, 50).map(exec => (
                    <tr key={exec.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3 font-semibold text-teal-300">{exec.categoryTitle}</td>
                      <td className="p-3 font-mono text-slate-400">{exec.date}</td>
                      <td className="p-3 text-slate-300">{MONTH_NAMES[exec.referenceMonth - 1] || exec.referenceMonth}/{exec.referenceYear}</td>
                      <td className="p-3 font-bold text-white">{exec.employeeName}</td>
                      <td className="p-3 text-slate-300">{exec.employeeRole}</td>
                      <td className="p-3 text-slate-300">{exec.evaluatorName}</td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          exec.conformityScore >= 90 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {exec.conformityScore.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono text-slate-300">
                        <span className="text-emerald-400 font-bold">{exec.conformesCount}C</span> / <span className="text-rose-400 font-bold">{exec.naoConformesCount}NC</span>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                          <Check className="w-2.5 h-2.5" /> Concluído
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content 5: Farol Colaboradores */}
        {activeSubTab === 'farol' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-400">
                Mostrando <span className="text-white font-bold">{
                  activeEmployees.filter(e => !searchTerm || e.nome.toLowerCase().includes(searchTerm.toLowerCase()) || e.matricula.toLowerCase().includes(searchTerm.toLowerCase()) || e.funcao.toLowerCase().includes(searchTerm.toLowerCase())).length
                }</span> colaboradores monitorados em {selectedYear}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportFarolMatrixToCSV(employees, executions, selectedYear, selectedUnit)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
                >
                  <Download className="w-3 h-3 text-emerald-400" />
                  Exportar Farol CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800/80 text-slate-300 font-semibold border-b border-slate-700">
                    <th className="p-3 sticky left-0 bg-slate-800 z-10">Matrícula</th>
                    <th className="p-3 sticky left-24 bg-slate-800 z-10 min-w-[200px]">Nome do Colaborador</th>
                    <th className="p-3 min-w-[150px]">Função</th>
                    {monthsHeader.map((m, idx) => (
                      <th key={idx} className="p-2.5 text-center min-w-[110px] border-l border-slate-700/50">
                        {m}/{selectedYear}
                      </th>
                    ))}
                    <th className="p-3 text-center min-w-[80px] bg-slate-800/90 border-l border-slate-700">Total</th>
                    <th className="p-3 text-center min-w-[80px] bg-slate-800/90">Média %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {activeEmployees
                    .filter(e => !searchTerm || e.nome.toLowerCase().includes(searchTerm.toLowerCase()) || e.matricula.toLowerCase().includes(searchTerm.toLowerCase()) || e.funcao.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(emp => {
                    let doneCount = 0;
                    let scoreSum = 0;

                    return (
                      <tr key={emp.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3 font-mono text-slate-400 sticky left-0 bg-slate-900 z-10">{emp.matricula || emp.id}</td>
                        <td className="p-3 font-bold text-white sticky left-24 bg-slate-900 z-10">{emp.nome}</td>
                        <td className="p-3 text-slate-300">{emp.funcao}</td>

                        {monthsHeader.map((_, idx) => {
                          const m = idx + 1;
                          const empNameClean = emp.nome.trim().toLowerCase();
                          const exec = executions.find(e => 
                            (e.employeeId === emp.id || 
                             e.employeeName?.trim().toLowerCase() === empNameClean ||
                             (e.employeeName && empNameClean.includes(e.employeeName.trim().toLowerCase()))) && 
                            e.referenceMonth === m && 
                            e.referenceYear === selectedYear &&
                            e.status === 'Concluído'
                          );

                          if (exec) {
                            doneCount++;
                            scoreSum += exec.conformityScore;
                            return (
                              <td key={idx} className="p-2 text-center border-l border-slate-800 bg-emerald-500/10">
                                <span className="block font-bold text-[11px] text-emerald-300 truncate max-w-[110px]" title={exec.categoryTitle}>
                                  {exec.categoryTitle.replace('DTO - ', '')}
                                </span>
                                <span className="text-[10px] font-bold text-emerald-400">
                                  {exec.conformityScore.toFixed(0)}%
                                </span>
                              </td>
                            );
                          }

                          return (
                            <td key={idx} className="p-2 text-center border-l border-slate-800 bg-amber-500/5">
                              <span className="text-[10px] font-semibold text-amber-400/70">
                                PENDENTE
                              </span>
                            </td>
                          );
                        })}

                        <td className="p-3 text-center font-extrabold text-white border-l border-slate-700 bg-slate-900/50">
                          {doneCount} / 12
                        </td>
                        <td className="p-3 text-center font-extrabold text-emerald-400 bg-slate-900/50">
                          {doneCount > 0 ? `${(scoreSum / doneCount).toFixed(0)}%` : '-'}
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
    </div>
  );
};
