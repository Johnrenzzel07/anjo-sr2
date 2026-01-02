'use client';

import { useState, useEffect } from 'react';
import { JobOrder, UserRole } from '@/types';
import { useToast } from './ToastContainer';
import { useConfirm } from './useConfirm';

interface BudgetPanelProps {
  jobOrder: JobOrder;
  currentUser?: { role: UserRole; id: string; name: string };
  onBudgetUpdate?: () => void;
}

export default function BudgetPanel({ jobOrder, currentUser, onBudgetUpdate }: BudgetPanelProps) {
  const toast = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const formatCurrency = (value: number) =>
    value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const [loading, setLoading] = useState(false);
  const [estimatedTotalCost, setEstimatedTotalCost] = useState(
    jobOrder.budget?.estimatedTotalCost || 0
  );
  const [costInputValue, setCostInputValue] = useState(
    jobOrder.budget?.estimatedTotalCost ? formatCurrency(jobOrder.budget.estimatedTotalCost) : ''
  );

  // Calculate estimated cost from materials and outsource price
  useEffect(() => {
    let calculated = 0;
    
    // Calculate from materials
    // Note: estimatedCost is already the total (quantity × unitPrice), so we just sum them up
    if (jobOrder.materials && jobOrder.materials.length > 0) {
      calculated = jobOrder.materials.reduce((sum, material) => {
        return sum + (material.estimatedCost || 0);
      }, 0);
    }
    
    // Add outsource price if available
    if (jobOrder.manpower?.outsourcePrice) {
      calculated += jobOrder.manpower.outsourcePrice;
    }
    
    if (calculated > 0 && !jobOrder.budget?.estimatedTotalCost) {
      setEstimatedTotalCost(calculated);
      setCostInputValue(formatCurrency(calculated));
    }
  }, [jobOrder.materials, jobOrder.manpower?.outsourcePrice, jobOrder.budget?.estimatedTotalCost]);

  // Check if user can edit budget (Finance by department or President/SUPER_ADMIN)
  const userRole = currentUser?.role as any;
  const userDepartment = (currentUser as any)?.department;
  const isFinance = userDepartment === 'Finance';
  const isPresident = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
  const canEditBudget = isFinance || isPresident;
  
  const financeApproved = jobOrder.approvals?.some(
    (a: any) => a.role === 'FINANCE' && a.action === 'BUDGET_APPROVED'
  );
  const presidentApproved = jobOrder.approvals?.some(
    (a: any) => a.role === 'MANAGEMENT' && a.action === 'BUDGET_APPROVED'
  );
  // Budget is only cleared when BOTH Finance and President have approved the budget specifically
  // NOT when Job Order status is APPROVED - these are separate approval processes
  const budgetCleared = financeApproved && presidentApproved;

  // Check if Service type has materials - if so, it needs budget approval
  const isServiceType = jobOrder.type === 'SERVICE';
  const hasMaterials = jobOrder.materials && jobOrder.materials.length > 0;
  const needsBudgetApproval = !isServiceType || (isServiceType && hasMaterials);
  
  // Finance can approve anytime (if not already approved by them)
  // President can only approve AFTER Finance has approved
  const canApproveBudget = canEditBudget && !budgetCleared && needsBudgetApproval && 
    (isFinance || (isPresident && financeApproved));
  
  // President cannot edit budget until Finance has approved
  const canActuallyEditBudget = isFinance || (isPresident && financeApproved);
  const hasApproved = financeApproved || presidentApproved;
  const userHasApproved = jobOrder.approvals?.some(
    (a: any) => a.userId === currentUser?.id && a.action === 'BUDGET_APPROVED'
  );


  const handleApproveBudget = async () => {
    const proceed = await confirm('Approve this budget? This will add your approval to the Job Order.', {
      title: 'Approve Budget',
      confirmButtonColor: 'green',
    });
    if (!proceed) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/job-orders/${jobOrder.id || jobOrder._id}/budget`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estimatedTotalCost: parseFloat(estimatedTotalCost.toString()) || 0,
          action: 'APPROVE',
        }),
      });

      if (response.ok) {
        toast.showSuccess('Budget approved successfully!');
        onBudgetUpdate?.();
      } else {
        const error = await response.json();
        toast.showError(error.error || 'Failed to approve budget');
      }
    } catch (error) {
      console.error('Error approving budget:', error);
      toast.showError('Failed to approve budget');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectBudget = async () => {
    const proceed = await confirm('Reject this budget? This will add your rejection to the Job Order.', {
      title: 'Reject Budget',
      confirmButtonColor: 'red',
    });
    if (!proceed) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/job-orders/${jobOrder.id || jobOrder._id}/budget`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REJECT',
        }),
      });

      if (response.ok) {
        toast.showSuccess('Budget rejected.');
        onBudgetUpdate?.();
      } else {
        const error = await response.json();
        toast.showError(error.error || 'Failed to reject budget');
      }
    } catch (error) {
      console.error('Error rejecting budget:', error);
      toast.showError('Failed to reject budget');
    } finally {
      setLoading(false);
    }
  };

  // Calculate from materials and outsource price if not set
  // Note: estimatedCost is already the total (quantity × unitPrice), so we just sum them up
  const calculatedCost = (() => {
    let cost = 0;
    
    // Calculate from materials
    if (jobOrder.materials && jobOrder.materials.length > 0) {
      cost = jobOrder.materials.reduce((sum, material) => {
        return sum + (material.estimatedCost || 0);
      }, 0);
    }
    
    // Add outsource price if available
    if (jobOrder.manpower?.outsourcePrice) {
      cost += jobOrder.manpower.outsourcePrice;
    }
    
    return cost;
  })();

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Budget Information</h2>
      
      {/* Budget Status - Show when budget is cleared */}
      {needsBudgetApproval && budgetCleared && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm font-medium text-green-800">
            ✓ Budget Cleared - Approved by Finance and President
          </p>
        </div> 
      )}

      {/* Budget Approval Status - Show when waiting for approval */}
      {needsBudgetApproval && hasApproved && !budgetCleared && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            {financeApproved && !presidentApproved && '✓ Finance Approved - Waiting for President approval'}
            {presidentApproved && !financeApproved && '✓ President Approved - Waiting for Finance approval'}
          </p>
        </div>
      )}

      {/* Service Type Notice - Only show if no materials */}
      {isServiceType && !hasMaterials && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            ℹ️ Service type job orders without materials do not require budget approval. Proceed with Operations/President approval to start work.
          </p>
        </div>
      )}

      {/* Service Type with Materials Notice */}
      {isServiceType && hasMaterials && !budgetCleared && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            ⚠️ This Service type Job Order includes materials and requires budget approval from Finance and President before execution can start.
          </p>
        </div>
      )}

      {/* Budget Details */}
      <div className="space-y-4">
        {/* Estimated Total Cost */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Estimated Total Cost <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">₱</span>
            <input
              type="text"
              value={costInputValue}
              onChange={(e) => {
                // Remove peso symbol, spaces, and allow only numbers, commas, and decimal point
                let cleaned = e.target.value.replace(/[₱\s]/g, '').replace(/[^0-9,.]/g, '');
                
                // Remove all commas first to work with raw number
                cleaned = cleaned.replace(/,/g, '');
                
                // Only allow one decimal point
                const parts = cleaned.split('.');
                let integerPart = parts[0] || '';
                let decimalPart = parts.length > 1 ? parts[1] : '';
                
                // Remove leading zeros but keep at least one digit
                if (integerPart.length > 1) {
                  integerPart = integerPart.replace(/^0+/, '') || '0';
                }
                
                // Limit decimal part to 2 digits
                if (decimalPart.length > 2) {
                  decimalPart = decimalPart.slice(0, 2);
                }
                
                // Format integer part with commas
                let formatted = '';
                if (integerPart) {
                  formatted = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                }
                
                // Add decimal part if exists
                if (parts.length > 1 && decimalPart !== '') {
                  formatted = formatted ? `${formatted}.${decimalPart}` : `0.${decimalPart}`;
                } else if (parts.length > 1 && decimalPart === '' && formatted) {
                  // User just typed decimal point
                  formatted = `${formatted}.`;
                }
                
                // Update display value
                setCostInputValue(formatted);
                
                // Parse back to number for storage
                const numStr = cleaned === '' ? '0' : cleaned;
                const numValue = numStr === '' ? 0 : parseFloat(numStr);
                setEstimatedTotalCost(isNaN(numValue) || numValue < 0 ? 0 : numValue);
              }}
              onBlur={() => {
                // On blur, ensure the value is properly formatted with decimals
                if (estimatedTotalCost > 0) {
                  setCostInputValue(formatCurrency(estimatedTotalCost));
                } else {
                  setCostInputValue('');
                }
              }}
              disabled={!canActuallyEditBudget || budgetCleared}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            {calculatedCost > 0 && estimatedTotalCost !== calculatedCost && (
              <button
                type="button"
                onClick={() => {
                  setEstimatedTotalCost(calculatedCost);
                  setCostInputValue(formatCurrency(calculatedCost));
                }}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
                disabled={!canActuallyEditBudget || budgetCleared}
              >
                Use calculated ({formatCurrency(calculatedCost)})
              </button>
            )}
          </div>
          {calculatedCost > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Calculated from materials{jobOrder.manpower?.outsourcePrice ? ' and outsource' : ''}: ₱{formatCurrency(calculatedCost)}
            </p>
          )}
        </div>

        {/* Budget Approvals - Show when budget approval is needed */}
        {needsBudgetApproval && jobOrder.approvals && jobOrder.approvals.length > 0 && (
          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Budget Approvals</h3>
            <div className="space-y-2">
              {jobOrder.approvals
                .filter((a: any) => a.action === 'BUDGET_APPROVED' || a.action === 'BUDGET_REJECTED')
                .map((approval: any, index: number) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium text-gray-900">{approval.userName}</span>
                      <span className="text-gray-500 ml-2">({approval.role})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${
                        approval.action === 'BUDGET_APPROVED' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {approval.action === 'BUDGET_APPROVED' ? '✓ Approved' : '✗ Rejected'}
                      </span>
                      <span className="text-gray-500 text-xs">
                        {new Date(approval.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
          {canApproveBudget && !userHasApproved && (
            <>
              <button
                onClick={handleApproveBudget}
                disabled={loading}
                className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-sm sm:text-base"
              >
                {loading ? 'Approving...' : 'Approve Budget'}
              </button>
              <button
                onClick={handleRejectBudget}
                disabled={loading}
                className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-sm sm:text-base"
              >
                {loading ? 'Rejecting...' : 'Reject Budget'}
              </button>
            </>
          )}

          {isPresident && !financeApproved && !budgetCleared && needsBudgetApproval && (
            <p className="text-sm text-yellow-600 font-medium">
              ⚠️ Finance must approve the budget before President can approve.
            </p>
          )}

          {!canEditBudget && needsBudgetApproval && (
            <p className="text-sm text-gray-500">
              Only Finance and President can edit and approve budgets.
            </p>
          )}

          {needsBudgetApproval && budgetCleared && (
            <p className="text-sm text-green-600 font-medium">
              Budget has been cleared and approved by both Finance and President.
            </p>
          )}

          {isServiceType && !hasMaterials && (
            <p className="text-sm text-blue-600 font-medium">
              Service type job orders without materials skip budget approval. Proceed with Operations/President approval to start work.
            </p>
          )}
        </div>
      </div>
      <ConfirmDialog />
    </div>
  );
}

