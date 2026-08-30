import * as XLSX from 'xlsx';
import { DTOExecution, Employee, DTOCategory } from '../types/dto';
import { MONTH_NAMES } from './dateUtils';
import { isEmployeeMonitoredForDTO, isRoleExcludedFromDTO } from './employeeFilter';

/**
 * Creates and downloads a complete multi-sheet Excel (.xlsx) workbook organized POR DTO (by DTO category).
 * Each DTO has its own dedicated worksheet with all specific question responses and metrics.
 */
export const exportGoogleSheetsWorkbook = (
  employees: Employee[],
  executions: DTOExecution[],
  categories: DTOCategory[],
  year: number = 2026,
  selectedUnit: string = 'Todas as Unidades',
  filename: string = `Base_DTO_Grupo_Pau_Brasil_por_DTO_${year}.xlsx`
) => {
  const wb = XLSX.utils.book_new();

  // Filter only active & monitored executions
  const filteredExecutions = executions.filter(e => 
    (e.categoryId === 'dto-relatos' || !isRoleExcludedFromDTO(e.employeeRole)) &&
    e.categoryId !== 'dto-rota-critica' &&
    (selectedUnit === 'Todas as Unidades' || e.employeeUnit === selectedUnit)
  );

  const filteredEmployees = employees.filter(e => 
    isEmployeeMonitoredForDTO(e) &&
    (selectedUnit === 'Todas as Unidades' || e.unidade === selectedUnit)
  );

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  // -------------------------------------------------------------
  // Sheet 1: Resumo Consolidado por DTO
  // -------------------------------------------------------------
  const summaryDTOs = categories.map(cat => {
    const catExecs = filteredExecutions.filter(e => e.categoryId === cat.id);
    const totalConforme = catExecs.reduce((acc, curr) => acc + curr.conformesCount, 0);
    const totalNC = catExecs.reduce((acc, curr) => acc + curr.naoConformesCount, 0);
    const totalNA = catExecs.reduce((acc, curr) => acc + curr.naCount, 0);
    const totalCoaching = catExecs.reduce((acc, curr) => acc + curr.coachingCount, 0);
    const uniqueCollaborators = new Set(catExecs.map(e => e.employeeId)).size;
    const avgScore = catExecs.length > 0 
      ? (catExecs.reduce((acc, curr) => acc + curr.conformityScore, 0) / catExecs.length).toFixed(1)
      : '0.0';

    return {
      'Código DTO': cat.id,
      'Título do DTO': cat.title,
      'Descrição': cat.description,
      'Total de Avaliações': catExecs.length,
      'Colaboradores Distintos': uniqueCollaborators,
      'Total de Questões': cat.questions.length,
      '% Conformidade Média': `${avgScore}%`,
      'Itens Conformes (C)': totalConforme,
      'Não Conformes (NC)': totalNC,
      'Não Aplicáveis (NA)': totalNA,
      'Ações de Coaching': totalCoaching,
      'Cargos Abrangidos': cat.requiredForRoles && cat.requiredForRoles.length > 0 ? cat.requiredForRoles.join(', ') : 'Todos os Cargos Operacionais'
    };
  });

  const wsSummary = XLSX.utils.json_to_sheet(summaryDTOs);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo por DTO');

  // -------------------------------------------------------------
  // Sheet 2: Matriz Mensal por DTO (DTO x 12 Meses)
  // -------------------------------------------------------------
  const dtoFixedMatrixRows = categories.map(cat => {
    const row: Record<string, any> = {
      'Código': cat.id,
      'Tipo de DTO': cat.title,
      'Cargos Elegíveis': cat.requiredForRoles && cat.requiredForRoles.length > 0 ? cat.requiredForRoles.join(', ') : 'Geral'
    };

    let totalAno = 0;
    let sumScoreAno = 0;

    for (let m = 1; m <= 12; m++) {
      const monthName = months[m - 1];
      const monthExecs = filteredExecutions.filter(e => 
        e.categoryId === cat.id && 
        e.referenceMonth === m && 
        e.referenceYear === year &&
        e.status === 'Concluído'
      );

      const count = monthExecs.length;
      totalAno += count;
      const monthAvg = count > 0 
        ? (monthExecs.reduce((acc, curr) => acc + curr.conformityScore, 0) / count).toFixed(0) + '%' 
        : '-';

      row[`${monthName} (Qtd)`] = count;
      row[`${monthName} (% Conf)`] = monthAvg;
      if (count > 0) {
        sumScoreAno += monthExecs.reduce((acc, curr) => acc + curr.conformityScore, 0);
      }
    }

    row['Total Realizado Ano'] = totalAno;
    row['% Conformidade Anual'] = totalAno > 0 ? `${(sumScoreAno / totalAno).toFixed(1)}%` : '-';

    return row;
  });

  const wsMatrixDTO = XLSX.utils.json_to_sheet(dtoFixedMatrixRows);
  XLSX.utils.book_append_sheet(wb, wsMatrixDTO, 'Matriz Mensal por DTO');

  // -------------------------------------------------------------
  // Dedicated Sheet per DTO Category (Aba exclusiva para cada DTO com gabarito e perguntas)
  // -------------------------------------------------------------
  categories.forEach(cat => {
    const catExecs = filteredExecutions.filter(e => {
      if (e.categoryId !== cat.id) return false;
      if (cat.id === 'dto-carregamento-baterias' || cat.id === 'dto-carregamento-descarregamento') {
        const roleLower = (e.employeeRole || '').toLowerCase();
        if (!roleLower.includes('empilhadeira') && !roleLower.includes('empilhador') && !roleLower.includes('empilh')) {
          return false;
        }
      }
      if (cat.id === 'dto-abastecimento-diesel') {
        const nameNorm = (e.employeeName || '').toUpperCase();
        if (!nameNorm.includes('DIOGENES') && !nameNorm.includes('DEJEAN')) {
          return false;
        }
      }
      return true;
    });
    
    // Shorten title for Excel tab limit (max 31 chars)
    const tabName = cat.title.replace('DTO - ', '').substring(0, 31);

    const sheetRows = catExecs.map(e => {
      const rowData: Record<string, any> = {
        'ID Avaliação': e.id,
        'Data de Aplicação': e.date,
        'Mês/Ano Ref': `${MONTH_NAMES[e.referenceMonth - 1] || e.referenceMonth}/${e.referenceYear}`,
        'Matrícula': e.employeeId,
        'Nome do Colaborador': e.employeeName,
        'Função / Cargo': e.employeeRole,
        'Unidade': e.employeeUnit,
        'Avaliador (TST)': e.evaluatorName,
        '% Conformidade': `${e.conformityScore.toFixed(1)}%`,
        'Status': e.status,
        'Conformes (C)': e.conformesCount,
        'Não Conformes (NC)': e.naoConformesCount,
        'Não Aplicáveis (NA)': e.naCount,
        'Coaching Aplicado': e.coachingCount > 0 ? `SIM (${e.coachingCount})` : 'NÃO',
        'Observações Gerais': e.notes || 'Rotina operacional conforme'
      };

      // Add column for each question of this specific DTO
      cat.questions.forEach((q, qIndex) => {
        const resp = e.responses.find(r => r.questionId === q.id);
        const colHeader = `Item ${qIndex + 1}: ${q.questionText}`;
        if (resp) {
          const statusText = resp.status === 'C' ? 'C (Conforme)' : resp.status === 'NC' ? 'NC (Não Conforme)' : 'NA (Não Aplicável)';
          rowData[colHeader] = resp.observation ? `${statusText} - Obs: ${resp.observation}` : statusText;
        } else {
          rowData[colHeader] = '-';
        }
      });

      return rowData;
    });

    const wsDTO = XLSX.utils.json_to_sheet(sheetRows.length > 0 ? sheetRows : [{
      'Mensagem': `Nenhuma avaliação registrada para ${cat.title} no filtro selecionado (${selectedUnit}).`
    }]);
    XLSX.utils.book_append_sheet(wb, wsDTO, tabName);
  });

  // -------------------------------------------------------------
  // Sheet: Base Geral de Todas Avaliações DTO
  // -------------------------------------------------------------
  const allExecutionsRows: Record<string, any>[] = filteredExecutions.map(e => ({
    'Tipo de DTO': e.categoryTitle,
    'ID Execução': e.id,
    'Data de Realização': e.date,
    'Mês Referência': `${MONTH_NAMES[e.referenceMonth - 1] || e.referenceMonth}/${e.referenceYear}`,
    'Ano': e.referenceYear,
    'Matrícula': e.employeeId,
    'Nome Colaborador': e.employeeName,
    'Função': e.employeeRole,
    'Unidade': e.employeeUnit,
    'Avaliador (SST/TST)': e.evaluatorName,
    'Conformidade (%)': `${e.conformityScore.toFixed(1)}%`,
    'Status DTO': e.status,
    'Total Perguntas': e.totalQuestions,
    'Conformes (C)': e.conformesCount,
    'Não Conformes (NC)': e.naoConformesCount,
    'Não Aplicáveis (NA)': e.naCount,
    'Coaching Aplicados': e.coachingCount,
    'Assinatura Avaliador': e.signatureEvaluator || e.evaluatorName,
    'Assinatura Colaborador': e.signatureEmployee || e.employeeName,
    'Observações / Notas': e.notes || 'Execução da Rotina - Conforme'
  }));

  const wsAllExecutions = XLSX.utils.json_to_sheet(allExecutionsRows);
  XLSX.utils.book_append_sheet(wb, wsAllExecutions, 'Base Geral DTOs');

  // -------------------------------------------------------------
  // Sheet: Matriz Farol por Colaborador (Auxiliar)
  // -------------------------------------------------------------
  const farolRows: Record<string, any>[] = filteredEmployees.map(emp => {
    let yearExecCount = 0;
    let sumScore = 0;
    const row: Record<string, any> = {
      'Matrícula': emp.matricula || emp.id,
      'Nome do Colaborador': emp.nome,
      'Função / Cargo': emp.funcao,
      'Setor': emp.setor,
      'Unidade': emp.unidade,
      'Data de Admissão': emp.dataAdmissao || '-',
      'Status': emp.status
    };

    for (let m = 1; m <= 12; m++) {
      const exec = filteredExecutions.find(e => 
        e.employeeId === emp.id && 
        e.referenceMonth === m && 
        e.referenceYear === year &&
        e.status === 'Concluído'
      );

      const monthName = months[m - 1];
      if (exec) {
        yearExecCount++;
        sumScore += exec.conformityScore;
        row[`DTO ${monthName}/${year}`] = exec.categoryTitle.replace('DTO - ', '');
        row[`Nota ${monthName}`] = `${exec.conformityScore.toFixed(0)}%`;
      } else {
        row[`DTO ${monthName}/${year}`] = 'PENDENTE';
        row[`Nota ${monthName}`] = '-';
      }
    }

    row['Total DTOs Ano'] = yearExecCount;
    row['% Média Conformidade'] = yearExecCount > 0 ? `${(sumScore / yearExecCount).toFixed(1)}%` : '-';

    return row;
  });

  const wsFarol = XLSX.utils.json_to_sheet(farolRows);
  XLSX.utils.book_append_sheet(wb, wsFarol, 'Farol Colaboradores');

  // Write and trigger download
  XLSX.writeFile(wb, filename);
};

/**
 * Downloads an Excel spreadsheet specifically for a SINGLE DTO category.
 */
export const exportSingleDTOWorkbook = (
  category: DTOCategory,
  executions: DTOExecution[],
  year: number = 2026,
  selectedUnit: string = 'Todas as Unidades'
) => {
  const wb = XLSX.utils.book_new();

  const filteredExecs = executions.filter(e => {
    if (e.categoryId !== category.id) return false;
    if (category.id !== 'dto-relatos' && isRoleExcludedFromDTO(e.employeeRole)) return false;
    if (selectedUnit !== 'Todas as Unidades' && e.employeeUnit !== selectedUnit) return false;
    if (category.id === 'dto-carregamento-baterias' || category.id === 'dto-carregamento-descarregamento') {
      const roleLower = (e.employeeRole || '').toLowerCase();
      if (!roleLower.includes('empilhadeira') && !roleLower.includes('empilhador') && !roleLower.includes('empilh')) {
        return false;
      }
    }
    if (category.id === 'dto-abastecimento-diesel') {
      const nameNorm = (e.employeeName || '').toUpperCase();
      if (!nameNorm.includes('DIOGENES') && !nameNorm.includes('DEJEAN')) {
        return false;
      }
    }
    return true;
  });

  const cleanName = category.title.replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').trim();

  // Tab 1: Avaliações do DTO com Respostas por Item
  const sheetRows = filteredExecs.map(e => {
    const rowData: Record<string, any> = {
      'ID Execução': e.id,
      'Data Aplicação': e.date,
      'Mês Referência': `${MONTH_NAMES[e.referenceMonth - 1] || e.referenceMonth}/${e.referenceYear}`,
      'Matrícula': e.employeeId,
      'Colaborador': e.employeeName,
      'Função / Cargo': e.employeeRole,
      'Unidade': e.employeeUnit,
      'Avaliador SST': e.evaluatorName,
      'Conformidade (%)': `${e.conformityScore.toFixed(1)}%`,
      'Status': e.status,
      'Conformes (C)': e.conformesCount,
      'Não Conformes (NC)': e.naoConformesCount,
      'Não Aplicáveis (NA)': e.naCount,
      'Coaching Aplicados': e.coachingCount,
      'Observações': e.notes || ''
    };

    category.questions.forEach((q, qIdx) => {
      const resp = e.responses.find(r => r.questionId === q.id);
      const col = `Item ${qIdx + 1}: ${q.questionText}`;
      if (resp) {
        const respLabel = resp.status === 'C' ? 'C' : resp.status === 'NC' ? 'NC' : 'NA';
        rowData[col] = resp.observation ? `${respLabel} (Obs: ${resp.observation})` : respLabel;
      } else {
        rowData[col] = '-';
      }
    });

    return rowData;
  });

  const wsDetail = XLSX.utils.json_to_sheet(sheetRows.length > 0 ? sheetRows : [{
    'Aviso': `Nenhum registro para ${category.title} encontrado.`
  }]);
  XLSX.utils.book_append_sheet(wb, wsDetail, cleanName.substring(0, 31));

  // Tab 2: Perguntas e Diretrizes do DTO
  const questionsRows = category.questions.map((q, idx) => ({
    'Nº': idx + 1,
    'Código Pergunta': q.id,
    'Diretriz / Pergunta': q.questionText,
    'Tipo de DTO': category.title
  }));
  const wsQuestions = XLSX.utils.json_to_sheet(questionsRows);
  XLSX.utils.book_append_sheet(wb, wsQuestions, 'Itens de Verificação');

  const filename = `Planilha_${cleanName.replace(/\s+/g, '_')}_${year}.xlsx`;
  XLSX.writeFile(wb, filename);
};

/**
 * Copies structured tabular data directly to clipboard in TSV format for instant Ctrl+V into Google Sheets
 */
export const copyTableToGoogleSheetsClipboard = async (
  headers: string[], 
  rows: (string | number)[][]
): Promise<boolean> => {
  try {
    const tsvContent = [
      headers.join('\t'),
      ...rows.map(row => row.map(val => String(val ?? '').replace(/[\t\n\r]/g, ' ')).join('\t'))
    ].join('\n');

    await navigator.clipboard.writeText(tsvContent);
    return true;
  } catch (err) {
    console.error('Falha ao copiar para a área de transferência:', err);
    return false;
  }
};

/**
 * Download a CSV file with UTF-8 BOM for perfect Excel / Google Sheets support with Portuguese characters.
 */
export const exportExecutionsToCSV = (executions: DTOExecution[], filename: string = 'Relatorio_DTO_Conformidade.csv') => {
  const filteredExecutions = executions.filter(e => e.categoryId === 'dto-relatos' || !isRoleExcludedFromDTO(e.employeeRole));
  const headers = [
    'ID Execução',
    'Data',
    'Mês Referência',
    'Ano Referência',
    'Matrícula',
    'Colaborador',
    'Função',
    'Unidade',
    'Tipo de DTO',
    'Avaliador (TST)',
    'Conformidade (%)',
    'Status DTO',
    'Total Perguntas',
    'Conformes (C)',
    'Não Conformes (NC)',
    'Não Aplicáveis (NA)',
    'Coaching Aplicados',
    'Observações / Notas'
  ];

  const rows = filteredExecutions.map(e => [
    e.id,
    e.date,
    `${e.referenceMonth}/${e.referenceYear}`,
    e.referenceYear,
    e.employeeId,
    `"${e.employeeName.replace(/"/g, '""')}"`,
    `"${e.employeeRole}"`,
    `"${e.employeeUnit}"`,
    `"${e.categoryTitle}"`,
    `"${e.evaluatorName}"`,
    `${e.conformityScore.toFixed(1)}%`,
    e.status,
    e.totalQuestions,
    e.conformesCount,
    e.naoConformesCount,
    e.naCount,
    e.coachingCount,
    `"${(e.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Export detailed question-by-question responses for a list of executions to CSV
 */
export const exportDetailedResponsesToCSV = (
  executions: DTOExecution[], 
  categories: DTOCategory[], 
  filename: string = 'Relatorio_Detalhado_Perguntas_DTO.csv'
) => {
  const filteredExecutions = executions.filter(e => e.categoryId === 'dto-relatos' || !isRoleExcludedFromDTO(e.employeeRole));
  const headers = [
    'ID Execução',
    'Data',
    'Colaborador',
    'Matrícula',
    'Função',
    'Unidade',
    'DTO Category',
    'Avaliador',
    'Pergunta ID',
    'Pergunta',
    'Resposta (C / NC / NA)',
    'Coaching Aplicado?',
    'Observação / Desvio'
  ];

  const rows: string[] = [];

  filteredExecutions.forEach(e => {
    const category = categories.find(c => c.id === e.categoryId);
    e.responses.forEach(r => {
      const q = category?.questions.find(qItem => qItem.id === r.questionId);
      const questionText = q ? q.questionText : r.questionId;
      rows.push([
        e.id,
        e.date,
        `"${e.employeeName.replace(/"/g, '""')}"`,
        e.employeeId,
        `"${e.employeeRole}"`,
        `"${e.employeeUnit}"`,
        `"${e.categoryTitle}"`,
        `"${e.evaluatorName}"`,
        r.questionId,
        `"${questionText.replace(/"/g, '""')}"`,
        r.status === 'C' ? 'Conforme' : r.status === 'NC' ? 'Não Conforme' : 'Não Aplicável',
        r.coachingApplied ? 'SIM' : 'NÃO',
        `"${(r.observation || '').replace(/"/g, '""')}"`
      ].join(';'));
    });
  });

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Export 12-month Farol Matrix per collaborator to CSV
 */
export const exportFarolMatrixToCSV = (
  employees: Employee[],
  executions: DTOExecution[],
  year: number,
  selectedUnit: string,
  filename: string = `Matriz_Farol_DTO_${year}.csv`
) => {
  const filteredEmployees = employees.filter(e => 
    isEmployeeMonitoredForDTO(e) && 
    (selectedUnit === 'Todas as Unidades' || e.unidade === selectedUnit)
  );
  const filteredExecutions = executions.filter(e => !isRoleExcludedFromDTO(e.employeeRole));

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  
  const headers = [
    'Matrícula',
    'Nome do Colaborador',
    'Função',
    'Setor',
    'Unidade',
    'Data Admissão',
    'Status Cadastral',
    ...months.map(m => `DTO ${m}/${year}`),
    ...months.map(m => `Nota ${m}/${year}`),
    'Total DTOs no Ano',
    '% Conformidade Média'
  ];

  const rows = filteredEmployees.map(emp => {
    let yearExecCount = 0;
    let sumScore = 0;

    const monthStatusCol: string[] = [];
    const monthScoreCol: string[] = [];

    for (let m = 1; m <= 12; m++) {
      const exec = filteredExecutions.find(e => 
        e.employeeId === emp.id && 
        e.referenceMonth === m && 
        e.referenceYear === year &&
        e.status === 'Concluído'
      );

      if (exec) {
        yearExecCount++;
        sumScore += exec.conformityScore;
        monthStatusCol.push(`"${exec.categoryTitle.replace('DTO - ', '')}"`);
        monthScoreCol.push(`${exec.conformityScore.toFixed(0)}%`);
      } else {
        monthStatusCol.push('PENDENTE');
        monthScoreCol.push('-');
      }
    }

    const avgScore = yearExecCount > 0 ? `${(sumScore / yearExecCount).toFixed(1)}%` : '-';

    return [
      emp.matricula || emp.id,
      `"${emp.nome.replace(/"/g, '""')}"`,
      `"${emp.funcao}"`,
      `"${emp.setor}"`,
      `"${emp.unidade}"`,
      emp.dataAdmissao || '-',
      emp.status,
      ...monthStatusCol,
      ...monthScoreCol,
      yearExecCount,
      avgScore
    ].join(';');
  });

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Triggers browser print on a formatted container for PDF export
 */
export const printElement = (elementId: string) => {
  const elem = document.getElementById(elementId);
  if (!elem) return;
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Relatório DTO - Grupo Pau Brasil</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; }
          h1, h2, h3 { margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-size: 13px; }
          th { background-color: #f1f5f9; font-weight: bold; }
          .badge { padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; }
          .badge-c { background-color: #dcfce7; color: #166534; }
          .badge-nc { background-color: #fee2e2; color: #991b1b; }
          .badge-na { background-color: #f1f5f9; color: #475569; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        ${elem.innerHTML}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};
