'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PurchaseOrder, UserRole } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import Link from 'next/link';

export default function PurchaseOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ role: UserRole; id: string; name: string; department?: string } | null>(null);

  useEffect(() => {
    // Fetch current user
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setCurrentUser({
            role: data.user.role,
            id: data.user._id || data.user.id,
            name: data.user.name,
            department: data.user.department,
          });
        }
      })
      .catch(() => {
        // Default user for development
        setCurrentUser({
          role: 'OPERATIONS',
          id: 'user-001',
          name: 'John Operations',
        });
      });
  }, []);

  useEffect(() => {
    if (params.id) {
      fetchPurchaseOrder();
    }
  }, [params.id]);

  const fetchPurchaseOrder = async () => {
    try {
      const response = await fetch(`/api/purchase-orders/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setPurchaseOrder({
          ...data.purchaseOrder,
          id: data.purchaseOrder._id?.toString() || data.purchaseOrder.id,
        });
      } else {
        alert('Failed to fetch purchase order');
        router.push('/dashboard/admin');
      }
    } catch (error) {
      console.error('Error fetching purchase order:', error);
      alert('Failed to fetch purchase order');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!purchaseOrder) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Purchase Order not found</div>
      </div>
    );
  }

  const joNumber = typeof purchaseOrder.joId === 'object' 
    ? (purchaseOrder.joId as any)?.joNumber 
    : purchaseOrder.joId;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href="/dashboard/admin"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
            <div className="flex items-center gap-2 sm:gap-4">
              <img 
                src="/logo.png" 
                alt="ANJO WORLD" 
                className="h-10 w-10 sm:h-12 sm:w-12 object-contain"
              />
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 break-words">{purchaseOrder.poNumber}</h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  Created: {new Date(purchaseOrder.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <StatusBadge status={purchaseOrder.status} type="po" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Job Order</h3>
              <p className="text-gray-900">{joNumber}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Department</h3>
              <p className="text-gray-900">{purchaseOrder.department}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Requested By</h3>
              <p className="text-gray-900">{purchaseOrder.requestedBy}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Priority</h3>
              <p className="text-gray-900">{purchaseOrder.priority}</p>
            </div>
            {purchaseOrder.expectedDeliveryDate && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Expected Delivery</h3>
                <p className="text-gray-900">
                  {new Date(purchaseOrder.expectedDeliveryDate).toLocaleDateString()}
                </p>
              </div>
            )}
            {purchaseOrder.actualDeliveryDate && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Actual Delivery</h3>
                <p className="text-gray-900">
                  {new Date(purchaseOrder.actualDeliveryDate).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          {/* Supplier and Delivery Date Information */}
          {purchaseOrder.items && purchaseOrder.items.length > 0 && (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Supplier & Delivery Information</h2>
                {purchaseOrder.status === 'DRAFT' && (
                  <p className="text-xs text-blue-600">
                    💡 You can edit delivery dates below (PO is in DRAFT status)
                  </p>
                )}
              </div>
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
                    <div key={item.id || index} className="p-4 bg-gray-50 rounded-md border border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h3 className="text-sm font-medium text-gray-700 mb-2">
                            Item: {item.item}
                          </h3>
                          <div className="space-y-2">
                            <div>
                              <span className="text-xs font-medium text-gray-500">Supplier Name:</span>
                              <p className="text-gray-900">{itemSupplier.name}</p>
                            </div>
                            {itemSupplier.contact && (
                              <div>
                                <span className="text-xs font-medium text-gray-500">Contact:</span>
                                <p className="text-gray-900">{itemSupplier.contact}</p>
                              </div>
                            )}
                            {itemSupplier.address && (
                              <div>
                                <span className="text-xs font-medium text-gray-500">Address:</span>
                                <p className="text-gray-900">{itemSupplier.address}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-700 mb-2">Delivery Date</h3>
                          {canEdit ? (
                            <input
                              type="date"
                              value={itemDeliveryDate && itemDeliveryDate.trim() !== '' 
                                ? new Date(itemDeliveryDate).toISOString().split('T')[0]
                                : ''}
                              onChange={async (e) => {
                                const newDate = e.target.value;
                                if (!newDate) return;
                                
                                // Update the item's delivery date
                                const updatedItems = [...(purchaseOrder.items || [])];
                                updatedItems[index] = {
                                  ...updatedItems[index],
                                  expectedDeliveryDate: newDate,
                                };
                                
                                try {
                                  const response = await fetch(`/api/purchase-orders/${purchaseOrder.id || purchaseOrder._id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ items: updatedItems }),
                                  });
                                  
                                  if (response.ok) {
                                    fetchPurchaseOrder(); // Refresh
                                  } else {
                                    alert('Failed to update delivery date');
                                  }
                                } catch (error) {
                                  console.error('Error updating delivery date:', error);
                                  alert('Failed to update delivery date');
                                }
                              }}
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          ) : (
                            <p className="text-gray-900">
                              {itemDeliveryDate && itemDeliveryDate.trim() !== ''
                                ? new Date(itemDeliveryDate).toLocaleDateString()
                                : 'N/A'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Items */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Items</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {purchaseOrder.items && purchaseOrder.items.length > 0 ? (
                    purchaseOrder.items.map((item, index) => (
                      <tr key={item.id || index}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.item}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.description}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.quantity}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.unit}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">₱{item.unitPrice.toFixed(2)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">₱{item.totalPrice.toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-3 text-center text-sm text-gray-500">
                        No items in this purchase order
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                      Subtotal:
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">
                      ₱{purchaseOrder.subtotal?.toFixed(2) || '0.00'}
                    </td>
                  </tr>
                  {purchaseOrder.tax && purchaseOrder.tax > 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                        Tax:
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900">
                        ₱{purchaseOrder.tax.toFixed(2)}
                      </td>
                    </tr>
                  ) : null}
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                      Total Amount:
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">
                      ₱{purchaseOrder.totalAmount?.toFixed(2) || '0.00'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Approvals */}
          {purchaseOrder.approvals && purchaseOrder.approvals.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Approvals</h2>
              <div className="space-y-3">
                {purchaseOrder.approvals.map((approval, index) => (
                  <div key={index} className="bg-gray-50 rounded-md p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{approval.userName}</p>
                        <p className="text-sm text-gray-500">{approval.role}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-medium ${
                          approval.action === 'APPROVED' ? 'text-green-600' : 
                          approval.action === 'REJECTED' ? 'text-red-600' : 
                          'text-gray-900'
                        }`}>
                          {approval.action}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(approval.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {approval.comments && (
                      <p className="text-sm text-gray-600 mt-2">{approval.comments}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approval Actions */}
          <div className="mb-6 bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
            
            {/* Submit Button (for DRAFT status) */}
            {purchaseOrder.status === 'DRAFT' && (
              <div className="mb-4">
                <button
                  onClick={async () => {
                    if (!confirm('Submit this Purchase Order for approval?')) return;
                    try {
                      const response = await fetch(`/api/purchase-orders/${purchaseOrder.id || purchaseOrder._id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'SUBMITTED' }),
                      });
                      if (response.ok) {
                        alert('Purchase Order submitted successfully!');
                        fetchPurchaseOrder();
                      } else {
                        const error = await response.json();
                        alert(error.error || 'Failed to submit Purchase Order');
                      }
                    } catch (error) {
                      console.error('Error submitting PO:', error);
                      alert('Failed to submit Purchase Order');
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                >
                  Submit for Approval
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  Submit this Purchase Order to start the approval process (Finance → President)
                </p>
              </div>
            )}

            {/* Approval Status and Buttons */}
            {(purchaseOrder.status === 'SUBMITTED' || purchaseOrder.status === 'APPROVED') && currentUser && (
              <div className="mb-4">
                {(() => {
                  const financeApproved = purchaseOrder.approvals?.some(
                    (a: any) => a.role === 'FINANCE' && a.action === 'APPROVED'
                  );
                  const presidentApproved = purchaseOrder.approvals?.some(
                    (a: any) => a.role === 'MANAGEMENT' && a.action === 'APPROVED'
                  );
                  const userHasApproved = purchaseOrder.approvals?.some(
                    (a: any) => a.userId === currentUser.id && a.action === 'APPROVED'
                  );
                  
                  return (
                    <div className="space-y-3">
                      {/* Finance Approval */}
                      <div className="p-3 rounded-md border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Finance Approval:</span>
                          {financeApproved ? (
                            <span className="text-sm text-green-600 font-medium">✓ Approved</span>
                          ) : (
                            <span className="text-sm text-yellow-600 font-medium">Pending</span>
                          )}
                        </div>
                        {!financeApproved && (currentUser.role === 'FINANCE' || currentUser.department === 'Finance') && !userHasApproved && (
                          <button
                            onClick={async () => {
                              const comments = prompt('Enter approval comments:');
                              if (!comments) return;
                              try {
                                const response = await fetch(`/api/purchase-orders/${purchaseOrder.id || purchaseOrder._id}/approve`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    role: 'FINANCE',
                                    userId: currentUser.id,
                                    userName: currentUser.name,
                                    action: 'APPROVED',
                                    comments,
                                  }),
                                });
                                if (response.ok) {
                                  alert('Purchase Order approved by Finance!');
                                  fetchPurchaseOrder();
                                } else {
                                  const error = await response.json();
                                  alert(error.error || 'Failed to approve');
                                }
                              } catch (error) {
                                console.error('Error approving:', error);
                                alert('Failed to approve Purchase Order');
                              }
                            }}
                            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                          >
                            Approve (Finance)
                          </button>
                        )}
                      </div>

                      {/* President Approval */}
                      <div className="p-3 rounded-md border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">President Approval:</span>
                          {presidentApproved ? (
                            <span className="text-sm text-green-600 font-medium">✓ Approved</span>
                          ) : financeApproved ? (
                            <span className="text-sm text-yellow-600 font-medium">Waiting for Approval</span>
                          ) : (
                            <span className="text-sm text-gray-500">Waiting for Finance approval first</span>
                          )}
                        </div>
                        {financeApproved && !presidentApproved && (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN') && !userHasApproved && (
                          <button
                            onClick={async () => {
                              const comments = prompt('Enter approval comments:');
                              if (!comments) return;
                              try {
                                const response = await fetch(`/api/purchase-orders/${purchaseOrder.id || purchaseOrder._id}/approve`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    role: currentUser.role === 'SUPER_ADMIN' ? 'MANAGEMENT' : currentUser.role,
                                    userId: currentUser.id,
                                    userName: currentUser.name,
                                    action: 'APPROVED',
                                    comments,
                                  }),
                                });
                                if (response.ok) {
                                  alert('Purchase Order approved by President!');
                                  fetchPurchaseOrder();
                                } else {
                                  const error = await response.json();
                                  alert(error.error || 'Failed to approve');
                                }
                              } catch (error) {
                                console.error('Error approving:', error);
                                alert('Failed to approve Purchase Order');
                              }
                            }}
                            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                          >
                            Approve (President)
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Post-Approval Actions: Mark as Purchased/Received */}
            {/* Show this block when PO is fully approved, purchased, or received */}
            {(purchaseOrder.status === 'APPROVED' || purchaseOrder.status === 'PURCHASED' || purchaseOrder.status === 'RECEIVED') && 
             purchaseOrder.approvals?.some((a: any) => a.role === 'FINANCE' && a.action === 'APPROVED') &&
             purchaseOrder.approvals?.some((a: any) => a.role === 'MANAGEMENT' && a.action === 'APPROVED') && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-md font-semibold text-gray-900 mb-3">Post-Approval Actions</h3>
                <div className="space-y-3">
                  {/* Mark as Purchased */}
                  {purchaseOrder.status !== 'PURCHASED' && purchaseOrder.status !== 'RECEIVED' && purchaseOrder.status !== 'CLOSED' && (
                    <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                      <p className="text-sm text-gray-700 mb-2">
                        <strong>Step 1:</strong> Mark as Purchased when the order has been placed with the supplier.
                      </p>
                      <button
                        onClick={async () => {
                          if (!confirm('Mark this Purchase Order as PURCHASED? This indicates the order has been placed with the supplier.')) return;
                          try {
                            const response = await fetch(`/api/purchase-orders/${purchaseOrder.id || purchaseOrder._id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: 'PURCHASED' }),
                            });
                            if (response.ok) {
                              alert('Purchase Order marked as PURCHASED!');
                              fetchPurchaseOrder();
                            } else {
                              const error = await response.json();
                              alert(error.error || 'Failed to update status');
                            }
                          } catch (error) {
                            console.error('Error updating PO status:', error);
                            alert('Failed to update Purchase Order status');
                          }
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                      >
                        Mark as Purchased
                      </button>
                    </div>
                  )}

                  {/* Mark as Received */}
                  {purchaseOrder.status === 'PURCHASED' && purchaseOrder.status !== 'RECEIVED' && purchaseOrder.status !== 'CLOSED' && (
                    <div className="p-3 bg-green-50 rounded-md border border-green-200">
                      <p className="text-sm text-gray-700 mb-2">
                        <strong>Step 2:</strong> Mark as Received when the items have been delivered. This will automatically set the Job Order status to IN_PROGRESS.
                      </p>
                      <div className="space-y-2 mb-3">
                        <label className="block text-sm font-medium text-gray-700">
                          Actual Delivery Date:
                        </label>
                        <input
                          type="date"
                          id="actualDeliveryDate"
                          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                          defaultValue={purchaseOrder.actualDeliveryDate ? new Date(purchaseOrder.actualDeliveryDate).toISOString().split('T')[0] : ''}
                        />
                        <label className="block text-sm font-medium text-gray-700 mt-2">
                          Delivery Notes (optional):
                        </label>
                        <textarea
                          id="deliveryNotes"
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          placeholder="Enter any notes about the delivery..."
                          defaultValue={purchaseOrder.deliveryNotes || ''}
                        />
                      </div>
                      <button
                        onClick={async () => {
                          if (!confirm('Mark this Purchase Order as RECEIVED? This will automatically set the Job Order to IN_PROGRESS.')) return;
                          try {
                            const actualDeliveryDate = (document.getElementById('actualDeliveryDate') as HTMLInputElement)?.value;
                            const deliveryNotes = (document.getElementById('deliveryNotes') as HTMLTextAreaElement)?.value;
                            
                            const response = await fetch(`/api/purchase-orders/${purchaseOrder.id || purchaseOrder._id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ 
                                status: 'RECEIVED',
                                actualDeliveryDate: actualDeliveryDate || new Date().toISOString(),
                                deliveryNotes: deliveryNotes || '',
                              }),
                            });
                            if (response.ok) {
                              alert('Purchase Order marked as RECEIVED! Job Order has been automatically set to IN_PROGRESS.');
                              fetchPurchaseOrder();
                            } else {
                              const error = await response.json();
                              alert(error.error || 'Failed to update status');
                            }
                          } catch (error) {
                            console.error('Error updating PO status:', error);
                            alert('Failed to update Purchase Order status');
                          }
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
                      >
                        Mark as Received
                      </button>
                    </div>
                  )}

                  {/* Status Display for Received/Closed */}
                  {(purchaseOrder.status === 'RECEIVED' || purchaseOrder.status === 'CLOSED') && (
                    <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
                      <p className="text-sm text-gray-700">
                        <strong>Status:</strong> {purchaseOrder.status === 'RECEIVED' ? 'Items have been received. Job Order is now IN_PROGRESS.' : 'Purchase Order is closed.'}
                      </p>
                      {purchaseOrder.actualDeliveryDate && (
                        <p className="text-sm text-gray-600 mt-1">
                          <strong>Actual Delivery Date:</strong> {new Date(purchaseOrder.actualDeliveryDate).toLocaleDateString()}
                        </p>
                      )}
                      {purchaseOrder.deliveryNotes && (
                        <p className="text-sm text-gray-600 mt-1">
                          <strong>Delivery Notes:</strong> {purchaseOrder.deliveryNotes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Delivery Notes */}
          {purchaseOrder.deliveryNotes && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Delivery Notes</h2>
              <p className="text-gray-600">{purchaseOrder.deliveryNotes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

