'use client';

import { ReceivingReport } from '@/types';
import Link from 'next/link';
import StatusBadge from './StatusBadge';

interface ReceivingReportCardProps {
  receivingReport: ReceivingReport;
  hasUnreadNotification?: boolean;
}

export default function ReceivingReportCard({
  receivingReport,
  hasUnreadNotification = false,
}: ReceivingReportCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      case 'SUBMITTED':
        return 'bg-blue-100 text-blue-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const rrId = receivingReport.id || receivingReport._id || '';

  return (
    <Link href={`/receiving-reports/${rrId}`}>
      <div className="relative bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 p-6 cursor-pointer border border-gray-200 hover:border-purple-300 break-inside-avoid mb-6">
        {hasUnreadNotification && (
          <div className="absolute top-2 right-2">
            <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse"></div>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {receivingReport.rrNumber}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              From PO: {receivingReport.createdFrom}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
              receivingReport.status
            )}`}
          >
            {receivingReport.status}
          </span>
        </div>

        {/* Supplier Info */}
        <div className="space-y-2 mb-4">
          <div className="flex items-start">
            <span className="text-sm font-medium text-gray-500 w-32">Supplier:</span>
            <span className="text-sm text-gray-900 flex-1">
              {receivingReport.supplierName}
            </span>
          </div>
          <div className="flex items-start">
            <span className="text-sm font-medium text-gray-500 w-32">Department:</span>
            <span className="text-sm text-gray-900 flex-1">
              {receivingReport.department}
            </span>
          </div>
          <div className="flex items-start">
            <span className="text-sm font-medium text-gray-500 w-32">Received Date:</span>
            <span className="text-sm text-gray-900 flex-1">
              {new Date(receivingReport.actualDeliveryDate).toLocaleDateString()}
            </span>
          </div>
          {receivingReport.toLocation && (
            <div className="flex items-start">
              <span className="text-sm font-medium text-gray-500 w-32">Location:</span>
              <span className="text-sm text-gray-900 flex-1">
                {receivingReport.toLocation}
              </span>
            </div>
          )}
        </div>

        {/* Items Summary */}
        <div className="border-t border-gray-200 pt-4 mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Items Received: {receivingReport.items.length}
          </p>
          <div className="space-y-1">
            {receivingReport.items.slice(0, 3).map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-600 truncate flex-1">
                  {item.item}
                </span>
                <span className="text-gray-900 ml-2 font-medium">
                  {item.receivedQuantity} {item.unit}
                </span>
              </div>
            ))}
            {receivingReport.items.length > 3 && (
              <p className="text-xs text-gray-500 italic">
                +{receivingReport.items.length - 3} more items...
              </p>
            )}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="border-t border-gray-200 pt-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Total Amount:</span>
            <span className="text-lg font-bold text-purple-600">
              ₱{receivingReport.totalAmount.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>

        {/* Received By */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center text-xs text-gray-500">
            <svg
              className="h-4 w-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            Received by: {receivingReport.receivedByName}
          </div>
        </div>

        {/* Delivery Notes */}
        {receivingReport.deliveryNotes && (
          <div className="mt-3 p-3 bg-gray-50 rounded-md">
            <p className="text-xs font-medium text-gray-700 mb-1">Delivery Notes:</p>
            <p className="text-xs text-gray-600 line-clamp-2">
              {receivingReport.deliveryNotes}
            </p>
          </div>
        )}
      </div>
    </Link>
  );
}
