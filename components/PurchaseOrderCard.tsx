'use client';

import { PurchaseOrder } from '@/types';
import StatusBadge from './StatusBadge';
import Link from 'next/link';

interface PurchaseOrderCardProps {
  purchaseOrder: PurchaseOrder;
}

export default function PurchaseOrderCard({ purchaseOrder }: PurchaseOrderCardProps) {
  const joNumber = typeof purchaseOrder.joId === 'object' 
    ? (purchaseOrder.joId as any)?.joNumber 
    : 'N/A';

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow">
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

