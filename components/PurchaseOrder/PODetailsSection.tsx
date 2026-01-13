'use client';

import { PurchaseOrder } from '@/types';
import StatusBadge from '@/components/StatusBadge';

interface PODetailsSectionProps {
    purchaseOrder: PurchaseOrder;
    onPrint: () => void;
}

// Helper function to get priority badge styling
export const getPriorityBadgeStyle = (priority: string) => {
    switch (priority.toUpperCase()) {
        case 'URGENT':
            return 'bg-red-100 text-red-800 border-red-300';
        case 'HIGH':
            return 'bg-orange-100 text-orange-800 border-orange-300';
        case 'MEDIUM':
            return 'bg-yellow-100 text-yellow-800 border-yellow-300';
        case 'LOW':
            return 'bg-green-100 text-green-800 border-green-300';
        default:
            return 'bg-gray-100 text-gray-800 border-gray-300';
    }
};

export default function PODetailsSection({
    purchaseOrder,
    onPrint
}: PODetailsSectionProps) {
    const joNumber = typeof purchaseOrder.joId === 'object'
        ? (purchaseOrder.joId as any)?.joNumber
        : purchaseOrder.joId;

    return (
        <div className="space-y-8">
            {/* Header Content */}
            <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
                <div className="flex items-start gap-4">
                    <img
                        src="/logo.png"
                        alt="ANJO WORLD"
                        className="h-16 w-16 object-contain po-logo print:block print:visible print:w-24 print:h-24"
                    />
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight uppercase">
                            {purchaseOrder.poNumber}
                        </h1>
                        <p className="text-sm text-gray-500 font-medium">
                            Created: {new Date(purchaseOrder.createdAt).toLocaleDateString('en-GB')}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 no-print">
                    <button
                        onClick={onPrint}
                        className="inline-flex items-center px-4 py-2 bg-[#4b5563] text-white rounded-md hover:bg-gray-700 transition-all font-semibold gap-2 shadow-sm"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Print
                    </button>

                    <StatusBadge status={purchaseOrder.status} type="po" />
                </div>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-y-6 gap-x-12">
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Job Order</label>
                    <p className="text-[15px] font-medium text-gray-900">{joNumber || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</label>
                    <p className="text-[15px] font-medium text-gray-900">{purchaseOrder.department}</p>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Requested By</label>
                    <p className="text-[15px] font-medium text-gray-900">{purchaseOrder.requestedBy}</p>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Priority</label>
                    <div>
                        <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold border uppercase ${getPriorityBadgeStyle(purchaseOrder.priority)}`}>
                            {purchaseOrder.priority}
                        </span>
                    </div>
                </div>
                {(purchaseOrder.expectedDeliveryDate || purchaseOrder.actualDeliveryDate) && (
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            {purchaseOrder.actualDeliveryDate ? 'Actual Delivery' : 'Expected Delivery'}
                        </label>
                        <p className="text-[15px] font-medium text-gray-900">
                            {new Date(purchaseOrder.actualDeliveryDate || purchaseOrder.expectedDeliveryDate!).toLocaleDateString('en-GB')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
