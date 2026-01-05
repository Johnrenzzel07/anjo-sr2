'use client';

import { useState } from 'react';
import { JobOrder, UserRole } from '@/types';
import { useToast } from './ToastContainer';
import { useConfirm } from './useConfirm';

// Service Category to Department mapping for execution management
const SERVICE_CATEGORY_TO_DEPARTMENT: Record<string, string[]> = {
  'Technical Support': ['it'],
  'Facility Maintenance': ['maintenance'],
  'Account/Billing Inquiry': ['accounting'],
  'General Inquiry': ['general services'],
  'Other': ['operations'],
};

// Normalize department name for comparison
function normalizeDept(dept: string | undefined): string {
  return (dept || '').toLowerCase().replace(/\s+department$/, '').trim();
}

// Check if user is the handling department for this service category
function isHandlingDepartment(userDepartment: string | undefined, serviceCategory: string): boolean {
  const normalizedUserDept = normalizeDept(userDepartment);

  // President can handle all
  if (normalizedUserDept === 'president') {
    return true;
  }

  const authorizedDepts = SERVICE_CATEGORY_TO_DEPARTMENT[serviceCategory];
  if (!authorizedDepts) {
    // Default to operations for unknown categories
    return normalizedUserDept === 'operations';
  }

  return authorizedDepts.includes(normalizedUserDept);
}

// Get the display name for the handling department
function getHandlingDepartmentName(serviceCategory: string): string {
  const depts = SERVICE_CATEGORY_TO_DEPARTMENT[serviceCategory];
  if (!depts || depts.length === 0) return 'Operations';
  // Capitalize
  return depts[0].split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

interface ExecutionPanelProps {
  jobOrder: JobOrder;
  currentUser?: { role: UserRole; id: string; name: string; department?: string };
  hasPurchaseOrder?: boolean;
  hasCompletedTransfer?: boolean;
  onExecutionUpdate?: () => void;
}

export default function ExecutionPanel({ jobOrder, currentUser, hasPurchaseOrder, hasCompletedTransfer, onExecutionUpdate }: ExecutionPanelProps) {
  const toast = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [loading, setLoading] = useState(false);

  const userRole = currentUser?.role as string;
  const userDepartment = (currentUser as any)?.department;

  // Check if user is the handling department for this JO's service category
  const isHandlingDept = isHandlingDepartment(userDepartment, jobOrder.serviceCategory);
  const handlingDeptName = getHandlingDepartmentName(jobOrder.serviceCategory);

  // Handling department, Operations, Admin, or Super Admin can manage execution
  const canManageExecutionRole = isHandlingDept ||
    userRole === 'OPERATIONS' ||
    userRole === 'ADMIN' ||
    userRole === 'SUPER_ADMIN' ||
    (userRole === 'APPROVER' && normalizeDept(userDepartment) === 'operations');

  const isMaterialReq = jobOrder.type === 'MATERIAL_REQUISITION';
  const isServiceType = jobOrder.type === 'SERVICE';
  const hasMaterials = jobOrder.materials && jobOrder.materials.length > 0;

  // Check budget approval for Service type with materials
  const financeBudgetApproved = jobOrder.approvals?.some(
    (a: any) => a.role === 'FINANCE' && a.action === 'BUDGET_APPROVED'
  );
  const presidentBudgetApproved = jobOrder.approvals?.some(
    (a: any) => a.role === 'MANAGEMENT' && a.action === 'BUDGET_APPROVED'
  );
  const budgetCleared = financeBudgetApproved && presidentBudgetApproved;
  const serviceNeedsBudget = isServiceType && hasMaterials;
  const serviceBudgetReady = !serviceNeedsBudget || budgetCleared;

  // For Service type without materials: execution can start once JO is APPROVED
  // For Service type with materials: execution can start once JO is APPROVED AND budget is cleared
  // For Material Requisition: JO must be APPROVED AND a Purchase Order must exist AND material transfer completed
  const canStartExecution =
    jobOrder.status === 'APPROVED' &&
    canManageExecutionRole &&
    serviceBudgetReady &&
    (!isMaterialReq || (!!hasPurchaseOrder && !!hasCompletedTransfer));

  const canCompleteExecution =
    jobOrder.status === 'IN_PROGRESS' &&
    canManageExecutionRole;

  const handleStartExecution = async () => {
    const proceed = await confirm('Start fulfillment for this Job Order? This will set the status to IN_PROGRESS.', {
      title: 'Start Fulfillment',
      confirmButtonColor: 'green',
    });
    if (!proceed) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/job-orders/${jobOrder.id || jobOrder._id}/execution`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'START',
        }),
      });

      if (response.ok) {
        toast.showSuccess('Fulfillment started successfully!');
        onExecutionUpdate?.();
      } else {
        const error = await response.json();
        toast.showError(error.error || 'Failed to start execution');
      }
    } catch (error) {
      console.error('Error starting execution:', error);
      toast.showError('Failed to start execution');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteExecution = async () => {
    const proceed = await confirm('Mark this Job Order as fulfilled? This will set the status to COMPLETED.', {
      title: 'Mark as Fulfilled',
      confirmButtonColor: 'green',
    });
    if (!proceed) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/job-orders/${jobOrder.id || jobOrder._id}/execution`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'COMPLETE',
        }),
      });

      if (response.ok) {
        toast.showSuccess('Job Order marked as fulfilled!');
        onExecutionUpdate?.();
      } else {
        const error = await response.json();
        toast.showError(error.error || 'Failed to complete execution');
      }
    } catch (error) {
      console.error('Error completing execution:', error);
      toast.showError('Failed to complete execution');
    } finally {
      setLoading(false);
    }
  };

  if (jobOrder.status === 'CLOSED') {
    return (
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Execution Status</h3>
        <p className="text-sm text-gray-600">This Job Order has been closed.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Order Fulfillment</h3>

      {/* Execution Status */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Current Status:</span>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${jobOrder.status === 'IN_PROGRESS'
            ? 'bg-blue-100 text-blue-800'
            : jobOrder.status === 'COMPLETED'
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-800'
            }`}>
            {jobOrder.status.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Actual Start Date */}
        {jobOrder.acceptance?.actualStartDate && (
          <div className="mt-2 text-sm text-gray-600">
            <span className="font-medium">Started:</span>{' '}
            {new Date(jobOrder.acceptance.actualStartDate).toLocaleString()}
          </div>
        )}

        {/* Actual Completion Date */}
        {jobOrder.acceptance?.actualCompletionDate && (
          <div className="mt-2 text-sm text-gray-600">
            <span className="font-medium">Completed:</span>{' '}
            {new Date(jobOrder.acceptance.actualCompletionDate).toLocaleString()}
          </div>
        )}
      </div>

      {/* Info for Material Requisition about PO & transfer requirement */}
      {isMaterialReq && (
        <div className="mb-4 text-xs text-gray-600">
          {!hasPurchaseOrder
            ? 'Create a Purchase Order for this Material Requisition Job Order before starting execution.'
            : !hasCompletedTransfer
              ? 'Materials have not yet been fully transferred. Complete the material transfer before starting execution.'
              : 'A Purchase Order exists and materials are transferred.'}
        </div>
      )}

      {/* Info for Service type with materials about budget requirement */}
      {serviceNeedsBudget && !budgetCleared && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            ⚠️ This Service type Job Order includes materials. Budget must be approved by Finance and President before execution can start.
          </p>
        </div>
      )}

      {/* Schedule Milestones */}
      {jobOrder.schedule && jobOrder.schedule.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Schedule Milestones</h4>
          <div className="space-y-2">
            {jobOrder.schedule.map((milestone, index) => {
              const startDate = new Date(milestone.startDate);
              const endDate = new Date(milestone.endDate);
              const now = new Date();
              const isOverdue = endDate < now && jobOrder.status !== 'COMPLETED';
              const isActive = startDate <= now && endDate >= now && jobOrder.status === 'IN_PROGRESS';

              return (
                <div
                  key={milestone.id || index}
                  className={`p-3 rounded-md border ${isOverdue ? 'bg-red-50 border-red-200' :
                    isActive ? 'bg-blue-50 border-blue-200' :
                      'bg-gray-50 border-gray-200'
                    }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{milestone.activity}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                      </p>
                    </div>
                    {isOverdue && (
                      <span className="text-xs text-red-600 font-medium">Overdue</span>
                    )}
                    {isActive && (
                      <span className="text-xs text-blue-600 font-medium">Active</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
        {canStartExecution && (
          <button
            onClick={handleStartExecution}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-sm sm:text-base"
          >
            {loading ? 'Starting...' : 'Start Fulfillment'}
          </button>
        )}

        {canCompleteExecution && (
          <button
            onClick={handleCompleteExecution}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-sm sm:text-base"
          >
            {loading ? 'Completing...' : 'Mark as Fulfilled'}
          </button>
        )}

        {!canStartExecution && !canCompleteExecution && jobOrder.status !== 'COMPLETED' && (
          <p className="text-sm text-gray-500">
            {jobOrder.status === 'IN_PROGRESS'
              ? 'Fulfillment is in progress. Click the button above to mark as fulfilled.'
              : jobOrder.status === 'DRAFT'
                ? `Job Order is currently ${jobOrder.status}. It must be approved by President first. Once approved, ${handlingDeptName} Department can start execution.`
                : serviceNeedsBudget && !budgetCleared
                  ? 'Execution can only be started after budget is approved by Finance and President.'
                  : isMaterialReq && !hasPurchaseOrder
                    ? 'Create a Purchase Order and complete material transfer before starting execution.'
                    : isMaterialReq && !hasCompletedTransfer
                      ? 'Complete the material transfer before starting fulfillment.'
                      : `Fulfillment can only be started by ${handlingDeptName} Department or Admin when Job Order is APPROVED.`}
          </p>
        )}
      </div>
      <ConfirmDialog />
    </div>
  );
}

