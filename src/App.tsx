/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Navigation, TabType } from './components/Navigation';
import { DashboardView } from './components/DashboardView';
import { PendenciesView } from './components/PendenciesView';
import { DTOExecutionModal } from './components/DTOExecutionModal';
import { ReportsView } from './components/ReportsView';
import { ManageExecutionsView } from './components/ManageExecutionsView';
import { GoogleSheetsView } from './components/GoogleSheetsView';
import { EmployeesView } from './components/EmployeesView';
import { DTOSettingsView } from './components/DTOSettingsView';

import { 
  Employee, 
  DTOCategory, 
  DTOExecution, 
  ActionPlanItem 
} from './types/dto';

import { 
  getStoredEmployees, 
  saveEmployees, 
  getStoredCategories, 
  saveCategories, 
  getStoredExecutions, 
  saveExecutions, 
  getStoredActionPlans, 
  saveActionPlans,
  clearAllExecutions,
  resetToInitialData,
  getCategoriesForRole
} from './utils/storage';

export default function App() {
  // Global Filter State
  const [selectedMonth, setSelectedMonth] = useState<number>(8); // August
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedUnit, setSelectedUnit] = useState<string>('Todas as Unidades');

  // Navigation State
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  // Core Data States
  const [employees, setEmployees] = useState<Employee[]>(() => getStoredEmployees());
  const [categories, setCategories] = useState<DTOCategory[]>(() => getStoredCategories());
  const [executions, setExecutions] = useState<DTOExecution[]>(() => getStoredExecutions());
  const [actionPlans, setActionPlans] = useState<ActionPlanItem[]>(() => getStoredActionPlans());

  // Execution flow modal selection state
  const [executionEmployeeId, setExecutionEmployeeId] = useState<string | undefined>();
  const [executionCategoryId, setExecutionCategoryId] = useState<string | undefined>();

  // Persist edits to localStorage
  useEffect(() => {
    saveEmployees(employees);
  }, [employees]);

  useEffect(() => {
    saveCategories(categories);
  }, [categories]);

  useEffect(() => {
    saveExecutions(executions);
  }, [executions]);

  useEffect(() => {
    saveActionPlans(actionPlans);
  }, [actionPlans]);

  // Calculate pending DTOs count for current month and unit (1 DTO per month rule)
  const activeEmployees = employees.filter(e => e.status === 'Ativo' && (selectedUnit === 'Todas as Unidades' || e.unidade === selectedUnit));
  let totalPendingDTOs = 0;

  activeEmployees.forEach(emp => {
    const hasCompletedInMonth = executions.some(exec => 
      exec.employeeId === emp.id && 
      exec.referenceMonth === selectedMonth && 
      exec.referenceYear === selectedYear &&
      exec.status === 'Concluído'
    );
    if (!hasCompletedInMonth) totalPendingDTOs++;
  });

  // Handlers
  const handleStartDTO = (employeeId?: string, categoryId?: string) => {
    setExecutionEmployeeId(employeeId);
    setExecutionCategoryId(categoryId);
    setActiveTab('execute');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveExecution = (newExecution: DTOExecution) => {
    setExecutions(prev => [newExecution, ...prev]);

    // Generate automatic action plan items for non-conformities
    const newActionItems: ActionPlanItem[] = [];
    newExecution.responses.forEach(resp => {
      if (resp.status === 'NC' || resp.coachingApplied) {
        const cat = categories.find(c => c.id === newExecution.categoryId);
        const q = cat?.questions.find(item => item.id === resp.questionId);
        newActionItems.push({
          id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          executionId: newExecution.id,
          employeeId: newExecution.employeeId,
          employeeName: newExecution.employeeName,
          questionId: resp.questionId,
          questionText: q ? q.questionText : resp.questionId,
          dtoTitle: newExecution.categoryTitle,
          description: resp.observation || 'Coaching e acompanhamento de segurança em campo.',
          responsible: newExecution.evaluatorName,
          deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'Pendente',
          createdAt: newExecution.date
        });
      }
    });

    if (newActionItems.length > 0) {
      setActionPlans(prev => [...newActionItems, ...prev]);
    }

    // Return to dashboard with notification
    setActiveTab('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddEmployee = (newEmp: Employee) => {
    setEmployees(prev => [newEmp, ...prev]);
  };

  const handleUpdateEmployee = (updatedEmp: Employee) => {
    setEmployees(prev => prev.map(e => e.id === updatedEmp.id ? updatedEmp : e));
  };

  const handleSaveCategories = (updatedCategories: DTOCategory[]) => {
    setCategories(updatedCategories);
  };

  const handleImportExecutions = (newExecs: DTOExecution[]) => {
    setExecutions(prev => [...newExecs, ...prev]);
  };

  const handleDeleteExecution = (executionId: string) => {
    setExecutions(prev => prev.filter(e => e.id !== executionId));
    setActionPlans(prev => prev.filter(a => a.executionId !== executionId));
  };

  const handleDeleteMultipleExecutions = (ids: string[]) => {
    const set = new Set(ids);
    setExecutions(prev => prev.filter(e => !set.has(e.id)));
    setActionPlans(prev => prev.filter(a => !set.has(a.executionId)));
  };

  const handleClearAllExecutions = () => {
    setExecutions([]);
    setActionPlans([]);
    clearAllExecutions();
  };

  // Count total duplicate executions for the badge
  const duplicateCount = React.useMemo(() => {
    const map = new Map<string, number>();
    executions.forEach(exec => {
      const key = `${exec.employeeId}__${exec.referenceMonth}__${exec.referenceYear}__${exec.categoryId}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    let duplicates = 0;
    map.forEach(count => {
      if (count > 1) duplicates += (count - 1);
    });
    return duplicates;
  }, [executions]);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans antialiased flex flex-col relative overflow-x-hidden">
      {/* Ambient Mesh Background Elements for Frosted Glass Effect */}
      <div className="fixed top-[-10%] left-[-10%] w-[45%] h-[45%] bg-blue-600/20 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed top-[35%] left-[25%] w-[40%] h-[40%] bg-amber-500/10 rounded-full blur-[160px] pointer-events-none z-0" />

      {/* Top Header */}
      <div className="relative z-20">
        <Header
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          selectedUnit={selectedUnit}
          onMonthChange={setSelectedMonth}
          onYearChange={setSelectedYear}
          onUnitChange={setSelectedUnit}
          onNewDTO={() => handleStartDTO()}
          pendingCount={totalPendingDTOs}
          onResetData={resetToInitialData}
        />

        {/* Tab Navigation */}
        <Navigation
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          pendingCount={totalPendingDTOs}
          employeesCount={activeEmployees.length}
          duplicateCount={duplicateCount}
        />
      </div>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10">
        
        {activeTab === 'dashboard' && (
          <DashboardView
            employees={employees}
            categories={categories}
            executions={executions}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            selectedUnit={selectedUnit}
            onNavigateTab={(tab) => {
              setActiveTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onStartDTOForEmployee={handleStartDTO}
          />
        )}

        {activeTab === 'pendencies' && (
          <PendenciesView
            employees={employees}
            categories={categories}
            executions={executions}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            selectedUnit={selectedUnit}
            onStartDTO={handleStartDTO}
            onUpdateExecutions={(newExecs) => setExecutions(newExecs)}
          />
        )}

        {activeTab === 'execute' && (
          <DTOExecutionModal
            employees={activeEmployees}
            categories={categories}
            initialEmployeeId={executionEmployeeId}
            initialCategoryId={executionCategoryId}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onSaveExecution={handleSaveExecution}
            onCancel={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            executions={executions}
            employees={employees}
            categories={categories}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            selectedUnit={selectedUnit}
            onImportExecutions={handleImportExecutions}
            onDeleteExecution={handleDeleteExecution}
          />
        )}

        {activeTab === 'manage-executions' && (
          <ManageExecutionsView
            executions={executions}
            employees={employees}
            categories={categories}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            selectedUnit={selectedUnit}
            onDeleteExecution={handleDeleteExecution}
            onDeleteMultipleExecutions={handleDeleteMultipleExecutions}
          />
        )}

        {activeTab === 'sheets' && (
          <GoogleSheetsView
            employees={employees}
            categories={categories}
            executions={executions}
            onUpdateExecutions={(newExecs) => setExecutions(newExecs)}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            selectedUnit={selectedUnit}
          />
        )}

        {activeTab === 'employees' && (
          <EmployeesView
            employees={employees}
            categories={categories}
            executions={executions}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onAddEmployee={handleAddEmployee}
            onUpdateEmployee={handleUpdateEmployee}
            onStartDTOForEmployee={handleStartDTO}
          />
        )}

        {activeTab === 'settings' && (
          <DTOSettingsView
            categories={categories}
            executionsCount={executions.length}
            onSaveCategories={handleSaveCategories}
            onClearAllExecutions={handleClearAllExecutions}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Grupo Pau Brasil • Sistema Integrado de Gestão DTO e Segurança Operacional SST</span>
          <span>© {new Date().getFullYear()} — Diagnóstico de Trabalho Operacional</span>
        </div>
      </footer>

    </div>
  );
}
