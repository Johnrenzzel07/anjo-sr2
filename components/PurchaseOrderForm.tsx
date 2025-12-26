'use client';

import { useState, useEffect } from 'react';
import { JobOrder, PurchaseOrderItem, MaterialItem, SupplierInfo } from '@/types';

interface PurchaseOrderFormProps {
  jobOrder: JobOrder;
  onSubmit: (data: {
    items: PurchaseOrderItem[];
    tax?: number;
  }) => void;
  onCancel: () => void;
}

export default function PurchaseOrderForm({ jobOrder, onSubmit, onCancel }: PurchaseOrderFormProps) {
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [tax, setTax] = useState(0);

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

  const addItem = () => {
    setItems([...items, {
      id: `po-item-${Date.now()}`,
      item: '',
      description: '',
      quantity: 0,
      unit: '',
      unitPrice: 0,
      totalPrice: 0,
      supplierInfo: {
        name: '',
        contact: '',
        address: '',
      },
      expectedDeliveryDate: '',
    }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that all items have supplier info
    const itemsWithoutSupplier = items.filter(item => !item.supplierInfo?.name && !item.supplier);
    if (itemsWithoutSupplier.length > 0) {
      alert(`Please provide supplier information for each item. ${itemsWithoutSupplier.length} item(s) are missing supplier name.`);
      return;
    }

    onSubmit({
      items,
      tax,
    });
  };

  const subtotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  const totalAmount = subtotal + tax;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Items */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <label className="block text-sm font-medium text-gray-700">
            Purchase Order Items
          </label>
          <button
            type="button"
            onClick={addItem}
            className="text-sm bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700"
          >
            + Add Item
          </button>
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
                  className="col-span-2 px-2 py-1 border border-gray-300 rounded text-sm"
                  required
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateItem(index, 'description', e.target.value)}
                  className="col-span-3 px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <input
                  type="number"
                  placeholder="Qty"
                  value={item.quantity || ''}
                  onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                  className="col-span-1 px-2 py-1 border border-gray-300 rounded text-sm"
                  required
                />
                <input
                  type="text"
                  placeholder="Unit"
                  value={item.unit}
                  onChange={(e) => updateItem(index, 'unit', e.target.value)}
                  className="col-span-1 px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <input
                  type="number"
                  placeholder="Unit Price"
                  value={item.unitPrice || ''}
                  onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                  className="col-span-2 px-2 py-1 border border-gray-300 rounded text-sm"
                  step="0.01"
                  required
                />
                <input
                  type="text"
                  placeholder="Total Price"
                  value={item.totalPrice.toFixed(2)}
                  readOnly
                  className="col-span-2 px-2 py-1 border border-gray-300 rounded text-sm bg-gray-100"
                />
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="col-span-1 text-red-600 hover:text-red-800 text-sm"
                >
                  Remove
                </button>
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
      </div>

      {/* Financial Summary */}
      <div className="bg-gray-50 rounded-md p-4">
        <div className="flex justify-between mb-2">
          <span className="font-medium text-gray-700">Subtotal:</span>
          <span className="text-gray-900">₱{subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between mb-2">
          <label className="font-medium text-gray-700">
            Tax:
            <input
              type="number"
              value={tax}
              onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
              step="0.01"
              className="ml-2 w-24 px-2 py-1 border border-gray-300 rounded text-sm"
            />
          </label>
          <span className="text-gray-900">₱{tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between pt-2 border-t border-gray-300">
          <span className="font-bold text-gray-900">Total Amount:</span>
          <span className="font-bold text-gray-900">₱{totalAmount.toFixed(2)}</span>
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

