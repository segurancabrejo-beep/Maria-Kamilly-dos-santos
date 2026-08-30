import { Employee, DTOCategory, DTOExecution, ResponseStatus } from '../types/dto';
import { isEmployeeAdmittedInMonth } from './dateUtils';
import { getCategoriesForEmployee } from './storage';
import { isEmployeeMonitoredForDTO } from './employeeFilter';

export interface AutoFillResult {
  newExecutions: DTOExecution[];
  filledCount: number;
  employeesCovered: number;
}

/**
 * Automatically generates complete 100% compliant DTO evaluations for all pending active collaborators
 * up to the current active month (August / month 8 in 2026) (EXCLUDING 'DTO - Relatos' and EXCLUDING non-monitored roles).
 */
export function generateAllPendingDTOs(
  employees: Employee[],
  categories: DTOCategory[],
  currentExecutions: DTOExecution[],
  year: number = 2026,
  maxMonth: number = 8
): AutoFillResult {
  const activeEmployees = employees.filter(e => e.status === 'Ativo' && isEmployeeMonitoredForDTO(e));
  const generatedExecutions: DTOExecution[] = [];
  const coveredEmployeeIds = new Set<string>();

  // Filter out DTO - Relatos from allowed categories
  const nonRelatoCategories = categories.filter(c => c.id !== 'dto-relatos');

  // Do not generate beyond the current month (August = 8) for 2026
  const monthLimit = year === 2026 ? Math.min(maxMonth, 8) : maxMonth;

  activeEmployees.forEach(emp => {
    // Get non-relato eligible categories for this employee
    const eligibleCategories = getCategoriesForEmployee(nonRelatoCategories, emp);
    const safeFallbackCategories = nonRelatoCategories.filter(c => 
      c.id !== 'dto-carregamento-baterias' && 
      c.id !== 'dto-carregamento-descarregamento' && 
      c.id !== 'dto-abastecimento-diesel'
    );
    const availableCategories = eligibleCategories.length > 0 ? eligibleCategories : safeFallbackCategories;

    const empNum = parseInt(emp.matricula.replace(/\D/g, '') || emp.id.replace(/\D/g, '') || '1', 10);

    for (let m = 1; m <= monthLimit; m++) {
      // Only generate if employee was admitted on or before this month
      if (!isEmployeeAdmittedInMonth(emp.dataAdmissao, m, year)) {
        continue;
      }

      // Check if employee already has a completed execution in this month
      const alreadyHasDTO = currentExecutions.some(exec => 
        exec.employeeId === emp.id && 
        exec.referenceMonth === m && 
        exec.referenceYear === year &&
        exec.status === 'Concluído'
      );

      if (alreadyHasDTO) {
        continue;
      }

      // Rotate through non-relato categories across months
      const catIndex = (m - 1 + empNum) % availableCategories.length;
      const category = availableCategories[catIndex] || availableCategories[0];

      // Alternating evaluators
      const isEvenMonth = m % 2 === 0;
      const evaluatorName = isEvenMonth 
        ? 'Djeanderson Soares do Nascimento' 
        : 'Maria Kamilly dos Santos';

      // Realistic business day inside the month
      const dayNum = 5 + ((empNum * 7 + m * 3) % 19);
      const dayStr = String(dayNum).padStart(2, '0');
      const monthStr = String(m).padStart(2, '0');
      const date = `${year}-${monthStr}-${dayStr}`;

      // Complete 100% compliant question responses
      const responses = category.questions.map(q => ({
        questionId: q.id,
        status: 'C' as ResponseStatus,
        coachingApplied: false
      }));

      const newExec: DTOExecution = {
        id: `exec-auto-${emp.id}-m${m}-${year}`,
        employeeId: emp.id,
        employeeName: emp.nome,
        employeeRole: emp.funcao,
        employeeUnit: emp.unidade,
        categoryId: category.id,
        categoryTitle: category.title,
        evaluatorName,
        evaluatorRole: 'Segurança do Trabalho / SST',
        date,
        referenceMonth: m,
        referenceYear: year,
        responses,
        conformityScore: 100,
        totalQuestions: category.questions.length,
        conformesCount: category.questions.length,
        naoConformesCount: 0,
        naCount: 0,
        coachingCount: 0,
        notes: 'Execução de Rotina SST - Gabarito Conforme',
        status: 'Concluído',
        signatureEvaluator: evaluatorName,
        signatureEmployee: emp.nome
      };

      generatedExecutions.push(newExec);
      coveredEmployeeIds.add(emp.id);
    }
  });

  return {
    newExecutions: generatedExecutions,
    filledCount: generatedExecutions.length,
    employeesCovered: coveredEmployeeIds.size
  };
}
