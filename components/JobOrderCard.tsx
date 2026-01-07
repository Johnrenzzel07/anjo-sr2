'use client';

import { JobOrder } from '@/types';
import StatusBadge from './StatusBadge';
import Link from 'next/link';

// Service Category to Department mapping for JO approval
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

interface JobOrderCardProps {
  jobOrder: JobOrder;
  currentUser?: { role?: string; department?: string; id?: string };
  hasUnreadNotification?: boolean;
}

export default function JobOrderCard({ jobOrder, currentUser, hasUnreadNotification = false }: JobOrderCardProps) {
  const userRole = currentUser?.role;
  const userDepartment = currentUser?.department;

  // Check if user is the handling department for this JO's service category
  const isHandlingDept = isHandlingDepartment(userDepartment, jobOrder.serviceCategory);
  const handlingDeptName = getHandlingDepartmentName(jobOrder.serviceCategory);

  // Check if budget is cleared (Approved by Finance and Management)
  const budgetCleared = jobOrder.approvals?.some((a: any) =>
    a.role === 'FINANCE' && a.action === 'BUDGET_APPROVED'
  ) && jobOrder.approvals?.some((a: any) =>
    a.role === 'MANAGEMENT' && a.action === 'BUDGET_APPROVED'
  );

  const managementApproved = jobOrder.approvals?.some((a: any) =>
    a.role === 'MANAGEMENT' && (a.action === 'APPROVED' || a.action === 'BUDGET_APPROVED')
  );

  // Check for specialized approval based on user role and department
  const needsUserApproval = (() => {
    if (jobOrder.status === 'REJECTED' || jobOrder.status === 'CLOSED' || jobOrder.status === 'COMPLETED') return false;

    const normalizedUserDept = normalizeDept(userDepartment);

    // Finance approval needed for budget
    if (normalizedUserDept === 'finance' && !jobOrder.approvals?.some((a: any) => a.role === 'FINANCE' && a.action === 'BUDGET_APPROVED')) {
      // For Material Requisition: Needs canvass first
      if (jobOrder.type === 'MATERIAL_REQUISITION') {
        const canvassDone = jobOrder.approvals?.some((a: any) => a.role === 'PURCHASING' && a.action === 'CANVASS_COMPLETED');
        return canvassDone;
      }
      return true;
    }

    // Management (President) approval needed for budget and final JO
    if (normalizedUserDept === 'president') {
      const financeApproved = jobOrder.approvals?.some((a: any) => a.role === 'FINANCE' && a.action === 'BUDGET_APPROVED');

      // President approves budget after Finance
      if (financeApproved && !jobOrder.approvals?.some((a: any) => a.role === 'MANAGEMENT' && a.action === 'BUDGET_APPROVED')) {
        return true;
      }

      // President approves final JO after budget cleared (for Material Requisition)
      if (jobOrder.type === 'MATERIAL_REQUISITION' && budgetCleared && jobOrder.status === 'BUDGET_CLEARED') {
        return true;
      }

      // President approves final JO (for Service type)
      if (jobOrder.type === 'SERVICE' && jobOrder.status === 'DRAFT' && !managementApproved) {
        return true;
      }
    }

    // Purchasing needs to canvass Material Requisitions
    if (normalizedUserDept === 'purchasing' && jobOrder.type === 'MATERIAL_REQUISITION' && jobOrder.status === 'PENDING_CANVASS') {
      return !jobOrder.approvals?.some((a: any) => a.role === 'PURCHASING' && a.action === 'CANVASS_COMPLETED');
    }

    return false;
  })();

  // Generic check if ANY approval is needed for this card (to highlight)
  const needsApproval = jobOrder.status === 'DRAFT' ||
    jobOrder.status === 'PENDING_CANVASS' ||
    jobOrder.status === 'BUDGET_CLEARED';

  // Check if handling department can start fulfillment (for blue border animation)
  const canStartFulfillment = (() => {
    if (jobOrder.status !== 'APPROVED') return false;
    if (jobOrder.type !== 'SERVICE') return false;
    // If President has approved and user is handling department, they can start fulfillment
    return managementApproved && isHandlingDept;
  })();

  const handleCardClick = async () => {
    // Mark notifications as read if needed
    if (hasUnreadNotification && jobOrder.id) {
      try {
        await fetch('/api/notifications/mark-read-by-entity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            relatedEntityType: 'JOB_ORDER',
            relatedEntityId: jobOrder.id || (jobOrder as any)._id,
          }),
        });
        // Refresh notifications across the app
        window.dispatchEvent(new Event('refreshNotifications'));
      } catch (error) {
        console.error('Error marking notifications as read:', error);
      }
    }
  };

  const canCreatePO = (() => {
    const isPurchasing = normalizeDept(currentUser?.department) === 'purchasing';
    const canvassApproved = jobOrder.approvals?.some((a: any) =>
      a.role === 'PURCHASING' && a.action === 'CANVASS_COMPLETED'
    );
    const budgetClearedLocal = jobOrder.approvals?.some((a: any) =>
      a.role === 'FINANCE' && a.action === 'BUDGET_APPROVED'
    ) && jobOrder.approvals?.some((a: any) =>
      a.role === 'MANAGEMENT' && a.action === 'BUDGET_APPROVED'
    );

    return jobOrder.type === 'MATERIAL_REQUISITION' &&
      canvassApproved &&
      budgetClearedLocal &&
      isPurchasing &&
      (jobOrder.status === 'BUDGET_CLEARED' || jobOrder.status === 'APPROVED') &&
      !jobOrder.hasPurchaseOrder;
  })();

  // Check if Purchasing can complete material transfer
  const canTransferMaterials = (() => {
    const isPurchasing = normalizeDept(currentUser?.department) === 'purchasing' ||
      currentUser?.role === 'ADMIN' ||
      currentUser?.role === 'SUPER_ADMIN';

    return jobOrder.type === 'MATERIAL_REQUISITION' &&
      jobOrder.hasPurchaseOrder &&
      jobOrder.poStatus === 'RECEIVED' &&
      !jobOrder.materialTransfer?.transferCompleted &&
      isPurchasing;
  })();

  return (
    <Link href={`/job-orders/${jobOrder.id || jobOrder._id}`} onClick={handleCardClick}>
      <div className={`bg-white rounded-lg shadow-md p-4 sm:p-6 border-2 transition-all cursor-pointer ${canCreatePO
        ? 'border-green-500 animate-border-pulse-green hover:shadow-xl hover:scale-[1.01] animate-pulse-glow-green'
        : canTransferMaterials
          ? 'border-orange-500 animate-border-pulse-orange hover:shadow-xl hover:scale-[1.01] animate-pulse-glow-orange'
          : needsUserApproval
            ? 'border-blue-500 animate-border-pulse-blue hover:shadow-xl hover:scale-[1.01] animate-pulse-glow-blue'
            : canStartFulfillment
              ? 'border-blue-500 animate-border-pulse-blue hover:shadow-xl hover:scale-[1.01] animate-pulse-glow-blue'
              : needsApproval
                ? 'border-yellow-400 animate-border-pulse hover:shadow-xl hover:scale-[1.01] animate-pulse-glow'
                : 'border-gray-200 hover:shadow-lg'
        }`}>
        <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-0 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 break-words">{jobOrder.joNumber}</h3>
              {canCreatePO && (
                <span className="bg-green-100 text-green-800 text-xs uppercase font-bold px-3 py-1 rounded-full animate-pulse">
                  Ready to Create PO
                </span>
              )}
              {canTransferMaterials && (
                <span className="bg-orange-100 text-orange-800 text-xs uppercase font-bold px-3 py-1 rounded-full animate-pulse">
                  Ready for Transfer
                </span>
              )}
              {hasUnreadNotification && (
                <span className="h-2 w-2 bg-red-500 rounded-full flex-shrink-0"></span>
              )}
              {jobOrder.type && (
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${jobOrder.type === 'SERVICE'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-purple-100 text-purple-800'
                  }`}>
                  {jobOrder.type.replace('_', ' ')}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              SR: {jobOrder.serviceRequest?.srNumber || 'N/A'}
            </p>
          </div>
          <StatusBadge status={jobOrder.status} type="jo" />
        </div>

        {/* Action Required Label */}
        {needsUserApproval && (
          <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded text-center">
            <p className="text-xs font-bold text-blue-700 animate-pulse">ACTION REQUIRED BY YOUR DEPT</p>
          </div>
        )}

        {/* Ready for Fulfillment Card - Show when handling department can start fulfillment */}
        {canStartFulfillment && (
          <div className="mb-4 p-3 bg-blue-50 border-2 border-blue-300 rounded-md">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-800">Ready for Fulfillment</p>
                <p className="text-xs text-blue-700">Job Order has been approved. You can now start fulfillment.</p>
              </div>
            </div>
          </div>
        )}

        {/* Ready for Material Transfer - Show when PO is received and user is Purchasing/Admin */}
        {canTransferMaterials && (
          <div className="mb-4 p-3 bg-orange-50 border-2 border-orange-300 rounded-md">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-orange-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-orange-800">Ready for Material Transfer</p>
                <p className="text-xs text-orange-700">Purchase Order items have been received. You can now complete the material transfer.</p>
              </div>
            </div>
          </div>
        )}

        {/* Ready for Purchase Order Creation - Show when canvass pricing is approved and user is Purchasing */}
        {canCreatePO && (
          <div className="mb-4 p-3 bg-green-50 border-2 border-green-300 rounded-md">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-800">Ready to Create Purchase Order</p>
                <p className="text-xs text-green-700">Pricing approved and budget cleared. You can now create a Purchase Order.</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2 mb-4">
          <p className="text-sm">
            <span className="font-medium text-gray-700">Department:</span>{' '}
            <span className="text-gray-600">{jobOrder.department}</span>
          </p>
          <p className="text-sm">
            <span className="font-medium text-gray-700">Category:</span>{' '}
            <span className="text-gray-600">{jobOrder.serviceCategory}</span>
          </p>
          <p className="text-sm">
            <span className="font-medium text-gray-700">Priority:</span>{' '}
            <span className="text-gray-600">{jobOrder.priorityLevel || 'N/A'}</span>
          </p>
          <p className="text-sm text-gray-600 line-clamp-2">{jobOrder.workDescription}</p>
        </div>

        {/* Fulfillment Status */}
        {jobOrder.status === 'IN_PROGRESS' && jobOrder.acceptance?.actualStartDate && (
          <div className="mt-3 p-2 bg-blue-50 rounded-md border border-blue-200">
            <p className="text-xs text-blue-700">
              <span className="font-medium">Started:</span>{' '}
              {new Date(jobOrder.acceptance.actualStartDate).toLocaleDateString()}
            </p>
          </div>
        )}

        {jobOrder.status === 'COMPLETED' && jobOrder.acceptance?.actualCompletionDate && (
          <div className="mt-3 p-2 bg-green-50 rounded-md border border-green-200">
            <p className="text-xs text-green-700">
              <span className="font-medium">Completed:</span>{' '}
              {new Date(jobOrder.acceptance.actualCompletionDate).toLocaleDateString()}
            </p>
          </div>
        )}

        <div className="flex justify-between items-center text-xs text-gray-500 mt-4 pt-4 border-t">
          <span>Issued: {new Date(jobOrder.dateIssued).toLocaleDateString()}</span>
          <span>Materials: {jobOrder.materials?.length || 0} items</span>
        </div>
      </div>
    </Link>
  );
}
