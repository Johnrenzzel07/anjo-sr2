'use client';

import { useState } from 'react';
import { JobOrder, UserRole } from '@/types';
import { useToast } from './ToastContainer';
import { useConfirm } from './useConfirm';

interface AcceptancePanelProps {
  jobOrder: JobOrder;
  currentUser?: { role: UserRole; id: string; name: string; department?: string };
  onAcceptanceUpdate?: () => void;
}

export default function AcceptancePanel({ jobOrder, currentUser, onAcceptanceUpdate }: AcceptancePanelProps) {
  const toast = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [loading, setLoading] = useState(false);
  const [workCompletionNotes, setWorkCompletionNotes] = useState(
    jobOrder.acceptance?.workCompletionNotes || ''
  );
  const [serviceAcceptedBy, setServiceAcceptedBy] = useState(
    jobOrder.acceptance?.serviceAcceptedBy || ''
  );

  // Normalize department names for comparison
  const normalizeDept = (dept: string | undefined): string => {
    return (dept || '').toLowerCase().replace(/\s+department$/, '').trim();
  };

  // Get the requester's department from the Service Request
  const requesterDepartment = jobOrder.serviceRequest?.department || jobOrder.department;
  const normalizedRequesterDept = normalizeDept(requesterDepartment);
  const normalizedUserDept = normalizeDept((currentUser as any)?.department);

  // Only the requester's department head can edit acceptance info
  // Admin and Super Admin can also edit
  const userRole = currentUser?.role as string;
  const isRequesterDeptHead = (userRole === 'APPROVER' || userRole === 'DEPARTMENT_HEAD') &&
                              normalizedUserDept === normalizedRequesterDept;
  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
  
  // Can edit if user is requester's department head or admin
  const canEditAcceptance = 
    (jobOrder.status === 'COMPLETED' || jobOrder.status === 'IN_PROGRESS' || jobOrder.status === 'CLOSED') &&
    (isRequesterDeptHead || isAdmin);
  
  // Can accept service if user is requester's department head or admin
  const canAcceptService = 
    jobOrder.status === 'COMPLETED' && 
    (isRequesterDeptHead || isAdmin);
  
  // Can view (read-only) if user is handling department, requester's department, or admin
  const canViewAcceptance = canEditAcceptance || isAdmin || 
    (jobOrder.status === 'COMPLETED' || jobOrder.status === 'IN_PROGRESS' || jobOrder.status === 'CLOSED');


  const handleAcceptService = async () => {
    if (!serviceAcceptedBy.trim()) {
      toast.showWarning('Please enter the name of the person accepting the service.');
      return;
    }

    const proceed = await confirm('Accept this completed service? This will mark the Job Order as accepted.', {
      title: 'Accept Service',
      confirmButtonColor: 'green',
    });
    if (!proceed) {
      return;
    }

    setLoading(true);
    try {
      const acceptanceDate = new Date().toISOString();
      const response = await fetch(`/api/job-orders/${jobOrder.id || jobOrder._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acceptance: {
            ...jobOrder.acceptance,
            workCompletionNotes: workCompletionNotes.trim() || undefined,
            serviceAcceptedBy: serviceAcceptedBy.trim(),
            dateAccepted: acceptanceDate,
          },
        }),
      });

      if (response.ok) {
        // Update status to CLOSED after acceptance
        const statusResponse = await fetch(`/api/job-orders/${jobOrder.id || jobOrder._id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'CLOSED' }),
        });

        if (statusResponse.ok) {
          toast.showSuccess('Service accepted successfully! Job Order has been closed.');
          onAcceptanceUpdate?.();
        } else {
          toast.showWarning('Acceptance recorded, but failed to close Job Order.');
          onAcceptanceUpdate?.();
        }
      } else {
        const error = await response.json();
        toast.showError(error.error || 'Failed to accept service');
      }
    } catch (error) {
      console.error('Error accepting service:', error);
      toast.showError('Failed to accept service');
    } finally {
      setLoading(false);
    }
  };

  const hasAcceptanceInfo = 
    jobOrder.acceptance?.actualStartDate ||
    jobOrder.acceptance?.actualCompletionDate ||
    jobOrder.acceptance?.workCompletionNotes ||
    jobOrder.acceptance?.serviceAcceptedBy ||
    jobOrder.acceptance?.dateAccepted;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Acceptance & Completion</h2>
      
      {/* Explanation for Service type */}
      {jobOrder.type === 'SERVICE' && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            <strong>Purpose:</strong> This section is used to record the actual completion of the service work and formal acceptance by the requester. 
            The handling department can update actual start/completion dates during execution. 
            Once work is completed, only the <strong>{requesterDepartment} Department Head</strong> (the requester's department) can add completion notes and formally accept the service, which closes the Job Order.
          </p>
        </div>
      )}
      
      {!hasAcceptanceInfo && jobOrder.status !== 'COMPLETED' && jobOrder.status !== 'IN_PROGRESS' && !canViewAcceptance && (
        <p className="text-sm text-gray-500">No completion information yet.</p>
      )}

      {(hasAcceptanceInfo || canEditAcceptance || canViewAcceptance) ? (
        <div className="space-y-4">
          {/* Actual Start Date - Read-only, set automatically during execution */}
          {jobOrder.acceptance?.actualStartDate && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Actual Start Date
              </label>
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700">
                {new Date(jobOrder.acceptance.actualStartDate).toLocaleDateString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Set automatically when execution started
              </p>
            </div>
          )}

          {/* Actual Completion Date - Read-only, set automatically during execution */}
          {jobOrder.acceptance?.actualCompletionDate && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Actual Completion Date
              </label>
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700">
                {new Date(jobOrder.acceptance.actualCompletionDate).toLocaleDateString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Set automatically when execution completed
              </p>
            </div>
          )}

          {/* Work Completion Notes - Optional */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Work Completion Notes (Optional)
            </label>
            {canEditAcceptance ? (
              <textarea
                value={workCompletionNotes}
                onChange={(e) => setWorkCompletionNotes(e.target.value)}
                rows={4}
                disabled={loading || !!jobOrder.acceptance?.serviceAcceptedBy}
                placeholder="Describe the completed work, any issues encountered, final status, and follow-up requirements (optional)..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            ) : (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700 min-h-[100px]">
                {jobOrder.acceptance?.workCompletionNotes || 'No completion notes provided.'}
              </div>
            )}
            {!canEditAcceptance && normalizedUserDept !== normalizedRequesterDept && (
              <p className="text-xs text-gray-500 mt-1">
                Only {requesterDepartment} Department Head can edit completion notes.
              </p>
            )}
          </div>

          {/* Service Acceptance Section - Only show when COMPLETED */}
          {jobOrder.status === 'COMPLETED' && (
            <div className="pt-4 border-t">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Service Acceptance</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Accepted By <span className="text-red-500">*</span>
                  </label>
                  {canAcceptService ? (
                    <>
                      <input
                        type="text"
                        value={serviceAcceptedBy}
                        onChange={(e) => setServiceAcceptedBy(e.target.value)}
                        disabled={loading || !!jobOrder.acceptance?.serviceAcceptedBy}
                        placeholder="Enter name of person accepting the service"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                      {jobOrder.acceptance?.serviceAcceptedBy && (
                        <p className="text-xs text-gray-500 mt-1">
                          Accepted by: {jobOrder.acceptance.serviceAcceptedBy} on{' '}
                          {jobOrder.acceptance.dateAccepted 
                            ? new Date(jobOrder.acceptance.dateAccepted).toLocaleDateString()
                            : 'N/A'}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700">
                        {jobOrder.acceptance?.serviceAcceptedBy || 'Not accepted yet'}
                      </div>
                      {!jobOrder.acceptance?.serviceAcceptedBy && normalizedUserDept !== normalizedRequesterDept && (
                        <p className="text-xs text-gray-500 mt-1">
                          Only {requesterDepartment} Department Head can accept the service.
                        </p>
                      )}
                      {jobOrder.acceptance?.serviceAcceptedBy && (
                        <p className="text-xs text-gray-500 mt-1">
                          Accepted by: {jobOrder.acceptance.serviceAcceptedBy} on{' '}
                          {jobOrder.acceptance.dateAccepted 
                            ? new Date(jobOrder.acceptance.dateAccepted).toLocaleDateString()
                            : 'N/A'}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {jobOrder.acceptance?.dateAccepted && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date Accepted
                    </label>
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700">
                      {new Date(jobOrder.acceptance.dateAccepted).toLocaleDateString()}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Set automatically when service was accepted
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            {canAcceptService && !jobOrder.acceptance?.serviceAcceptedBy && (
              <button
                onClick={handleAcceptService}
                disabled={loading || !serviceAcceptedBy.trim()}
                className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-sm sm:text-base"
              >
                {loading ? 'Accepting...' : 'Accept Service'}
              </button>
            )}

            {jobOrder.acceptance?.serviceAcceptedBy && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <span className="font-medium">✓</span>
                <span>Service accepted by {jobOrder.acceptance.serviceAcceptedBy}</span>
              </div>
            )}

            {canEditAcceptance && !canAcceptService && jobOrder.status !== 'CLOSED' && (
              <p className="text-sm text-gray-500">
                Start and completion dates are set automatically during execution. You can add optional completion notes above.
              </p>
            )}
            
            {!canEditAcceptance && !canAcceptService && jobOrder.status === 'COMPLETED' && normalizedUserDept !== normalizedRequesterDept && (
              <p className="text-sm text-gray-500">
                Only {requesterDepartment} Department Head can edit completion notes and accept the service.
              </p>
            )}
          </div>
        </div>
      ) : null}
      <ConfirmDialog />
    </div>
  );
}

