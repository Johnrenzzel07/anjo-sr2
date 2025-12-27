'use client';

import { useState, useEffect } from 'react';
import { JobOrder, PurchaseOrder, MaterialTransferItem, UserRole } from '@/types';
import { useToast } from './ToastContainer';
import { useConfirm } from './useConfirm';

interface TransferPanelProps {
  jobOrder: JobOrder;
  purchaseOrder: PurchaseOrder | null;
  currentUser?: { role: UserRole; id: string; name: string };
  onTransferUpdate?: () => void;
}

export default function TransferPanel({ jobOrder, purchaseOrder, currentUser, onTransferUpdate }: TransferPanelProps) {
  const toast = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [loading, setLoading] = useState(false);
  const [transferItems, setTransferItems] = useState<MaterialTransferItem[]>([]);
  const [transferNotes, setTransferNotes] = useState('');
  const [transferCompleted, setTransferCompleted] = useState(false);

  // Initialize transfer items from PO when available
  useEffect(() => {
    if (purchaseOrder && purchaseOrder.status === 'RECEIVED' && purchaseOrder.items) {
      const existingTransfer = jobOrder.materialTransfer;
      
      if (existingTransfer && existingTransfer.items && existingTransfer.items.length > 0) {
        // Use existing transfer data
        setTransferItems(existingTransfer.items);
        setTransferNotes(existingTransfer.transferNotes || '');
        setTransferCompleted(existingTransfer.transferCompleted || false);
      } else {
        // Initialize from PO items
        const items: MaterialTransferItem[] = purchaseOrder.items.map((poItem, index) => ({
          id: `transfer-item-${Date.now()}-${index}`,
          item: poItem.item,
          description: poItem.description || '',
          quantity: poItem.quantity,
          unit: poItem.unit,
          transferredQuantity: 0,
          status: 'PENDING' as const,
        }));
        setTransferItems(items);
      }
    }
  }, [purchaseOrder, jobOrder.materialTransfer]);

  // Check if PO is received (prerequisite for transfer)
  const canTransfer = purchaseOrder?.status === 'RECEIVED';
  const isTransferCompleted = jobOrder.materialTransfer?.transferCompleted || false;

  // Check if user can manage transfers (OPERATIONS or ADMIN)
  const userRole = currentUser?.role as string;
  const userDepartment = (currentUser as any)?.department;
  const canManageTransfer = userRole === 'OPERATIONS' || 
                            userRole === 'ADMIN' || 
                            userRole === 'SUPER_ADMIN' ||
                            (userRole === 'APPROVER' && userDepartment === 'Operations');

  const updateTransferItem = (index: number, field: keyof MaterialTransferItem, value: any) => {
    const updated = [...transferItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Update status based on transferred quantity
    const item = updated[index];
    if (field === 'transferredQuantity') {
      const transferred = value || 0;
      if (transferred === 0) {
        item.status = 'PENDING';
      } else if (transferred < item.quantity) {
        item.status = 'PARTIAL';
      } else {
        item.status = 'COMPLETED';
      }
    }
    
    setTransferItems(updated);
  };

  const handleSaveTransfer = async () => {
    if (!canManageTransfer) {
      toast.showError('You do not have permission to manage material transfers');
      return;
    }

    if (!transferItems || transferItems.length === 0) {
      toast.showWarning('No items to transfer');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/job-orders/${jobOrder.id || jobOrder._id}/transfer`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: transferItems,
          transferNotes: transferNotes,
        }),
      });

      if (response.ok) {
        toast.showSuccess('Material transfer updated successfully!');
        if (onTransferUpdate) {
          onTransferUpdate();
        }
      } else {
        const error = await response.json();
        toast.showError(error.error || 'Failed to update material transfer');
      }
    } catch (error) {
      console.error('Error updating transfer:', error);
      toast.showError('Failed to update material transfer');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTransfer = async () => {
    if (!canManageTransfer) {
      toast.showError('You do not have permission to complete material transfers');
      return;
    }

    // Check if all items are at least partially transferred
    const allTransferred = transferItems.every(item => 
      (item.transferredQuantity || 0) > 0
    );

    if (!allTransferred) {
      const proceed = await confirm('Some items have not been transferred. Are you sure you want to mark the transfer as completed?', {
        title: 'Confirm Transfer',
        confirmButtonColor: 'red',
      });
      if (!proceed) {
        return;
      }
    }

    const proceed = await confirm('Mark this material transfer as completed? This will finalize the transfer process.', {
      title: 'Complete Transfer',
      confirmButtonColor: 'green',
    });
    if (!proceed) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/job-orders/${jobOrder.id || jobOrder._id}/transfer`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: transferItems,
          transferNotes: transferNotes,
          transferCompleted: true,
          transferCompletedBy: currentUser?.name || 'Unknown',
        }),
      });

      if (response.ok) {
        toast.showSuccess('Material transfer completed successfully!');
        setTransferCompleted(true);
        if (onTransferUpdate) {
          onTransferUpdate();
        }
      } else {
        const error = await response.json();
        toast.showError(error.error || 'Failed to complete material transfer');
      }
    } catch (error) {
      console.error('Error completing transfer:', error);
      toast.showError('Failed to complete material transfer');
    } finally {
      setLoading(false);
    }
  };

  if (!canTransfer) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 border border-gray-200">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Material Transfer</h2>
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-sm text-yellow-800">
            <strong>Prerequisite:</strong> Purchase Order must be marked as <strong>RECEIVED</strong> before materials can be transferred.
            {purchaseOrder && (
              <span className="block mt-1">Current PO Status: <strong>{purchaseOrder.status}</strong></span>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 border border-gray-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Material Transfer</h2>
        {isTransferCompleted && (
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            ✓ Transfer Completed
          </span>
        )}
      </div>

      {purchaseOrder && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            <strong>Purchase Order:</strong> {purchaseOrder.poNumber} (Status: {purchaseOrder.status})
            {purchaseOrder.actualDeliveryDate && (
              <span className="block mt-1">
                <strong>Received Date:</strong> {new Date(purchaseOrder.actualDeliveryDate).toLocaleDateString()}
              </span>
            )}
          </p>
        </div>
      )}

      {transferItems.length > 0 ? (
        <div className="space-y-4">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Unit</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Transferred</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    {canManageTransfer && !isTransferCompleted && (
                      <th className="px-2 sm:px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Transfer Date</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transferItems.map((item, index) => (
                    <tr key={item.id || index}>
                      <td className="px-2 sm:px-4 py-3 text-xs sm:text-sm text-gray-900">{item.item}</td>
                      <td className="px-2 sm:px-4 py-3 text-xs sm:text-sm text-gray-600">{item.description}</td>
                      <td className="px-2 sm:px-4 py-3 text-xs sm:text-sm text-center text-gray-900">{item.quantity}</td>
                      <td className="px-2 sm:px-4 py-3 text-xs sm:text-sm text-center text-gray-600">{item.unit}</td>
                      <td className="px-2 sm:px-4 py-3 text-center">
                        {canManageTransfer && !isTransferCompleted ? (
                          <input
                            type="number"
                            min="0"
                            max={item.quantity}
                            value={item.transferredQuantity || 0}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 0;
                              updateTransferItem(index, 'transferredQuantity', value);
                              if (value > 0 && !item.transferDate) {
                                updateTransferItem(index, 'transferDate', new Date().toISOString().split('T')[0]);
                                updateTransferItem(index, 'transferredBy', currentUser?.name || 'Unknown');
                              }
                            }}
                            className="w-16 sm:w-20 px-2 py-1 border border-gray-300 rounded text-xs sm:text-sm text-center"
                          />
                        ) : (
                          <span className="text-xs sm:text-sm text-gray-900">{item.transferredQuantity || 0}</span>
                        )}
                      </td>
                      <td className="px-2 sm:px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                          item.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      {canManageTransfer && !isTransferCompleted && (
                        <td className="px-2 sm:px-4 py-3 text-center">
                          {item.transferDate ? (
                            <span className="text-xs text-gray-600">{new Date(item.transferDate).toLocaleDateString()}</span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                      )}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {canManageTransfer && !isTransferCompleted && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transfer Notes (optional):
              </label>
              <textarea
                value={transferNotes}
                onChange={(e) => setTransferNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Enter any notes about the material transfer..."
              />
            </div>
          )}

          {jobOrder.materialTransfer?.transferNotes && (
            <div className="mt-2 p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-700">
                <strong>Transfer Notes:</strong> {jobOrder.materialTransfer.transferNotes}
              </p>
            </div>
          )}

          {isTransferCompleted && jobOrder.materialTransfer && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">
                <strong>Transfer Completed:</strong> {jobOrder.materialTransfer.transferCompletedDate 
                  ? new Date(jobOrder.materialTransfer.transferCompletedDate).toLocaleDateString()
                  : 'N/A'}
              </p>
              {jobOrder.materialTransfer.transferCompletedBy && (
                <p className="text-sm text-green-800 mt-1">
                  <strong>Completed By:</strong> {jobOrder.materialTransfer.transferCompletedBy}
                </p>
              )}
            </div>
          )}

          {canManageTransfer && !isTransferCompleted && (
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <button
                onClick={handleSaveTransfer}
                disabled={loading}
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50 text-sm sm:text-base"
              >
                {loading ? 'Saving...' : 'Save Transfer'}
              </button>
              <button
                onClick={handleCompleteTransfer}
                disabled={loading}
                className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium disabled:opacity-50 text-sm sm:text-base"
              >
                {loading ? 'Completing...' : 'Complete Transfer'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
          <p className="text-sm text-gray-600">
            No materials available for transfer. Ensure the Purchase Order has been received and contains items.
          </p>
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}

