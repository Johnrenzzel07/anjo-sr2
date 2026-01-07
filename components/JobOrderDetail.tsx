'use client';

import { JobOrder, UserRole, ApprovalAction } from '@/types';
import StatusBadge from './StatusBadge';
import BudgetPanel from '@/components/BudgetPanel';
import { useApprovalModal } from './useApprovalModal';

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

  // Operations can also handle if they're in the authorized list
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

  const canApprove = (action: 'PREPARED' | 'REVIEWED' | 'NOTED' | 'APPROVED' | 'REJECTED') => {
    if (!currentUser) return false;

    const userRole = currentUser.role as string;
    const userDepartment = (currentUser as any).department as string;

    // Check if user is the handling department for this JO's service category
    const isHandlingDept = isHandlingDepartment(userDepartment, jobOrder.serviceCategory);

    // Check if user is President/Management (SUPER_ADMIN/ADMIN should be treated as MANAGEMENT)
    const isPresident = userRole === 'MANAGEMENT' || userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

    // Check if President/Management has ALREADY approved, rejected, or approved budget for this JO
    const presidentHasActed = jobOrder.approvals.some(
      a => a.role === 'MANAGEMENT' && (a.action === 'APPROVED' || a.action === 'REJECTED' || a.action === 'BUDGET_APPROVED')
    );

    // If President has already acted (approved, rejected, or budget approved), no further approval/rejection actions
    if (isPresident && presidentHasActed && (action === 'APPROVED' || action === 'REJECTED')) {
      return false;
    }

    const hasApproval = jobOrder.approvals.some(a => {
      // Check if user already approved with the SAME action
      if (isPresident && a.role === 'MANAGEMENT' && a.action === action) return true;
      // Also check if user already approved budget (BUDGET_APPROVED) when checking for APPROVED action
      // For SERVICE type with materials, if user already approved budget, they've effectively approved the JO
      if (action === 'APPROVED' && isPresident && a.role === 'MANAGEMENT' && a.action === 'BUDGET_APPROVED') {
        // Check by userId - if this approval matches the current user, they've already approved
        if (a.userId === currentUser.id) return true;
      }
      return a.role === currentUser.role && a.action === action;
    });

    if (hasApproval) return false;

    // If already rejected, cannot approve or reject further
    if (jobOrder.status === 'REJECTED') return false;

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

    switch (action) {
      case 'PREPARED':
        return isHandlingDept;
      case 'REVIEWED':
        return userRole === 'DEPARTMENT_HEAD';
      case 'NOTED':
        return userRole === 'FINANCE';
      case 'APPROVED':
      case 'REJECTED':
        if (isServiceType) {
          // For Service type: Creating the JO counts as handling dept approval
          // Only President needs to approve or reject
          if (!isPresident) {
            return false; // Only President can approve/reject Service type JOs
          }
          // For Service type with materials: Budget must be approved first (rejection can happen anytime though)
          if (serviceNeedsBudget && action === 'APPROVED') {
            return budgetCleared;
          }
          // For Service type without materials or for REJECTED action: President can act directly
          return true;
        }
        // For Material Requisition: Budget must be approved first for APPROVED action,
        // then only Management can approve or reject Job Order
        if (!isPresident) {
          return false; // Only President can approve/reject Material Requisition Job Orders
        }
        // President can only approve Job Order if budget has been cleared, 
        // but they can reject it anytime.
        if (action === 'REJECTED') return true;
        return budgetCleared;
      default:
        return false;
    }
  };

  const { showApproval, ApprovalDialog } = useApprovalModal();

  const handleApprove = async (action: 'PREPARED' | 'REVIEWED' | 'NOTED' | 'APPROVED' | 'REJECTED') => {
    if (!currentUser) return;

    // Show confirmation/comment modal
    const comments = await showApproval({
      title: action === 'REJECTED' ? 'Reject Job Order' : 'Approve Job Order',
      message: action === 'REJECTED'
        ? `Are you sure you want to reject ${jobOrder.joNumber}? Please provide a reason.`
        : `Are you sure you want to approve ${jobOrder.joNumber}?`,
      confirmButtonText: action === 'REJECTED' ? 'Reject' : 'Approve',
      confirmButtonColor: action === 'REJECTED' ? 'red' : 'green',
      placeholder: action === 'REJECTED' ? 'Enter rejection reason (required)...' : 'Enter comments (optional)...',
      showComments: true,
    });

    if (comments === null) return; // User cancelled

    if (action === 'REJECTED' && !comments.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    // Map roles for approvals:
    // - Handling department (based on service category) → DEPARTMENT_HEAD
    // - SUPER_ADMIN/ADMIN → MANAGEMENT (President)
    const userRole = currentUser.role as string;
    const userDepartment = (currentUser as any).department as string;
    let approvalRole = userRole;

    // Check if user is the handling department for this JO's service category
    const isHandlingDept = isHandlingDepartment(userDepartment, jobOrder.serviceCategory);

    if (isHandlingDept && userRole === 'APPROVER') {
      approvalRole = 'DEPARTMENT_HEAD';
    } else if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') {
      approvalRole = 'MANAGEMENT';
    }

    onApprove?.({
      role: approvalRole as any,
      userId: currentUser.id,
      userName: currentUser.name,
      action,
      comments: comments || '',
    });
  };

  // Different timelines for Service vs Material Requisition
  const isServiceType = jobOrder.type === 'SERVICE';
  const statusTimeline = isServiceType
    ? [
      // Service type timeline
      { status: 'DRAFT', label: 'Draft', condition: ['DRAFT', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'].includes(jobOrder.status) },
      { status: 'APPROVED', label: 'Approved', condition: ['APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'].includes(jobOrder.status) },
      { status: 'IN_PROGRESS', label: 'In Progress', condition: ['IN_PROGRESS', 'COMPLETED', 'CLOSED'].includes(jobOrder.status) },
      { status: 'COMPLETED', label: 'Completed', condition: ['COMPLETED', 'CLOSED'].includes(jobOrder.status) },
      { status: 'CLOSED', label: 'Closed', condition: jobOrder.status === 'CLOSED' },
    ]
    : [
      // Material Requisition type timeline (starts at Pending Canvass, no Draft)
      { status: 'PENDING_CANVASS', label: 'Pending Canvass', condition: true }, // Always shown
      { status: 'BUDGET_APPROVAL', label: 'Budget Approval', condition: jobOrder.approvals?.some((a: any) => a.action === 'CANVASS_COMPLETED') || ['BUDGET_CLEARED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'].includes(jobOrder.status) },
      { status: 'APPROVED', label: 'Approved', condition: ['BUDGET_CLEARED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'].includes(jobOrder.status) },
      { status: 'IN_PROGRESS', label: 'In Progress', condition: ['IN_PROGRESS', 'COMPLETED', 'CLOSED'].includes(jobOrder.status) },
      { status: 'COMPLETED', label: 'Completed', condition: ['COMPLETED', 'CLOSED'].includes(jobOrder.status) },
      { status: 'CLOSED', label: 'Closed', condition: jobOrder.status === 'CLOSED' },
    ];

  return (
    <div className="space-y-6">
      <ApprovalDialog />
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
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${step.condition ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
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
                        <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                        <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Color</th>
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
                          <td className="px-2 sm:px-4 py-3 text-xs sm:text-sm text-gray-600">{material.size || '-'}</td>
                          <td className="px-2 sm:px-4 py-3 text-xs sm:text-sm text-gray-600">{material.color || '-'}</td>
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
                  <span className={`text-sm font-medium ${approval.action === 'APPROVED' || approval.action === 'BUDGET_APPROVED' ? 'text-green-600' :
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
          <div className={`mb-4 p-3 border rounded-md ${jobOrder.status === 'REJECTED'
            ? 'bg-red-50 border-red-200'
            : jobOrder.approvals.some((a: any) => a.role === 'MANAGEMENT' && a.action === 'APPROVED')
              ? 'bg-green-50 border-green-200'
              : 'bg-blue-50 border-blue-200'
            }`}>
            {(() => {
              const handlingDeptName = getHandlingDepartmentName(jobOrder.serviceCategory);
              const presidentApproved = jobOrder.approvals.some((a: any) =>
                a.role === 'MANAGEMENT' && a.action === 'APPROVED'
              );
              const isRejected = jobOrder.status === 'REJECTED';

              if (isRejected) {
                return <p className="text-sm text-red-700 font-medium">✕ Rejected by President - This Job Order will not proceed</p>;
              } else if (presidentApproved) {
                return <p className="text-sm text-green-700 font-medium">✓ Approved by {handlingDeptName} Department (via creation) and President - Ready for fulfillment</p>;
              } else {
                return <p className="text-sm text-blue-700">✓ Approved by {handlingDeptName} Department (via creation) - Waiting for President approval</p>;
              }
            })()}
          </div>
        )}

        {/* Approval Actions - simplified to only Approve */}
        <div className="flex gap-2">
          {canApprove('APPROVED') && (
            <button
              onClick={() => handleApprove('APPROVED')}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium text-sm sm:text-base"
            >
              Approve (President)
            </button>
          )}
          {canApprove('REJECTED') && jobOrder.type === 'SERVICE' && (
            <button
              onClick={() => handleApprove('REJECTED')}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium text-sm sm:text-base"
            >
              Reject (President)
            </button>
          )}
        </div>

        {!canApprove('APPROVED') && (
          <p className="text-sm text-gray-500 text-center py-4">
            {(() => {
              const userRole = currentUser?.role as string;
              const userDepartment = (currentUser as any)?.department;
              const isHandlingDept = isHandlingDepartment(userDepartment, jobOrder.serviceCategory);
              const isPresident = userRole === 'MANAGEMENT' || userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

              if (jobOrder.status === 'REJECTED') {
                return 'This Job Order has been rejected.';
              }
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

              // For SERVICE type: Handling department created it, now waiting for President
              if (jobOrder.type === 'SERVICE' && isHandlingDept && !isPresident && (jobOrder.status as string) !== 'REJECTED') {
                return 'This Job Order is waiting for President approval. Once approved, you can start fulfillment.';
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

