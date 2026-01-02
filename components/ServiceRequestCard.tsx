'use client';

import { useState } from 'react';
import { ServiceRequest, UserRole } from '@/types';
import StatusBadge from './StatusBadge';
import Link from 'next/link';
import { useToast } from './ToastContainer';
import { useApprovalModal } from './useApprovalModal';

// Service Category to Department mapping for JO creation and SR approval authorization
const SERVICE_CATEGORY_TO_DEPARTMENT: Record<string, string[]> = {
  'Technical Support': ['it'],
  'Facility Maintenance': ['maintenance'],
  'Account/Billing Inquiry': ['accounting'],
  'General Inquiry': ['general services'],
  'Other': ['operations'],
};

// Normalize department name for comparison
function normalizeDepartment(dept: string | undefined): string {
  return (dept || '').toLowerCase().replace(/\s+department$/, '').trim();
}

// Check if user is the handling department head for this service category
function isHandlingDepartmentHead(userDepartment: string | undefined, userRole: string, serviceCategory: string): boolean {
  // Must be APPROVER, ADMIN, or SUPER_ADMIN
  if (userRole !== 'APPROVER' && userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
    return false;
  }

  // ADMIN and SUPER_ADMIN can approve all
  if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') {
    return true;
  }

  const normalizedUserDept = normalizeDepartment(userDepartment);

  // President can approve any service category
  if (normalizedUserDept === 'president') {
    return true;
  }

  // Get authorized departments for this service category
  const authorizedDepts = SERVICE_CATEGORY_TO_DEPARTMENT[serviceCategory];

  if (!authorizedDepts) {
    // If service category is not in mapping, only Operations can handle it
    return normalizedUserDept === 'operations';
  }

  return authorizedDepts.includes(normalizedUserDept);
}

// Check if user can create JO for this service category (same logic as approval)
function canUserCreateJO(userDepartment: string | undefined, userRole: string, serviceCategory: string): boolean {
  return isHandlingDepartmentHead(userDepartment, userRole, serviceCategory);
}

// Get authorization message for display
function getAuthMessage(serviceCategory: string): string {
  const authorizedDepts = SERVICE_CATEGORY_TO_DEPARTMENT[serviceCategory];
  if (!authorizedDepts) {
    return 'Only Operations Department can create Job Orders for this category.';
  }
  const deptNames = authorizedDepts.map(d => d.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
  if (deptNames.length === 1) {
    return `Only ${deptNames[0]} Department can create Job Orders for "${serviceCategory}".`;
  }
  return `Only ${deptNames.join(' or ')} Department can create Job Orders for "${serviceCategory}".`;
}

interface ServiceRequestCardProps {
  serviceRequest: ServiceRequest;
  showCreateJO?: boolean;
  onCreateJO?: (srId: string) => void;
  currentUser?: { role: UserRole; id: string; name: string; department?: string };
  onApprovalUpdate?: () => void;
  hasJobOrder?: boolean;
}

export default function ServiceRequestCard({
  serviceRequest,
  showCreateJO = false,
  onCreateJO,
  currentUser,
  onApprovalUpdate,
  hasJobOrder = false
}: ServiceRequestCardProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const { showApproval, ApprovalDialog } = useApprovalModal();

  const departmentHeadApproved = serviceRequest.approvals?.some(
    (a: any) => a.role === 'DEPARTMENT_HEAD' && a.action === 'APPROVED'
  );

  // Normalize department names for comparison
  const normalizeDept = (dept?: string) =>
    (dept || '').toLowerCase().replace(/\s+department$/, '').trim();

  // Check if current user is the REQUESTER'S department head (for SR approval)
  // The requester's own department head approves the Service Request
  const isRequesterDeptHead = !!currentUser && (() => {
    const userRole = currentUser.role as string;
    if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') {
      return true; // Admin/Super Admin can approve any SR
    }
    if (userRole !== 'APPROVER') {
      return false;
    }
    // Check if user's department matches the SR's department (requester's department)
    return normalizeDept(currentUser.department) === normalizeDept(serviceRequest.department);
  })();

  // Check if current user is the HANDLING department head (for JO creation)
  // Based on service category - IT dept creates JO for "Technical Support", etc.
  const isHandlingDeptHead = !!currentUser && (() => {
    const userRole = currentUser.role as string;
    return isHandlingDepartmentHead(currentUser.department, userRole, serviceRequest.serviceCategory);
  })();

  const canApprove =
    isRequesterDeptHead &&
    serviceRequest.status === 'SUBMITTED' &&
    !departmentHeadApproved;

  const handleApproveClick = async (e: React.MouseEvent, action: 'APPROVED' | 'REJECTED') => {
    e.stopPropagation(); // Prevent any event bubbling
    if (!currentUser) return;

    // Show approval modal
    const comments = await showApproval({
      title: action === 'APPROVED' ? 'Approve Service Request' : 'Reject Service Request',
      message: action === 'APPROVED'
        ? `Are you sure you want to approve ${serviceRequest.srNumber}?`
        : `Are you sure you want to reject ${serviceRequest.srNumber}? Please provide a reason.`,
      confirmButtonText: action === 'APPROVED' ? 'Approve' : 'Reject',
      confirmButtonColor: action === 'APPROVED' ? 'green' : 'red',
      placeholder: 'Enter rejection reason (required)...',
      showComments: action === 'REJECTED', // Only show comments for rejections
    });

    if (comments === null) return; // User cancelled

    // For rejection, require comments
    if (action === 'REJECTED' && !comments.trim()) {
      toast.showError('Please provide a reason for rejection');
      return;
    }

    await handleApprove(action, comments || '');
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

        // Mark related notifications as read after approval/rejection
        try {
          await fetch('/api/notifications/mark-read-by-entity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              relatedEntityType: 'SERVICE_REQUEST',
              relatedEntityId: srId,
            }),
          });
        } catch (notifError) {
          console.error('Error marking notifications as read:', notifError);
        }

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
  const needsUserApproval = needsApprovalHighlight && isRequesterDeptHead;
  // Show visual highlight if SR is APPROVED and handling department can create JO
  const canCreateJOHighlight = serviceRequest.status === 'APPROVED' && isHandlingDeptHead && showCreateJO;

  return (
    <>
      <ApprovalDialog />
      <div className={`bg-white rounded-lg shadow-md p-6 border-2 transition-all ${canCreateJOHighlight
          ? 'border-blue-500 animate-border-pulse-blue hover:shadow-xl hover:scale-[1.01] animate-pulse-glow-blue'
          : needsUserApproval
            ? 'border-blue-500 animate-border-pulse-blue hover:shadow-xl hover:scale-[1.01] animate-pulse-glow-blue'
            : needsApprovalHighlight
              ? 'border-yellow-400 animate-border-pulse hover:shadow-xl hover:scale-[1.01] animate-pulse-glow'
              : 'border-gray-200 hover:shadow-lg'
        }`}>
        <Link href={`/service-requests/${serviceRequest.id || serviceRequest._id}`} className="block">
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
          {serviceRequest.status === 'SUBMITTED' && !departmentHeadApproved && !isRequesterDeptHead && (
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
          {!isRequesterDeptHead && (serviceRequest.status === 'SUBMITTED' || serviceRequest.status === 'APPROVED') && (
            <div className="mb-4 p-3 bg-gray-50 rounded-md">
              <p className="text-xs font-medium text-gray-700 mb-2">Department Head Approval:</p>
              {departmentHeadApproved ? (
                <p className="text-xs text-green-600">✓ Approved by Department Head</p>
              ) : (
                <p className="text-xs text-yellow-600">Pending Department Head approval</p>
              )}
            </div>
          )}
        </Link>

        {/* Approval Buttons - Outside Link to prevent navigation */}
        {canApprove && (
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={(e) => handleApproveClick(e, 'APPROVED')}
              disabled={loading}
              className="flex-1 bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 transition-colors text-sm font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Approve'}
            </button>
            <button
              type="button"
              onClick={(e) => handleApproveClick(e, 'REJECTED')}
              disabled={loading}
              className="flex-1 bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700 transition-colors text-sm font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Reject'}
            </button>
          </div>
        )}

        {/* Job Order already created message */}
        {hasJobOrder && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-green-600 font-medium">Job Order already created</p>
            </div>
          </div>
        )}

        {/* Show Create Job Order button if status is APPROVED, no JO exists, and user is authorized (handling dept) */}
        {/* The HANDLING department (based on service category) creates the Job Order */}
        {showCreateJO && !hasJobOrder && serviceRequest.status === 'APPROVED' && (() => {
          if (isHandlingDeptHead) {
            return (
              <>
                {/* Ready for Job Order Creation Message */}
                <div className="mt-4 p-3 bg-blue-50 border-2 border-blue-300 rounded-md">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-800">Ready for Job Order Creation</p>
                      <p className="text-xs text-blue-700">You can now create a Job Order for this Service Request</p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onCreateJO?.(serviceRequest.id || serviceRequest._id || '');
                  }}
                  className="w-full mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Create Job Order
                </button>
              </>
            );
          } else {
            // Show message about who can create JO
            return (
              <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
                <p className="text-xs text-gray-600 text-center">
                  {getAuthMessage(serviceRequest.serviceCategory)}
                </p>
              </div>
            );
          }
        })()}
      </div>
    </>
  );
}