import React, { useState } from 'react';
import { 
  Settings, 
  PlusCircle, 
  HelpCircle, 
  Layers, 
  Edit2, 
  CheckCircle2, 
  X, 
  Save, 
  ShieldCheck,
  Plus,
  Trash2,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { DTOCategory, DTOQuestion, RoleType } from '../types/dto';

interface DTOSettingsViewProps {
  categories: DTOCategory[];
  executionsCount?: number;
  onSaveCategories: (categories: DTOCategory[]) => void;
  onClearAllExecutions?: () => void;
}

const ALL_ROLES: RoleType[] = [
  'Motorista',
  'Carreteiro',
  'Ajudante de Armazém',
  'Operador de Empilhadeira',
  'Operador de Paleteira',
  'Conferente',
  'Mecânico / Manutenção',
  'Outro'
];

export const DTOSettingsView: React.FC<DTOSettingsViewProps> = ({
  categories,
  executionsCount,
  onSaveCategories,
  onClearAllExecutions
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(categories[0]?.id || '');
  const [newQuestionText, setNewQuestionText] = useState('');
  
  // Modal for new category
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatTitle, setNewCatTitle] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatRoles, setNewCatRoles] = useState<RoleType[]>([]);

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);

  // Add question to active category
  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim() || !selectedCategory) return;

    const newQuestion: DTOQuestion = {
      id: `${selectedCategory.id}-q-${Date.now()}`,
      categoryId: selectedCategory.id,
      questionText: newQuestionText.trim()
    };

    const updatedCategories = categories.map(cat => {
      if (cat.id === selectedCategory.id) {
        return {
          ...cat,
          questions: [...cat.questions, newQuestion]
        };
      }
      return cat;
    });

    onSaveCategories(updatedCategories);
    setNewQuestionText('');
  };

  // Create new category
  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatTitle.trim()) return;

    const newCategory: DTOCategory = {
      id: `dto-custom-${Date.now()}`,
      title: newCatTitle.startsWith('DTO') ? newCatTitle : `DTO - ${newCatTitle}`,
      description: newCatDesc || 'Categoria customizada de checklist de segurança.',
      requiredForRoles: newCatRoles.length > 0 ? newCatRoles : ALL_ROLES,
      questions: []
    };

    onSaveCategories([...categories, newCategory]);
    setSelectedCategoryId(newCategory.id);
    setIsCategoryModalOpen(false);
    setNewCatTitle('');
    setNewCatDesc('');
    setNewCatRoles([]);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Banner */}
      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 sm:p-6 text-white shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Settings className="w-4 h-4" />
            <span>Configurações & Ajustes da Operação Logística</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Gestão de DTOs & Perguntas
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Adicione novas perguntas ou crie novos tipos de DTO para atender a evolução do seu QLP e processos de segurança SST.
          </p>
        </div>

        <button
          onClick={() => setIsCategoryModalOpen(true)}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 transition transform active:scale-95 shrink-0"
        >
          <PlusCircle className="w-4 h-4 stroke-[2.5]" />
          <span>Criar Novo Tipo de DTO</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Categories Sidebar List */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl space-y-2">
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider px-2 pb-2 border-b border-white/10 flex justify-between items-center">
            <span>Tipos de DTO ({categories.length})</span>
            <span className="text-xs text-amber-400 font-bold">SST</span>
          </h3>

          <div className="space-y-1">
            {categories.map(cat => {
              const isSelected = cat.id === selectedCategoryId;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`w-full text-left p-3 rounded-xl text-xs transition flex items-center justify-between border ${
                    isSelected 
                      ? 'bg-amber-500/20 text-white font-bold border-amber-500/40 shadow-lg shadow-amber-500/10' 
                      : 'hover:bg-white/5 text-slate-300 font-medium border-transparent'
                  }`}
                >
                  <div className="pr-2">
                    <div className="text-sm text-slate-100 font-bold">{cat.title}</div>
                    <div className={`text-[11px] truncate max-w-[200px] ${isSelected ? 'text-amber-300' : 'text-slate-400'}`}>
                      {cat.questions.length} perguntas cadastradas
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold shrink-0 border ${
                    isSelected ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-white/10 text-slate-300 border-white/10'
                  }`}>
                    {cat.questions.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Category Details & Questions Editor */}
        <div className="lg:col-span-2 space-y-6">
          {selectedCategory && (
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-xl space-y-5 text-slate-100">
              
              {/* Category Info Header */}
              <div className="border-b border-white/10 pb-4">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Checklist Selecionado
                </span>
                <h3 className="text-xl font-extrabold text-slate-100">{selectedCategory.title}</h3>
                <p className="text-xs text-slate-400 mt-1">{selectedCategory.description}</p>
                
                <div className="mt-3 flex flex-wrap gap-1.5 items-center text-xs">
                  <span className="text-slate-400 font-medium mr-1">Exigido para:</span>
                  {(selectedCategory.requiredForRoles || ALL_ROLES).map(role => (
                    <span key={role} className="bg-white/10 border border-white/10 text-slate-200 font-semibold px-2 py-0.5 rounded-md text-[11px]">
                      {role}
                    </span>
                  ))}
                </div>
              </div>

              {/* Add New Question Form */}
              <form onSubmit={handleAddQuestion} className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-2 backdrop-blur-md">
                <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Adicionar Nova Pergunta a este DTO
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    placeholder="Digite a nova pergunta ou verificação de segurança..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shrink-0 shadow-lg shadow-amber-500/20 flex items-center gap-1 transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adicionar</span>
                  </button>
                </div>
              </form>

              {/* Existing Questions List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Perguntas Atuais ({selectedCategory.questions.length})
                </h4>

                <div className="space-y-2">
                  {selectedCategory.questions.map((q, idx) => (
                    <div key={q.id} className="p-3.5 bg-white/5 border border-white/10 rounded-xl text-xs flex items-start gap-3 hover:border-amber-400/40 transition">
                      <span className="bg-white/10 text-amber-400 font-bold px-2 py-0.5 rounded-md shrink-0 border border-white/10">
                        #{idx + 1}
                      </span>
                      <p className="text-slate-200 font-semibold leading-relaxed flex-1 pt-0.5">
                        {q.questionText}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>

      </div>

      {/* Database & Execution Cleanup Management */}
      <div className="bg-white/5 backdrop-blur-xl border border-rose-500/20 rounded-2xl p-5 shadow-xl text-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
            <Trash2 className="w-4 h-4" />
            <span>Gerenciamento de Registros de DTOs</span>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl">
            Zere todos os registros e relatórios de DTOs salvos para iniciar novos lançamentos limpos da operação.
            {executionsCount !== undefined && (
              <span className="font-semibold text-amber-300 ml-1">
                (Atualmente existem {executionsCount} registros de DTO armazenados).
              </span>
            )}
          </p>
        </div>

        {onClearAllExecutions && (
          <button
            onClick={() => {
              if (confirm('Atenção: Tem certeza que deseja ZERAR todos os registros de DTOs lançados? Esta ação limpará todo o histórico de execuções para que você possa lançar os relatórios reais.')) {
                onClearAllExecutions();
              }
            }}
            className="bg-rose-500/20 hover:bg-rose-500 text-rose-200 hover:text-white border border-rose-500/30 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition active:scale-95 shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Zerar Todos os Registros de DTOs</span>
          </button>
        )}
      </div>

      {/* Modal: New Category */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/15 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative text-slate-100">
            <button
              onClick={() => setIsCategoryModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-white/10 pb-3 mb-4">
              <div className="bg-amber-500 text-slate-950 p-2 rounded-2xl font-bold shadow-lg shadow-amber-500/20">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">Criar Novo Tipo de DTO</h3>
                <p className="text-xs text-slate-400">Defina o nome e a abrangência da nova lista de verificação.</p>
              </div>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Título do DTO *
                </label>
                <input
                  type="text"
                  required
                  value={newCatTitle}
                  onChange={(e) => setNewCatTitle(e.target.value)}
                  placeholder="Ex: DTO - Treinamento de Plataforma Elevatória"
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-sm font-semibold text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Descrição do Checklist
                </label>
                <textarea
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  rows={2}
                  placeholder="Descreva o propósito deste DTO..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 border border-white/10 rounded-xl text-slate-300 font-semibold hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-2 rounded-xl shadow-lg shadow-amber-500/20"
                >
                  Criar DTO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
