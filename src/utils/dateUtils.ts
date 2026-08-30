/**
 * Date utilities for DTO Management and Employee Admission handling
 */

export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const MONTH_NAMES_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

/**
 * Parses admission date string in either YYYY-MM-DD or DD/MM/YYYY format
 */
export function parseAdmissionDate(dateStr: string): { day: number; month: number; year: number } | null {
  if (!dateStr) return null;
  
  const clean = dateStr.trim();
  if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length >= 3) {
      return {
        year: parseInt(parts[0], 10),
        month: parseInt(parts[1], 10),
        day: parseInt(parts[2], 10)
      };
    }
  } else if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length >= 3) {
      return {
        day: parseInt(parts[0], 10),
        month: parseInt(parts[1], 10),
        year: parseInt(parts[2], 10)
      };
    }
  }
  return null;
}

/**
 * Checks if an employee was already admitted by the specified month and year.
 * An employee hired in June 2026 is NOT active in March 2026 and should not have DTO pendencies in March 2026.
 */
export function isEmployeeAdmittedInMonth(dateStr: string, month: number, year: number): boolean {
  if (!dateStr) return true; // Default fallback
  
  const parsed = parseAdmissionDate(dateStr);
  if (!parsed) return true;

  if (parsed.year < year) return true;
  if (parsed.year > year) return false;
  return parsed.month <= month;
}

/**
 * Formats a date string to Brazilian standard DD/MM/YYYY
 */
export function formatBRDate(dateStr: string): string {
  if (!dateStr) return '-';
  const parsed = parseAdmissionDate(dateStr);
  if (!parsed) return dateStr;
  
  const d = String(parsed.day).padStart(2, '0');
  const m = String(parsed.month).padStart(2, '0');
  const y = parsed.year;
  return `${d}/${m}/${y}`;
}

/**
 * Formats admission info badge text (e.g. "Admitido em 16/06/2026")
 */
export function getAdmissionStatusLabel(dateStr: string, currentMonth: number, currentYear: number): {
  isAdmitted: boolean;
  label: string;
  badgeText: string;
} {
  const isAdmitted = isEmployeeAdmittedInMonth(dateStr, currentMonth, currentYear);
  const formatted = formatBRDate(dateStr);
  
  if (isAdmitted) {
    return {
      isAdmitted: true,
      label: `Admitido em ${formatted}`,
      badgeText: 'Ativo no Mês'
    };
  } else {
    return {
      isAdmitted: false,
      label: `Contratado em ${formatted} (Posterior a este período)`,
      badgeText: 'Não admitido no período'
    };
  }
}
