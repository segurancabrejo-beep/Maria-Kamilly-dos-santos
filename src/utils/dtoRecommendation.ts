import { Employee, DTOCategory, DTOExecution } from '../types/dto';
import { getCategoriesForEmployee } from './storage';
import { isEmployeeMonitoredForDTO, getExcludedRoleReason } from './employeeFilter';

export interface MonthlyRecommendation {
  categoryId: string;
  categoryTitle: string;
  isReapplication: boolean; // true if due to non-conformity in previous execution
  reason: string;
  previousExecution?: DTOExecution;
  isExcluded?: boolean;
}

/**
 * Finds the latest execution for a given employee prior to or at a given reference period
 */
export function getPreviousExecution(
  employeeId: string,
  executions: DTOExecution[],
  beforeMonth: number,
  beforeYear: number
): DTOExecution | undefined {
  const past = executions.filter(e => {
    if (e.employeeId !== employeeId || e.status !== 'Concluído') return false;
    if (e.referenceYear < beforeYear) return true;
    if (e.referenceYear === beforeYear && e.referenceMonth < beforeMonth) return true;
    return false;
  });

  if (past.length === 0) return undefined;

  // Sort descending by year, month, date
  past.sort((a, b) => {
    if (a.referenceYear !== b.referenceYear) return b.referenceYear - a.referenceYear;
    if (a.referenceMonth !== b.referenceMonth) return b.referenceMonth - a.referenceMonth;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return past[0];
}

/**
 * Determines the smart recommended DTO for an employee in a given month.
 * Rule:
 * 1. Exactly 1 DTO target per month per active employee.
 * 2. If the previous DTO had any Non-Conformity (NC > 0 or score < 100%), re-apply the same DTO to verify improvement.
 * 3. If previous DTO was 100% Conforme (or no previous history), rotate to the next applicable DTO for the role.
 */
export function getRecommendedDTOForMonth(
  employee: Employee,
  categories: DTOCategory[],
  executions: DTOExecution[],
  month: number,
  year: number
): MonthlyRecommendation {
  if (!isEmployeeMonitoredForDTO(employee)) {
    const reason = getExcludedRoleReason(employee.funcao) || 'Função fora do escopo de acompanhamento DTO';
    return {
      categoryId: '',
      categoryTitle: 'Fora do Escopo DTO',
      isReapplication: false,
      reason,
      isExcluded: true
    };
  }

  const eligibleCategories = getCategoriesForEmployee(categories, employee);
  
  if (eligibleCategories.length === 0) {
    const fallback = categories.find(c => c.id !== 'dto-relatos') || categories[0];
    return {
      categoryId: fallback.id,
      categoryTitle: fallback.title,
      isReapplication: false,
      reason: 'Checklist geral de segurança aplicável.'
    };
  }

  const prevExecution = getPreviousExecution(employee.id, executions, month, year);

  // Case 1: Previous DTO had Non-Conformity -> Reapply the SAME DTO
  if (prevExecution && prevExecution.naoConformesCount > 0) {
    const matchingCat = eligibleCategories.find(c => c.id === prevExecution.categoryId) || 
                         categories.find(c => c.id === prevExecution.categoryId);
    
    return {
      categoryId: prevExecution.categoryId,
      categoryTitle: matchingCat ? matchingCat.title : prevExecution.categoryTitle,
      isReapplication: true,
      reason: `Reaplicação prioritária: foram identificados itens Não Conformes (${prevExecution.naoConformesCount} NCs) no DTO de ${prevExecution.categoryTitle}. Necessário verificar evolução e eficácia das orientações.`,
      previousExecution: prevExecution
    };
  }

  // Case 2: No previous execution or previous was 100% Conforme -> Rotate through eligible categories
  // Find all executed category IDs for this employee in the past
  const pastExecs = executions.filter(e => e.employeeId === employee.id && e.status === 'Concluído');
  
  if (prevExecution) {
    // Find index of the last performed category among eligible
    const lastIndex = eligibleCategories.findIndex(c => c.id === prevExecution.categoryId);
    if (lastIndex !== -1) {
      // Pick next category in circular rotation
      const nextIndex = (lastIndex + 1) % eligibleCategories.length;
      const nextCat = eligibleCategories[nextIndex];
      return {
        categoryId: nextCat.id,
        categoryTitle: nextCat.title,
        isReapplication: false,
        reason: `Rodízio mensal: DTO anterior (${prevExecution.categoryTitle}) concluído com 100% de conformidade. Avançando para o próximo tema da função.`,
        previousExecution: prevExecution
      };
    }
  }

  // If no past execution or last was not in eligible list, choose based on month index or first eligible
  const monthOffset = (month - 1) % eligibleCategories.length;
  const targetCat = eligibleCategories[monthOffset] || eligibleCategories[0];

  return {
    categoryId: targetCat.id,
    categoryTitle: targetCat.title,
    isReapplication: false,
    reason: `Ciclo mensal programado para a função de ${employee.funcao}.`
  };
}
