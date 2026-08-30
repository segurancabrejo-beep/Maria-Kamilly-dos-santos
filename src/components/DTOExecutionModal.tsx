import React, { useState, useEffect } from 'react';
import { 
  ClipboardCheck, 
  CheckCircle2, 
  XCircle, 
  MinusCircle, 
  AlertTriangle, 
  User, 
  Building, 
  Calendar, 
  Save, 
  ArrowLeft, 
  Sparkles,
  MessageSquare,
  Award
} from 'lucide-react';
import { Employee, DTOCategory, DTOExecution, QuestionResponse, ResponseStatus } from '../types/dto';
import { getCategoriesForEmployee } from '../utils/storage';
import { formatBRDate, isEmployeeAdmittedInMonth } from '../utils/dateUtils';

interface DTOExecutionModalProps {
  employees: Employee[];
  categories: DTOCategory[];
  initialEmployeeId?: string;
  initialCategoryId?: string;
  selectedMonth: number;
  selectedYear: number;
  onSaveExecution: (execution: DTOExecution) => void;
  onCancel: () => void;
}

export const DTOExecutionModal: React.FC<DTOExecutionModalProps> = ({
  employees,
  categories,
  initialEmployeeId,
  initialCategoryId,
  selectedMonth,
  selectedYear,
  onSaveExecution,
  onCancel
}) => {
  // Form State
  const [employeeId, setEmployeeId] = useState<string>(initialEmployeeId || (employees[0]?.id || ''));
  const [categoryId, setCategoryId] = useState<string>(initialCategoryId || (categories[0]?.id || ''));
  const [evaluatorName, setEvaluatorName] = useState<string>('Engº Robson TST');
  const [evaluatorRole, setEvaluatorRole] = useState<string>('Técnico de Segurança do Trabalho');
  const [executionDate, setExecutionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [generalNotes, setGeneralNotes] = useState<string>('');

  // Selected entities
  const selectedEmployee = employees.find(e => e.id === employeeId);
  const selectedCategory = categories.find(c => c.id === categoryId);

  // Suggested categories for selected employee
  const recommendedCategories = selectedEmployee 
    ? getCategoriesForEmployee(categories, selectedEmployee)
    : categories;

  // Responses state for questions of current category
  const [responses, setResponses] = useState<Record<string, QuestionResponse>>({});

  // Reset responses when category changes
  useEffect(() => {
    if (selectedCategory) {
      const initialResp: Record<string, QuestionResponse> = {};
      selectedCategory.questions.forEach(q => {
        initialResp[q.id] = {
          questionId: q.id,
          status: 'C', // Default to Conforme
          coachingApplied: false,
          observation: ''
        };
      });
      setResponses(initialResp);
    }
  }, [categoryId, selectedCategory]);

  // Handle choice update
  const handleStatusChange = (questionId: string, status: ResponseStatus) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        status,
        // Auto-check coaching when Non-Conforme
        coachingApplied: status === 'NC' ? true : prev[questionId]?.coachingApplied || false
      }
    }));
  };

  const handleCoachingToggle = (questionId: string, coachingApplied: boolean) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        coachingApplied
      }
    }));
  };

  const handleObservationChange = (questionId: string, observation: string) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        observation
      }
    }));
  };

  // Bulk set all questions to "Conforme"
  const handleSetAllConforme = () => {
    if (!selectedCategory) return;
    const updated: Record<string, QuestionResponse> = {};
    selectedCategory.questions.forEach(q => {
      updated[q.id] = {
        questionId: q.id,
        status: 'C',
        coachingApplied: false,
        observation: ''
      };
    });
    setResponses(updated);
  };

  // Live Score Calculation
  const responseArray: QuestionResponse[] = Object.values(responses);
  const conformesCount = responseArray.filter(r => r.status === 'C').length;
  const naoConformesCount = responseArray.filter(r => r.status === 'NC').length;
  const naCount = responseArray.filter(r => r.status === 'NA').length;
  const coachingCount = responseArray.filter(r => r.coachingApplied).length;
  
  const totalEvaluated = conformesCount + naoConformesCount;
  const conformityScore = totalEvaluated > 0 ? (conformesCount / totalEvaluated) * 100 : 100;

  // Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !selectedCategory) return;

    const newExecution: DTOExecution = {
      id: `exec-${Date.now()}`,
      employeeId: selectedEmployee.id,
      employeeName: selectedEmployee.nome,
      employeeRole: selectedEmployee.funcao,
      employeeUnit: selectedEmployee.unidade,
      categoryId: selectedCategory.id,
      categoryTitle: selectedCategory.title,
      evaluatorName,
      evaluatorRole,
      date: executionDate,
      referenceMonth: selectedMonth,
      referenceYear: selectedYear,
      responses: responseArray,
      conformityScore: parseFloat(conformityScore.toFixed(1)),
      totalQuestions: selectedCategory.questions.length,
      conformesCount,
      naoConformesCount,
      naCount,
      coachingCount,
      notes: generalNotes,
      status: 'Concluído'
    };

    onSaveExecution(newExecution);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      
      {/* Header bar */}
      <div className="flex items-center justify-between bg-white/5 backdrop-blur-2xl text-white rounded-2xl p-5 border border-white/10 shadow-2xl">
        <div className="flex items-center space-x-3">
          <button 
            type="button" 
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition border border-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <span className="text-xs text-amber-400 font-bold uppercase tracking-wider">
              Checklist de Segurança SST
            </span>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Aplicação de DTO (Diagnóstico Operacional)
            </h2>
          </div>
        </div>

        {/* Live Score Gauge Badge */}
        <div className="text-right hidden sm:block">
          <span className="text-xs text-slate-400 block font-medium">Índice Calculado</span>
          <span className={`text-2xl font-black ${
            conformityScore >= 90 ? 'text-emerald-400' : conformityScore >= 80 ? 'text-amber-400' : 'text-rose-400'
          }`}>
            {conformityScore.toFixed(1)}%
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 text-slate-100">
        
        {/* Step 1: Header / Selections Card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-slate-100 border-b border-white/10 pb-2">
            1. Dados da Avaliação & Colaborador
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Employee Pick */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Colaborador (QLP Operacional) *
              </label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-100 focus:outline-none focus:border-amber-400"
                required
              >
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nome} — {emp.funcao} ({emp.matricula})
                  </option>
                ))}
              </select>
              {selectedEmployee && (
                <div className="mt-2 text-xs text-slate-300 bg-white/5 p-2.5 rounded-xl border border-white/10 space-y-1.5">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span><strong>Setor:</strong> {selectedEmployee.setor}</span>
                    <span><strong>Unidade:</strong> {selectedEmployee.unidade}</span>
                    <span><strong>Admissão:</strong> {formatBRDate(selectedEmployee.dataAdmissao)}</span>
                  </div>
                  {!isEmployeeAdmittedInMonth(selectedEmployee.dataAdmissao, selectedMonth, selectedYear) && (
                    <div className="text-[11px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded-lg">
                      Admissão em {formatBRDate(selectedEmployee.dataAdmissao)} (posterior a {selectedMonth}/{selectedYear}).
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* DTO Category Pick */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Tipo de DTO (Checklist) *
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-100 focus:outline-none focus:border-amber-400"
                required
              >
                {categories.map(cat => {
                  const isRecommended = recommendedCategories.some(rc => rc.id === cat.id);
                  return (
                    <option key={cat.id} value={cat.id}>
                      {cat.title} {isRecommended ? '★ (Exigido p/ Função)' : ''}
                    </option>
                  );
                })}
              </select>
              {selectedCategory && (
                <p className="mt-2 text-xs text-slate-400 italic">
                  {selectedCategory.description}
                </p>
              )}
            </div>

            {/* Evaluator Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Avaliador / Técnico SST *
              </label>
              <input
                type="text"
                value={evaluatorName}
                onChange={(e) => setEvaluatorName(e.target.value)}
                placeholder="Ex: Engº Robson TST / Técnico SST"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                required
              />
            </div>

            {/* Execution Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Data da Avaliação *
              </label>
              <input
                type="date"
                value={executionDate}
                onChange={(e) => setExecutionDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-100 focus:outline-none focus:border-amber-400"
                required
              />
            </div>

          </div>
        </div>

        {/* Step 2: Questions Execution Card */}
        {selectedCategory && (
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-xl space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  2. Perguntas do Checklist ({selectedCategory.questions.length} itens)
                </h3>
                <p className="text-xs text-slate-400">
                  Marque Conforme, Não Conforme ou N/A para cada item. Indique se houve coaching.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSetAllConforme}
                  className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold px-3 py-1.5 rounded-xl transition"
                >
                  ✓ Marcar Todos Conformes
                </button>
              </div>
            </div>

            {/* Questions List */}
            <div className="space-y-4 divide-y divide-white/5">
              {selectedCategory.questions.map((q, idx) => {
                const currentResp = responses[q.id] || { status: 'C', coachingApplied: false, observation: '' };

                return (
                  <div key={q.id} className="pt-4 first:pt-0 space-y-3">
                    
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div className="flex gap-2.5">
                        <span className="bg-white/10 text-amber-400 border border-white/10 text-xs font-bold px-2.5 py-1 rounded-md h-fit shrink-0">
                          #{idx + 1}
                        </span>
                        <p className="text-sm font-semibold text-slate-100 pt-0.5 leading-snug">
                          {q.questionText}
                        </p>
                      </div>

                      {/* Pill buttons for C / NC / NA */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end md:self-start">
                        
                        {/* Conforme */}
                        <button
                          type="button"
                          onClick={() => handleStatusChange(q.id, 'C')}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                            currentResp.status === 'C'
                              ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-600/30'
                              : 'bg-white/5 text-slate-400 hover:text-slate-200 border-white/10'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Conforme</span>
                        </button>

                        {/* Não Conforme */}
                        <button
                          type="button"
                          onClick={() => handleStatusChange(q.id, 'NC')}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                            currentResp.status === 'NC'
                              ? 'bg-rose-600 text-white border-rose-400 shadow-lg shadow-rose-600/30'
                              : 'bg-white/5 text-slate-400 hover:text-slate-200 border-white/10'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Não Conforme</span>
                        </button>

                        {/* Não Aplicável */}
                        <button
                          type="button"
                          onClick={() => handleStatusChange(q.id, 'NA')}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition border ${
                            currentResp.status === 'NA'
                              ? 'bg-slate-700 text-white border-slate-500 shadow'
                              : 'bg-white/5 text-slate-400 hover:text-slate-200 border-white/10'
                          }`}
                        >
                          <MinusCircle className="w-3.5 h-3.5" />
                          <span>N/A</span>
                        </button>

                      </div>
                    </div>

                    {/* Coaching Checkbox & Observation Text Area */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 font-semibold text-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={currentResp.coachingApplied}
                            onChange={(e) => handleCoachingToggle(q.id, e.target.checked)}
                            className="w-4 h-4 text-amber-500 rounded border-white/20 bg-slate-900 focus:ring-amber-500"
                          />
                          <span>Coaching aplicado em campo com o colaborador?</span>
                        </label>
                        {currentResp.coachingApplied && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold px-2 py-0.5 rounded-full">
                            Coaching Registrado
                          </span>
                        )}
                      </div>

                      <input
                        type="text"
                        value={currentResp.observation || ''}
                        onChange={(e) => handleObservationChange(q.id, e.target.value)}
                        placeholder="Observações, motivo do desvio ou detalhes do coaching..."
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* Step 3: Summary & Notes Card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-slate-100 border-b border-white/10 pb-2">
            3. Resumo da Avaliação & Considerações Finais
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/5 p-4 rounded-2xl text-center border border-white/10">
            <div>
              <span className="text-xs text-slate-400 block font-medium">Conformes (C)</span>
              <span className="text-xl font-extrabold text-emerald-400">{conformesCount}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">Não Conformes (NC)</span>
              <span className="text-xl font-extrabold text-rose-400">{naoConformesCount}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">Não Aplicáveis (NA)</span>
              <span className="text-xl font-extrabold text-slate-300">{naCount}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">Coachings</span>
              <span className="text-xl font-extrabold text-indigo-400">{coachingCount}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Observações Gerais do Avaliador / Plano de Ação Recomendado
            </label>
            <textarea
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              rows={3}
              placeholder="Digite aqui recomendações, observações do TST ou combinados de acompanhamento..."
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl border border-white/10 text-slate-300 font-semibold text-sm hover:bg-white/10 transition"
          >
            Cancelar
          </button>
          
          <button
            type="submit"
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 transition transform active:scale-95"
          >
            <Save className="w-4 h-4 stroke-[2.5]" />
            <span>Salvar e Concluir DTO ({conformityScore.toFixed(0)}%)</span>
          </button>
        </div>

      </form>

    </div>
  );
};
