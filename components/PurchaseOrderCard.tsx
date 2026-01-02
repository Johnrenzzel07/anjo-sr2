'use client';

import { PurchaseOrder } from '@/types';
import StatusBadge from './StatusBadge';
import Link from 'next/link';

interface PurchaseOrderCardProps {
  purchaseOrder: PurchaseOrder;
  currentUser?: { role?: string; department?: string };
}

export default function PurchaseOrderCard({ purchaseOrder, currentUser }: PurchaseOrderCardProps) {
  const joNumber = typeof purchaseOrder.joId === 'object' 
    ? (purchaseOrder.joId as any)?.joNumber 
    : 'N/A';

  // Check if current user can approve
  const isManagement = currentUser?.role === 'MANAGEMENT' || currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN';

  // Check if Purchase Order needs approval (for visual highlight - show even if user can approve)
  const needsApproval = (() => {
    if (purchaseOrder.status === 'CLOSED' || purchaseOrder.status === 'REJECTED') return false;
    if (purchaseOrder.status === 'DRAFT') return false; // Draft doesn't need approval yet
    
    const managementApproved = purchaseOrder.approvals?.some((a: any) => 
      a.role === 'MANAGEMENT' && a.action === 'APPROVED'
    );

    // Needs Management (President) approval
    return !managementApproved;
  })();

  // Check if current user needs to approve (for different highlight color)
  const needsUserApproval = (() => {
    if (purchaseOrder.status === 'CLOSED' || purchaseOrder.status === 'REJECTED' || purchaseOrder.status === 'DRAFT') return false;
    
    const managementApproved = purchaseOrder.approvals?.some((a: any) => 
      a.role === 'MANAGEMENT' && a.action === 'APPROVED'
    );

    // Management (President) needs to approve
    if (!managementApproved && isManagement) return true;
    return false;
  })();

  const approvalMessage = (() => {
    if (purchaseOrder.status === 'CLOSED' || purchaseOrder.status === 'REJECTED' || purchaseOrder.status === 'DRAFT') return '';
    
    const managementApproved = purchaseOrder.approvals?.some((a: any) => 
      a.role === 'MANAGEMENT' && a.action === 'APPROVED'
    );

    if (!managementApproved) {
      // Don't show warning to Management users - they can approve
      if (isManagement) return '';
      return 'Waiting for President approval';
    }
    return '';
  })();

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 border-2 transition-all ${
      needsUserApproval
        ? 'border-blue-500 animate-border-pulse-blue hover:shadow-xl hover:scale-[1.01] animate-pulse-glow-blue'
        : needsApproval 
        ? 'border-yellow-400 animate-border-pulse hover:shadow-xl hover:scale-[1.01] animate-pulse-glow' 
        : 'border-gray-200 hover:shadow-lg'
    }`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <Link href={`/purchase-orders/${purchaseOrder.id || purchaseOrder._id}`}>
            <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600">
              {purchaseOrder.poNumber}
            </h3>
          </Link>
          <p className="text-sm text-gray-500 mt-1">{purchaseOrder.department}</p>
        </div>
        <StatusBadge status={purchaseOrder.status} type="po" />
      </div>

      {/* Needs Approval Card - Hide warning message for users who can approve, but show visual highlight */}
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
        <p className="text-sm">
          <span className="font-medium text-gray-700">Total Amount:</span>{' '}
          <span className="text-gray-600 font-semibold">₱{purchaseOrder.totalAmount?.toLocaleString() || '0'}</span>
        </p>
        {purchaseOrder.expectedDeliveryDate && (
          <p className="text-sm">
            <span className="font-medium text-gray-700">Expected Delivery:</span>{' '}
            <span className="text-gray-600">
              {new Date(purchaseOrder.expectedDeliveryDate).toLocaleDateString()}
            </span>
          </p>
        )}
      </div>

      <Link
        href={`/purchase-orders/${purchaseOrder.id || purchaseOrder._id}`}
        className="block mt-4 text-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
      >
        View Details
      </Link>
    </div>
  );
}

