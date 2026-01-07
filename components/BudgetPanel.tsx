'use client';

import { useState, useEffect } from 'react';
import { JobOrder, UserRole } from '@/types';
import { useToast } from './ToastContainer';
import { useConfirm } from './useConfirm';
import RejectBudgetModal from './RejectBudgetModal';

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
  const [showRejectModal, setShowRejectModal] = useState(false);
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
  const financeRejected = jobOrder.approvals?.some(
    (a: any) => a.role === 'FINANCE' && a.action === 'BUDGET_REJECTED'
  );
  const presidentRejected = jobOrder.approvals?.some(
    (a: any) => a.role === 'MANAGEMENT' && a.action === 'BUDGET_REJECTED'
  );
  const budgetRejected = financeRejected || presidentRejected;

  // Budget is cleared once Finance has approved the budget specifically
  const budgetCleared = financeApproved;

  // Check if Service type has materials - if so, it needs budget approval
  const isServiceType = jobOrder.type === 'SERVICE';
  const hasMaterials = jobOrder.materials && jobOrder.materials.length > 0;
  const needsBudgetApproval = !isServiceType || (isServiceType && hasMaterials);

  // Finance or President can approve anytime (if not already approved by them)
  // Hide buttons if budget is rejected
  const canApproveBudget = canEditBudget && !budgetCleared && !budgetRejected && needsBudgetApproval;

  // President can edit budget anytime as well
  const canActuallyEditBudget = isFinance || isPresident;
  const hasApproved = financeApproved || presidentApproved;
  const userHasApproved = jobOrder.approvals?.some(
    (a: any) => a.userId === currentUser?.id && (a.action === 'BUDGET_APPROVED' || a.action === 'BUDGET_REJECTED')
  );


  const handleApproveBudget = async () => {
    const proceed = await confirm('Approve this budget? This will add your approval to the Job Order.', {
      title: 'Approve Budget',
      confirmButtonColor: 'green',
    });
    if (!proceed) {
      setShowRejectModal(false);
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

  const handleRejectBudget = async (reason: string) => {
    setLoading(true);
    setShowRejectModal(false); // Close modal immediately

    try {
      const response = await fetch(`/api/job-orders/${jobOrder.id || jobOrder._id}/budget`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REJECT',
          comments: reason,
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
            ✓ Budget Approved by Finance
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
            ⚠️ This Service type Job Order includes materials and requires budget approval from Finance before fulfillment can start.
          </p>
        </div>
      )}

      {/* Budget Details */}
      <div className="space-y-4">
        {/* Estimated Total Cost */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Total Cost <span className="text-gray-500 text-xs font-normal">(Auto-calculated)</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">₱</span>
            <input
              type="text"
              value={costInputValue}
              readOnly
              disabled
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 cursor-not-allowed text-gray-700"
            />
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
                  <div key={index} className="text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-900">{approval.userName}</span>
                        <span className="text-gray-500 ml-2">({approval.role})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${approval.action === 'BUDGET_APPROVED' ? 'text-green-600' : 'text-red-600'
                          }`}>
                          {approval.action === 'BUDGET_APPROVED' ? '✓ Approved' : '✗ Rejected'}
                        </span>
                        <span className="text-gray-500 text-xs">
                          {new Date(approval.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {approval.comments && (
                      <div className="mt-1 ml-2 p-2 bg-gray-50 rounded text-xs text-gray-700 border-l-2 border-gray-300">
                        <span className="font-medium">Reason: </span>
                        {approval.comments}
                      </div>
                    )}
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
                onClick={() => setShowRejectModal(true)}
                disabled={loading}
                className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-sm sm:text-base"
              >
                {loading ? 'Rejecting...' : 'Reject Budget'}
              </button>
            </>
          )}



          {!canEditBudget && needsBudgetApproval && (
            <p className="text-sm text-gray-500">
              Only Finance and President can approve budgets.
            </p>
          )}

          {/* {needsBudgetApproval && budgetCleared && (
            <p className="text-sm text-green-600 font-medium">
              Budget has been cleared and approved by both Finance and President.
            </p>
          )} */}

          {isServiceType && !hasMaterials && (
            <p className="text-sm text-blue-600 font-medium">
              Service type job orders without materials skip budget approval. Proceed with Operations/President approval to start work.
            </p>
          )}
        </div>
      </div>
      <ConfirmDialog />
      <RejectBudgetModal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={handleRejectBudget}
        loading={loading}
      />
    </div>
  );
}


