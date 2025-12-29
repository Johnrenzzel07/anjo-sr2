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
  currentUser?: { role?: string; department?: string };
}

export default function JobOrderCard({ jobOrder, currentUser }: JobOrderCardProps) {
  // Check if current user can approve (hide warning message but show visual highlight)
  const isFinance = normalizeDept(currentUser?.department) === 'finance' || currentUser?.role === 'FINANCE';
  const isOperations = normalizeDept(currentUser?.department) === 'operations' || currentUser?.role === 'OPERATIONS';
  const isManagement = currentUser?.role === 'MANAGEMENT' || currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN';
  
  // Check if user is the handling department for this JO's service category
  const isHandlingDept = isHandlingDepartment(currentUser?.department, jobOrder.serviceCategory);
  
  // Get the handling department name for display
  const handlingDeptName = getHandlingDepartmentName(jobOrder.serviceCategory);

  // For SERVICE type: Creating the JO by the handling department counts as their approval
  // So only President/Management approval is needed after JO creation
  // For MATERIAL_REQUISITION: Finance approves budget first, then Management
  
  const managementApproved = jobOrder.approvals?.some((a: any) => 
    a.role === 'MANAGEMENT' && a.action === 'APPROVED'
  );
  
  const financeApproved = jobOrder.approvals?.some((a: any) => 
    a.role === 'FINANCE' && (a.action === 'NOTED' || a.action === 'BUDGET_APPROVED')
  );

  // Check if Job Order needs approval (for visual highlight - show even if user can approve)
  const needsApproval = (() => {
    if (jobOrder.status === 'CLOSED') return false;
    
    const isServiceType = jobOrder.type === 'SERVICE';

    if (isServiceType) {
      // Service type: Only needs President approval (creating JO = handling dept approval)
      return !managementApproved;
    } else {
      // Material Requisition needs Finance then Management approval
      return !financeApproved || !managementApproved;
    }
  })();

  // Check if current user needs to approve (for different highlight color)
  const needsUserApproval = (() => {
    if (jobOrder.status === 'CLOSED') return false;
    
    const isServiceType = jobOrder.type === 'SERVICE';

    if (isServiceType) {
      // Service type: Only President needs to approve
      if (!managementApproved && isManagement) return true;
    } else {
      // Material Requisition: Finance first, then Management
      if (!financeApproved && isFinance) return true;
      if (!managementApproved && isManagement && financeApproved) return true;
    }
    return false;
  })();

  // Check if handling department can start execution (for blue border animation)
  const canStartExecution = (() => {
    if (jobOrder.status !== 'APPROVED') return false;
    if (jobOrder.type !== 'SERVICE') return false;
    // If President has approved and user is handling department, they can start execution
    return managementApproved && isHandlingDept;
  })();

  const approvalMessage = (() => {
    if (jobOrder.status === 'CLOSED') return '';
    
    const isServiceType = jobOrder.type === 'SERVICE';

    if (isServiceType) {
      // Service type: Only needs President approval
      if (!managementApproved) {
        // Don't show warning to Management users - they can approve
        if (isManagement) return '';
        return 'Waiting for President approval';
      }
    } else {
      // For Material Requisition: Finance needs to approve via Budget Panel
      if (!financeApproved) {
        // Don't show warning to Finance users - they can approve
        if (isFinance) return '';
        return 'Waiting for Finance approval';
      }
      if (!managementApproved) {
        // Don't show warning to Management users - they can approve
        if (isManagement) return '';
        return 'Waiting for President approval';
      }
    }
    return '';
  })();

  return (
    <Link href={`/job-orders/${jobOrder.id || jobOrder._id}`}>
      <div className={`bg-white rounded-lg shadow-md p-4 sm:p-6 border-2 transition-all cursor-pointer ${
        needsUserApproval
          ? 'border-blue-500 animate-border-pulse-blue hover:shadow-xl hover:scale-[1.01] animate-pulse-glow-blue'
          : canStartExecution
          ? 'border-blue-500 animate-border-pulse-blue hover:shadow-xl hover:scale-[1.01] animate-pulse-glow-blue'
          : needsApproval 
          ? 'border-yellow-400 animate-border-pulse hover:shadow-xl hover:scale-[1.01] animate-pulse-glow' 
          : 'border-gray-200 hover:shadow-lg'
      }`}>
        <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-0 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 break-words">{jobOrder.joNumber}</h3>
              {jobOrder.type && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  jobOrder.type === 'SERVICE' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-purple-100 text-purple-800'
                }`}>
                  {jobOrder.type === 'SERVICE' ? 'Service' : 'Material Requisition'}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              SR: {jobOrder.serviceRequest?.srNumber || 'N/A'}
            </p>
          </div>
          <StatusBadge status={jobOrder.status} type="jo" />
        </div>

        {/* Needs Your Approval Card - Show when current user needs to approve */}
        {needsUserApproval && (
          <div className="mb-4 p-3 bg-blue-50 border-2 border-blue-300 rounded-md">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-800">Needs Your Approval</p>
                <p className="text-xs text-blue-700">
                  {jobOrder.type === 'SERVICE' 
                    ? 'This Job Order is waiting for your approval as President.'
                    : !financeApproved 
                    ? 'This Job Order is waiting for your approval as Finance.'
                    : 'This Job Order is waiting for your approval as President.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Needs Approval Card - Show for other users (not the approver) */}
        {needsApproval && !needsUserApproval && approvalMessage && (
          <div className="mb-4 p-3 bg-yellow-50 border-2 border-yellow-300 rounded-md">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-yellow-800">Needs Approval</p>
                <p className="text-xs text-yellow-700">{approvalMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Ready for Execution Card - Show when handling department can start execution */}
        {canStartExecution && (
          <div className="mb-4 p-3 bg-blue-50 border-2 border-blue-300 rounded-md">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-800">Ready for Execution</p>
                <p className="text-xs text-blue-700">Job Order has been approved. You can now start execution.</p>
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
            <span className="text-gray-600">{jobOrder.priorityLevel}</span>
          </p>
          <p className="text-sm text-gray-600 line-clamp-2">{jobOrder.workDescription}</p>
        </div>

        {/* Execution Status */}
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
          <span>Materials: {jobOrder.materials.length} items</span>
        </div>
      </div>
    </Link>
  );
}

