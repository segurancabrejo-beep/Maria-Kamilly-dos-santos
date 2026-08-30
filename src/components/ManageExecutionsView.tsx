import React, { useState, useMemo } from 'react';
import { 
  Trash2, 
  Search, 
  Filter, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  Building, 
  Layers, 
  RefreshCw, 
  Eye, 
  Copy,
  Sparkles,
  ChevronRight,
  HelpCircle,
  X
} from 'lucide-react';
import { DTOExecution, Employee, DTOCategory } from '../types/dto';
import { MONTH_NAMES } from '../utils/dateUtils';

interface ManageExecutionsViewProps {
  executions: DTOExecution[];
  employees: Employee[];
  categories: DTOCategory[];
  selectedMonth: number;
  selectedYear: number;
  selectedUnit: string;
  onDeleteExecution: (id: string) => void;
  onDeleteMultipleExecutions?: (ids: string[]) => void;
  onCleanDuplicates?: () => void;
}

export const ManageExecutionsView: React.FC<ManageExecutionsViewProps> = ({
  executions,
  employees,
  categories,
  selectedMonth,
  selectedYear,
  selectedUnit,
  onDeleteExecution,
  onDeleteMultipleExecutions,
  onCleanDuplicates
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('Todas');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('Todas');
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>(String(selectedYear));
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string>(selectedUnit);
  const [onlyDuplicates, setOnlyDuplicates] = useState<boolean>(false);
  
  // Selection state for batch deletion
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [executionToDelete, setExecutionToDelete] = useState<DTOExecution | null>(null);
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'info'; text: string } | null>(null);

  // Grouping to detect duplicates: same employee + same referenceMonth + same referenceYear + same categoryId
  const duplicateGroups = useMemo(() => {
    const map = new Map<string, DTOExecution[]>();
    executions.forEach(exec => {
      // Key: employeeId + month + year + categoryId
      const key = `${exec.employeeId}__${exec.referenceMonth}__${exec.referenceYear}__${exec.categoryId}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(exec);
    });

    const duplicatesMap = new Map<string, DTOExecution[]>();
    map.forEach((list, key) => {
      if (list.length > 1) {
        duplicatesMap.set(key, list);
      }
    });
    return duplicatesMap;
  }, [executions]);

  // Set of execution IDs that are considered part of duplicate sets
  const duplicateExecIds = useMemo(() => {
    const ids = new Set<string>();
    duplicateGroups.forEach(list => {
      list.forEach(e => ids.add(e.id));
    });
    return ids;
  }, [duplicateGroups]);

  // Redundant duplicate IDs (all except the first/latest in each duplicate group)
  const autoRedundantIds = useMemo(() => {
    const redundant = new Set<string>();
    duplicateGroups.forEach(list => {
      // Sort: keep the latest or highest conformity score, remove the rest
      const sorted = [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      for (let i = 1; i < sorted.length; i++) {
        redundant.add(sorted[i].id);
      }
    });
    return Array.from(redundant);
  }, [duplicateGroups]);

  // Filtered executions
  const filteredExecutions = useMemo(() => {
    return executions.filter(exec => {
      // Duplicates filter
      if (onlyDuplicates && !duplicateExecIds.has(exec.id)) {
        return false;
      }

      // Unit filter
      if (selectedUnitFilter !== 'Todas as Unidades' && selectedUnitFilter !== 'Todas' && exec.employeeUnit !== selectedUnitFilter) {
        return false;
      }

      // Year filter
      if (selectedYearFilter !== 'Todas' && exec.referenceYear !== Number(selectedYearFilter)) {
        return false;
      }

      // Month filter
      if (selectedMonthFilter !== 'Todas' && exec.referenceMonth !== Number(selectedMonthFilter)) {
        return false;
      }

      // Category filter
      if (selectedCategoryId !== 'Todas' && exec.categoryId !== selectedCategoryId) {
        return false;
      }

      // Search term (employee name, id, category title, evaluator)
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = exec.employeeName.toLowerCase().includes(q);
        const matchMatricula = (exec.employeeId || '').toLowerCase().includes(q);
        const matchCat = exec.categoryTitle.toLowerCase().includes(q);
        const matchEval = (exec.evaluatorName || '').toLowerCase().includes(q);
        const matchId = exec.id.toLowerCase().includes(q);
        if (!matchName && !matchMatricula && !matchCat && !matchEval && !matchId) {
          return false;
        }
      }

      return true;
    });
  }, [executions, onlyDuplicates, duplicateExecIds, selectedUnitFilter, selectedYearFilter, selectedMonthFilter, selectedCategoryId, searchTerm]);

  // Toggle single item selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle select all visible
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredExecutions.length && filteredExecutions.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredExecutions.map(e => e.id)));
    }
  };

  // Select all duplicates
  const handleSelectAllDuplicates = () => {
    const dupIdsInView = filteredExecutions.filter(e => autoRedundantIds.includes(e.id)).map(e => e.id);
    setSelectedIds(new Set(dupIdsInView));
    setFeedbackMsg({
      type: 'info',
      text: `${dupIdsInView.length} lançamentos duplicados excedentes foram selecionados para exclusão.`
    });
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  // Confirm single delete
  const handleConfirmSingleDelete = () => {
    if (!executionToDelete) return;
    onDeleteExecution(executionToDelete.id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(executionToDelete.id);
      return next;
    });
    setFeedbackMsg({
      type: 'success',
      text: `DTO de "${executionToDelete.employeeName}" (${executionToDelete.categoryTitle}) apagado com sucesso!`
    });
    setExecutionToDelete(null);
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Confirm batch delete
  const handleConfirmBatchDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (onDeleteMultipleExecutions) {
      onDeleteMultipleExecutions(ids);
    } else {
      ids.forEach(id => onDeleteExecution(id));
    }
    setSelectedIds(new Set());
    setShowBatchConfirm(false);
    setFeedbackMsg({
      type: 'success',
      text: `${ids.length} lançamentos de DTO foram apagados com sucesso!`
    });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <Trash2 className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-slate-100">Gerenciar & Apagar Lançamentos de DTO</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Visualize, filtre e remova com segurança avaliações de DTO lançadas indevidamente ou duplicadas no sistema.
            </p>
          </div>

          {/* Quick Action Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {autoRedundantIds.length > 0 && (
              <button
                onClick={handleSelectAllDuplicates}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition shadow-lg shadow-amber-500/10"
              >
                <Copy className="w-4 h-4 text-amber-400" />
                <span>Selecionar {autoRedundantIds.length} Duplicados</span>
              </button>
            )}

            {selectedIds.size > 0 && (
              <button
                onClick={() => setShowBatchConfirm(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-rose-500 hover:bg-rose-400 text-slate-950 transition shadow-lg shadow-rose-500/20 active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>Apagar Selecionados ({selectedIds.size})</span>
              </button>
            )}
          </div>
        </div>

        {/* Feedback Alert Message */}
        {feedbackMsg && (
          <div className={`mt-4 p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
            feedbackMsg.type === 'success' 
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
              : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
          }`}>
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedbackMsg.text}</span>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar colaborador, TST..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950/60 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategoryId}
              onChange={e => setSelectedCategoryId(e.target.value)}
              className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 transition"
            >
              <option value="Todas">Todas as Categorias</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>

          {/* Month Filter */}
          <div>
            <select
              value={selectedMonthFilter}
              onChange={e => setSelectedMonthFilter(e.target.value)}
              className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 transition"
            >
              <option value="Todas">Todos os Meses</option>
              {MONTH_NAMES.map((mName, idx) => (
                <option key={idx} value={String(idx + 1)}>{mName}</option>
              ))}
            </select>
          </div>

          {/* Unit Filter */}
          <div>
            <select
              value={selectedUnitFilter}
              onChange={e => setSelectedUnitFilter(e.target.value)}
              className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 transition"
            >
              <option value="Todas">Todas as Unidades</option>
              <option value="Filial Brejo">Filial Brejo</option>
              <option value="Filial Sousa">Filial Sousa</option>
              <option value="Filial Patos">Filial Patos</option>
              <option value="Matriz">Matriz</option>
            </select>
          </div>

          {/* Filter Duplicates Only Button / Toggle */}
          <div>
            <button
              onClick={() => setOnlyDuplicates(prev => !prev)}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                onlyDuplicates
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
              }`}
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Ver Apenas Duplicados {duplicateGroups.size > 0 && `(${duplicateGroups.size})`}</span>
            </button>
          </div>

        </div>

        {/* Counter and Multi-Select Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 pt-3 border-t border-white/10 gap-2">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={filteredExecutions.length > 0 && selectedIds.size === filteredExecutions.length}
                onChange={handleToggleSelectAll}
                className="w-4 h-4 rounded border-white/20 bg-slate-900 text-amber-500 focus:ring-amber-500"
              />
              <span className="font-semibold">Selecionar Todos ({filteredExecutions.length})</span>
            </label>

            {selectedIds.size > 0 && (
              <span className="text-amber-400 font-bold">
                • {selectedIds.size} selecionado(s)
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span>Total na listagem: <strong className="text-slate-100 font-bold">{filteredExecutions.length}</strong> de {executions.length}</span>
            {duplicateGroups.size > 0 && (
              <span className="text-amber-400 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> {duplicateGroups.size} casos de duplicidade detectados
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Table of Executions */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl overflow-hidden">
        {filteredExecutions.length === 0 ? (
          <div className="py-16 text-center text-slate-400 px-4">
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400 mb-3 opacity-80" />
            <p className="text-base font-semibold text-slate-200">Nenhum lançamento encontrado para os filtros selecionados.</p>
            <p className="text-xs text-slate-400 mt-1">
              {onlyDuplicates ? 'Não há lançamentos duplicados com os filtros atuais!' : 'Verifique os filtros de mês, unidade ou categoria.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-white/5 border-b border-white/10 text-slate-300 font-bold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filteredExecutions.length > 0 && selectedIds.size === filteredExecutions.length}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded border-white/20 bg-slate-900 text-amber-500 focus:ring-amber-500"
                    />
                  </th>
                  <th className="py-3.5 px-4">Data / Mês</th>
                  <th className="py-3.5 px-4">Colaborador</th>
                  <th className="py-3.5 px-4">Função / Unidade</th>
                  <th className="py-3.5 px-4">Checklist DTO</th>
                  <th className="py-3.5 px-4">Avaliador (TST)</th>
                  <th className="py-3.5 px-4 text-center">Score</th>
                  <th className="py-3.5 px-4 text-center">Status / Duplicidade</th>
                  <th className="py-3.5 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredExecutions.map((exec) => {
                  const isSelected = selectedIds.has(exec.id);
                  const isDuplicate = duplicateExecIds.has(exec.id);
                  const isRedundant = autoRedundantIds.includes(exec.id);

                  return (
                    <tr 
                      key={exec.id} 
                      className={`hover:bg-white/5 transition ${
                        isSelected ? 'bg-amber-500/10' : isDuplicate ? 'bg-rose-500/5' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(exec.id)}
                          className="w-4 h-4 rounded border-white/20 bg-slate-900 text-amber-500 focus:ring-amber-500"
                        />
                      </td>

                      {/* Date & Month */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-200">{exec.date}</div>
                        <div className="text-[10px] text-amber-400 font-mono">
                          Mês: {MONTH_NAMES[exec.referenceMonth - 1] || exec.referenceMonth}/{exec.referenceYear}
                        </div>
                      </td>

                      {/* Employee */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-100">{exec.employeeName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">ID/Mat: {exec.employeeId}</div>
                      </td>

                      {/* Role & Unit */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-300">{exec.employeeRole}</div>
                        <div className="text-[10px] text-slate-400">{exec.employeeUnit}</div>
                      </td>

                      {/* DTO Category */}
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-100">{exec.categoryTitle}</span>
                        <div className="text-[10px] text-slate-400">{exec.conformesCount}C / {exec.naoConformesCount}NC</div>
                      </td>

                      {/* Evaluator */}
                      <td className="py-3.5 px-4 text-slate-300">
                        {exec.evaluatorName || 'SST'}
                      </td>

                      {/* Conformity Score */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-lg font-bold text-[11px] border ${
                          exec.conformityScore >= 90
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : exec.conformityScore >= 80
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {exec.conformityScore}%
                        </span>
                      </td>

                      {/* Duplicity Tag */}
                      <td className="py-3.5 px-4 text-center">
                        {isDuplicate ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            isRedundant 
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse'
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                          }`}>
                            <Copy className="w-3 h-3" />
                            {isRedundant ? 'Duplicata Excedente' : 'Original / Mantido'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-medium">Único</span>
                        )}
                      </td>

                      {/* Action Button */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setExecutionToDelete(exec)}
                          className="p-1.5 text-rose-400 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition active:scale-95"
                          title="Apagar este DTO"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Confirm Single Delete */}
      {executionToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 bg-rose-500/20 rounded-xl border border-rose-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Confirmar Exclusão de DTO</h3>
                <p className="text-xs text-slate-400">Esta ação removerá permanentemente o lançamento.</p>
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
                <span className="text-slate-400">Data de Aplicação:</span>{' '}
                <span className="text-slate-200">{executionToDelete.date}</span>
              </div>
              <div>
                <span className="text-slate-400">Avaliador:</span>{' '}
                <span className="text-slate-200">{executionToDelete.evaluatorName}</span>
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
                onClick={handleConfirmSingleDelete}
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-rose-500 hover:bg-rose-400 text-slate-950 transition shadow-lg shadow-rose-500/20 active:scale-95 flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sim, Apagar DTO</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirm Batch Delete */}
      {showBatchConfirm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 bg-rose-500/20 rounded-xl border border-rose-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Excluir {selectedIds.size} Lançamentos</h3>
                <p className="text-xs text-slate-400">Tem certeza que deseja apagar todos os DTOs selecionados?</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-white/10">
              Esta ação excluirá em lote os <strong>{selectedIds.size}</strong> registros selecionados. Os cálculos de farol e relatórios serão atualizados imediatamente.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowBatchConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/10 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmBatchDelete}
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-rose-500 hover:bg-rose-400 text-slate-950 transition shadow-lg shadow-rose-500/20 active:scale-95 flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Apagar {selectedIds.size} DTOs</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
