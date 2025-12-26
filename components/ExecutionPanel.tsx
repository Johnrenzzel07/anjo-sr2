'use client';

import { useState } from 'react';
import { JobOrder, UserRole } from '@/types';

interface ExecutionPanelProps {
  jobOrder: JobOrder;
  currentUser?: { role: UserRole; id: string; name: string; department?: string };
  hasPurchaseOrder?: boolean;
  hasCompletedTransfer?: boolean;
  onExecutionUpdate?: () => void;
}

export default function ExecutionPanel({ jobOrder, currentUser, hasPurchaseOrder, hasCompletedTransfer, onExecutionUpdate }: ExecutionPanelProps) {
  const [loading, setLoading] = useState(false);
  const [workCompletionNotes, setWorkCompletionNotes] = useState(jobOrder.acceptance?.workCompletionNotes || '');

  const userRole = currentUser?.role;
  const canManageExecutionRole = userRole === 'OPERATIONS' || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

  const isMaterialReq = jobOrder.type === 'MATERIAL_REQUISITION';

  // For Service type: execution can start once JO is APPROVED
  // For Material Requisition: JO must be APPROVED AND a Purchase Order must exist AND material transfer completed
  const canStartExecution = 
    jobOrder.status === 'APPROVED' &&
    canManageExecutionRole &&
    (!isMaterialReq || (!!hasPurchaseOrder && !!hasCompletedTransfer));

  const canCompleteExecution = 
    jobOrder.status === 'IN_PROGRESS' &&
    canManageExecutionRole;

  const handleStartExecution = async () => {
    if (!confirm('Start execution for this Job Order? This will set the status to IN_PROGRESS.')) {
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
        alert('Execution started successfully!');
        onExecutionUpdate?.();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to start execution');
      }
    } catch (error) {
      console.error('Error starting execution:', error);
      alert('Failed to start execution');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteExecution = async () => {
    if (!workCompletionNotes.trim()) {
      alert('Please provide work completion notes before completing execution.');
      return;
    }

    if (!confirm('Complete execution for this Job Order? This will set the status to COMPLETED.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/job-orders/${jobOrder.id || jobOrder._id}/execution`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'COMPLETE',
          workCompletionNotes: workCompletionNotes.trim(),
        }),
      });

      if (response.ok) {
        alert('Execution completed successfully!');
        onExecutionUpdate?.();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to complete execution');
      }
    } catch (error) {
      console.error('Error completing execution:', error);
      alert('Failed to complete execution');
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
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Execution Management</h3>
      
      {/* Execution Status */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Current Status:</span>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            jobOrder.status === 'IN_PROGRESS' 
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
              : 'A Purchase Order exists and materials are transferred. You can start execution once the status is APPROVED.'}
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
                  className={`p-3 rounded-md border ${
                    isOverdue ? 'bg-red-50 border-red-200' :
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

      {/* Work Completion Notes (for completion) */}
      {jobOrder.status === 'IN_PROGRESS' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Work Completion Notes <span className="text-red-500">*</span>
          </label>
          <textarea
            value={workCompletionNotes}
            onChange={(e) => setWorkCompletionNotes(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Describe the work completed, any issues encountered, and final status..."
          />
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
            {loading ? 'Starting...' : 'Start Execution'}
          </button>
        )}

        {canCompleteExecution && (
          <button
            onClick={handleCompleteExecution}
            disabled={loading || !workCompletionNotes.trim()}
            className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-sm sm:text-base"
          >
            {loading ? 'Completing...' : 'Complete Execution'}
          </button>
        )}

        {!canStartExecution && !canCompleteExecution && jobOrder.status !== 'COMPLETED' && (
          <p className="text-sm text-gray-500">
            {jobOrder.status === 'IN_PROGRESS' 
              ? 'Execution is in progress. Add completion notes above to complete.'
              : 'Execution can only be started by Operations or Admin when Job Order is APPROVED or BUDGET_CLEARED.'}
          </p>
        )}
      </div>
    </div>
  );
}

