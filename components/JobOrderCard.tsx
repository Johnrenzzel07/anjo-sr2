'use client';

import { JobOrder } from '@/types';
import StatusBadge from './StatusBadge';
import Link from 'next/link';

interface JobOrderCardProps {
  jobOrder: JobOrder;
  currentUser?: { role?: string; department?: string };
}

export default function JobOrderCard({ jobOrder, currentUser }: JobOrderCardProps) {
  // Check if current user can approve (hide warning message but show visual highlight)
  const isFinance = currentUser?.department === 'Finance' || currentUser?.role === 'FINANCE';
  const isOperations = currentUser?.department === 'Operations' || currentUser?.role === 'OPERATIONS';
  const isManagement = currentUser?.role === 'MANAGEMENT' || currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN';

  // Check if Job Order needs approval (for visual highlight - show even if user can approve)
  const needsApproval = (() => {
    if (jobOrder.status === 'CLOSED') return false;
    
    const isServiceType = jobOrder.type === 'SERVICE';
    const operationsApproved = jobOrder.approvals?.some((a: any) => 
      a.role === 'OPERATIONS' && a.action === 'APPROVED'
    );
    const managementApproved = jobOrder.approvals?.some((a: any) => 
      a.role === 'MANAGEMENT' && a.action === 'APPROVED'
    );
    const financeApproved = jobOrder.approvals?.some((a: any) => 
      a.role === 'FINANCE' && (a.action === 'NOTED' || a.action === 'BUDGET_APPROVED')
    );

    if (isServiceType) {
      // Service type needs Operations then Management approval
      return !operationsApproved || !managementApproved;
    } else {
      // Material Requisition needs Finance then Management approval
      return !financeApproved || !managementApproved;
    }
  })();

  // Check if current user needs to approve (for different highlight color)
  const needsUserApproval = (() => {
    if (jobOrder.status === 'CLOSED') return false;
    
    const isServiceType = jobOrder.type === 'SERVICE';
    const operationsApproved = jobOrder.approvals?.some((a: any) => 
      a.role === 'OPERATIONS' && a.action === 'APPROVED'
    );
    const managementApproved = jobOrder.approvals?.some((a: any) => 
      a.role === 'MANAGEMENT' && a.action === 'APPROVED'
    );
    const financeApproved = jobOrder.approvals?.some((a: any) => 
      a.role === 'FINANCE' && (a.action === 'NOTED' || a.action === 'BUDGET_APPROVED')
    );

    if (isServiceType) {
      // Service type: Operations first, then Management
      if (!operationsApproved && isOperations) return true;
      if (!managementApproved && isManagement && operationsApproved) return true;
    } else {
      // Material Requisition: Finance first, then Management
      if (!financeApproved && isFinance) return true;
      if (!managementApproved && isManagement && financeApproved) return true;
    }
    return false;
  })();

  const approvalMessage = (() => {
    if (jobOrder.status === 'CLOSED') return '';
    
    const isServiceType = jobOrder.type === 'SERVICE';
    const operationsApproved = jobOrder.approvals?.some((a: any) => 
      a.role === 'OPERATIONS' && a.action === 'APPROVED'
    );
    const managementApproved = jobOrder.approvals?.some((a: any) => 
      a.role === 'MANAGEMENT' && a.action === 'APPROVED'
    );
    // Check for Finance approval - Material Requisition uses BUDGET_APPROVED, but also check NOTED for compatibility
    const financeApproved = jobOrder.approvals?.some((a: any) => 
      a.role === 'FINANCE' && (a.action === 'NOTED' || a.action === 'BUDGET_APPROVED')
    );

    if (isServiceType) {
      if (!operationsApproved) {
        // Don't show warning to Operations users - they can approve
        if (isOperations) return '';
        return 'Waiting for Operations approval';
      }
      if (!managementApproved) {
        // Don't show warning to Management users - they can approve
        if (isManagement) return '';
        return 'Waiting for Management approval';
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
        return 'Waiting for Management approval';
      }
    }
    return '';
  })();

  return (
    <Link href={`/job-orders/${jobOrder.id || jobOrder._id}`}>
      <div className={`bg-white rounded-lg shadow-md p-4 sm:p-6 border-2 transition-all cursor-pointer ${
        needsUserApproval
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

        {/* Needs Approval Card - Hide warning message for users who can approve, but keep visual highlight */}
        {needsApproval && approvalMessage && (
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

