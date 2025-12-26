'use client';

import { useState, useEffect } from 'react';
import { JobOrder, UserRole } from '@/types';

interface BudgetPanelProps {
  jobOrder: JobOrder;
  currentUser?: { role: UserRole; id: string; name: string };
  onBudgetUpdate?: () => void;
}

export default function BudgetPanel({ jobOrder, currentUser, onBudgetUpdate }: BudgetPanelProps) {
  const [loading, setLoading] = useState(false);
  const [estimatedTotalCost, setEstimatedTotalCost] = useState(
    jobOrder.budget?.estimatedTotalCost || 0
  );
  const [withinApprovedBudget, setWithinApprovedBudget] = useState(
    jobOrder.budget?.withinApprovedBudget || false
  );
  const [comments, setComments] = useState('');

  const formatCurrency = (value: number) =>
    value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Calculate estimated cost from materials and outsource price
  useEffect(() => {
    let calculated = 0;
    
    // Calculate from materials
    if (jobOrder.materials && jobOrder.materials.length > 0) {
      calculated = jobOrder.materials.reduce((sum, material) => {
        return sum + ((material.estimatedCost || 0) * (material.quantity || 0));
      }, 0);
    }
    
    // Add outsource price if available
    if (jobOrder.manpower?.outsourcePrice) {
      calculated += jobOrder.manpower.outsourcePrice;
    }
    
    if (calculated > 0 && !jobOrder.budget?.estimatedTotalCost) {
      setEstimatedTotalCost(calculated);
    }
  }, [jobOrder.materials, jobOrder.manpower?.outsourcePrice, jobOrder.budget?.estimatedTotalCost]);

  // Check if user can edit budget (Finance by department or President/SUPER_ADMIN)
  const userRole = currentUser?.role as any;
  const userDepartment = (currentUser as any)?.department;
  const canEditBudget = userDepartment === 'Finance' || userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
  
  const financeApproved = jobOrder.approvals?.some(
    (a: any) => a.role === 'FINANCE' && a.action === 'BUDGET_APPROVED'
  );
  const presidentApproved = jobOrder.approvals?.some(
    (a: any) => a.role === 'MANAGEMENT' && a.action === 'BUDGET_APPROVED'
  );
  const budgetCleared = jobOrder.status === 'APPROVED' || (financeApproved && presidentApproved);

  // For Service type, skip budget approval - only Material Requisition needs budget approval
  const isServiceType = jobOrder.type === 'SERVICE';
  const canApproveBudget = canEditBudget && !budgetCleared && !isServiceType;
  const hasApproved = financeApproved || presidentApproved;
  const userHasApproved = jobOrder.approvals?.some(
    (a: any) => a.userId === currentUser?.id && a.action === 'BUDGET_APPROVED'
  );

  const handleUpdateBudget = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/job-orders/${jobOrder.id || jobOrder._id}/budget`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estimatedTotalCost: parseFloat(estimatedTotalCost.toString()) || 0,
          withinApprovedBudget,
        }),
      });

      if (response.ok) {
        alert('Budget information updated successfully!');
        onBudgetUpdate?.();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update budget');
      }
    } catch (error) {
      console.error('Error updating budget:', error);
      alert('Failed to update budget');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveBudget = async () => {
    if (!comments.trim()) {
      alert('Please provide comments for budget approval.');
      return;
    }

    if (!confirm('Approve this budget? This will add your approval to the Job Order.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/job-orders/${jobOrder.id || jobOrder._id}/budget`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estimatedTotalCost: parseFloat(estimatedTotalCost.toString()) || 0,
          withinApprovedBudget,
          action: 'APPROVE',
          comments: comments.trim(),
        }),
      });

      if (response.ok) {
        alert('Budget approved successfully!');
        setComments('');
        onBudgetUpdate?.();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to approve budget');
      }
    } catch (error) {
      console.error('Error approving budget:', error);
      alert('Failed to approve budget');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectBudget = async () => {
    if (!comments.trim()) {
      alert('Please provide comments for budget rejection.');
      return;
    }

    if (!confirm('Reject this budget? This will add your rejection to the Job Order.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/job-orders/${jobOrder.id || jobOrder._id}/budget`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REJECT',
          comments: comments.trim(),
        }),
      });

      if (response.ok) {
        alert('Budget rejected.');
        setComments('');
        onBudgetUpdate?.();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to reject budget');
      }
    } catch (error) {
      console.error('Error rejecting budget:', error);
      alert('Failed to reject budget');
    } finally {
      setLoading(false);
    }
  };

  // Calculate from materials and outsource price if not set
  const calculatedCost = (() => {
    let cost = 0;
    
    // Calculate from materials
    if (jobOrder.materials && jobOrder.materials.length > 0) {
      cost = jobOrder.materials.reduce((sum, material) => {
        return sum + ((material.estimatedCost || 0) * (material.quantity || 0));
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
      
      {/* Budget Status - Only show for Material Requisition type */}
      {!isServiceType && budgetCleared && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm font-medium text-green-800">
            ✓ Budget Cleared - Approved by Finance and President
          </p>
        </div> 
      )}

      {/* Budget Approval Status - Only show for Material Requisition type */}
      {!isServiceType && hasApproved && !budgetCleared && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            {financeApproved && !presidentApproved && '✓ Finance Approved - Waiting for President approval'}
            {presidentApproved && !financeApproved && '✓ President Approved - Waiting for Finance approval'}
          </p>
        </div>
      )}

      {/* Service Type Notice */}
      {isServiceType && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            ℹ️ Service type job orders do not require budget approval. Proceed with Operations/President approval.
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
              value={formatCurrency(estimatedTotalCost)}
              onChange={(e) => {
                const raw = e.target.value.replace(/,/g, '');
                const num = parseFloat(raw);
                setEstimatedTotalCost(isNaN(num) ? 0 : num);
              }}
              disabled={!canEditBudget || budgetCleared}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            {calculatedCost > 0 && estimatedTotalCost !== calculatedCost && (
              <button
                type="button"
                onClick={() => setEstimatedTotalCost(calculatedCost)}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
                disabled={!canEditBudget || budgetCleared}
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

        {/* Within Approved Budget */}
        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={withinApprovedBudget}
              onChange={(e) => setWithinApprovedBudget(e.target.checked)}
              disabled={!canEditBudget || budgetCleared}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <span className="text-sm font-medium text-gray-700">
              Within Approved Budget
            </span>
          </label>
        </div>

        {/* Budget Approvals - Only show for Material Requisition type */}
        {!isServiceType && jobOrder.approvals && jobOrder.approvals.length > 0 && (
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

        {/* Comments for Approval */}
        {canApproveBudget && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comments {userHasApproved ? '(You have already approved)' : ''}
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              placeholder="Add comments for budget approval/rejection..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
          {canEditBudget && !budgetCleared && (
            <button
              onClick={handleUpdateBudget}
              disabled={loading}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-sm sm:text-base"
            >
              {loading ? 'Updating...' : 'Update Budget Info'}
            </button>
          )}

          {canApproveBudget && !userHasApproved && (
            <>
              <button
                onClick={handleApproveBudget}
                disabled={loading || !comments.trim()}
                className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-sm sm:text-base"
              >
                {loading ? 'Approving...' : 'Approve Budget'}
              </button>
              <button
                onClick={handleRejectBudget}
                disabled={loading || !comments.trim()}
                className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-sm sm:text-base"
              >
                {loading ? 'Rejecting...' : 'Reject Budget'}
              </button>
            </>
          )}

          {!canEditBudget && !isServiceType && (
            <p className="text-sm text-gray-500">
              Only Finance and President can edit and approve budgets.
            </p>
          )}

          {!isServiceType && budgetCleared && (
            <p className="text-sm text-green-600 font-medium">
              Budget has been cleared and approved by both Finance and President.
            </p>
          )}

          {isServiceType && (
            <p className="text-sm text-blue-600 font-medium">
              Service type job orders skip budget approval. Proceed with Operations/President approval to start work.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

