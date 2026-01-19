'use client';

import { useState, useEffect } from 'react';
import { JobOrder, PurchaseOrderItem, MaterialItem, SupplierInfo } from '@/types';
import { useToast } from './ToastContainer';

interface PurchaseOrderFormProps {
  jobOrder: JobOrder;
  onSubmit: (data: {
    items: PurchaseOrderItem[];
  }) => void;
  onCancel: () => void;
}

export default function PurchaseOrderForm({ jobOrder, onSubmit, onCancel }: PurchaseOrderFormProps) {
  const toast = useToast();
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);

  // Format currency with commas
  const formatCurrency = (value: number): string => {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Parse currency (remove commas)
  const parseCurrency = (value: string): number => {
    const cleaned = value.replace(/,/g, '').trim();
    return cleaned === '' ? 0 : parseFloat(cleaned) || 0;
  };

  // Initialize items from Job Order materials
  useEffect(() => {
    if (jobOrder.materials && jobOrder.materials.length > 0) {
      const poItems: PurchaseOrderItem[] = jobOrder.materials
        .filter(m => m.source === 'PURCHASE')
        .map((material, index) => ({
          id: `po-item-${Date.now()}-${index}`,
          materialItemId: material.id,
          item: material.item,
          description: material.description,
          color: material.color || '',
          size: material.size || '',
          quantity: material.quantity,
          unit: material.unit,
          unitPrice: material.estimatedCost / material.quantity || 0,
          totalPrice: material.estimatedCost || 0,
          supplier: '',
          supplierInfo: {
            name: '',
            contact: '',
            address: '',
          },
          expectedDeliveryDate: '',
        }));
      setItems(poItems);
    }
  }, [jobOrder]);

  const updateItem = (index: number, field: keyof PurchaseOrderItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };

    // Recalculate totalPrice if quantity or unitPrice changes
    if (field === 'quantity' || field === 'unitPrice') {
      updated[index].totalPrice = (updated[index].quantity || 0) * (updated[index].unitPrice || 0);
    }

    setItems(updated);
  };

  const updateItemSupplier = (index: number, supplierField: keyof SupplierInfo, value: string) => {
    const updated = [...items];
    if (!updated[index].supplierInfo) {
      updated[index].supplierInfo = { name: '', contact: '', address: '' };
    }
    updated[index].supplierInfo = {
      ...updated[index].supplierInfo,
      [supplierField]: value,
    };
    // Also update legacy supplier field for backward compatibility
    if (supplierField === 'name') {
      updated[index].supplier = value;
    }
    setItems(updated);
  };



  const removeItem = (index: number) => {
    // Prevent removing the last item
    if (items.length <= 1) {
      toast.showWarning('Cannot remove the last item. A Purchase Order must have at least one item.');
      return;
    }
    
    const itemName = items[index].item;
    if (window.confirm(`Are you sure you want to remove "${itemName}" from this Purchase Order? This item will not be purchased.`)) {
      setItems(items.filter((_, i) => i !== index));
      toast.showSuccess(`Item "${itemName}" removed from Purchase Order.`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate that there is at least one item
    if (items.length === 0) {
      toast.showWarning('Cannot create Purchase Order without items. Please add at least one item.');
      return;
    }

    // Validate that all items have supplier info
    const itemsWithoutSupplier = items.filter(item => !item.supplierInfo?.name && !item.supplier);
    if (itemsWithoutSupplier.length > 0) {
      toast.showWarning(`Please provide supplier information for each item. ${itemsWithoutSupplier.length} item(s) are missing supplier name.`);
      return;
    }

    onSubmit({
      items,
    });
  };

  const subtotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  const totalAmount = subtotal;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Items */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">
            Purchase Order Items
          </label>
          <span className="text-sm text-gray-500">
            {items.length} item{items.length !== 1 ? 's' : ''} • 
            <span className="text-blue-600 font-medium"> Click trash icon to remove unwanted items</span>
          </span>
        </div>
        {items.length === 1 && (
          <div className="mb-3 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-xs text-yellow-800">
              ⚠️ This is the last item. At least one item is required to create a Purchase Order.
            </p>
          </div>
        )}

        {/* Header Labels */}
        <div className="hidden md:grid grid-cols-12 gap-2 px-4 mb-2">
          <div className="col-span-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Item</div>
          <div className="col-span-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Color</div>
          <div className="col-span-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Size</div>
          <div className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Description</div>
          <div className="col-span-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Qty</div>
          <div className="col-span-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Unit</div>
          <div className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Unit Price</div>
          <div className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total</div>
        </div>

        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={item.id} className="p-4 bg-gray-50 rounded-md border border-gray-200">
              {/* Item Details Row */}
              <div className="grid grid-cols-12 gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Item"
                  value={item.item}
                  onChange={(e) => updateItem(index, 'item', e.target.value)}
                  readOnly={!!item.materialItemId}
                  className={`col-span-1 px-2 py-1 border border-gray-300 rounded text-sm ${item.materialItemId ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  required
                />
                <input
                  type="text"
                  placeholder="Color"
                  value={item.color || ''}
                  onChange={(e) => updateItem(index, 'color', e.target.value)}
                  readOnly={!!item.materialItemId}
                  className={`col-span-1 px-2 py-1 border border-gray-300 rounded text-sm ${item.materialItemId ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />
                <input
                  type="text"
                  placeholder="Size"
                  value={item.size || ''}
                  onChange={(e) => updateItem(index, 'size', e.target.value)}
                  readOnly={!!item.materialItemId}
                  className={`col-span-1 px-2 py-1 border border-gray-300 rounded text-sm ${item.materialItemId ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateItem(index, 'description', e.target.value)}
                  readOnly={!!item.materialItemId}
                  className={`col-span-2 px-2 py-1 border border-gray-300 rounded text-sm ${item.materialItemId ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />
                <input
                  type="number"
                  placeholder="Qty"
                  value={item.quantity || ''}
                  onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                  readOnly={!!item.materialItemId}
                  className={`col-span-1 px-2 py-1 border border-gray-300 rounded text-sm ${item.materialItemId ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  required
                />
                <input
                  type="text"
                  placeholder="Unit"
                  value={item.unit}
                  onChange={(e) => updateItem(index, 'unit', e.target.value)}
                  readOnly={!!item.materialItemId}
                  className={`col-span-1 px-2 py-1 border border-gray-300 rounded text-sm ${item.materialItemId ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />
                <input
                  type="text"
                  placeholder="Unit Price"
                  value={item.unitPrice ? formatCurrency(item.unitPrice) : ''}
                  onChange={(e) => {
                    const numericValue = parseCurrency(e.target.value);
                    updateItem(index, 'unitPrice', numericValue);
                  }}
                  readOnly={!!item.materialItemId}
                  className={`col-span-2 px-2 py-1 border border-gray-300 rounded text-sm ${item.materialItemId ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  required
                />
                <div className="col-span-2 flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="Total Price"
                    value={formatCurrency(item.totalPrice)}
                    readOnly
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm bg-gray-100"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className={`px-2 py-1 rounded transition-colors ${
                      items.length <= 1
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-red-600 hover:text-red-800 hover:bg-red-50'
                    }`}
                    title={items.length <= 1 ? 'Cannot remove the last item' : 'Remove this item from Purchase Order'}
                    disabled={items.length <= 1}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Supplier Information and Delivery Date for this Item */}
              <div className="mt-3 pt-3 border-t border-gray-300">
                <p className="text-xs font-medium text-gray-600 mb-2">Supplier for this item:</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="Supplier Name *"
                    value={item.supplierInfo?.name || ''}
                    onChange={(e) => updateItemSupplier(index, 'name', e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Contact"
                    value={item.supplierInfo?.contact || ''}
                    onChange={(e) => updateItemSupplier(index, 'contact', e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Address"
                    value={item.supplierInfo?.address || ''}
                    onChange={(e) => updateItemSupplier(index, 'address', e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Expected Delivery Date for this item:
                  </label>
                  <input
                    type="date"
                    value={item.expectedDeliveryDate || ''}
                    onChange={(e) => updateItem(index, 'expectedDeliveryDate', e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Help Text */}
        <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-xs text-blue-800">
            <strong>💡 Tip:</strong> You can remove items that are not needed right now or if you've found a better alternative. 
            Items removed here will not be included in this Purchase Order, but remain in the original Job Order.
          </p>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-gray-50 rounded-md p-4">
        <div className="flex justify-between">
          <span className="font-bold text-gray-900 text-lg">Total Amount:</span>
          <span className="font-bold text-gray-900 text-lg">₱{formatCurrency(totalAmount)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Create Purchase Order
        </button>
      </div>
    </form>
  );
}

