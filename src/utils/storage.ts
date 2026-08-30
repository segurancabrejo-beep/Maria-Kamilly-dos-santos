import { DTOCategory, Employee, DTOExecution, ActionPlanItem, RoleType } from '../types/dto';
import { INITIAL_DTO_CATEGORIES, INITIAL_EMPLOYEES, INITIAL_EXECUTIONS, INITIAL_ACTION_PLANS } from '../data/initialData';
import { generateAllPendingDTOs } from './autoFillPending';
import { isRoleExcludedFromDTO, isEmployeeMonitoredForDTO } from './employeeFilter';

const KEYS = {
  EMPLOYEES: 'dto_app_employees_v9',
  CATEGORIES: 'dto_app_categories_v9',
  EXECUTIONS: 'dto_app_executions_v9',
  ACTION_PLANS: 'dto_app_action_plans_v9'
};

export const getStoredEmployees = (): Employee[] => {
  const data = localStorage.getItem(KEYS.EMPLOYEES);
  if (!data) {
    localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(INITIAL_EMPLOYEES));
    return INITIAL_EMPLOYEES;
  }
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed) || parsed.length < 50) {
      // If cached data is from previous small mock list, update to the full 115 list
      localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(INITIAL_EMPLOYEES));
      return INITIAL_EMPLOYEES;
    }
    return parsed;
  } catch (e) {
    return INITIAL_EMPLOYEES;
  }
};

export const saveEmployees = (employees: Employee[]) => {
  localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(employees));
};

export const getStoredCategories = (): DTOCategory[] => {
  const data = localStorage.getItem(KEYS.CATEGORIES);
  if (!data) {
    localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(INITIAL_DTO_CATEGORIES));
    return INITIAL_DTO_CATEGORIES;
  }
  try {
    let parsed: DTOCategory[] = JSON.parse(data);
    const initialMap = new Map(INITIAL_DTO_CATEGORIES.map(c => [c.id, c]));
    let updated = false;

    // Sync official category properties (e.g. requiredForEmployeeNames, requiredForEmployeeIds, descriptions, questions)
    parsed = parsed.map(cat => {
      const initial = initialMap.get(cat.id);
      if (initial) {
        if (
          JSON.stringify(cat.requiredForEmployeeNames) !== JSON.stringify(initial.requiredForEmployeeNames) ||
          JSON.stringify(cat.requiredForEmployeeIds) !== JSON.stringify(initial.requiredForEmployeeIds) ||
          cat.description !== initial.description ||
          JSON.stringify(cat.requiredForRoles) !== JSON.stringify(initial.requiredForRoles) ||
          JSON.stringify(cat.questions) !== JSON.stringify(initial.questions)
        ) {
          updated = true;
          return {
            ...cat,
            title: initial.title,
            description: initial.description,
            requiredForRoles: initial.requiredForRoles,
            requiredForEmployeeNames: initial.requiredForEmployeeNames,
            requiredForEmployeeIds: initial.requiredForEmployeeIds,
            questions: initial.questions
          };
        }
      }
      return cat;
    });

    // Ensure all official categories (including dto-trabalho-nivel-diferente, dto-carregamento-baterias and dto-manuseio-materiais) are present
    const existingIds = new Set(parsed.map(c => c.id));
    INITIAL_DTO_CATEGORIES.forEach(cat => {
      if (!existingIds.has(cat.id)) {
        parsed.push(cat);
        updated = true;
      }
    });

    // Eliminate removed categories like dto-rota-critica
    const cleaned = parsed.filter(c => c.id !== 'dto-rota-critica');
    if (cleaned.length !== parsed.length) {
      parsed = cleaned;
      updated = true;
    }

    if (updated) {
      localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(parsed));
    }
    return parsed;
  } catch (e) {
    return INITIAL_DTO_CATEGORIES;
  }
};

export const saveCategories = (categories: DTOCategory[]) => {
  localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(categories));
};

export const getStoredExecutions = (): DTOExecution[] => {
  const data = localStorage.getItem(KEYS.EXECUTIONS);
  let baseList: DTOExecution[] = INITIAL_EXECUTIONS;
  if (data) {
    try {
      baseList = JSON.parse(data);
    } catch (e) {
      baseList = INITIAL_EXECUTIONS;
    }
  }

  try {
    const initialMap = new Map(INITIAL_EXECUTIONS.map(e => [e.id, e]));
    let updated = false;

    // Update matching initial executions if their date, categoryId or other key fields changed in base data
    let parsed = baseList.map(exec => {
      const initial = initialMap.get(exec.id);
      if (initial) {
        if (
          exec.date !== initial.date || 
          exec.referenceMonth !== initial.referenceMonth || 
          exec.referenceYear !== initial.referenceYear ||
          exec.categoryId !== initial.categoryId ||
          exec.conformityScore !== initial.conformityScore ||
          exec.employeeName !== initial.employeeName
        ) {
          updated = true;
          return { ...initial };
        }
      }
      return exec;
    });

    // Ensure any new official executions are merged if missing
    const existingIds = new Set(parsed.map(e => e.id));
    INITIAL_EXECUTIONS.forEach(exec => {
      if (!existingIds.has(exec.id)) {
        parsed.push(exec);
        updated = true;
      }
    });

    // Filter out eliminated categories (dto-rota-critica) and future months beyond August 2026
    const filteredParsed = parsed.filter(exec => {
      if (exec.categoryId === 'dto-rota-critica') return false;
      if (exec.referenceYear === 2026 && exec.referenceMonth > 8) return false;
      if (exec.date && exec.date > '2026-08-31') return false;
      return true;
    });
    if (filteredParsed.length !== parsed.length) {
      parsed = filteredParsed;
      updated = true;
    }

    const storedEmployees = getStoredEmployees();
    const storedCategories = getStoredCategories();
    const empMap = new Map(storedEmployees.map(emp => [emp.id, emp]));

    // Sanitize any existing executions in localStorage that were incorrectly assigned to non-eligible roles
    parsed = parsed.map(exec => {
      const emp = empMap.get(exec.employeeId);
      const role = emp ? emp.funcao : exec.employeeRole;
      const roleLower = (role || '').toLowerCase();
      const isEmpilhador = roleLower.includes('empilhadeira') || roleLower.includes('empilhador') || roleLower.includes('empilh');

      // 1. Carregamento de Baterias / Carregamento e Descarregamento MUST ONLY be for Empilhadores
      if ((exec.categoryId === 'dto-carregamento-baterias' || exec.categoryId === 'dto-carregamento-descarregamento') && !isEmpilhador) {
        updated = true;
        // Find valid categories for this employee (excluding relatos, baterias, carregamento-descarregamento, diesel)
        const validCats = storedCategories.filter(c => 
          c.id !== 'dto-relatos' && 
          c.id !== 'dto-carregamento-baterias' && 
          c.id !== 'dto-carregamento-descarregamento' && 
          c.id !== 'dto-abastecimento-diesel' &&
          (emp ? isCategoryApplicableForEmployee(c, emp) : isCategoryApplicableForRole(c, role as any))
        );
        const fallbackCats = storedCategories.filter(c => 
          c.id !== 'dto-relatos' && 
          c.id !== 'dto-carregamento-baterias' && 
          c.id !== 'dto-carregamento-descarregamento' && 
          c.id !== 'dto-abastecimento-diesel'
        );
        const eligible = validCats.length > 0 ? validCats : fallbackCats;
        const empNum = parseInt(exec.employeeId.replace(/\D/g, '') || '1', 10);
        const catIndex = ((exec.referenceMonth || 1) - 1 + empNum) % eligible.length;
        const newCat = eligible[catIndex] || eligible[0];

        const newResponses = newCat.questions.map(q => ({
          questionId: q.id,
          status: 'C' as const,
          coachingApplied: false
        }));

        return {
          ...exec,
          categoryId: newCat.id,
          categoryTitle: newCat.title,
          employeeRole: role,
          responses: newResponses,
          conformityScore: 100,
          totalQuestions: newCat.questions.length,
          conformesCount: newCat.questions.length,
          naoConformesCount: 0,
          naCount: 0,
          coachingCount: 0,
          notes: 'Execução de Rotina SST - Gabarito Conforme'
        };
      }

      // 2. Abastecimento de Diesel MUST ONLY be for Diógenes Pereira and Dejean Silva
      if (exec.categoryId === 'dto-abastecimento-diesel') {
        const empNameNorm = (emp ? emp.nome : exec.employeeName || '').toUpperCase();
        const isAuthorizedDiesel = empNameNorm.includes('DIOGENES') || empNameNorm.includes('DEJEAN');
        if (!isAuthorizedDiesel) {
          updated = true;
          const validCats = storedCategories.filter(c => 
            c.id !== 'dto-relatos' && 
            c.id !== 'dto-abastecimento-diesel' &&
            c.id !== 'dto-carregamento-baterias' &&
            c.id !== 'dto-carregamento-descarregamento'
          );
          const newCat = validCats[0] || storedCategories[0];
          const newResponses = newCat.questions.map(q => ({
            questionId: q.id,
            status: 'C' as const,
            coachingApplied: false
          }));
          return {
            ...exec,
            categoryId: newCat.id,
            categoryTitle: newCat.title,
            responses: newResponses,
            conformityScore: 100,
            totalQuestions: newCat.questions.length,
            conformesCount: newCat.questions.length,
            naoConformesCount: 0,
            naCount: 0,
            coachingCount: 0
          };
        }
      }

      return exec;
    });

    // Auto fill all pending gabaritos across all active monitored employees for 2026 up to August (excluding relato)
    const fillResult = generateAllPendingDTOs(storedEmployees, storedCategories, parsed, 2026, 8);
    if (fillResult.newExecutions.length > 0) {
      parsed = [...parsed, ...fillResult.newExecutions];
      updated = true;
    }

    if (updated || !data) {
      localStorage.setItem(KEYS.EXECUTIONS, JSON.stringify(parsed));
    }
    return parsed;
  } catch (e) {
    return INITIAL_EXECUTIONS;
  }
};

export const saveExecutions = (executions: DTOExecution[]) => {
  localStorage.setItem(KEYS.EXECUTIONS, JSON.stringify(executions));
};

export const clearAllExecutions = () => {
  localStorage.setItem(KEYS.EXECUTIONS, JSON.stringify([]));
  localStorage.setItem(KEYS.ACTION_PLANS, JSON.stringify([]));
};

export const getStoredActionPlans = (): ActionPlanItem[] => {
  const data = localStorage.getItem(KEYS.ACTION_PLANS);
  if (!data) {
    localStorage.setItem(KEYS.ACTION_PLANS, JSON.stringify(INITIAL_ACTION_PLANS));
    return INITIAL_ACTION_PLANS;
  }
  try {
    let parsed: ActionPlanItem[] = JSON.parse(data);
    const initialMap = new Map(INITIAL_ACTION_PLANS.map(p => [p.id, p]));
    let updated = false;

    // Update matching initial plans if their dates or status changed in base data
    parsed = parsed.map(plan => {
      const initial = initialMap.get(plan.id);
      if (initial && (plan.createdAt !== initial.createdAt || plan.deadline !== initial.deadline || plan.status !== initial.status)) {
        updated = true;
        return { ...plan, createdAt: initial.createdAt, deadline: initial.deadline, status: initial.status };
      }
      return plan;
    });

    const existingIds = new Set(parsed.map(p => p.id));
    INITIAL_ACTION_PLANS.forEach(plan => {
      if (!existingIds.has(plan.id)) {
        parsed.push(plan);
        updated = true;
      }
    });
    if (updated) {
      localStorage.setItem(KEYS.ACTION_PLANS, JSON.stringify(parsed));
    }
    return parsed;
  } catch (e) {
    return INITIAL_ACTION_PLANS;
  }
};

export const saveActionPlans = (plans: ActionPlanItem[]) => {
  localStorage.setItem(KEYS.ACTION_PLANS, JSON.stringify(plans));
};

export const resetToInitialData = () => {
  localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(INITIAL_EMPLOYEES));
  localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(INITIAL_DTO_CATEGORIES));
  localStorage.setItem(KEYS.EXECUTIONS, JSON.stringify(INITIAL_EXECUTIONS));
  localStorage.setItem(KEYS.ACTION_PLANS, JSON.stringify(INITIAL_ACTION_PLANS));
  window.location.reload();
};

/**
 * Checks whether a specific DTO category applies to a given employee.
 * Special Rule: "DTO - Abastecimento de Diesel" applies EXCLUSIVELY to Diogenes Pereira da Silva and Dejean Silva de Oliveira.
 */
export const isCategoryApplicableForEmployee = (cat: DTOCategory, employee: Employee): boolean => {
  if (!employee) return false;
  if (!isEmployeeMonitoredForDTO(employee)) return false;
  const empNameNorm = employee.nome.toUpperCase().trim();
  
  // Specific restriction for Abastecimento de Diesel
  if (cat.id === 'dto-abastecimento-diesel') {
    const isDiogenesOrDejean = 
      empNameNorm.includes('DIOGENES') || 
      empNameNorm.includes('DEJEAN') || 
      employee.id === 'emp-021' || 
      employee.id === 'emp-018' ||
      employee.matricula === 'QLP-021' ||
      employee.matricula === 'QLP-018';
    
    return isDiogenesOrDejean;
  }

  // If category specifies designated employees
  if (cat.requiredForEmployeeNames && cat.requiredForEmployeeNames.length > 0) {
    const isNamed = cat.requiredForEmployeeNames.some(name => {
      const n = name.toUpperCase().trim();
      return empNameNorm.includes(n) || n.includes(empNameNorm);
    });
    if (isNamed) return true;
    if (cat.requiredForEmployeeIds && cat.requiredForEmployeeIds.includes(employee.id)) return true;
    // If specific employee names are specified and this employee is not one of them, return false
    return false;
  }

  // Fallback to role-based check
  return isCategoryApplicableForRole(cat, employee.funcao);
};

/**
 * Checks if category applies to a role
 */
export const isCategoryApplicableForRole = (cat: DTOCategory, role: RoleType): boolean => {
  if (!role) return false;
  if (isRoleExcludedFromDTO(role)) return false;
  const roleLower = role.toLowerCase();

  // Abastecimento de Diesel is restricted to specific employees only
  if (cat.id === 'dto-abastecimento-diesel') {
    return false;
  }

  // DTO de Carregamento de Baterias e DTO de Carregamento e Descarregamento se aplicam EXCLUSIVAMENTE aos Empilhadores
  if (cat.id === 'dto-carregamento-baterias' || cat.id === 'dto-carregamento-descarregamento') {
    return (
      roleLower.includes('empilhadeira') ||
      roleLower.includes('empilhador') ||
      roleLower.includes('empilh')
    );
  }

  // Direct match in requiredForRoles
  if (cat.requiredForRoles && cat.requiredForRoles.length > 0) {
    const hasDirectMatch = cat.requiredForRoles.some(r => 
      r.toLowerCase() === roleLower || roleLower.includes(r.toLowerCase()) || r.toLowerCase().includes(roleLower)
    );
    if (hasDirectMatch) return true;
  }

  // Semantic Role Matching
  // Motoristas / Carreteiros / Manobristas
  if (roleLower.includes('motorista') || roleLower.includes('carreteiro') || roleLower.includes('manobrista')) {
    if (
      cat.id === 'dto-relatos' || 
      cat.id === 'dto-epi' || 
      cat.id === 'dto-telemetria' || 
      cat.id === 'dto-seguranca-trajeto' || 
      cat.id === 'dto-manuseio-materiais' ||
      cat.id === 'dto-trabalho-nivel-diferente'
    ) {
      return true;
    }
  }

  // Ajudantes / Puxada / Carga / Movimentação
  if (roleLower.includes('ajudante') || roleLower.includes('puxada') || roleLower.includes('auxiliar')) {
    if (
      cat.id === 'dto-relatos' || 
      cat.id === 'dto-epi' || 
      cat.id === 'dto-ergonomia-manuseio' || 
      cat.id === 'dto-transporte-seguro' || 
      cat.id === 'dto-seguranca-trajeto' || 
      cat.id === 'dto-manuseio-materiais' ||
      cat.id === 'dto-trabalho-nivel-diferente'
    ) {
      return true;
    }
  }

  // Operadores de Empilhadeira / Empilhadores
  if (roleLower.includes('empilhadeira') || roleLower.includes('empilhador') || roleLower.includes('empilh')) {
    if (
      cat.id === 'dto-relatos' ||
      cat.id === 'dto-epi' ||
      cat.id === 'dto-transporte-seguro' ||
      cat.id === 'dto-sam-loto' ||
      cat.id === 'dto-carregamento-descarregamento' ||
      cat.id === 'dto-carregamento-baterias' ||
      cat.id === 'dto-seguranca-trajeto' ||
      cat.id === 'dto-manuseio-materiais' ||
      cat.id === 'dto-trabalho-nivel-diferente'
    ) {
      return true;
    }
  }

  // Operadores de Paleteira / Conferentes
  if (roleLower.includes('paleteira') || roleLower.includes('conferente') || roleLower.includes('estoquista')) {
    if (
      cat.id === 'dto-relatos' ||
      cat.id === 'dto-epi' ||
      cat.id === 'dto-transporte-seguro' ||
      cat.id === 'dto-ergonomia-manuseio' ||
      cat.id === 'dto-seguranca-trajeto' ||
      cat.id === 'dto-manuseio-materiais' ||
      cat.id === 'dto-trabalho-nivel-diferente'
    ) {
      return true;
    }
  }

  // Serviços Gerais / Facilities
  if (roleLower.includes('serviço') || roleLower.includes('servico') || roleLower.includes('facilities') || roleLower.includes('limpeza')) {
    if (
      cat.id === 'dto-relatos' || 
      cat.id === 'dto-epi' || 
      cat.id === 'dto-seguranca-trajeto' || 
      cat.id === 'dto-manuseio-materiais' ||
      cat.id === 'dto-trabalho-nivel-diferente'
    ) {
      return true;
    }
  }

  // Mecânico / Manutenção
  if (roleLower.includes('mecânico') || roleLower.includes('mecanico') || roleLower.includes('manutenção') || roleLower.includes('manutencao') || roleLower.includes('eletricista')) {
    if (
      cat.id === 'dto-relatos' ||
      cat.id === 'dto-epi' ||
      cat.id === 'dto-sam-loto' ||
      cat.id === 'dto-seguranca-trajeto' ||
      cat.id === 'dto-manuseio-materiais' ||
      cat.id === 'dto-trabalho-nivel-diferente'
    ) {
      return true;
    }
  }

  // General default safety DTOs for all operational positions
  if (
    cat.id === 'dto-relatos' || 
    cat.id === 'dto-epi' || 
    cat.id === 'dto-seguranca-trajeto' || 
    cat.id === 'dto-manuseio-materiais' ||
    cat.id === 'dto-trabalho-nivel-diferente'
  ) {
    return true;
  }

  return false;
};

/**
 * Returns required DTO categories for a specific employee (taking into account individual authorized assignments)
 */
export const getCategoriesForEmployee = (categories: DTOCategory[], employee: Employee): DTOCategory[] => {
  if (!employee) return categories;
  return categories.filter(cat => isCategoryApplicableForEmployee(cat, employee));
};

/**
 * Returns required DTO categories for a specific employee role
 */
export const getCategoriesForRole = (categories: DTOCategory[], role: RoleType): DTOCategory[] => {
  if (!role) return categories;
  return categories.filter(cat => isCategoryApplicableForRole(cat, role));
};
