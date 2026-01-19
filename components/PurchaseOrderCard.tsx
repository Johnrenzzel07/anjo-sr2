'use client';

import { PurchaseOrder } from '@/types';
import StatusBadge from './StatusBadge';
import Link from 'next/link';

interface PurchaseOrderCardProps {
  purchaseOrder: PurchaseOrder;
  currentUser?: { role?: string; department?: string };
  hasUnreadNotification?: boolean;
  onCreateReceivingReport?: (po: PurchaseOrder) => void;
}

// Normalize department name for comparison
function normalizeDept(dept: string | undefined): string {
  return (dept || '').toLowerCase().replace(/\s+department$/, '').trim();
}

export default function PurchaseOrderCard({ purchaseOrder, currentUser, hasUnreadNotification = false, onCreateReceivingReport }: PurchaseOrderCardProps) {
  const joNumber = typeof purchaseOrder.joId === 'object'
    ? (purchaseOrder.joId as any)?.joNumber
    : 'N/A';

  const userRole = currentUser?.role;
  const userDepartment = normalizeDept(currentUser?.department);

  // Check if President needs to approve
  const isPresident = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' || userRole === 'MANAGEMENT';
  const presidentApproved = purchaseOrder.approvals?.some((a: any) =>
    a.role === 'MANAGEMENT' && a.action === 'APPROVED'
  );
  const needsPresidentApproval = purchaseOrder.status === 'SUBMITTED' && !presidentApproved && isPresident;

  // Check if Purchasing can proceed with purchasing
  const isPurchasing = userDepartment === 'purchasing';
  const canProceedWithPurchasing = purchaseOrder.status === 'APPROVED' && isPurchasing;

  // Check if can create receiving report
  const canCreateReceivingReport = purchaseOrder.status === 'RECEIVED' && 
    (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || isPurchasing);

  // Determine border color based on action needed
  const borderClass = needsPresidentApproval
    ? 'border-yellow-400 animate-border-pulse'
    : canProceedWithPurchasing
      ? 'border-green-500 animate-border-pulse-green'
      : canCreateReceivingReport
        ? 'border-purple-500 animate-border-pulse-purple'
        : 'border-gray-200';

  const handleCardClick = async () => {
    // Mark notifications as read if needed
    if (hasUnreadNotification && purchaseOrder.id) {
      try {
        await fetch('/api/notifications/mark-read-by-entity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            relatedEntityType: 'PURCHASE_ORDER',
            relatedEntityId: purchaseOrder.id || (purchaseOrder as any)._id,
          }),
        });
        // Refresh notifications across the app
        window.dispatchEvent(new Event('refreshNotifications'));
      } catch (error) {
        console.error('Error marking notifications as read:', error);
      }
    }
  };

  const handleCreateRRClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onCreateReceivingReport) {
      onCreateReceivingReport(purchaseOrder);
    }
  };

  return (
    <Link href={`/purchase-orders/${purchaseOrder.id || purchaseOrder._id}`} onClick={handleCardClick}>
      <div className={`bg-white rounded-lg shadow-md p-6 border-2 ${borderClass} hover:shadow-lg transition-all cursor-pointer`}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {purchaseOrder.poNumber}
              </h3>
              {hasUnreadNotification && (
                <span className="h-2 w-2 bg-red-500 rounded-full flex-shrink-0"></span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">{purchaseOrder.department}</p>
          </div>
          <StatusBadge status={purchaseOrder.status} type="po" />
        </div>

        {/* Action Required Badges */}
        {needsPresidentApproval && (
          <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-center">
            <p className="text-xs font-bold text-yellow-700 animate-pulse">REQUIRES YOUR APPROVAL</p>
          </div>
        )}

        {canProceedWithPurchasing && (
          <div className="mb-4 p-3 bg-green-50 border-2 border-green-300 rounded-md">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-800">Ready to Purchase</p>
                <p className="text-xs text-green-700">PO has been approved. You can now proceed with purchasing.</p>
              </div>
            </div>
          </div>
        )}

        {canCreateReceivingReport && (
          <button
            onClick={handleCreateRRClick}
            className="mb-4 w-full p-3 bg-purple-50 border-2 border-purple-300 rounded-md hover:bg-purple-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600 flex-shrink-0 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-purple-800">Create Receiving Report</p>
                <p className="text-xs text-purple-700">Items have been received. Click to document the receipt.</p>
              </div>
            </div>
          </button>
        )}

        <div className="space-y-2 mb-4">
          <p className="text-sm">
            <span className="font-medium text-gray-700">Job Order:</span>{' '}
            <span className="text-gray-600">{joNumber}</span>
          </p>
          {purchaseOrder.supplierName && (
            <p className="text-sm">
              <span className="font-medium text-gray-700">Supplier:</span>{' '}
              <span className="text-gray-600">{purchaseOrder.supplierName}</span>
            </p>
          )}
          <p className="text-sm">
            <span className="font-medium text-gray-700">Items:</span>{' '}
            <span className="text-gray-600">{purchaseOrder.items?.length || 0} items</span>
          </p>
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-md px-3 py-2 mt-1">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-blue-700">Total Amount:</span>
              <span className="text-sm font-bold text-blue-900">₱{purchaseOrder.totalAmount?.toLocaleString() || '0'}</span>
            </div>
          </div>
          {purchaseOrder.expectedDeliveryDate && (
            <p className="text-sm">
              <span className="font-medium text-gray-700">Expected Delivery:</span>{' '}
              <span className="text-gray-600">
                {new Date(purchaseOrder.expectedDeliveryDate).toLocaleDateString()}
              </span>
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

