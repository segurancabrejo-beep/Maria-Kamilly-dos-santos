import React, { useState, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Building2, 
  Phone, 
  Mail, 
  Calendar, 
  Edit3, 
  UserCheck, 
  UserX, 
  Play, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Briefcase,
  CalendarCheck
} from 'lucide-react';
import { Employee, RoleType, UnitType, DTOExecution, DTOCategory } from '../types/dto';
import { getCategoriesForEmployee } from '../utils/storage';
import { formatBRDate, isEmployeeAdmittedInMonth } from '../utils/dateUtils';
import { isEmployeeMonitoredForDTO } from '../utils/employeeFilter';

interface EmployeesViewProps {
  employees: Employee[];
  categories: DTOCategory[];
  executions: DTOExecution[];
  selectedMonth: number;
  selectedYear: number;
  onAddEmployee: (employee: Employee) => void;
  onUpdateEmployee: (employee: Employee) => void;
  onStartDTOForEmployee: (employeeId: string, categoryId: string) => void;
}

const UNITS: UnitType[] = [
  'Filial Brejo',
  'Armazém Central',
  'Filial Matriz',
  'Centro de Distribuição Norte',
  'Unidade Logística Sul'
];

export const EmployeesView: React.FC<EmployeesViewProps> = ({
  employees,
  categories,
  executions,
  selectedMonth,
  selectedYear,
  onAddEmployee,
  onUpdateEmployee,
  onStartDTOForEmployee
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('Todas');
  const [yearFilter, setYearFilter] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState<'Ativo' | 'Inativo' | 'Todos'>('Ativo');
  const [dtoScopeFilter, setDtoScopeFilter] = useState<'Todos' | 'Monitorados' | 'ForaEscopo'>('Todos');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Selected Employee Details Modal
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);

  // Dynamic unique roles & admission years from current database
  const availableRoles = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.funcao) set.add(e.funcao);
    });
    return Array.from(set).sort();
  }, [employees]);

  const availableYears = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.dataAdmissao) {
        const yr = e.dataAdmissao.split('-')[0] || e.dataAdmissao.split('/')[2];
        if (yr) set.add(yr);
      }
    });
    return Array.from(set).sort().reverse();
  }, [employees]);

  // Form State
  const [formData, setFormData] = useState<Omit<Employee, 'id'>>({
    matricula: '',
    nome: '',
    funcao: 'Ajudante de Distribuição',
    setor: 'Distribuição Urbana',
    unidade: 'Filial Brejo',
    dataAdmissao: new Date().toISOString().split('T')[0],
    status: 'Ativo',
    telefone: '',
    email: ''
  });

  const handleOpenAddModal = () => {
    setEditingEmployee(null);
    setFormData({
      matricula: `QLP-${Math.floor(100 + Math.random() * 900)}`,
      nome: '',
      funcao: 'Ajudante de Distribuição',
      setor: 'Distribuição Urbana',
      unidade: 'Filial Brejo',
      dataAdmissao: new Date().toISOString().split('T')[0],
      status: 'Ativo',
      telefone: '',
      email: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({
      matricula: emp.matricula,
      nome: emp.nome,
      funcao: emp.funcao,
      setor: emp.setor,
      unidade: emp.unidade,
      dataAdmissao: emp.dataAdmissao,
      status: emp.status,
      telefone: emp.telefone || '',
      email: emp.email || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.matricula) return;

    if (editingEmployee) {
      onUpdateEmployee({
        ...editingEmployee,
        ...formData
      });
    } else {
      onAddEmployee({
        id: `emp-${Date.now()}`,
        ...formData
      });
    }
    setIsModalOpen(false);
  };

  // Filtered List
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const isMonitored = isEmployeeMonitoredForDTO(emp);
      if (dtoScopeFilter === 'Monitorados' && !isMonitored) return false;
      if (dtoScopeFilter === 'ForaEscopo' && isMonitored) return false;

      const matchStatus = statusFilter === 'Todos' || emp.status === statusFilter;
      const matchRole = roleFilter === 'Todas' || emp.funcao === roleFilter;
      
      let matchYear = true;
      if (yearFilter !== 'Todos') {
        matchYear = emp.dataAdmissao ? emp.dataAdmissao.startsWith(yearFilter) || emp.dataAdmissao.endsWith(yearFilter) : false;
      }

      const matchSearch = emp.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          emp.matricula.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          emp.funcao.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          emp.setor.toLowerCase().includes(searchTerm.toLowerCase());
      return matchStatus && matchRole && matchYear && matchSearch;
    });
  }, [employees, statusFilter, roleFilter, yearFilter, searchTerm, dtoScopeFilter]);

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Banner */}
      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 sm:p-6 text-white shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Users className="w-4 h-4" />
            <span>Gestão de Pessoas QLP Operacional</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Quadro de Colaboradores ({employees.length} Cadastrados)
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Controle de dados cadastrais, função, setor, data de admissão e acompanhamento individual de DTOs.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 transition active:scale-95 shrink-0 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Cadastrar Novo Colaborador</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar colaborador, matrícula ou função..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-amber-400 text-slate-100 placeholder-slate-500"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-slate-900 border border-white/10 rounded-xl text-xs px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-amber-400"
          >
            <option value="Todas">Todas as Funções ({availableRoles.length})</option>
            {availableRoles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>

          {/* Admission Year Filter */}
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="bg-slate-900 border border-white/10 rounded-xl text-xs px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-amber-400"
          >
            <option value="Todos">Todos os Anos de Admissão</option>
            {availableYears.map(yr => (
              <option key={yr} value={yr}>Admitidos em {yr}</option>
            ))}
          </select>

          {/* Status Filter */}
          <div className="flex bg-white/5 border border-white/10 p-1 rounded-xl text-xs font-semibold backdrop-blur-md">
            <button
              onClick={() => setStatusFilter('Ativo')}
              className={`flex-1 py-1 rounded-lg transition ${statusFilter === 'Ativo' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-emerald-400 hover:text-emerald-300'}`}
            >
              Ativos ({employees.filter(e => e.status === 'Ativo').length})
            </button>
            <button
              onClick={() => setStatusFilter('Todos')}
              className={`flex-1 py-1 rounded-lg transition ${statusFilter === 'Todos' ? 'bg-white/20 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Todos ({employees.length})
            </button>
          </div>

        </div>

        {/* DTO Monitoring Scope Pill Selector */}
        <div className="flex items-center gap-2 pt-2 border-t border-white/5 text-xs">
          <span className="text-slate-400 font-medium shrink-0">Escopo DTO:</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setDtoScopeFilter('Todos')}
              className={`px-2.5 py-1 rounded-lg transition ${dtoScopeFilter === 'Todos' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
            >
              Todos os Cargos ({employees.length})
            </button>
            <button
              onClick={() => setDtoScopeFilter('Monitorados')}
              className={`px-2.5 py-1 rounded-lg transition ${dtoScopeFilter === 'Monitorados' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-white/5 text-emerald-300 hover:bg-white/10'}`}
            >
              Acompanhados no DTO ({employees.filter(e => isEmployeeMonitoredForDTO(e)).length})
            </button>
            <button
              onClick={() => setDtoScopeFilter('ForaEscopo')}
              className={`px-2.5 py-1 rounded-lg transition ${dtoScopeFilter === 'ForaEscopo' ? 'bg-slate-700 text-white font-bold' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
            >
              Fora do Escopo DTO ({employees.filter(e => !isEmployeeMonitoredForDTO(e)).length})
            </button>
          </div>
        </div>
      </div>

      {/* Collaborators List / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEmployees.map(emp => {
          const isMonitored = isEmployeeMonitoredForDTO(emp);
          const isAdmittedInSelectedMonth = isEmployeeAdmittedInMonth(emp.dataAdmissao, selectedMonth, selectedYear);
          const requiredCats = isMonitored ? getCategoriesForEmployee(categories, emp) : [];
          
          const completedCount = requiredCats.filter(cat => 
            executions.some(exec => 
              exec.employeeId === emp.id && 
              exec.categoryId === cat.id && 
              exec.referenceMonth === selectedMonth && 
              exec.referenceYear === selectedYear &&
              exec.status === 'Concluído'
            )
          ).length;

          const isFullyDone = isMonitored && isAdmittedInSelectedMonth && requiredCats.length > 0 && completedCount === requiredCats.length;

          return (
            <div 
              key={emp.id}
              className={`backdrop-blur-md border rounded-2xl p-4 shadow-xl transition flex flex-col justify-between ${
                isMonitored 
                  ? 'bg-white/5 border-white/10 hover:border-amber-400/40' 
                  : 'bg-slate-900/60 border-white/5 opacity-80'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="text-sm font-bold text-white leading-tight">{emp.nome}</h3>
                    <span className="text-[11px] font-mono text-slate-400">Matrícula: {emp.matricula}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border shrink-0 ${
                      emp.status === 'Ativo' 
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                        : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                    }`}>
                      {emp.status}
                    </span>
                    {!isMonitored && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                        Fora do Escopo DTO
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300 my-3">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="font-semibold text-slate-200">{emp.funcao}</span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-400">
                    <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{emp.setor} • {emp.unidade}</span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-300">
                    <CalendarCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Admissão: <strong className="text-white">{formatBRDate(emp.dataAdmissao)}</strong></span>
                  </div>
                </div>

                {/* Status DTO indicator for reference month */}
                <div className="mt-3 pt-3 border-t border-white/10 text-[11px]">
                  {!isMonitored ? (
                    <span className="text-slate-400 bg-slate-800/80 border border-slate-700 px-2 py-0.5 rounded-md inline-block">
                      Função isenta de avaliação DTO
                    </span>
                  ) : !isAdmittedInSelectedMonth ? (
                    <span className="text-indigo-300 bg-indigo-500/15 border border-indigo-500/20 px-2 py-0.5 rounded-md inline-block">
                      Não admitido em {selectedMonth}/{selectedYear}
                    </span>
                  ) : isFullyDone ? (
                    <span className="text-emerald-300 bg-emerald-500/15 border border-emerald-500/20 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> DTOs de {selectedMonth}/{selectedYear} 100% OK
                    </span>
                  ) : (
                    <span className="text-amber-300 bg-amber-500/15 border border-amber-500/20 px-2 py-0.5 rounded-md inline-block">
                      {completedCount} de {requiredCats.length} DTOs concluídos ({selectedMonth}/{selectedYear})
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-white/5">
                <button
                  onClick={() => setViewingEmployee(emp)}
                  className="text-xs text-slate-300 hover:text-white font-medium underline-offset-2 hover:underline cursor-pointer"
                >
                  Ver Histórico
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenEditModal(emp)}
                    className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-white/10 rounded-lg transition cursor-pointer"
                    title="Editar Colaborador"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  {isMonitored && isAdmittedInSelectedMonth && requiredCats.length > 0 && (
                    <button
                      onClick={() => onStartDTOForEmployee(emp.id, requiredCats[0].id)}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 shadow transition active:scale-95 cursor-pointer"
                      title="Lançar Checklist DTO"
                    >
                      <Play className="w-3 h-3 fill-slate-950" />
                      <span>DTO</span>
                    </button>
                  )}
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1">
              {editingEmployee ? 'Editar Colaborador' : 'Novo Colaborador QLP'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Preencha os dados do colaborador para acompanhamento de conformidade de DTO.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Matrícula QLP *</label>
                  <input
                    type="text"
                    required
                    value={formData.matricula}
                    onChange={(e) => setFormData({ ...formData, matricula: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-400"
                    placeholder="Ex: QLP-012"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Data de Admissão *</label>
                  <input
                    type="date"
                    required
                    value={formData.dataAdmissao}
                    onChange={(e) => setFormData({ ...formData, dataAdmissao: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-400"
                  placeholder="Nome do colaborador"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Função / Cargo *</label>
                  <input
                    type="text"
                    required
                    value={formData.funcao}
                    onChange={(e) => setFormData({ ...formData, funcao: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-400"
                    placeholder="Ex: Motorista de Distribuição"
                    list="roleSuggestions"
                  />
                  <datalist id="roleSuggestions">
                    {availableRoles.map(r => <option key={r} value={r} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Setor / Área *</label>
                  <input
                    type="text"
                    required
                    value={formData.setor}
                    onChange={(e) => setFormData({ ...formData, setor: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-400"
                    placeholder="Ex: Distribuição Urbana"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Unidade Logística *</label>
                  <select
                    value={formData.unidade}
                    onChange={(e) => setFormData({ ...formData, unidade: e.target.value as UnitType })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-400"
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Status Cadastral</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Ativo' | 'Inativo' })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20"
                >
                  {editingEmployee ? 'Salvar Alterações' : 'Cadastrar Colaborador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details & Execution History Modal */}
      {viewingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setViewingEmployee(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4">
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider">{viewingEmployee.matricula}</span>
              <h3 className="text-xl font-bold text-white">{viewingEmployee.nome}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {viewingEmployee.funcao} • {viewingEmployee.setor} • {viewingEmployee.unidade} • Admissão: {formatBRDate(viewingEmployee.dataAdmissao)}
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Histórico de Avaliações DTO Realizadas
              </h4>

              {executions.filter(e => e.employeeId === viewingEmployee.id).length === 0 ? (
                <div className="p-8 text-center bg-white/5 border border-white/10 rounded-xl text-slate-400 text-xs">
                  Nenhum checklist DTO registrado até o momento para este colaborador.
                </div>
              ) : (
                <div className="space-y-2">
                  {executions.filter(e => e.employeeId === viewingEmployee.id).map(exec => (
                    <div 
                      key={exec.id}
                      className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-white">{exec.categoryTitle}</div>
                        <div className="text-slate-400 text-[11px]">
                          Data: {exec.date} • Avaliador: {exec.evaluatorName}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-lg font-bold text-xs ${
                          exec.conformityScore >= 90 
                            ? 'bg-emerald-500/20 text-emerald-300' 
                            : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {exec.conformityScore.toFixed(0)}% Conformidade
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setViewingEmployee(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
