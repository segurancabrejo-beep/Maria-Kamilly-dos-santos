import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Printer, 
  Search, 
  Filter, 
  Download, 
  Upload,
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  XCircle, 
  MinusCircle, 
  User, 
  Calendar,
  Eye,
  X,
  ShieldCheck,
  Building,
  FileText,
  AlertCircle,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { DTOExecution, Employee, DTOCategory } from '../types/dto';
import { exportExecutionsToCSV, exportDetailedResponsesToCSV, printElement } from '../utils/export';
import { isRoleExcludedFromDTO, isEmployeeMonitoredForDTO } from '../utils/employeeFilter';

interface ReportsViewProps {
  executions: DTOExecution[];
  employees: Employee[];
  categories: DTOCategory[];
  selectedMonth: number;
  selectedYear: number;
  selectedUnit: string;
  onImportExecutions?: (newExecs: DTOExecution[]) => void;
  onDeleteExecution?: (id: string) => void;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const ReportsView: React.FC<ReportsViewProps> = ({
  executions,
  employees,
  categories,
  selectedMonth,
  selectedYear,
  selectedUnit,
  onImportExecutions,
  onDeleteExecution
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('Todas');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [scoreFilter, setScoreFilter] = useState<'Todos' | 'Abaixo85' | 'Acima90'>('Todos');
  const [monthFilter, setMonthFilter] = useState<string>('all'); // 'all', 'current', or month number '1'..'12'
  const [yearFilter, setYearFilter] = useState<string>('all'); // 'all' or '2026', etc.
  const [unitFilter, setUnitFilter] = useState<string>('Todas');
  const [expandedExecutionId, setExpandedExecutionId] = useState<string | null>(null);
  const [viewingExecution, setViewingExecution] = useState<DTOExecution | null>(null);
  const [executionToDelete, setExecutionToDelete] = useState<DTOExecution | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Extract available roles from monitored employees list
  const availableRoles = React.useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.funcao && isEmployeeMonitoredForDTO(e)) set.add(e.funcao);
    });
    return Array.from(set).sort();
  }, [employees]);

  const handleProcessCSV = () => {
    if (!csvText.trim()) {
      setImportStatus({ type: 'error', message: 'Cole os dados do CSV ou relatório do Google Forms no campo abaixo.' });
      return;
    }

    try {
      const lines = csvText.trim().split(/\r?\n/);
      if (lines.length < 2) {
        setImportStatus({ type: 'error', message: 'O arquivo CSV precisa ter ao menos a linha de cabeçalho e 1 linha de dados.' });
        return;
      }

      // Simple CSV line parser supporting quoted fields
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"' || char === "'") {
            inQuotes = !inQuotes;
          } else if ((char === ',' || char === '\t' || char === ';') && !inQuotes) {
            result.push(cur.trim());
            cur = '';
          } else {
            cur += char;
          }
        }
        result.push(cur.trim());
        return result;
      };

      const header = parseCSVLine(lines[0]);
      let addedCount = 0;
      const parsedExecs: DTOExecution[] = [];

      // Detect category by inspecting header questions and keywords
      const headerText = lines[0].toLowerCase();
      let matchedCategory = categories.find(c => {
        const catKeywords = c.title.toLowerCase();
        if (catKeywords.includes('bateria') && (headerText.includes('bateria') || headerText.includes('carregador'))) return true;
        if (catKeywords.includes('diesel') && (headerText.includes('diesel') || headerText.includes('nr-20') || headerText.includes('bacia de contenção'))) return true;
        if (catKeywords.includes('sam') && (headerText.includes('sam') || headerText.includes('loto') || headerText.includes('bloqueio'))) return true;
        if (catKeywords.includes('manuseio') && (headerText.includes('manuseio') || headerText.includes('postura ergonômica') || headerText.includes('levantamento'))) return true;
        if (catKeywords.includes('ergonomia') && (headerText.includes('ergonomia') || headerText.includes('empurrar ao invés de puxar'))) return true;
        if (catKeywords.includes('descarregamento') && (headerText.includes('descarregamento') || headerText.includes('trava-rodas') || headerText.includes('red zone'))) return true;
        if (catKeywords.includes('transporte seguro') && (headerText.includes('transporte seguro') || headerText.includes('homem x máquina'))) return true;
        if (catKeywords.includes('telemetria') && headerText.includes('telemetria')) return true;
        if (catKeywords.includes('trajeto') && headerText.includes('trajeto')) return true;
        if (catKeywords.includes('rota crítica') && headerText.includes('rota crítica')) return true;
        if (catKeywords.includes('epi') && headerText.includes('equipamentos de proteção')) return true;
        return false;
      });

      if (!matchedCategory) {
        // Fallback to first available category
        matchedCategory = categories.find(c => c.id === 'dto-carregamento-baterias') || categories[0];
      }

      // Identify question columns (columns not containing timestamp, employee, reason, evaluator, comments)
      const questionColIndices: { colIdx: number; questionId?: string }[] = [];
      header.forEach((col, idx) => {
        const cLower = col.toLowerCase();
        const isMetadata = 
          cLower.includes('carimbo') || 
          cLower.includes('data') || 
          cLower.includes('hora') || 
          cLower.includes('colaborador') || 
          cLower.includes('avaliado') || 
          cLower.includes('nome') || 
          cLower.includes('motivo') || 
          cLower.includes('responsável') || 
          cLower.includes('avaliador') || 
          cLower.includes('tst') || 
          cLower.includes('comentário') || 
          cLower.includes('observa');

        if (!isMetadata && col.trim().length > 3) {
          questionColIndices.push({ colIdx: idx });
        }
      });

      for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        if (!row || row.length < 2 || !row.join('').trim()) continue;

        let empName = '';
        let dateStr = new Date().toISOString().split('T')[0];
        let evaluatorName = 'Segurança do Trabalho / SST';
        let notes = '';

        row.forEach((cell, idx) => {
          const colHeader = (header[idx] || '').toLowerCase();
          if (colHeader.includes('carimbo') || colHeader.includes('data') || colHeader.includes('hora')) {
            // e.g. 05/01/2026 or 2026-01-05 or 05/01/2026 14:30:00
            const cleanedDate = cell.split(' ')[0].trim();
            const parts = cleanedDate.split(/[\/\-]/);
            if (parts.length === 3) {
              if (parts[0].length === 4) {
                // YYYY-MM-DD
                dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
              } else {
                // DD/MM/YYYY
                const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
                const m = parts[1].padStart(2, '0');
                const d = parts[0].padStart(2, '0');
                dateStr = `${y}-${m}-${d}`;
              }
            }
          }
          if (colHeader.includes('colaborador') || colHeader.includes('avaliado') || colHeader.includes('nome do colaborador')) {
            empName = cell.trim();
          }
          if (colHeader.includes('avaliador') || colHeader.includes('tst') || colHeader.includes('responsável')) {
            evaluatorName = cell.trim() || evaluatorName;
          }
          if (colHeader.includes('motivo') || colHeader.includes('observação') || colHeader.includes('comentário') || colHeader.includes('comentários')) {
            if (cell.trim() && cell.trim().toLowerCase() !== 'n/a' && cell.trim() !== '-') {
              notes = (notes ? notes + ' | ' : '') + cell.trim();
            }
          }
        });

        // Match employee
        const normalizedEmpName = empName.toLowerCase().replace(/\s+/g, ' ').trim();
        const matchedEmp = employees.find(e => {
          const eNorm = e.nome.toLowerCase().replace(/\s+/g, ' ').trim();
          return eNorm === normalizedEmpName || eNorm.includes(normalizedEmpName) || normalizedEmpName.includes(eNorm);
        });

        const refDate = new Date(dateStr + 'T00:00:00');
        const refMonth = !isNaN(refDate.getMonth()) ? refDate.getMonth() + 1 : selectedMonth;
        const refYear = !isNaN(refDate.getFullYear()) ? refDate.getFullYear() : selectedYear;

        // Build question responses from the row values
        const catQuestions = matchedCategory.questions;
        const responses = catQuestions.map((q, qIndex) => {
          let status: 'C' | 'NC' | 'NA' = 'C';
          let coachingApplied = false;
          let obs: string | undefined = undefined;

          // Check if there is a corresponding column in CSV
          if (questionColIndices[qIndex]) {
            const cellValue = (row[questionColIndices[qIndex].colIdx] || '').trim().toLowerCase();
            if (cellValue.includes('não conforme') || cellValue === 'nc' || cellValue.includes('nao conforme') || cellValue === 'inconforme') {
              status = 'NC';
              coachingApplied = true;
              obs = `Desvio identificado no item: ${q.questionText}`;
            } else if (cellValue.includes('n/a') || cellValue === 'na' || cellValue.includes('não se aplica') || cellValue.includes('nao se aplica')) {
              status = 'NA';
            } else {
              status = 'C';
            }
          }

          return {
            questionId: q.id,
            status,
            coachingApplied,
            observation: obs
          };
        });

        const conformesCount = responses.filter(r => r.status === 'C').length;
        const naoConformesCount = responses.filter(r => r.status === 'NC').length;
        const naCount = responses.filter(r => r.status === 'NA').length;
        const coachingCount = responses.filter(r => r.coachingApplied).length;
        const totalEvaluated = conformesCount + naoConformesCount;
        const conformityScore = totalEvaluated > 0 ? Math.round((conformesCount / totalEvaluated) * 100) : 100;

        const newExec: DTOExecution = {
          id: `exec-imp-${Date.now()}-${i}`,
          employeeId: matchedEmp ? matchedEmp.id : `emp-imp-${i}`,
          employeeName: matchedEmp ? matchedEmp.nome : (empName || 'Colaborador'),
          employeeRole: matchedEmp ? matchedEmp.funcao : 'Operador de Empilhadeira',
          employeeUnit: matchedEmp ? matchedEmp.unidade : 'Filial Brejo',
          categoryId: matchedCategory.id,
          categoryTitle: matchedCategory.title,
          evaluatorName: evaluatorName || 'Segurança do Trabalho / SST',
          evaluatorRole: 'Segurança do Trabalho / SST',
          date: dateStr,
          referenceMonth: refMonth,
          referenceYear: refYear,
          responses,
          conformityScore,
          totalQuestions: responses.length,
          conformesCount,
          naoConformesCount,
          naCount,
          coachingCount,
          notes: notes || 'Execução de rotina',
          status: 'Concluído',
          signatureEvaluator: evaluatorName || 'Segurança do Trabalho',
          signatureEmployee: matchedEmp ? matchedEmp.nome : (empName || 'Colaborador')
        };

        parsedExecs.push(newExec);
        addedCount++;
      }

      if (addedCount > 0 && onImportExecutions) {
        onImportExecutions(parsedExecs);
        setImportStatus({ 
          type: 'success', 
          message: `${addedCount} avaliações do ${matchedCategory.title} importadas com sucesso para o Acompanhamento!` 
        });
        setTimeout(() => {
          setIsImportModalOpen(false);
          setCsvText('');
          setImportStatus(null);
        }, 1800);
      } else {
        setImportStatus({ type: 'error', message: 'Nenhum registro pôde ser processado. Verifique a estrutura do texto.' });
      }
    } catch (err: any) {
      setImportStatus({ type: 'error', message: `Erro ao processar CSV: ${err?.message || 'Formato inválido'}` });
    }
  };

  // Filter executions

  // Filter executions
  const filteredExecutions = executions.filter(exec => {
    // Month / Period Match
    let matchMonth = true;
    if (monthFilter === 'current') {
      matchMonth = exec.referenceMonth === selectedMonth;
    } else if (monthFilter !== 'all') {
      matchMonth = exec.referenceMonth === Number(monthFilter);
    }

    // Year Match
    let matchYear = true;
    if (yearFilter === 'current') {
      matchYear = exec.referenceYear === selectedYear;
    } else if (yearFilter !== 'all') {
      matchYear = exec.referenceYear === Number(yearFilter);
    }

    // Unit Match
    let matchUnit = true;
    if (unitFilter !== 'Todas') {
      matchUnit = exec.employeeUnit === unitFilter;
    } else if (selectedUnit !== 'Todas as Unidades') {
      matchUnit = exec.employeeUnit === selectedUnit;
    }

    const isMonitored = exec.categoryId === 'dto-relatos' || !isRoleExcludedFromDTO(exec.employeeRole);
    const matchRole = roleFilter === 'Todas' || exec.employeeRole === roleFilter;
    const matchCat = categoryFilter === 'Todas' || exec.categoryId === categoryFilter;
    const matchSearch = exec.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        exec.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        exec.evaluatorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        exec.categoryTitle.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchScore = true;
    if (scoreFilter === 'Abaixo85') matchScore = exec.conformityScore < 85;
    if (scoreFilter === 'Acima90') matchScore = exec.conformityScore >= 90;

    return isMonitored && matchMonth && matchYear && matchUnit && matchRole && matchCat && matchSearch && matchScore;
  });

  // Calculate summary stats for filtered set
  const totalExecs = filteredExecutions.length;
  const avgScore = totalExecs > 0
    ? (filteredExecutions.reduce((acc, curr) => acc + curr.conformityScore, 0) / totalExecs).toFixed(1)
    : '100.0';
  const totalCoaching = filteredExecutions.reduce((acc, curr) => acc + curr.coachingCount, 0);

  const resetAllFilters = () => {
    setSearchTerm('');
    setRoleFilter('Todas');
    setCategoryFilter('Todas');
    setScoreFilter('Todos');
    setMonthFilter('all');
    setYearFilter('all');
    setUnitFilter('Todas');
  };

  const toggleExpand = (id: string) => {
    setExpandedExecutionId(prev => prev === id ? null : id);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Banner */}
      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 sm:p-6 text-white shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
            <FileSpreadsheet className="w-4 h-4" />
            <span>Relatórios & Exportação de Conformidade DTO</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Relatório de Segurança Operacional
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Exporte relatórios em Excel/CSV ou PDF com os indicadores de conformidade e aplicação de coaching por funcionário.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-blue-600/20 transition active:scale-95"
          >
            <Upload className="w-4 h-4" />
            <span>Importar Relatório (CSV)</span>
          </button>

          <button
            onClick={() => exportExecutionsToCSV(filteredExecutions, `Relatorio_DTO_${selectedMonth}_${selectedYear}.csv`)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Excel (Resumo)</span>
          </button>

          <button
            onClick={() => exportDetailedResponsesToCSV(filteredExecutions, categories, `Relatorio_Detalhado_Perguntas_${selectedMonth}_${selectedYear}.csv`)}
            className="bg-white/10 hover:bg-white/20 text-amber-300 border border-white/10 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition active:scale-95 backdrop-blur-md"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Perguntas Detalhadas</span>
          </button>

          <button
            onClick={() => printElement('printable-report-container')}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir PDF</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          
          {/* Search */}
          <div className="relative xl:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar colaborador, QLP, TST ou DTO..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-amber-400 text-slate-100 placeholder-slate-500"
            />
          </div>

          {/* Period / Month Filter */}
          <div>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl text-xs px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-amber-400"
            >
              <option value="all">📅 Todos os Meses (Geral)</option>
              <option value="current">📍 Mês Selecionado ({MONTH_NAMES[selectedMonth - 1]})</option>
              {MONTH_NAMES.map((m, idx) => (
                <option key={idx} value={String(idx + 1)}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* DTO Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl text-xs px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-amber-400"
            >
              <option value="Todas">📋 Todos os DTOs</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>

          {/* Role Filter */}
          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl text-xs px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-amber-400"
            >
              <option value="Todas">👤 Todas as Funções</option>
              {availableRoles.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>

          {/* Score Range Filter */}
          <div>
            <select
              value={scoreFilter}
              onChange={(e) => setScoreFilter(e.target.value as any)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl text-xs px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-amber-400"
            >
              <option value="Todos">🎯 Todas as Notas</option>
              <option value="Abaixo85">Abaixo da Meta (&lt; 85%)</option>
              <option value="Acima90">Alta Conformidade (&ge; 90%)</option>
            </select>
          </div>

        </div>

        {/* Quick Category Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mr-1">Filtro Rápido:</span>
          
          <button
            onClick={() => { setCategoryFilter('Todas'); setMonthFilter('all'); }}
            className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition ${
              categoryFilter === 'Todas' && monthFilter === 'all'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            Todos os Registros ({executions.length})
          </button>

          {categories.map(c => {
            const count = executions.filter(e => e.categoryId === c.id).length;
            if (count === 0) return null;
            const isSelected = categoryFilter === c.id;
            return (
              <button
                key={c.id}
                onClick={() => { setCategoryFilter(isSelected ? 'Todas' : c.id); setMonthFilter('all'); }}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                <span>{c.title.replace('DTO - ', '')}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-slate-950/20 text-slate-950 font-bold' : 'bg-white/10 text-amber-300'}`}>
                  {count}
                </span>
              </button>
            );
          })}

          {(searchTerm || roleFilter !== 'Todas' || categoryFilter !== 'Todas' || scoreFilter !== 'Todos' || monthFilter !== 'all') && (
            <button
              onClick={resetAllFilters}
              className="text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2 ml-auto"
            >
              Limpar Filtros
            </button>
          )}
        </div>

        {/* Stats strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 pt-3 border-t border-white/10 gap-2">
          <span>
            Mostrando <strong className="text-slate-100 font-bold">{totalExecs}</strong> de <strong className="text-slate-100 font-bold">{executions.length}</strong> avaliações registradas
            {monthFilter !== 'all' && (
              <span className="text-amber-300 ml-1">
                ({monthFilter === 'current' ? `${MONTH_NAMES[selectedMonth - 1]}/${selectedYear}` : `${MONTH_NAMES[Number(monthFilter) - 1]}`})
              </span>
            )}
          </span>
          <div className="flex gap-4">
            <span>Média de Conformidade: <strong className="text-emerald-400 font-bold">{avgScore}%</strong></span>
            <span>Total Coachings: <strong className="text-indigo-400 font-bold">{totalCoaching}</strong></span>
          </div>
        </div>
      </div>

      {/* Printable Report Container */}
      <div id="printable-report-container" className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl overflow-hidden">
        
        {/* Printable Header */}
        <div className="p-6 border-b border-white/10 bg-white/5">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">GRUPO PAU BRASIL • SISTEMA SST</span>
              <h2 className="text-xl font-bold text-slate-100">Relatório Consolidado de Conformidade DTO</h2>
              <p className="text-xs text-slate-400 mt-1">
                Período: {monthFilter === 'all' ? 'Histórico Completo (Todos os Meses)' : monthFilter === 'current' ? `${MONTH_NAMES[selectedMonth - 1]} / ${selectedYear}` : `${MONTH_NAMES[Number(monthFilter) - 1]} / ${selectedYear}`} • Unidade: {selectedUnit}
              </p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <div>Gerado em: {new Date().toLocaleDateString('pt-BR')}</div>
              <div className="font-semibold text-slate-200">{totalExecs} Registros Processados</div>
            </div>
          </div>
        </div>

        {/* Executions Table */}
        {filteredExecutions.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm px-4">
            <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-500 mb-3" />
            <p className="text-base font-semibold text-slate-200">Nenhum registro encontrado com os filtros atuais.</p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Existem <strong>{executions.length}</strong> avaliações no sistema em outros períodos ou categorias.
            </p>
            <button
              onClick={resetAllFilters}
              className="mt-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-lg shadow-amber-500/20 transition active:scale-95"
            >
              Mostrar Todos os Registros ({executions.length})
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-white/5 border-b border-white/10 text-slate-300 font-bold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Data</th>
                  <th className="py-3.5 px-4">Colaborador / QLP</th>
                  <th className="py-3.5 px-4">Função</th>
                  <th className="py-3.5 px-4">DTO Checklist</th>
                  <th className="py-3.5 px-4">Avaliador (TST)</th>
                  <th className="py-3.5 px-4 text-center">Desempenho</th>
                  <th className="py-3.5 px-4 text-center">Conformidade</th>
                  <th className="py-3.5 px-4 text-right no-print">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredExecutions.map(exec => {
                  const isExpanded = expandedExecutionId === exec.id;
                  const category = categories.find(c => c.id === exec.categoryId);

                  return (
                    <React.Fragment key={exec.id}>
                      <tr className={`hover:bg-white/5 transition ${isExpanded ? 'bg-amber-500/10' : ''}`}>
                        
                        <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-300">
                          {exec.date}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-100">{exec.employeeName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">Matrícula: {exec.employeeId}</div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-300 font-medium">
                          {exec.employeeRole}
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-slate-100">
                          {exec.categoryTitle}
                        </td>

                        <td className="py-3.5 px-4 text-slate-400">
                          {exec.evaluatorName}
                        </td>

                        {/* Counts (C / NC / NA) */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-2 text-[11px]">
                            <span className="text-emerald-300 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md" title="Conformes">
                              {exec.conformesCount}C
                            </span>
                            <span className="text-rose-300 font-bold bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md" title="Não Conformes">
                              {exec.naoConformesCount}NC
                            </span>
                            {exec.coachingCount > 0 && (
                              <span className="text-indigo-300 font-bold bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md" title="Coachings">
                                {exec.coachingCount}💬
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Score Badge */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-lg font-extrabold text-xs border ${
                            exec.conformityScore >= 90
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : exec.conformityScore >= 80
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {exec.conformityScore.toFixed(1)}%
                          </span>
                        </td>

                        {/* Action buttons */}
                        <td className="py-3.5 px-4 text-right no-print">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setViewingExecution(exec)}
                              className="p-1.5 text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition border border-white/10"
                              title="Visualizar Ficha Completa"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => toggleExpand(exec.id)}
                              className="p-1.5 text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition border border-white/10"
                              title="Expandir respostas"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            {onDeleteExecution && (
                              <button
                                onClick={() => setExecutionToDelete(exec)}
                                className="p-1.5 text-rose-400 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition border border-rose-500/20"
                                title="Apagar lançamento de DTO"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>

                      </tr>

                      {/* Expandable Question Detail Drawer Row */}
                      {isExpanded && (
                        <tr className="bg-white/5">
                          <td colSpan={8} className="p-4">
                            <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 space-y-3 backdrop-blur-md">
                              <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center justify-between">
                                <span>Detalhamento de Perguntas — {exec.categoryTitle}</span>
                                <span className="text-slate-400 font-normal">Avaliador: {exec.evaluatorName}</span>
                              </h4>

                              <div className="space-y-2 text-xs">
                                {exec.responses.map((resp, rIdx) => {
                                  const q = category?.questions.find(item => item.id === resp.questionId);
                                  return (
                                    <div key={rIdx} className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10 gap-2">
                                      <div className="flex items-start gap-2">
                                        <span className="font-bold text-slate-500">#{rIdx + 1}</span>
                                        <span className="text-slate-200 font-medium">{q ? q.questionText : resp.questionId}</span>
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                        {resp.status === 'C' && (
                                          <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-md font-bold text-[11px] flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Conforme
                                          </span>
                                        )}
                                        {resp.status === 'NC' && (
                                          <span className="bg-rose-500/10 text-rose-300 border border-rose-500/20 px-2 py-0.5 rounded-md font-bold text-[11px] flex items-center gap-1">
                                            <XCircle className="w-3 h-3 text-rose-400" /> Não Conforme
                                          </span>
                                        )}
                                        {resp.status === 'NA' && (
                                          <span className="bg-white/10 text-slate-300 border border-white/10 px-2 py-0.5 rounded-md font-bold text-[11px] flex items-center gap-1">
                                            <MinusCircle className="w-3 h-3" /> N/A
                                          </span>
                                        )}

                                        {resp.coachingApplied && (
                                          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md font-bold text-[10px]">
                                            Coaching
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {exec.notes && (
                                <div className="text-xs text-amber-300 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                                  <strong>Observações Gerais do TST:</strong> {exec.notes}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Single DTO Sheet Modal */}
      {viewingExecution && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-white/15 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative my-8 text-slate-100">
            
            <button
              onClick={() => setViewingExecution(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Certificate Header */}
            <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-4">
              <div className="bg-amber-500 text-slate-950 p-2.5 rounded-2xl font-bold shadow-lg shadow-amber-500/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Ficha Oficial DTO</span>
                <h3 className="text-xl font-extrabold text-slate-100">{viewingExecution.categoryTitle}</h3>
                <p className="text-xs text-slate-400">
                  Data: {viewingExecution.date} • Avaliador: {viewingExecution.evaluatorName}
                </p>
              </div>
            </div>

            {/* Employee Details */}
            <div className="grid grid-cols-2 gap-3 bg-white/5 backdrop-blur-md p-4 rounded-2xl text-xs mb-4 border border-white/10">
              <div>
                <span className="text-slate-400 block">Colaborador Avaliado:</span>
                <strong className="text-slate-100 text-sm">{viewingExecution.employeeName}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Matrícula & Cargo:</span>
                <strong className="text-slate-100">{viewingExecution.employeeId} — {viewingExecution.employeeRole}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Unidade Logística:</span>
                <strong className="text-slate-100">{viewingExecution.employeeUnit}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Índice de Conformidade:</span>
                <strong className={`text-sm ${
                  viewingExecution.conformityScore >= 90 ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {viewingExecution.conformityScore.toFixed(1)}%
                </strong>
              </div>
            </div>

            {/* Responses List */}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1 text-xs">
              {viewingExecution.responses.map((resp, idx) => {
                const cat = categories.find(c => c.id === viewingExecution.categoryId);
                const q = cat?.questions.find(item => item.id === resp.questionId);

                return (
                  <div key={idx} className="p-3 rounded-xl bg-white/5 border border-white/10 flex justify-between items-center">
                    <span className="font-medium text-slate-200 text-xs pr-2">{q ? q.questionText : resp.questionId}</span>
                    <span className={`px-2.5 py-1 rounded-md font-bold text-[11px] shrink-0 border ${
                      resp.status === 'C' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : resp.status === 'NC' ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' : 'bg-white/10 text-slate-300 border-white/10'
                    }`}>
                      {resp.status === 'C' ? 'Conforme' : resp.status === 'NC' ? 'Não Conforme' : 'N/A'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 border-t border-white/10 pt-4 mt-4">
              <button
                onClick={() => printElement('printable-report-container')}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Ficha</span>
              </button>
              <button
                onClick={() => setViewingExecution(null)}
                className="bg-white/10 hover:bg-white/20 text-slate-200 font-semibold px-4 py-2 rounded-xl text-xs border border-white/10"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CSV / Google Forms Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/15 rounded-3xl p-6 max-w-2xl w-full text-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-blue-400">
                <Upload className="w-5 h-5" />
                <h3 className="text-lg font-bold text-white">Importar Relatório / CSV para o Farol</h3>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportStatus(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Cole abaixo as linhas copiadas do seu arquivo CSV, planilha Excel ou exportação do Google Forms. O sistema identificará automaticamente os colaboradores, datas e itens avaliados.
            </p>

            <textarea
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Cole aqui o conteúdo CSV (com cabeçalho)... Exemplo:&#10;Carimbo de data/hora,Colaborador,Função,Motivo&#10;21/01/2026 10:38:45,ALAN JUNIOR MATIAS DA SILVA,Ajudante de Distribuição,Incidente simples..."
              className="w-full bg-slate-950 border border-white/15 rounded-2xl p-3.5 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-400"
            />

            {importStatus && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                importStatus.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {importStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{importStatus.message}</span>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2 border-t border-white/10">
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportStatus(null);
                }}
                className="bg-white/10 hover:bg-white/20 text-slate-200 font-semibold px-4 py-2 rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleProcessCSV}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-blue-600/20 transition active:scale-95"
              >
                <Upload className="w-4 h-4" />
                <span>Processar & Subir no Farol</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirm Delete Execution */}
      {executionToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 bg-rose-500/20 rounded-xl border border-rose-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Confirmar Exclusão de DTO</h3>
                <p className="text-xs text-slate-400">Esta ação removerá este lançamento permanentemente.</p>
              </div>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-xl border border-white/10 text-xs space-y-2">
              <div>
                <span className="text-slate-400">Colaborador:</span>{' '}
                <strong className="text-slate-100">{executionToDelete.employeeName}</strong>
              </div>
              <div>
                <span className="text-slate-400">Checklist:</span>{' '}
                <strong className="text-slate-100">{executionToDelete.categoryTitle}</strong>
              </div>
              <div>
                <span className="text-slate-400">Mês Referência:</span>{' '}
                <strong className="text-amber-400">{MONTH_NAMES[executionToDelete.referenceMonth - 1]}/{executionToDelete.referenceYear}</strong>
              </div>
              <div>
                <span className="text-slate-400">Data de Realização:</span>{' '}
                <span className="text-slate-200">{executionToDelete.date}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setExecutionToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/10 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (onDeleteExecution && executionToDelete) {
                    onDeleteExecution(executionToDelete.id);
                  }
                  setExecutionToDelete(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-rose-500 hover:bg-rose-400 text-slate-950 transition shadow-lg shadow-rose-500/20 active:scale-95 flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sim, Apagar DTO</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
