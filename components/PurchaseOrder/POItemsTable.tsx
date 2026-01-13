'use client';

import { PurchaseOrder } from '@/types';
import { formatCurrency } from './utils';

interface POItemsTableProps {
    purchaseOrder: PurchaseOrder;
}

export default function POItemsTable({ purchaseOrder }: POItemsTableProps) {
    return (
        <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Items</h2>
            <div className="overflow-hidden rounded-lg border border-gray-100 shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-[#f8fafc]">
                        <tr>
                            <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Item</th>
                            <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Color</th>
                            <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Size</th>
                            <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Description</th>
                            <th className="px-4 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Qty</th>
                            <th className="px-4 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Unit</th>
                            <th className="px-4 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Unit Price</th>
                            <th className="px-4 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Total</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {purchaseOrder.items && purchaseOrder.items.length > 0 ? (
                            purchaseOrder.items.map((item, index) => (
                                <tr key={item.id || index} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.item}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{item.color || 'N/A'}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{item.size || 'N/A'}</td>
                                    <td className="px-4 py-4 text-sm text-gray-700 font-medium">{item.description}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-900 font-bold">{item.quantity}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-600">{item.unit}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-medium">₱{formatCurrency(item.unitPrice)}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-bold">₱{formatCurrency(item.totalPrice)}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400 italic font-medium">
                                    No items in this purchase order
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 space-y-3 flex flex-col items-end px-4">
                <div className="flex items-center gap-12">
                    <span className="text-sm font-semibold text-gray-500">Subtotal:</span>
                    <span className="text-[17px] font-bold text-gray-900">₱{formatCurrency(purchaseOrder.subtotal || 0)}</span>
                </div>
                {purchaseOrder.tax && purchaseOrder.tax > 0 ? (
                    <div className="flex items-center gap-12">
                        <span className="text-sm font-semibold text-gray-500">Tax:</span>
                        <span className="text-[17px] font-bold text-gray-900">₱{formatCurrency(purchaseOrder.tax)}</span>
                    </div>
                ) : null}
                <div className="flex items-center gap-12 pt-2">
                    <span className="text-base font-bold text-gray-900">Total Amount:</span>
                    <span className="text-2xl font-black text-blue-600">₱{formatCurrency(purchaseOrder.totalAmount || 0)}</span>
                </div>
            </div>
        </div>
    );
}
