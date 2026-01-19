'use client';

import { useState, useEffect } from 'react';
import { PurchaseOrder, ReceivingReportItem } from '@/types';

interface ReceivingReportFormProps {
  purchaseOrder: PurchaseOrder;
  onSubmit: (data: {
    items: ReceivingReportItem[];
    actualDeliveryDate: string;
    deliveryNotes?: string;
    storeNo?: string;
    terminalNo?: string;
    division?: string;
    toLocation?: string;
    class?: string;
    subsidiary?: string;
    exchangeRate?: number;
    memo?: string;
  }) => void;
  onCancel: () => void;
}

export default function ReceivingReportForm({
  purchaseOrder,
  onSubmit,
  onCancel,
}: ReceivingReportFormProps) {
  const [formData, setFormData] = useState({
    actualDeliveryDate: new Date().toISOString().split('T')[0],
    deliveryNotes: '',
    storeNo: '',
    terminalNo: '',
    division: '',
    toLocation: '',
    class: '',
    subsidiary: 'Anjo Global Sourcing Inc.',
    exchangeRate: 1.00,
    memo: '',
  });

  const [items, setItems] = useState<ReceivingReportItem[]>([]);

  // Format currency with commas
  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Extract supplier information from items (prioritize item-level supplier info)
  const getSupplierInfo = () => {
    if (purchaseOrder.items && purchaseOrder.items.length > 0) {
      const firstItem = purchaseOrder.items[0] as any;
      const itemSupplier = firstItem.supplierInfo || {
        name: firstItem.supplier || purchaseOrder.supplierName || 'N/A',
        contact: purchaseOrder.supplierContact || '',
        address: purchaseOrder.supplierAddress || '',
      };
      return itemSupplier;
    }
    return {
      name: purchaseOrder.supplierName || 'N/A',
      contact: purchaseOrder.supplierContact || '',
      address: purchaseOrder.supplierAddress || '',
    };
  };

  const supplierInfo = getSupplierInfo();

  useEffect(() => {
    // Initialize items from PO
    const initialItems: ReceivingReportItem[] = purchaseOrder.items.map((poItem) => ({
      id: crypto.randomUUID(),
      poItemId: poItem.id,
      item: poItem.item,
      description: poItem.description,
      orderedQuantity: poItem.quantity,
      receivedQuantity: poItem.quantity, // Default to ordered quantity
      unit: poItem.unit,
      size: poItem.size,
      color: poItem.color,
      unitPrice: poItem.unitPrice,
      totalPrice: poItem.unitPrice * poItem.quantity,
      onHandQuantity: 0,
      toLocation: formData.toLocation,
      vendorName: purchaseOrder.supplierName,
      rate: poItem.unitPrice,
      currency: 'PHP',
      notes: '',
    }));
    setItems(initialItems);
  }, [purchaseOrder]);

  const handleItemChange = (itemId: string, field: string, value: any) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === itemId) {
          const updatedItem = { ...item, [field]: value };
          
          // Recalculate total price if quantity or unit price changes
          if (field === 'receivedQuantity' || field === 'unitPrice') {
            updatedItem.totalPrice = updatedItem.receivedQuantity * updatedItem.unitPrice;
          }
          
          return updatedItem;
        }
        return item;
      })
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that at least one item has been received
    const hasReceivedItems = items.some(item => item.receivedQuantity > 0);
    if (!hasReceivedItems) {
      alert('Please enter received quantities for at least one item.');
      return;
    }

    onSubmit({
      ...formData,
      items: items.filter(item => item.receivedQuantity > 0), // Only include items with received quantity
    });
  };

  const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl my-8">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="bg-purple-600 text-white px-6 py-4 rounded-t-lg">
            <h2 className="text-xl font-bold">Create Receiving Report</h2>
            <p className="text-sm text-purple-100 mt-1">
              From Purchase Order: {purchaseOrder.poNumber}
            </p>
          </div>

          <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
            {/* Primary Information */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Primary Information</h3>
              <div className="grid grid-cols-1 gap-4">
                {/* Supplier Information */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <h4 className="text-sm font-semibold text-blue-900 mb-3">Supplier Information (from PO)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Name
                      </label>
                      <div className="px-3 py-2 bg-white border border-blue-200 rounded text-sm text-gray-900 font-medium">
                        {supplierInfo.name}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Contact
                      </label>
                      <div className="px-3 py-2 bg-white border border-blue-200 rounded text-sm text-gray-700">
                        {supplierInfo.contact || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Address
                      </label>
                      <div className="px-3 py-2 bg-white border border-blue-200 rounded text-sm text-gray-700">
                        {supplierInfo.address || 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Delivery Date and Exchange Rate */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Delivery Date *
                    </label>
                    <input
                      type="date"
                      value={formData.actualDeliveryDate}
                      onChange={(e) =>
                        setFormData({ ...formData, actualDeliveryDate: e.target.value })
                      }
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Exchange Rate
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.exchangeRate}
                      onChange={(e) =>
                        setFormData({ ...formData, exchangeRate: parseFloat(e.target.value) || 1 })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Memo
                </label>
                <textarea
                  value={formData.memo}
                  onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* POS Information */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">POS Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Store No.
                  </label>
                  <input
                    type="text"
                    value={formData.storeNo}
                    onChange={(e) => setFormData({ ...formData, storeNo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Terminal No.
                  </label>
                  <input
                    type="text"
                    value={formData.terminalNo}
                    onChange={(e) => setFormData({ ...formData, terminalNo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Original PO No.
                  </label>
                  <input
                    type="text"
                    value={purchaseOrder.poNumber}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                  />
                </div>
              </div>
            </div>

            {/* Classification */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Classification</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Division
                  </label>
                  <input
                    type="text"
                    value={formData.division}
                    onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To Location
                  </label>
                  <input
                    type="text"
                    value={formData.toLocation}
                    onChange={(e) => setFormData({ ...formData, toLocation: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Class
                  </label>
                  <input
                    type="text"
                    value={formData.class}
                    onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={purchaseOrder.department}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subsidiary
                  </label>
                  <input
                    type="text"
                    value={formData.subsidiary}
                    onChange={(e) => setFormData({ ...formData, subsidiary: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Items</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Item
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Description
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Ordered
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Received *
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Unit
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Rate
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-4 text-sm text-gray-900 whitespace-nowrap">
                          {item.item}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-600">
                          {item.description}
                        </td>
                        <td className="px-3 py-4 text-sm text-center text-gray-900">
                          {item.orderedQuantity}
                        </td>
                        <td className="px-3 py-4">
                          <input
                            type="number"
                            min="0"
                            max={item.orderedQuantity}
                            value={item.receivedQuantity}
                            onChange={(e) =>
                              handleItemChange(
                                item.id,
                                'receivedQuantity',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-center focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </td>
                        <td className="px-3 py-4 text-sm text-center text-gray-900">
                          {item.unit}
                        </td>
                        <td className="px-3 py-4 text-sm text-right text-gray-900">
                          ₱{formatCurrency(item.unitPrice)}
                        </td>
                        <td className="px-3 py-4 text-sm text-right font-medium text-gray-900">
                          ₱{formatCurrency(item.totalPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Delivery Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Notes
              </label>
              <textarea
                value={formData.deliveryNotes}
                onChange={(e) =>
                  setFormData({ ...formData, deliveryNotes: e.target.value })
                }
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter any notes about the delivery..."
              />
            </div>

            {/* Total Summary */}
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="flex justify-end">
                <div className="w-64">
                  <div className="flex justify-between">
                    <span className="text-base font-bold text-gray-900">Total Amount:</span>
                    <span className="text-base font-bold text-purple-600">
                      ₱{formatCurrency(totalAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              Create Receiving Report
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
