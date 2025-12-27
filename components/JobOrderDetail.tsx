'use client';

import { JobOrder, UserRole, ApprovalAction } from '@/types';
import StatusBadge from './StatusBadge';
import BudgetPanel from '@/components/BudgetPanel';

interface JobOrderDetailProps {
  jobOrder: JobOrder;
  currentUser?: { role: UserRole; id: string; name: string; department?: string };
  onApprove?: (approval: ApprovalAction) => void;
  onStatusChange?: (status: JobOrder['status']) => void;
  onBudgetUpdate?: () => void;
}

export default function JobOrderDetail({ 
  jobOrder, 
  currentUser,
  onApprove,
  onStatusChange,
  onBudgetUpdate,
}: JobOrderDetailProps) {
  // Helper function to format dates safely
  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString || !dateString.trim()) return 'N/A';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
  };

  // Get target dates from milestones if not set in Job Order
  const getTargetStartDate = (): string => {
    if (jobOrder.targetStartDate && jobOrder.targetStartDate.trim()) {
      const date = new Date(jobOrder.targetStartDate);
      if (!isNaN(date.getTime())) {
        return formatDate(jobOrder.targetStartDate);
      }
    }
    // Fallback to earliest milestone start date
    if (jobOrder.schedule && jobOrder.schedule.length > 0) {
      const startDates = jobOrder.schedule
        .map(m => m.startDate)
        .filter(date => date && date.trim())
        .map(date => new Date(date!))
        .filter(date => !isNaN(date.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());
      if (startDates.length > 0) {
        return startDates[0].toLocaleDateString();
      }
    }
    return 'N/A';
  };

  const getTargetCompletionDate = (): string => {
    if (jobOrder.targetCompletionDate && jobOrder.targetCompletionDate.trim()) {
      const date = new Date(jobOrder.targetCompletionDate);
      if (!isNaN(date.getTime())) {
        return formatDate(jobOrder.targetCompletionDate);
      }
    }
    // Fallback to latest milestone end date
    if (jobOrder.schedule && jobOrder.schedule.length > 0) {
      const endDates = jobOrder.schedule
        .map(m => m.endDate)
        .filter(date => date && date.trim())
        .map(date => new Date(date!))
        .filter(date => !isNaN(date.getTime()))
        .sort((a, b) => b.getTime() - a.getTime());
      if (endDates.length > 0) {
        return endDates[0].toLocaleDateString();
      }
    }
    return 'N/A';
  };

  const canApprove = (action: 'PREPARED' | 'REVIEWED' | 'NOTED' | 'APPROVED') => {
    if (!currentUser) return false;
    
    // Check if user is Operations (either role is OPERATIONS or APPROVER with Operations department)
    const userRole = currentUser.role as string;
    const userDepartment = (currentUser as any).department as string;
    const isOperations = userRole === 'OPERATIONS' || 
      (userRole === 'APPROVER' && userDepartment === 'Operations');
    
    // Check if user is President/Management (SUPER_ADMIN/ADMIN should be treated as MANAGEMENT)
    const isPresident = userRole === 'MANAGEMENT' || userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    
    const hasApproval = jobOrder.approvals.some(a => {
      // Check if user already approved with the SAME action (match by role or by mapped roles)
      if (isOperations && a.role === 'OPERATIONS' && a.action === action) return true;
      if (isPresident && a.role === 'MANAGEMENT' && a.action === action) return true;
      return a.role === currentUser.role && a.action === action;
    });
    
    if (hasApproval) return false;
    
    const isServiceType = jobOrder.type === 'SERVICE';
    const hasMaterials = jobOrder.materials && jobOrder.materials.length > 0;
    const serviceNeedsBudget = isServiceType && hasMaterials;
    
    // Check budget approval status
    const financeBudgetApproved = jobOrder.approvals.some(
      (a: any) => a.role === 'FINANCE' && a.action === 'BUDGET_APPROVED'
    );
    const presidentBudgetApproved = jobOrder.approvals.some(
      (a: any) => a.role === 'MANAGEMENT' && a.action === 'BUDGET_APPROVED'
    );
    const budgetCleared = financeBudgetApproved && presidentBudgetApproved;
    
    // Check if Operations has approved for Service type
    const operationsApproved = jobOrder.approvals.some(a => 
      a.role === 'OPERATIONS' && a.action === 'APPROVED'
    );
    
    switch (action) {
      case 'PREPARED':
        return isOperations;
      case 'REVIEWED':
        return userRole === 'DEPARTMENT_HEAD';
      case 'NOTED':
        return userRole === 'FINANCE';
      case 'APPROVED':
        if (isServiceType) {
          // For Service type with materials: Budget must be approved first, then Operations, then President
          if (serviceNeedsBudget) {
            if (isOperations) {
              // Operations can approve after budget is cleared
              return budgetCleared;
            }
            if (isPresident) {
              // President can approve after Operations has approved (and budget is already cleared)
              return budgetCleared && operationsApproved;
            }
            return false;
          } else {
            // For Service type without materials: Operations must approve first, then President can approve
            if (isOperations) {
              return true; // Operations can approve first
            }
            if (isPresident) {
              return operationsApproved; // President/Admin can only approve after Operations
            }
            return false;
          }
        }
        // For Material Requisition: Budget must be approved first, then only Management can approve Job Order
        if (!isPresident) {
          return false; // Only President can approve Material Requisition Job Orders
        }
        // President can only approve Job Order if budget has been cleared
        return budgetCleared;
      default:
        return false;
    }
  };

  const handleApprove = (action: 'PREPARED' | 'REVIEWED' | 'NOTED' | 'APPROVED') => {
    if (!currentUser) return;
    
    // Map roles for approvals:
    // - APPROVER with Operations department → OPERATIONS
    // - SUPER_ADMIN/ADMIN → MANAGEMENT (President)
    const userRole = currentUser.role as string;
    const userDepartment = (currentUser as any).department as string;
    let approvalRole = userRole;
    
    if (userRole === 'APPROVER' && userDepartment === 'Operations') {
      approvalRole = 'OPERATIONS';
    } else if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') {
      approvalRole = 'MANAGEMENT';
    }
    
    onApprove?.({
      role: approvalRole as any,
      userId: currentUser.id,
      userName: currentUser.name,
      action,
    });
  };

  // Different timelines for Service vs Material Requisition
  const isServiceType = jobOrder.type === 'SERVICE';
  const statusTimeline = isServiceType 
    ? [
        // Service type timeline
        { status: 'DRAFT', label: 'Draft', condition: jobOrder.status !== 'DRAFT' },
        { status: 'APPROVED', label: 'Approved', condition: ['APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'].includes(jobOrder.status) },
        { status: 'IN_PROGRESS', label: 'In Progress', condition: ['IN_PROGRESS', 'COMPLETED', 'CLOSED'].includes(jobOrder.status) },
        { status: 'COMPLETED', label: 'Completed', condition: ['COMPLETED', 'CLOSED'].includes(jobOrder.status) },
        { status: 'CLOSED', label: 'Closed', condition: jobOrder.status === 'CLOSED' },
      ]
    : [
        // Material Requisition type timeline
        { status: 'DRAFT', label: 'Draft', condition: jobOrder.status !== 'DRAFT' },
        { status: 'APPROVED', label: 'Approved', condition: ['BUDGET_CLEARED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'].includes(jobOrder.status) },
        { status: 'IN_PROGRESS', label: 'In Progress', condition: ['IN_PROGRESS', 'COMPLETED', 'CLOSED'].includes(jobOrder.status) },
        { status: 'COMPLETED', label: 'Completed', condition: ['COMPLETED', 'CLOSED'].includes(jobOrder.status) },
        { status: 'CLOSED', label: 'Closed', condition: jobOrder.status === 'CLOSED' },
      ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">{jobOrder.joNumber}</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Service Request: {jobOrder.serviceRequest?.srNumber || 'N/A'}
            </p>
          </div>
          <StatusBadge status={jobOrder.status} type="jo" />
        </div>

        {/* Status Timeline */}
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Status Timeline</h3>
          <div className="flex items-center space-x-2 overflow-x-auto pb-2">
            {statusTimeline.map((step, index) => (
              <div key={step.status} className="flex items-center flex-shrink-0">
                <div className={`flex flex-col items-center ${step.condition ? 'text-blue-600' : 'text-gray-400'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                    step.condition ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {index + 1}
                  </div>
                  <span className="text-xs mt-1 whitespace-nowrap">{step.label}</span>
                </div>
                {index < statusTimeline.length - 1 && (
                  <div className={`w-12 h-0.5 mx-1 ${step.condition ? 'bg-blue-600' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Job Order Header (Read-only) */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Job Order Header</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Date Issued:</span>{' '}
            <span className="text-gray-600">{new Date(jobOrder.dateIssued).toLocaleDateString()}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Requested By:</span>{' '}
            <span className="text-gray-600">{jobOrder.requestedBy}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Department:</span>{' '}
            <span className="text-gray-600">{jobOrder.department}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Contact Person:</span>{' '}
            <span className="text-gray-600">{jobOrder.contactPerson}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Priority Level:</span>{' '}
            <span className="text-gray-600">{jobOrder.priorityLevel}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Target Start Date:</span>{' '}
            <span className="text-gray-600">{getTargetStartDate()}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Target Completion Date:</span>{' '}
            <span className="text-gray-600">{getTargetCompletionDate()}</span>
          </div>
        </div>
      </div>

      {/* Job Description */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Job Description</h2>
        <div className="space-y-3 text-sm">
          <div>
            <span className="font-medium text-gray-700">Service Category:</span>{' '}
            <span className="text-gray-600">{jobOrder.serviceCategory}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Work Description / Scope:</span>
            <p className="text-gray-600 mt-1">{jobOrder.workDescription}</p>
          </div>
        </div>
      </div>

      {/* Materials & Services - Show for both Material Requisition and Service type with materials */}
      {((jobOrder.type === 'MATERIAL_REQUISITION') || (jobOrder.type === 'SERVICE' && jobOrder.materials && jobOrder.materials.length > 0)) && (
        <>
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Materials & Services Required</h2>
            {jobOrder.materials && jobOrder.materials.length > 0 ? (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                        <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                        <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Est. Cost</th>
                        <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {jobOrder.materials.map((material) => (
                        <tr key={material.id}>
                          <td className="px-2 sm:px-4 py-3 text-xs sm:text-sm text-gray-900">{material.item}</td>
                          <td className="px-2 sm:px-4 py-3 text-xs sm:text-sm text-gray-600">{material.description}</td>
                          <td className="px-2 sm:px-4 py-3 text-xs sm:text-sm text-gray-600">{material.quantity}</td>
                          <td className="px-2 sm:px-4 py-3 text-xs sm:text-sm text-gray-600">{material.unit}</td>
                          <td className="px-2 sm:px-4 py-3 text-xs sm:text-sm text-gray-600">
                            ₱{material.estimatedCost.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-2 sm:px-4 py-3 text-xs sm:text-sm text-gray-600">{material.source.replace('_', ' ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No materials added yet.</p>
            )}
          </div>

          {/* Budget Panel - Show for Material Requisition or Service type with materials */}
          <div className="mt-6">
            <BudgetPanel
              jobOrder={jobOrder}
              currentUser={currentUser}
              onBudgetUpdate={onBudgetUpdate}
            />
          </div>
        </>
      )}

      {/* Manpower - Only show for Service type */}
      {jobOrder.type === 'SERVICE' && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Manpower / Responsibility</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Assigned Unit / Team:</span>{' '}
              <span className="text-gray-600">{jobOrder.manpower?.assignedUnit || 'Not assigned'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Supervisor-in-Charge:</span>{' '}
              <span className="text-gray-600">{jobOrder.manpower?.supervisorInCharge || 'Not assigned'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Supervisor Department:</span>{' '}
              <span className="text-gray-600">{jobOrder.manpower?.supervisorDept || 'Not assigned'}</span>
            </div>
            {jobOrder.manpower?.outsource && (
              <div>
                <span className="font-medium text-gray-700">Outsource:</span>{' '}
                <span className="text-gray-600">{jobOrder.manpower.outsource}</span>
                {jobOrder.manpower.outsourcePrice && (
                  <span className="text-gray-600 ml-2">
                    (₱{jobOrder.manpower.outsourcePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Schedule & Milestones */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Schedule & Milestones</h2>
        {jobOrder.schedule && jobOrder.schedule.length > 0 ? (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activity</th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">End Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {jobOrder.schedule.map((milestone) => (
                    <tr key={milestone.id}>
                      <td className="px-2 sm:px-4 py-3 text-xs sm:text-sm text-gray-900">{milestone.activity}</td>
                      <td className="px-2 sm:px-4 py-3 text-xs sm:text-sm text-gray-600">
                        {milestone.startDate ? new Date(milestone.startDate).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-2 sm:px-4 py-3 text-xs sm:text-sm text-gray-600">
                        {milestone.endDate ? new Date(milestone.endDate).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No milestones added yet.</p>
        )}
      </div>

      {/* Approvals Section */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Approvals</h2>
        
        {/* Existing Approvals */}
        {jobOrder.approvals && jobOrder.approvals.length > 0 && (
          <div className="mb-4 space-y-2">
            {jobOrder.approvals.map((approval: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <div>
                  <span className="font-medium text-gray-900">{approval.userName}</span>
                  <span className="text-gray-500 ml-2">({approval.role})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${
                    approval.action === 'APPROVED' || approval.action === 'BUDGET_APPROVED' ? 'text-green-600' :
                    approval.action === 'REJECTED' || approval.action === 'BUDGET_REJECTED' ? 'text-red-600' :
                    'text-blue-600'
                  }`}>
                    {approval.action}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(approval.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Service Type Approval Status */}
        {jobOrder.type === 'SERVICE' && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            {(() => {
              const operationsApproved = jobOrder.approvals.some((a: any) => 
                a.role === 'OPERATIONS' && a.action === 'APPROVED'
              );
              const presidentApproved = jobOrder.approvals.some((a: any) => 
                a.role === 'MANAGEMENT' && a.action === 'APPROVED'
              );
              
              if (operationsApproved && presidentApproved) {
                return <p className="text-sm text-green-700 font-medium">✓ Approved by Operations and President - Ready for execution</p>;
              } else if (operationsApproved) {
                return <p className="text-sm text-yellow-700">✓ Operations approved - Waiting for President approval</p>;
              } else {
                return <p className="text-sm text-blue-700">Waiting for Operations approval first, then President approval</p>;
              }
            })()}
          </div>
        )}

        {/* Approval Actions - simplified to only Approve */}
        <div className="space-y-2">
          {canApprove('APPROVED') && (
            <button
              onClick={() => handleApprove('APPROVED')}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium text-sm sm:text-base"
            >
              {jobOrder.type === 'SERVICE' 
                ? ((() => {
                    const userRole = currentUser?.role as string;
                    const userDepartment = (currentUser as any)?.department as string;
                    const isOperations = userRole === 'OPERATIONS' || (userRole === 'APPROVER' && userDepartment === 'Operations');
                    const isPresident = userRole === 'MANAGEMENT' || userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
                    return isOperations ? 'Approve (Operations)' : (isPresident ? 'Approve (President)' : 'Approve Job Order');
                  })())
                : 'Approve Job Order'}
            </button>
          )}
        </div>

        {!canApprove('APPROVED') && (
          <p className="text-sm text-gray-500 text-center py-4">
            {(() => {
              if (jobOrder.approvals && jobOrder.approvals.length > 0) {
                // Check if it's Material Requisition and budget not cleared
                if (jobOrder.type === 'MATERIAL_REQUISITION') {
                  const financeBudgetApproved = jobOrder.approvals.some(
                    (a: any) => a.role === 'FINANCE' && a.action === 'BUDGET_APPROVED'
                  );
                  const presidentBudgetApproved = jobOrder.approvals.some(
                    (a: any) => a.role === 'MANAGEMENT' && a.action === 'BUDGET_APPROVED'
                  );
                  const budgetCleared = financeBudgetApproved && presidentBudgetApproved;
                  
                  if (!budgetCleared) {
                    return 'Budget must be approved by Finance and President before Job Order can be approved.';
                  }
                }
                return 'You have already provided your approval or no further approvals are needed.';
              }
              return 'No approval actions available for your role.';
            })()}
          </p>
        )}
      </div>

      {/* Budget Information & Acceptance & Completion are handled by separate panels on the page */}
    </div>
  );
}

