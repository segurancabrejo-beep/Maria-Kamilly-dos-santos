import React from 'react';
import { 
  X, 
  CheckCircle2, 
  XCircle, 
  MinusCircle, 
  User, 
  Calendar, 
  Building, 
  ShieldCheck, 
  MessageSquare,
  AlertTriangle,
  Award,
  Clock,
  Printer
} from 'lucide-react';
import { DTOExecution, DTOCategory } from '../types/dto';
import { formatBRDate, MONTH_NAMES } from '../utils/dateUtils';
import { printElement } from '../utils/export';

interface DTODetailModalProps {
  execution: DTOExecution | null;
  category?: DTOCategory;
  onClose: () => void;
  onNewDTO?: (employeeId: string, categoryId: string) => void;
}

export const DTODetailModal: React.FC<DTODetailModalProps> = ({
  execution,
  category,
  onClose,
  onNewDTO
}) => {
  if (!execution) return null;

  const handlePrint = () => {
    printElement('dto-detail-modal-content');
  };

  const isHighPerformance = execution.conformityScore >= 90;
  const isMediumPerformance = execution.conformityScore >= 75 && execution.conformityScore < 90;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100 my-auto">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-950/60 flex items-start justify-between gap-4 shrink-0">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{execution.categoryTitle}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Registro de Avaliação DTO
            </h2>
            <p className="text-xs text-slate-400">
              ID da Avaliação: <span className="font-mono text-slate-300">{execution.id}</span> • Realizado em {formatBRDate(execution.date)} (Mês de Referência: {MONTH_NAMES[execution.referenceMonth - 1]}/{execution.referenceYear})
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrint}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
              title="Imprimir Relatório"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div id="dto-detail-modal-content" className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          
          {/* Metadata Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Colaborador */}
            <div className="bg-slate-800/60 border border-slate-750 p-3.5 rounded-2xl space-y-1">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-400" />
                Colaborador Avaliado
              </span>
              <p className="text-sm font-bold text-white leading-tight">{execution.employeeName}</p>
              <p className="text-slate-400">{execution.employeeRole}</p>
              <p className="text-[11px] text-slate-500 font-mono">Unidade: {execution.employeeUnit}</p>
            </div>

            {/* Avaliador */}
            <div className="bg-slate-800/60 border border-slate-750 p-3.5 rounded-2xl space-y-1">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                Avaliador / Responsável
              </span>
              <p className="text-sm font-bold text-white leading-tight">{execution.evaluatorName}</p>
              <p className="text-slate-400">{execution.evaluatorRole || 'Avaliador SST'}</p>
              <p className="text-[11px] text-slate-500">Aplicação em campo</p>
            </div>

            {/* Data & Período */}
            <div className="bg-slate-800/60 border border-slate-750 p-3.5 rounded-2xl space-y-1">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                Data & Competência
              </span>
              <p className="text-sm font-bold text-white">{formatBRDate(execution.date)}</p>
              <p className="text-slate-400">Mês {execution.referenceMonth}/{execution.referenceYear}</p>
              <p className="text-[11px] text-emerald-400 font-semibold">{execution.status || 'Concluído'}</p>
            </div>

            {/* Score & Indicador */}
            <div className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
              isHighPerformance
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                : isMediumPerformance
                ? 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs uppercase tracking-wider">Conformidade</span>
                <Award className="w-4 h-4" />
              </div>
              <div className="flex items-baseline gap-1 my-1">
                <span className="text-2xl sm:text-3xl font-black">{execution.conformityScore}%</span>
                <span className="text-xs opacity-80 font-semibold">
                  ({execution.conformesCount}/{execution.totalQuestions} C)
                </span>
              </div>
              <div className="text-[11px] flex items-center gap-2">
                <span>{execution.naoConformesCount} NCs</span>
                <span>•</span>
                <span>{execution.coachingCount} Coaching(s)</span>
              </div>
            </div>
          </div>

          {/* Observations / Notes Banner */}
          {execution.notes && (
            <div className="bg-slate-800/40 border border-slate-700/80 rounded-2xl p-4 space-y-1">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" />
                Observações do Avaliador / Motivo da Aplicação
              </span>
              <p className="text-sm text-slate-200 leading-relaxed italic bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                "{execution.notes}"
              </p>
            </div>
          )}

          {/* Detailed Question by Question Responses */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                Respostas Detalhadas do Checklist ({execution.responses.length} Itens)
              </h3>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Conforme: {execution.conformesCount}
                </span>
                <span className="flex items-center gap-1 text-rose-400 font-semibold">
                  <XCircle className="w-3.5 h-3.5" /> Não Conforme: {execution.naoConformesCount}
                </span>
                {execution.naCount > 0 && (
                  <span className="flex items-center gap-1 text-slate-400 font-semibold">
                    <MinusCircle className="w-3.5 h-3.5" /> N/A: {execution.naCount}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {execution.responses.map((resp, idx) => {
                const questionObj = category?.questions.find(q => q.id === resp.questionId);
                const questionText = questionObj?.questionText || `Pergunta ${idx + 1} (${resp.questionId})`;
                const isC = resp.status === 'C';
                const isNC = resp.status === 'NC';
                const isNA = resp.status === 'NA';

                return (
                  <div 
                    key={resp.questionId || idx}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isNC
                        ? 'bg-rose-950/20 border-rose-500/40 text-rose-100'
                        : isC
                        ? 'bg-slate-850/70 border-slate-750 text-slate-200'
                        : 'bg-slate-900/50 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-400 font-bold px-2 py-0.5 bg-slate-800 rounded-md">
                            #{idx + 1}
                          </span>
                          <span className="text-xs sm:text-sm font-medium text-slate-100">
                            {questionText}
                          </span>
                        </div>

                        {/* Observation or Coaching badge */}
                        {(resp.observation || resp.coachingApplied) && (
                          <div className="ml-7 mt-1.5 p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs space-y-1">
                            {resp.coachingApplied && (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[11px] font-bold border border-amber-500/30">
                                <AlertTriangle className="w-3 h-3" />
                                Coaching Aplicado em Campo
                              </div>
                            )}
                            {resp.observation && (
                              <p className="text-slate-300 text-xs italic">
                                <strong className="text-slate-400">Apontamento:</strong> {resp.observation}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Status Pill */}
                      <div className="shrink-0">
                        {isC && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Conforme
                          </span>
                        )}
                        {isNC && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold animate-pulse">
                            <XCircle className="w-3.5 h-3.5" />
                            Não Conforme
                          </span>
                        )}
                        {isNA && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-700/40 text-slate-400 border border-slate-700 text-xs font-bold">
                            <MinusCircle className="w-3.5 h-3.5" />
                            Não Aplicável
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Signatures Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-800 text-xs">
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">
                Assinatura do Avaliador
              </span>
              <p className="font-bold text-white text-sm">{execution.signatureEvaluator || execution.evaluatorName}</p>
              <div className="h-0.5 w-full bg-slate-800 rounded-full" />
              <p className="text-[11px] text-slate-500">Validação técnica SST / Liderança Operacional</p>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">
                Assinatura do Colaborador Avaliado
              </span>
              <p className="font-bold text-white text-sm">{execution.signatureEmployee || execution.employeeName}</p>
              <div className="h-0.5 w-full bg-slate-800 rounded-full" />
              <p className="text-[11px] text-slate-500">Ciente da avaliação e orientações recebidas</p>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400">
            Status: <span className="font-bold text-emerald-400">{execution.status || 'Concluído'}</span> • Registrado no QLP Operacional
          </div>

          <div className="flex items-center gap-3">
            {onNewDTO && (
              <button
                onClick={() => {
                  onClose();
                  onNewDTO(execution.employeeId, execution.categoryId);
                }}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-lg shadow-amber-500/10"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Nova Avaliação para este Colaborador</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded-xl text-xs border border-slate-700 transition cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
