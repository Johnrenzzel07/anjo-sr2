'use client';

import { useState } from 'react';
import { ServiceRequest, MaterialItem, ScheduleMilestone, JobOrderType } from '@/types';
import LoadingSpinner from '@/components/LoadingSpinner';

interface JobOrderFormProps {
  serviceRequest: ServiceRequest;
  onSubmit: (data: {
    type: JobOrderType;
    workDescription?: string;
    materials: MaterialItem[];
    manpower: Record<string, unknown>;
    schedule: ScheduleMilestone[];
  }) => Promise<void>;
  onCancel: () => void;
}

export default function JobOrderForm({ serviceRequest, onSubmit, onCancel }: JobOrderFormProps) {
  const [type] = useState<JobOrderType>('MATERIAL_REQUISITION');
  const [workDescription, setWorkDescription] = useState(serviceRequest.workDescription);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [schedule, setSchedule] = useState<ScheduleMilestone[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addMaterial = () => {
    setMaterials([...materials, {
      id: `mat-${Date.now()}`,
      item: '',
      description: '',
      quantity: 0,
      unit: '',
      size: '',
      color: '',
      estimatedCost: 0,
      source: 'PURCHASE',
    }]);
  };

  const formatCurrency = (value: number | string): string => {
    if (value === '' || value === null || value === undefined) return '';
    const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
    if (isNaN(num)) return '';
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const formatCurrencyWithDecimals = (value: number | string | undefined): string => {
    if (value === '' || value === null || value === undefined) return '';

    // Convert to string to handle very large numbers
    let numStr: string;
    if (typeof value === 'string') {
      numStr = value.replace(/,/g, '');
    } else {
      // For very large numbers, use toFixed to preserve precision
      numStr = value.toFixed(2);
    }

    // Split into integer and decimal parts
    const parts = numStr.split('.');
    const integerPart = parts[0] || '0';
    const decimalPart = parts[1] || '00';

    // Format integer part with commas
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    // Combine with decimal part (always 2 digits)
    return `${formattedInteger}.${decimalPart.padEnd(2, '0').slice(0, 2)}`;
  };

  const parseCurrency = (value: string): number => {
    // Remove commas and parse
    const cleaned = value.replace(/,/g, '').trim();
    return cleaned === '' ? 0 : parseFloat(cleaned) || 0;
  };

  const updateMaterial = (index: number, field: keyof MaterialItem | 'unitPrice', value: any) => {
    const updated = [...materials];
    const material = updated[index];

    if (field === 'unitPrice') {
      // When unit price changes, calculate estimatedCost = quantity × unitPrice
      const unitPrice = typeof value === 'number' ? value : parseCurrency(String(value));
      const quantity = material.quantity || 0;
      (updated[index] as any).unitPrice = unitPrice;
      updated[index].estimatedCost = quantity * unitPrice;
    } else if (field === 'quantity') {
      // When quantity changes, calculate estimatedCost = quantity × unitPrice
      const quantity = typeof value === 'number' ? value : (parseInt(String(value)) || 0);
      updated[index].quantity = quantity;
      const unitPrice = (material as any).unitPrice || 0;
      updated[index].estimatedCost = quantity * unitPrice;
    } else if (field === 'estimatedCost') {
      // Allow manual entry of estimatedCost, parse and store numeric value
      const cost = typeof value === 'number' ? value : parseCurrency(String(value));
      updated[index].estimatedCost = cost;
      // Recalculate unitPrice if quantity exists
      const quantity = material.quantity || 1;
      (updated[index] as any).unitPrice = quantity > 0 ? cost / quantity : 0;
    } else {
      updated[index] = { ...material, [field]: value };
    }

    setMaterials(updated);
  };

  const removeMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index));
  };

  const addMilestone = () => {
    setSchedule([...schedule, {
      id: `milestone-${Date.now()}`,
      activity: '',
      startDate: '',
      endDate: '',
    }]);
  };

  const updateMilestone = (index: number, field: keyof ScheduleMilestone, value: string) => {
    const updated = [...schedule];
    updated[index] = { ...updated[index], [field]: value };
    setSchedule(updated);
  };

  const removeMilestone = (index: number) => {
    setSchedule(schedule.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent multiple submissions

    setIsSubmitting(true);
    try {
      await onSubmit({
        type,
        workDescription: workDescription !== serviceRequest.workDescription ? workDescription : undefined,
        materials,
        manpower: {},
        schedule,
      });
    } catch (error) {
      console.error('Error submitting form:', error);
      // Error handling is done in the parent component
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Job Order Type - Fixed to Material Requisition */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <label className="block text-sm font-medium text-gray-900 mb-2">
          Job Order Type
        </label>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            Material Requisition
          </span>
          <p className="text-xs text-gray-600">For purchasing materials (can create PO)</p>
        </div>
      </div>

      {/* Work Description (Editable) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Work Description / Scope <span className="text-blue-600">(Editable)</span>
        </label>
        <textarea
          value={workDescription}
          onChange={(e) => setWorkDescription(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Materials Required */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <label className="block text-sm font-medium text-gray-700">
            Materials Required
          </label>
          <button
            type="button"
            onClick={addMaterial}
            className="text-sm bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700"
          >
            + Add Item
          </button>
        </div>
        <div className="space-y-3">
          {materials.map((material, index) => (
            <div key={material.id} className="grid grid-cols-12 gap-2 p-3 bg-gray-50 rounded-md">
              <input
                type="text"
                placeholder="Item no."
                value={material.item}
                onChange={(e) => updateMaterial(index, 'item', e.target.value)}
                className="col-span-1 px-2 py-1 border border-gray-300 rounded text-sm"
              />
              <input
                type="text"
                placeholder="Description"
                value={material.description}
                onChange={(e) => updateMaterial(index, 'description', e.target.value)}
                className="col-span-4 px-2 py-1 border border-gray-300 rounded text-sm"
              />
              <input
                type="number"
                placeholder="Qty"
                value={material.quantity || ''}
                onChange={(e) => {
                  const qty = parseInt(e.target.value) || 0;
                  updateMaterial(index, 'quantity', qty);
                }}
                className="col-span-1 px-2 py-1 border border-gray-300 rounded text-sm"
              />
              <input
                type="text"
                placeholder="Unit"
                value={material.unit}
                onChange={(e) => updateMaterial(index, 'unit', e.target.value)}
                className="col-span-1 px-2 py-1 border border-gray-300 rounded text-sm"
              />
              <input
                type="text"
                placeholder="Size"
                value={material.size || ''}
                onChange={(e) => updateMaterial(index, 'size', e.target.value)}
                className="col-span-2 px-2 py-1 border border-gray-300 rounded text-sm"
              />
              <input
                type="text"
                placeholder="Color"
                value={material.color || ''}
                onChange={(e) => updateMaterial(index, 'color', e.target.value)}
                className="col-span-2 px-2 py-1 border border-gray-300 rounded text-sm"
              />
              <button
                type="button"
                onClick={() => removeMaterial(index)}
                className="col-span-1 text-red-600 hover:text-red-800 text-sm"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>



      {/* Schedule & Milestones */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <label className="block text-sm font-medium text-gray-700">
            Schedule & Milestones
          </label>
          <button
            type="button"
            onClick={addMilestone}
            className="text-sm bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700"
          >
            + Add Milestone
          </button>
        </div>
        <div className="space-y-3">
          {schedule.map((milestone, index) => (
            <div key={milestone.id} className="grid grid-cols-12 gap-2 p-3 bg-gray-50 rounded-md">
              <input
                type="text"
                placeholder="Activity"
                value={milestone.activity}
                onChange={(e) => updateMilestone(index, 'activity', e.target.value)}
                className="col-span-4 px-2 py-1 border border-gray-300 rounded text-sm"
              />
              <input
                type="date"
                value={milestone.startDate}
                onChange={(e) => updateMilestone(index, 'startDate', e.target.value)}
                className="col-span-3 px-2 py-1 border border-gray-300 rounded text-sm"
              />
              <input
                type="date"
                value={milestone.endDate}
                onChange={(e) => updateMilestone(index, 'endDate', e.target.value)}
                className="col-span-3 px-2 py-1 border border-gray-300 rounded text-sm"
              />
              <button
                type="button"
                onClick={() => removeMilestone(index)}
                className="col-span-2 text-red-600 hover:text-red-800 text-sm"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <LoadingSpinner size="20" speed="1.4" color="white" />
              <span>Creating...</span>
            </>
          ) : (
            'Create Job Order'
          )}
        </button>
      </div>
    </form>
  );
}

