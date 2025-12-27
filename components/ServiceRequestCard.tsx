'use client';

import { useState } from 'react';
import { ServiceRequest, UserRole } from '@/types';
import StatusBadge from './StatusBadge';
import Link from 'next/link';
import ConfirmationModal from './ConfirmationModal';
import { useToast } from './ToastContainer';

interface ServiceRequestCardProps {
  serviceRequest: ServiceRequest;
  showCreateJO?: boolean;
  onCreateJO?: (srId: string) => void;
  currentUser?: { role: UserRole; id: string; name: string; department?: string };
  onApprovalUpdate?: () => void;
}

export default function ServiceRequestCard({ 
  serviceRequest, 
  showCreateJO = false,
  onCreateJO,
  currentUser,
  onApprovalUpdate
}: ServiceRequestCardProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'APPROVED' | 'REJECTED' | null>(null);

  const departmentHeadApproved = serviceRequest.approvals?.some(
    (a: any) => a.role === 'DEPARTMENT_HEAD' && a.action === 'APPROVED'
  );

  // Normalize department names so minor differences (e.g., "IT" vs "IT Department") still match
  const normalizeDept = (dept?: string) =>
    (dept || '').toLowerCase().replace(/\s+department$/, '').trim();

  const isDepartmentHead = !!currentUser && (() => {
    const userRole = currentUser.role as string;
    return (
      (userRole === 'APPROVER' || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') &&
      normalizeDept(currentUser.department) === normalizeDept(serviceRequest.department)
    );
  })();

  const canApprove = 
    isDepartmentHead &&
    serviceRequest.status === 'SUBMITTED' &&
    !departmentHeadApproved;

  const handleApproveClick = (action: 'APPROVED' | 'REJECTED') => {
    if (!currentUser) return;
    
    if (action === 'APPROVED') {
      // Show confirmation modal for approval
      setPendingAction(action);
      setShowConfirmModal(true);
    } else {
      // For rejection, still use prompt for comments
      const commentsInput = prompt(`Enter comments for ${action.toLowerCase()}:`);
      if (commentsInput === null) return; // User cancelled
      handleApprove(action, commentsInput);
    }
  };

  const handleConfirmApprove = () => {
    setShowConfirmModal(false);
    if (pendingAction === 'APPROVED') {
      handleApprove('APPROVED', '');
    }
    setPendingAction(null);
  };

  const handleCancelApprove = () => {
    setShowConfirmModal(false);
    setPendingAction(null);
  };

  const handleApprove = async (action: 'APPROVED' | 'REJECTED', comments: string = '') => {
    if (!currentUser) return;

    setLoading(true);
    try {
      const srId = serviceRequest.id || serviceRequest._id;
      const response = await fetch(`/api/service-requests/${srId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'DEPARTMENT_HEAD',
          userId: currentUser.id,
          userName: currentUser.name,
          action,
          comments,
        }),
      });

      if (response.ok) {
        toast.showSuccess(`Service Request ${action.toLowerCase()} successfully!`);
        onApprovalUpdate?.();
      } else {
        const error = await response.json();
        toast.showError(error.error || `Failed to ${action.toLowerCase()} Service Request`);
      }
    } catch (error) {
      console.error(`Error ${action.toLowerCase()}ing SR:`, error);
      toast.showError(`Failed to ${action.toLowerCase()} Service Request`);
    } finally {
      setLoading(false);
    }
  };

  // Show visual highlight if approval is needed (even for users who can approve)
  const needsApprovalHighlight = serviceRequest.status === 'SUBMITTED' && !departmentHeadApproved;
  // Check if current user needs to approve (for different highlight color)
  const needsUserApproval = needsApprovalHighlight && isDepartmentHead;

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 border-2 transition-all ${
      needsUserApproval
        ? 'border-blue-500 animate-border-pulse-blue hover:shadow-xl hover:scale-[1.01] animate-pulse-glow-blue'
        : needsApprovalHighlight 
        ? 'border-yellow-400 animate-border-pulse hover:shadow-xl hover:scale-[1.01] animate-pulse-glow' 
        : 'border-gray-200 hover:shadow-lg'
    }`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{serviceRequest.srNumber}</h3>
          <p className="text-sm text-gray-500 mt-1">{serviceRequest.department}</p>
        </div>
        <StatusBadge status={serviceRequest.status} type="sr" />
      </div>
      
      <div className="space-y-2 mb-4">
        <p className="text-sm">
          <span className="font-medium text-gray-700">Requested By:</span>{' '}
          <span className="text-gray-600">{serviceRequest.requestedBy}</span>
        </p>
        <p className="text-sm">
          <span className="font-medium text-gray-700">Category:</span>{' '}
          <span className="text-gray-600">{serviceRequest.serviceCategory}</span>
        </p>
        <p className="text-sm">
          <span className="font-medium text-gray-700">Priority:</span>{' '}
          <span className="text-gray-600">{serviceRequest.priority}</span>
        </p>
        <p className="text-sm text-gray-600 line-clamp-2">{serviceRequest.workDescription}</p>
      </div>

      {/* Needs Approval Card - Hide warning message for Department Head who can approve, but show visual highlight */}
      {serviceRequest.status === 'SUBMITTED' && !departmentHeadApproved && !isDepartmentHead && (
        <div className="mb-4 p-3 bg-yellow-50 border-2 border-yellow-300 rounded-md">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-yellow-800">Needs Approval</p>
              <p className="text-xs text-yellow-700">Waiting for Department Head approval</p>
            </div>
          </div>
        </div>
      )}

      {/* Department Head Approval Status (hidden for the Department Head themselves) */}
      {!isDepartmentHead && (serviceRequest.status === 'SUBMITTED' || serviceRequest.status === 'APPROVED') && (
        <div className="mb-4 p-3 bg-gray-50 rounded-md">
          <p className="text-xs font-medium text-gray-700 mb-2">Department Head Approval:</p>
          {departmentHeadApproved ? (
            <p className="text-xs text-green-600">✓ Approved by Department Head</p>
          ) : (
            <p className="text-xs text-yellow-600">Pending Department Head approval</p>
          )}
        </div>
      )}

      {/* Approval Buttons */}
      {canApprove && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => handleApproveClick('APPROVED')}
            disabled={loading}
            className="flex-1 bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 transition-colors text-sm font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 'Approve'}
          </button>
          <button
            onClick={() => handleApproveClick('REJECTED')}
            disabled={loading}
            className="flex-1 bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700 transition-colors text-sm font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 'Reject'}
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        title="Confirm Approval"
        message="Are you sure to approve this service request?"
        confirmText="Approve"
        cancelText="Cancel"
        onConfirm={handleConfirmApprove}
        onCancel={handleCancelApprove}
        confirmButtonColor="green"
      />

      {/* Show Create Job Order button if status is APPROVED */}
      {/* If status is APPROVED, we allow creation even without explicit approval record (backward compatibility) */}
      {showCreateJO && serviceRequest.status === 'APPROVED' && (
        <button
          onClick={() => onCreateJO?.(serviceRequest.id || serviceRequest._id || '')}
          className="w-full mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Create Job Order
        </button>
      )}
    </div>
  );
}