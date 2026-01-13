'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { JobOrder, ApprovalAction, UserRole, PurchaseOrder } from '@/types';
import JobOrderDetail from '@/components/JobOrderDetail';
import PurchaseOrderForm from '@/components/PurchaseOrderForm';
import FulfillmentPanel from '@/components/FulfillmentPanel';
import AcceptancePanel from '@/components/AcceptancePanel';
import TransferPanel from '@/components/TransferPanel';
import StatusBadge from '@/components/StatusBadge';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useToast } from '@/components/ToastContainer';
import { useConfirm } from '@/components/useConfirm';

export default function JobOrderPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [jobOrder, setJobOrder] = useState<JobOrder | null>(null);
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [showCreatePO, setShowCreatePO] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ role: UserRole; id: string; name: string; department?: string } | null>(null);
  const [canvassMaterials, setCanvassMaterials] = useState<any[]>([]);

  const formatCurrency = (value: number | string | undefined): string => {
    if (value === '' || value === null || value === undefined) return '';
    const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
    if (isNaN(num)) return '';

    // Split into integer and decimal parts
    const parts = num.toFixed(2).split('.');
    const integerPart = parts[0] || '0';
    const decimalPart = parts[1] || '00';

    // Format integer part with commas
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    return `${formattedInteger}.${decimalPart}`;
  };

  const parseCurrency = (value: string): number => {
    const cleaned = value.replace(/,/g, '').trim();
    return cleaned === '' ? 0 : parseFloat(cleaned) || 0;
  };

  useEffect(() => {
    // Fetch current user from auth
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          setCurrentUser(data.user);
        } else {
          // If not authenticated, redirect to login
          router.push('/login');
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        router.push('/login');
      }
    };

    fetchUser();
  }, [router]);

  useEffect(() => {
    if (params.id) {
      fetchJobOrder(params.id as string);
    }
  }, [params.id]);

  const fetchJobOrder = async (id: string) => {
    try {
      const response = await fetch(`/api/job-orders/${id}`);
      if (response.ok) {
        const data = await response.json();
        // Convert MongoDB _id to id for consistency
        const jo = data.jobOrder;
        if (jo._id && !jo.id) {
          jo.id = jo._id.toString();
        }
        if (jo.srId && typeof jo.srId === 'object' && jo.srId._id) {
          jo.serviceRequest = jo.srId;
          jo.srId = jo.srId._id.toString();
        }
        setJobOrder(jo);

        // Initialize canvass materials with pricing fields if status is PENDING_CANVASS
        if (jo.status === 'PENDING_CANVASS' && jo.materials) {
          setCanvassMaterials(jo.materials.map((mat: any) => ({
            ...mat,
            unitPrice: mat.unitPrice || 0,
            estimatedCost: mat.estimatedCost || 0,
          })));
        }

        // Mark related notifications as read
        try {
          await fetch('/api/notifications/mark-read-by-entity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              relatedEntityType: 'JOB_ORDER',
              relatedEntityId: jo.id || jo._id?.toString(),
            }),
          });

          // Trigger NotificationBell refresh
          window.dispatchEvent(new Event('refreshNotifications'));
        } catch (notifError) {
          console.error('Error marking notifications as read:', notifError);
        }

        // Check if PO exists for this JO
        if (jo.type === 'MATERIAL_REQUISITION') {
          const poResponse = await fetch(`/api/purchase-orders?joId=${jo._id || jo.id}`);
          if (poResponse.ok) {
            const poData = await poResponse.json();
            if (poData.purchaseOrders && poData.purchaseOrders.length > 0) {
              setPurchaseOrder(poData.purchaseOrders[0]);
            }
          }
        }
      } else {
        console.error('Failed to fetch Job Order');
      }
    } catch (error) {
      console.error('Error fetching Job Order:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (approval: ApprovalAction) => {
    if (!jobOrder) return;

    try {
      const joId = jobOrder.id || (jobOrder as any)._id;
      const response = await fetch(`/api/job-orders/${joId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(approval),
      });

      if (response.ok) {
        const data = await response.json();
        setJobOrder(data.jobOrder);

        // Mark related notifications as read after approval
        try {
          await fetch('/api/notifications/mark-read-by-entity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              relatedEntityType: 'JOB_ORDER',
              relatedEntityId: joId,
            }),
          });

          // Trigger NotificationBell refresh
          window.dispatchEvent(new Event('refreshNotifications'));
        } catch (notifError) {
          console.error('Error marking notifications as read:', notifError);
        }
      } else {
        const error = await response.json();
        toast.showError(error.error || 'Failed to add approval');
      }
    } catch (error) {
      console.error('Error adding approval:', error);
      toast.showError('Failed to add approval');
    }
  };

  const handleStatusChange = async (status: JobOrder['status']) => {
    if (!jobOrder) return;

    try {
      const joId = jobOrder.id || (jobOrder as any)._id;
      const response = await fetch(`/api/job-orders/${joId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        const data = await response.json();
        setJobOrder(data.jobOrder);
      } else {
        const error = await response.json();
        toast.showError(error.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.showError('Failed to update status');
    }
  };

  const handleCreatePO = async (data: {
    items: any[];
    supplierName?: string;
    supplierContact?: string;
    supplierAddress?: string;
    tax?: number;
    expectedDeliveryDate?: string;
  }) => {
    if (!jobOrder) return;

    try {
      const joId = jobOrder.id || (jobOrder as any)._id;
      const response = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          joId,
          ...data,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setPurchaseOrder(result.purchaseOrder);
        setShowCreatePO(false);
        toast.showSuccess(`Purchase Order ${result.purchaseOrder.poNumber} created successfully!`);
        router.push(`/purchase-orders/${result.purchaseOrder._id || result.purchaseOrder.id}`);
      } else {
        const error = await response.json();
        const errorMessage = error.details
          ? `${error.error}\n\n${error.details}`
          : error.error || 'Failed to create Purchase Order';
        toast.showError(errorMessage);
        console.error('PO Creation Error:', error);
      }
    } catch (error) {
      console.error('Error creating Purchase Order:', error);
      toast.showError('Failed to create Purchase Order');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="78" speed="1.4" color="#3b82f6" />
      </div>
    );
  }

  if (!jobOrder) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Job Order not found</p>
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 sm:gap-4">
              <img
                src="/logo.png"
                alt="ANJO WORLD"
                className="h-10 w-10 sm:h-12 sm:w-12 object-contain"
              />
              <div>
                <Link
                  href="/"
                  className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm mb-1 sm:mb-2 inline-block"
                >
                  ← Back to Dashboard
                </Link>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Job Order Details</h1>
              </div>
            </div>
            {currentUser && (
              <div className="text-xs sm:text-sm text-gray-600">
                <span className="hidden sm:inline">Logged in as: </span>
                <span className="font-medium">{currentUser.name}</span> ({currentUser.role})
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Read-only notice for unauthorized users */}
        {(() => {
          const userRole = currentUser?.role as string;
          const userDepartment = (currentUser as any)?.department;

          // Helper to normalize department
          const normalizeDept = (dept: string | undefined) => (dept || '').toLowerCase().replace(/\s+department$/, '').trim();

          // Service Category to Department mapping
          const SERVICE_CATEGORY_TO_DEPARTMENT: Record<string, string[]> = {
            'Technical Support': ['it'],
            'Facility Maintenance': ['maintenance'],
            'Account/Billing Inquiry': ['finance'],
            'General Inquiry': ['operations'],
            'Other': ['operations'],
          };

          // Check if user is the handling department for this JO
          const isHandlingDept = (() => {
            const normalizedUserDept = normalizeDept(userDepartment);
            if (normalizedUserDept === 'president') return true;
            const authorizedDepts = SERVICE_CATEGORY_TO_DEPARTMENT[jobOrder.serviceCategory];
            if (!authorizedDepts) return normalizedUserDept === 'operations';
            return authorizedDepts.includes(normalizedUserDept);
          })();

          const isAuthorized = userRole === 'OPERATIONS' ||
            userRole === 'ADMIN' ||
            userRole === 'SUPER_ADMIN' ||
            userRole === 'FINANCE' ||
            userRole === 'DEPARTMENT_HEAD' ||
            isHandlingDept ||
            (userRole === 'APPROVER' && (normalizeDept(userDepartment) === 'operations' || normalizeDept(userDepartment) === 'finance' || normalizeDept(userDepartment) === 'purchasing'));

          if (!isAuthorized && currentUser) {
            return (
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-blue-900">View Only Mode</p>
                    <p className="text-xs text-blue-700 mt-1">
                      You are viewing this Job Order in read-only mode. Only authorized personnel (Operations, Finance, Purchasing, Admin, or Department Heads) can make changes.
                    </p>
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* Canvass Panel for Purchasing Department */}
        {(() => {
          const isPendingCanvass = jobOrder.status === 'PENDING_CANVASS';
          const userDepartment = (currentUser as any)?.department;
          const userRole = currentUser?.role as string;
          const normalizedDept = (userDepartment || '').toLowerCase().replace(/\s+department$/, '');
          const isPurchasing = normalizedDept === 'purchasing' ||
            userRole === 'SUPER_ADMIN' ||
            userRole === 'ADMIN';

          if (!isPendingCanvass || !isPurchasing) {
            return null;
          }

          return (
            <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg p-6">
              <div className="flex items-start gap-3 mb-4">
                <svg className="w-6 h-6 text-orange-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                <div>
                  <h3 className="text-lg font-semibold text-orange-900">Lowest Canvassed Price</h3>
                  <p className="text-sm text-orange-700 mt-1">
                    Please input the most competitive lowest prices obtained during your canvassing process. These values will serve as the official basis for budget approval and final procurement.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border border-orange-200">
                <h4 className="font-medium text-gray-900 mb-3">Materials to Price:</h4>
                <div className="space-y-3">
                  {canvassMaterials.map((mat, index) => (
                    <div key={mat.id || index} className="p-3 bg-gray-50 rounded border">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="font-medium text-gray-900">{mat.item}</span>
                          {mat.description && <span className="text-gray-500 ml-2">- {mat.description}</span>}
                        </div>
                        <div className="text-sm text-gray-600">
                          Qty: {mat.quantity} {mat.unit}
                          {mat.size && <span className="ml-2">Size: {mat.size}</span>}
                          {mat.color && <span className="ml-2">Color: {mat.color}</span>}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Unit Price (₱)</label>
                          <input
                            type="text"
                            value={mat.unitPrice !== undefined && mat.unitPrice !== 0 ? mat.unitPrice.toLocaleString('en-US') : ''}
                            onChange={(e) => {
                              const rawValue = e.target.value.replace(/,/g, '');
                              if (/^\d*\.?\d*$/.test(rawValue)) {
                                const unitPrice = parseFloat(rawValue) || 0;
                                const estimatedCost = unitPrice * (mat.quantity || 1);
                                setCanvassMaterials(prev => prev.map((m, i) =>
                                  i === index ? { ...m, unitPrice, estimatedCost } : m
                                ));
                              }
                            }}
                            placeholder="0.00"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Lowest Price (₱)</label>
                          <input
                            type="text"
                            value={formatCurrency(mat.estimatedCost)}
                            readOnly
                            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-100 text-gray-700 font-medium"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center">
                  <span className="font-medium text-gray-900">Total Lowest Price:</span>
                  <span className="text-lg font-bold text-orange-600">
                    ₱{canvassMaterials.reduce((sum, m) => sum + (m.estimatedCost || 0), 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="mt-4">
                {(() => {
                  const hasMissingPrices = canvassMaterials.some(m => !m.unitPrice || m.unitPrice === 0 || !m.estimatedCost || m.estimatedCost === 0);

                  return (
                    <>
                      {hasMissingPrices && (
                        <div className="mb-3 bg-red-50 border border-red-200 rounded-md p-3">
                          <div className="flex items-start gap-2">
                            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div>
                              <p className="text-sm font-medium text-red-900">Missing Prices</p>
                              <p className="text-xs text-red-700 mt-1">
                                Please enter unit prices for all materials before submitting for approval.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="flex justify-end">
                        <button
                          onClick={async () => {
                            const confirmed = await confirm(
                              'Are you ready to submit this for budget approval? The current material prices will be used for the budget calculation.',
                              { title: 'Submit Canvass', confirmText: 'Submit', confirmButtonColor: 'green' }
                            );
                            if (!confirmed) return;

                            try {
                              const joId = jobOrder.id || (jobOrder as any)._id;
                              const response = await fetch(`/api/job-orders/${joId}/canvass`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  materials: canvassMaterials,
                                  comments: 'Canvassing completed by Purchasing Department',
                                }),
                              });

                              if (response.ok) {
                                toast.showSuccess('Canvass submitted successfully! Job Order forwarded for budget approval.');
                                fetchJobOrder(joId);
                              } else {
                                const error = await response.json();
                                toast.showError(error.error || 'Failed to submit canvass');
                              }
                            } catch (error) {
                              console.error('Error submitting canvass:', error);
                              toast.showError('Failed to submit canvass');
                            }
                          }}
                          disabled={hasMissingPrices}
                          className={`px-6 py-2 rounded-md font-medium shadow-sm transition-colors ${hasMissingPrices
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-orange-600 text-white hover:bg-orange-700'
                            }`}
                        >
                          Submit for Budget Approval
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          );
        })()}

        {/* Show PO link or Create PO button for Material Requisition */}
        {(() => {
          const isMaterialRequisition = jobOrder.type === 'MATERIAL_REQUISITION';
          const hasMaterials = jobOrder.materials && jobOrder.materials.length > 0;
          const showPOSection = isMaterialRequisition || (!jobOrder.type && hasMaterials);

          if (!showPOSection) {
            // Show info message for Service type JOs
            if (jobOrder.type === 'SERVICE') {
              return (
                <div className="mb-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Note:</span> Purchase Orders can only be created from <span className="font-medium">Material Requisition</span> type Job Orders.
                    This is a <span className="font-medium">Service</span> type Job Order.
                  </p>
                </div>
              );
            }
            return null;
          }

          // Check if user is authorized to create Purchase Orders
          const userRole = currentUser?.role as string;
          const userDepartment = (currentUser as any)?.department;
          const canCreatePO = userRole === 'ADMIN' ||
            userRole === 'SUPER_ADMIN' ||
            (userRole === 'APPROVER' && userDepartment === 'Purchasing');

          // Check if budget has been approved (required for Material Requisition)
          const budgetCleared = jobOrder.approvals?.some(
            (a: any) => a.role === 'FINANCE' && a.action === 'BUDGET_APPROVED'
          );

          // Only show the card if user is authorized
          if (!canCreatePO) {
            return null;
          }

          return (
            <div className="mb-6 bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
              {purchaseOrder ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Purchase Order:</p>
                    <Link
                      href={`/purchase-orders/${purchaseOrder.id || purchaseOrder._id}`}
                      className="text-lg font-semibold text-blue-600 hover:text-blue-800"
                    >
                      {purchaseOrder.poNumber}
                    </Link>
                  </div>
                  <StatusBadge status={purchaseOrder.status} type="po" />
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-900 font-medium">Ready to Create Purchase Order</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {isMaterialRequisition
                        ? budgetCleared
                          ? `This Material Requisition Job Order has ${jobOrder.materials?.length || 0} material(s) ready for purchase`
                          : 'Budget must be approved by Finance before Purchase Order can be created'
                        : 'This Job Order has materials that can be converted to a Purchase Order'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (!isMaterialRequisition && jobOrder.type) {
                        toast.showWarning('Purchase Orders can only be created from Material Requisition Job Orders. Please create a new Job Order with type "Material Requisition".');
                        return;
                      }
                      if (isMaterialRequisition && !budgetCleared) {
                        toast.showWarning('Budget must be approved by Finance before Purchase Order can be created.');
                        return;
                      }
                      setShowCreatePO(true);
                    }}
                    disabled={(jobOrder.type && !isMaterialRequisition) || (isMaterialRequisition && !budgetCleared)}
                    className={`px-6 py-2 rounded-md font-medium shadow-sm ${(jobOrder.type && !isMaterialRequisition) || (isMaterialRequisition && !budgetCleared)
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                  >
                    Create Purchase Order
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        <JobOrderDetail
          jobOrder={jobOrder}
          currentUser={currentUser || undefined}
          onApprove={handleApprove}
          onStatusChange={handleStatusChange}
          onBudgetUpdate={() => fetchJobOrder(params.id as string)}
        />

        {/* Only show these panels if JO is NOT rejected */}
        {jobOrder.status !== 'REJECTED' && (
          <>
            {/* Material Transfer (Materials move to Maintenance) */}
            {jobOrder.type === 'MATERIAL_REQUISITION' && (
              <div className="mt-6">
                <TransferPanel
                  jobOrder={jobOrder}
                  purchaseOrder={purchaseOrder}
                  currentUser={currentUser || undefined}
                  onTransferUpdate={() => fetchJobOrder(params.id as string)}
                />
              </div>
            )}

            {/* Fulfillment Panel (Work starts after transfer) */}
            <div className="mt-6">
              <FulfillmentPanel
                jobOrder={jobOrder}
                currentUser={currentUser || undefined}
                hasPurchaseOrder={!!purchaseOrder}
                hasCompletedTransfer={!!jobOrder.materialTransfer?.transferCompleted}
                onFulfillmentUpdate={() => fetchJobOrder(params.id as string)}
              />
            </div>

            {/* Acceptance Panel (Client acceptance after completion) */}
            <div className="mt-6">
              <AcceptancePanel
                jobOrder={jobOrder}
                currentUser={currentUser || undefined}
                onAcceptanceUpdate={() => fetchJobOrder(params.id as string)}
              />
            </div>
          </>
        )}

        {/* Create PO Modal */}
        {showCreatePO && jobOrder && (
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Create Purchase Order from {jobOrder.joNumber}
                </h2>
                <button
                  onClick={() => setShowCreatePO(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              <PurchaseOrderForm
                jobOrder={jobOrder}
                onSubmit={handleCreatePO}
                onCancel={() => setShowCreatePO(false)}
              />
            </div>
          </div>
        )}
      </main>
      <ConfirmDialog />
    </div>
  );
}

