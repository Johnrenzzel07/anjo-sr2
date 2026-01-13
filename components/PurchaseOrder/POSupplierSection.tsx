'use client';

import { PurchaseOrder } from '@/types';

interface POSupplierSectionProps {
    purchaseOrder: PurchaseOrder;
    onItemDeliveryDateChange: (index: number, newDate: string) => Promise<void>;
}

export default function POSupplierSection({
    purchaseOrder,
    onItemDeliveryDateChange
}: POSupplierSectionProps) {
    if (!purchaseOrder.items || purchaseOrder.items.length === 0) {
        return null;
    }

    return (
        <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                Supplier & Delivery Information
            </h2>
            <div className="space-y-4">
                {purchaseOrder.items.map((item, index) => {
                    const itemSupplier = (item as any).supplierInfo || {
                        name: item.supplier || purchaseOrder.supplierName || 'N/A',
                        contact: purchaseOrder.supplierContact || '',
                        address: purchaseOrder.supplierAddress || '',
                    };
                    const itemDeliveryDate = (item as any).expectedDeliveryDate || purchaseOrder.expectedDeliveryDate || '';
                    const canEdit = purchaseOrder.status === 'DRAFT';

                    return (
                        <div key={item.id || index} className="p-6 bg-[#f8fafc] rounded-lg border border-gray-100 shadow-sm transition-all hover:border-gray-200">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                <div className="md:col-span-8 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-bold text-gray-900">Item: {index + 1}</span>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Supplier Name:</label>
                                        <p className="text-lg font-medium text-gray-800 tracking-tight leading-tight uppercase">
                                            {itemSupplier.name}
                                        </p>
                                        {itemSupplier.contact && (
                                            <p className="text-sm text-gray-500 font-medium italic">Contact: {itemSupplier.contact}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="md:col-span-4 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Delivery Date</label>
                                    {canEdit ? (
                                        <input
                                            type="date"
                                            value={itemDeliveryDate && itemDeliveryDate.trim() !== ''
                                                ? new Date(itemDeliveryDate).toISOString().split('T')[0]
                                                : ''}
                                            onChange={(e) => onItemDeliveryDateChange(index, e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm font-medium bg-white"
                                        />
                                    ) : (
                                        <div className="h-10 flex items-center">
                                            <p className="text-base font-semibold text-gray-900">
                                                {itemDeliveryDate && itemDeliveryDate.trim() !== ''
                                                    ? new Date(itemDeliveryDate).toLocaleDateString('en-GB')
                                                    : 'N/A'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
