export type RoleType = 
  | 'Ajudante de Distribuição'
  | 'Ajudante de Distribuição II'
  | 'Motorista de Distribuição'
  | 'Carreteiro'
  | 'Ajudante de Armazém Noturno'
  | 'Ajudante de Armazém Diurno'
  | 'Operador de Empilhadeira'
  | 'Operador de Empilhadeira Diurno'
  | 'Operador de Empilhadeira Noturno'
  | 'Operador de Paleteira'
  | 'Conferente'
  | 'Conferente Diurno'
  | 'Conferente Noturno'
  | 'Manobrista'
  | 'Auxiliar de Puxada'
  | 'Auxiliar de Logística'
  | 'Auxiliar de Controle'
  | 'Assistente de Segurança'
  | 'Assistente de Controle'
  | 'Representante de Negócios'
  | 'Representante de Negócios III'
  | 'Promotor'
  | 'Gerente de Vendas'
  | 'Gerente de Operações e Distribuição'
  | 'Coordenador de Armazém'
  | 'Coordenador de Distribuição'
  | 'Coordenadora de Gente'
  | 'Supervisor de Nível de Serviço'
  | 'Analista Financeiro'
  | 'Analista de Frota'
  | 'Auxiliar Financeiro'
  | 'Auxiliar de Serviços Gerais'
  | 'Cadastrador'
  | 'Caixa'
  | 'Jovem Aprendiz'
  | 'Jovem Aprendiz de Gente'
  | 'Jovem Aprendiz Faturista'
  | 'Jovem Aprendiz Armazém'
  | 'Jovem Aprendiz Entrega'
  | 'Estagiário Distribuição'
  | 'Estagiário de Vendas'
  | 'Estagiário Financeiro'
  | 'Estagiária de Gente'
  | 'Mecânico / Manutenção'
  | 'Outro'
  | string;

export type UnitType = 
  | 'Filial Brejo'
  | 'Armazém Central'
  | 'Filial Matriz'
  | 'Centro de Distribuição Norte'
  | 'Unidade Logística Sul';

export type ResponseStatus = 'C' | 'NC' | 'NA'; // Conforme, Não Conforme, Não Aplicável

export interface Employee {
  id: string;
  matricula: string;
  nome: string;
  funcao: RoleType;
  setor: string;
  unidade: UnitType;
  dataAdmissao: string;
  status: 'Ativo' | 'Inativo';
  telefone?: string;
  email?: string;
}

export interface DTOQuestion {
  id: string;
  categoryId: string;
  questionText: string;
  appliesToRoles?: RoleType[]; // Empty or undefined means applies to all roles
}

export interface DTOCategory {
  id: string;
  title: string;
  description: string;
  iconName?: string;
  requiredForRoles?: RoleType[]; // Roles that MUST complete this DTO monthly
  requiredForEmployeeNames?: string[]; // Specific employees who are targeted for this DTO (if set, restricts eligibility to these employees)
  requiredForEmployeeIds?: string[];
  questions: DTOQuestion[];
}

export interface QuestionResponse {
  questionId: string;
  status: ResponseStatus;
  coachingApplied: boolean;
  observation?: string;
}

export interface DTOExecution {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRole: RoleType;
  employeeUnit: UnitType;
  categoryId: string;
  categoryTitle: string;
  evaluatorName: string;
  evaluatorRole: string;
  date: string; // ISO date string YYYY-MM-DD
  referenceMonth: number; // 1-12
  referenceYear: number;  // e.g. 2026
  responses: QuestionResponse[];
  conformityScore: number; // 0 to 100 percentage
  totalQuestions: number;
  conformesCount: number;
  naoConformesCount: number;
  naCount: number;
  coachingCount: number;
  notes?: string;
  status: 'Concluído' | 'Em Andamento';
  signatureEvaluator?: string;
  signatureEmployee?: string;
}

export interface ActionPlanItem {
  id: string;
  executionId: string;
  employeeId: string;
  employeeName: string;
  questionId: string;
  questionText: string;
  dtoTitle: string;
  description: string;
  responsible: string;
  deadline: string;
  status: 'Pendente' | 'Em Andamento' | 'Concluído';
  createdAt: string;
}

export interface MonthlyPendency {
  employee: Employee;
  categoryId: string;
  categoryTitle: string;
  month: number;
  year: number;
  status: 'Concluído' | 'Pendente' | 'Atrasado';
  lastExecutionDate?: string;
  lastExecutionId?: string;
  lastScore?: number;
}
