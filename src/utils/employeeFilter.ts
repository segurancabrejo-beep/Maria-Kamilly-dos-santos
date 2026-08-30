import { Employee, RoleType } from '../types/dto';

/**
 * Normalizes string for comparison (removes accents, lowercase, trimmed).
 */
export function normalizeRole(role: string): string {
  if (!role) return '';
  return role
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Checks if a given role is explicitly EXCLUDED from DTO monitoring / acompanhamento.
 * 
 * Excluded functions:
 * - Coordenadora / Coordenador de Gente
 * - Coordenador de Distribuição
 * - Coordenador de Armazém
 * - Gerente de Operação e Distribuição / Gerente de Operações
 * - Supervisor de Nível de Serviço
 * - Gerente de Vendas
 * - Promotor (no geral)
 * - Representante de Negócios (no geral)
 * - Jovem Aprendiz (no geral)
 * - Estagiários (no geral: Distribuição, Vendas, Financeiro, Gente, etc.)
 */
export function isRoleExcludedFromDTO(role: string): boolean {
  if (!role) return false;
  const r = normalizeRole(role);

  // 1. Coordenadora de Gente / Coordenador de Gente
  if (r.includes('coordenador') && r.includes('gente')) return true;

  // 2. Coordenador de Distribuição
  if (r.includes('coordenador') && r.includes('distribui')) return true;

  // 3. Coordenador de Armazém
  if (r.includes('coordenador') && r.includes('armaz')) return true;

  // 4. Gerente de Operação e Distribuição / Gerente de Operações
  if (r.includes('gerente') && (r.includes('operac') || r.includes('distribui'))) return true;

  // 5. Supervisor de Nível de Serviço
  if (r.includes('supervisor') && (r.includes('servico') || r.includes('nivel'))) return true;

  // 6. Gerente de Vendas
  if (r.includes('gerente') && r.includes('venda')) return true;

  // 7. Promotor (no geral)
  if (r.includes('promotor')) return true;

  // 8. Representante de Negócios (no geral)
  if (r.includes('representante')) return true;

  // 9. Jovem Aprendiz (no geral)
  if (r.includes('aprendiz')) return true;

  // 10. Estagiários no geral (Estagiário, Estagiária, Estágio)
  if (r.includes('estagi') || r.includes('estagio')) return true;

  return false;
}

/**
 * Returns true if an employee is monitored for DTO (operational positions).
 */
export function isEmployeeMonitoredForDTO(employee: Employee | { funcao: string; status?: string } | null | undefined): boolean {
  if (!employee) return false;
  return !isRoleExcludedFromDTO(employee.funcao);
}

/**
 * Filters a list of employees to return only active and monitored employees for DTO.
 */
export function getMonitoredEmployees(employees: Employee[]): Employee[] {
  return employees.filter(e => isEmployeeMonitoredForDTO(e) && e.status === 'Ativo');
}

/**
 * Friendly label explaining why a role is outside DTO monitoring scope
 */
export function getExcludedRoleReason(role: string): string | null {
  if (!isRoleExcludedFromDTO(role)) return null;
  const r = normalizeRole(role);
  if (r.includes('coordenador') || r.includes('gerente') || r.includes('supervisor')) {
    return 'Cargo de Gestão / Liderança (Fora do escopo DTO operacional)';
  }
  if (r.includes('aprendiz') || r.includes('estagi')) {
    return 'Formação / Aprendiz / Estágio (Fora do escopo DTO operacional)';
  }
  if (r.includes('representante') || r.includes('promotor')) {
    return 'Área Comercial / Campo Externo (Fora do escopo DTO operacional)';
  }
  return 'Função Administrativa / Não Operacional';
}
