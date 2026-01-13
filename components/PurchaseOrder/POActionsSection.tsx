'use client';

import { useState } from 'react';
import { PurchaseOrder, UserRole } from '@/types';
import { useConfirm } from '@/components/useConfirm';
import { useApprovalModal } from '@/components/useApprovalModal';

interface POActionsSectionProps {
    purchaseOrder: PurchaseOrder;
    currentUser: { role: UserRole; id: string; name: string; department?: string } | null;
    onRefresh: () => void;
    onShowStatus: (status: { type: 'success' | 'error'; title: string; message: string }) => void;
}

export default function POActionsSection({
    purchaseOrder,
    currentUser,
    onRefresh,
    onShowStatus
}: POActionsSectionProps) {
    const { confirm, ConfirmDialog } = useConfirm();
    const { showApproval, ApprovalDialog } = useApprovalModal();

    // State for "Mark as Received" inputs
    const [actualDeliveryDate, setActualDeliveryDate] = useState<string>('');
    const [deliveryNotes, setDeliveryNotes] = useState<string>('');

    // Helper to normalize department
    const normalizeDept = (dept: string | undefined): string => {
        return (dept || '').toLowerCase().replace(/\s+department$/, '').trim();
    };

    // 1. Submit for Approval (Purchasing -> President)
    const handleSubmitForApproval = async () => {
        const proceed = await confirm('Submit this Purchase Order for President approval?', {
            title: 'Request Approval',
            confirmButtonColor: 'blue',
        });

        if (!proceed) return;

        try {
            const response = await fetch(`/api/purchase-orders/${purchaseOrder.id || purchaseOrder._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'SUBMITTED' }),
            });

            if (response.ok) {
                onShowStatus({
                    type: 'success',
                    title: 'Success!',
                    message: 'Purchase Order submitted for approval!',
                });
                onRefresh();
            } else {
                const error = await response.json();
                onShowStatus({
                    type: 'error',
                    title: 'Error',
                    message: error.error || 'Failed to submit',
                });
            }
        } catch (err) {
            onShowStatus({
                type: 'error',
                title: 'Error',
                message: 'Error submitting for approval',
            });
        }
    };

    // 2. Approve (President)
    const handleApprove = async () => {
        if (!currentUser) return;

        const comments = await showApproval({
            title: 'President Approval',
            message: 'Please enter your approval comments for this Purchase Order.',
            confirmButtonText: 'Approve',
            confirmButtonColor: 'green',
            placeholder: 'Enter approval comments (optional)...',
        });

        if (comments === null) return;

        try {
            const response = await fetch(`/api/purchase-orders/${purchaseOrder.id || purchaseOrder._id}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role: 'MANAGEMENT',
                    userId: currentUser.id,
                    userName: currentUser.name,
                    action: 'APPROVED',
                    comments: comments || '',
                }),
            });

            if (response.ok) {
                onShowStatus({
                    type: 'success',
                    title: 'Success!',
                    message: `Purchase Order ${purchaseOrder.poNumber} approved by President!`,
                });

                // Mark notifications as read
                try {
                    await fetch('/api/notifications/mark-read-by-entity', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            relatedEntityType: 'PURCHASE_ORDER',
                            relatedEntityId: purchaseOrder.id || purchaseOrder._id,
                        }),
                    });
                    window.dispatchEvent(new Event('refreshNotifications'));
                } catch (e) {
                    console.error("Failed to mark notifications read", e);
                }

                onRefresh();
            } else {
                const error = await response.json();
                onShowStatus({
                    type: 'error',
                    title: 'Error',
                    message: error.error || 'Failed to approve',
                });
            }
        } catch (error) {
            onShowStatus({
                type: 'error',
                title: 'Error',
                message: 'Failed to approve Purchase Order',
            });
        }
    };

    // 3. Reject (President)
    const handleReject = async () => {
        if (!currentUser) return;

        const comments = await showApproval({
            title: 'Reject Purchase Order',
            message: 'Please provide a reason for rejecting this Purchase Order.',
            confirmButtonText: 'Reject',
            confirmButtonColor: 'red',
            placeholder: 'Enter rejection reason...',
        });

        if (comments === null) return;

        try {
            const response = await fetch(`/api/purchase-orders/${purchaseOrder.id || purchaseOrder._id}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role: 'MANAGEMENT',
                    userId: currentUser.id,
                    userName: currentUser.name,
                    action: 'REJECTED',
                    comments: comments || '',
                }),
            });

            if (response.ok) {
                onShowStatus({
                    type: 'success',
                    title: 'Purchase Order Rejected',
                    message: `Purchase Order ${purchaseOrder.poNumber} has been rejected by President.`,
                });
                onRefresh();
            } else {
                const error = await response.json();
                onShowStatus({
                    type: 'error',
                    title: 'Error',
                    message: error.error || 'Failed to reject',
                });
            }
        } catch (error) {
            onShowStatus({
                type: 'error',
                title: 'Error',
                message: 'Failed to reject Purchase Order',
            });
        }
    };

    // 4. Mark as Purchased (Purchasing)
    const handleMarkAsPurchased = async () => {
        const proceed = await confirm('Mark this Purchase Order as PURCHASED?', {
            title: 'Mark as Purchased',
            confirmButtonColor: 'purple',
        });

        if (!proceed) return;

        try {
            const response = await fetch(`/api/purchase-orders/${purchaseOrder.id || purchaseOrder._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'PURCHASED' }),
            });

            if (response.ok) {
                onShowStatus({
                    type: 'success',
                    title: 'Success!',
                    message: 'Purchase Order marked as PURCHASED!',
                });
                onRefresh();
            } else {
                const error = await response.json();
                onShowStatus({
                    type: 'error',
                    title: 'Error',
                    message: error.error || 'Failed to update',
                });
            }
        } catch (err) {
            onShowStatus({
                type: 'error',
                title: 'Error',
                message: 'Error updating status',
            });
        }
    };

    // 5. Mark as Received
    const handleMarkAsReceived = async () => {
        const proceed = await confirm('Mark this Purchase Order as RECEIVED? This will automatically set the Job Order to IN_PROGRESS.', {
            title: 'Mark as Received',
            confirmButtonColor: 'green',
        });

        if (!proceed) return;

        try {
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
                onShowStatus({
                    type: 'success',
                    title: 'Success!',
                    message: 'Purchase Order marked as RECEIVED! Job Order has been automatically set to IN_PROGRESS.',
                });
                onRefresh();
            } else {
                const error = await response.json();
                onShowStatus({
                    type: 'error',
                    title: 'Error',
                    message: error.error || 'Failed to update status',
                });
            }
        } catch (error) {
            onShowStatus({
                type: 'error',
                title: 'Error',
                message: 'Failed to update Purchase Order status',
            });
        }
    };

    return (
        <>
            <div className="no-print mb-6 bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>

                {/* 1. Request Approval (Purchasing) */}
                {purchaseOrder.status === 'DRAFT' && currentUser && (normalizeDept(currentUser.department) === 'purchasing' || currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN') && (
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="text-sm text-blue-700 mb-3 font-medium">
                            Ready to request President approval for this Purchase Order?
                        </p>
                        <button
                            onClick={handleSubmitForApproval}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                        >
                            Submit for Approval
                        </button>
                    </div>
                )}

                {purchaseOrder.status === 'DRAFT' && currentUser && !(normalizeDept(currentUser.department) === 'purchasing' || currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN') && (
                    <p className="text-sm text-gray-500 italic">
                        Waiting for Purchasing department to submit this Purchase Order for approval.
                    </p>
                )}

                {/* 2. President Approval (SUBMITTED status) */}
                {purchaseOrder.status === 'SUBMITTED' && currentUser && (
                    <div className="mb-4">
                        {(() => {
                            const presidentApproved = purchaseOrder.approvals?.some(
                                (a: any) => a.role === 'MANAGEMENT' && a.action === 'APPROVED'
                            );
                            const isPresident = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN' || currentUser.role === 'MANAGEMENT';

                            if (!isPresident || presidentApproved) return null;

                            return (
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleApprove}
                                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
                                    >
                                        Approve (President)
                                    </button>
                                    <button
                                        onClick={handleReject}
                                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium"
                                    >
                                        Reject (President)
                                    </button>
                                </div>
                            );
                        })()}
                    </div>
                )}

                {purchaseOrder.status === 'SUBMITTED' && currentUser && !(currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN' || currentUser.role === 'MANAGEMENT') && (
                    <p className="text-sm text-gray-500 italic pb-4">
                        This Purchase Order has been submitted and is currently waiting for President approval.
                    </p>
                )}

                {/* 3. Mark as Purchased (APPROVED status) */}
                {purchaseOrder.status === 'APPROVED' && currentUser && (normalizeDept(currentUser.department) === 'purchasing' || currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN') && (
                    <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-md">
                        <p className="text-sm text-purple-700 mb-3 font-medium">
                            Mark this Purchase Order as PURCHASED once the order has been placed with the supplier.
                        </p>
                        <button
                            onClick={handleMarkAsPurchased}
                            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium"
                        >
                            Mark as Purchased
                        </button>
                    </div>
                )}

                {purchaseOrder.status === 'APPROVED' && currentUser && !(normalizeDept(currentUser.department) === 'purchasing' || currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN') && (
                    <p className="text-sm text-gray-500 italic">
                        Purchase Order approved. Waiting for Purchasing to mark as purchased with the supplier.
                    </p>
                )}

                {/* 4. Mark as Received (PURCHASED status) */}
                {purchaseOrder.status === 'PURCHASED' && (
                    <div className="p-3 bg-green-50 rounded-md border border-green-200">
                        <p className="text-sm text-gray-700 mb-2">
                            Mark as Received when the items have been delivered. This will automatically set the Job Order status to IN_PROGRESS.
                        </p>
                        <div className="space-y-2 mb-3">
                            <label className="block text-sm font-medium text-gray-700">
                                Actual Delivery Date:
                            </label>
                            <input
                                type="date"
                                value={actualDeliveryDate || (purchaseOrder.actualDeliveryDate ? new Date(purchaseOrder.actualDeliveryDate).toISOString().split('T')[0] : '')}
                                onChange={(e) => setActualDeliveryDate(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                            />
                            <label className="block text-sm font-medium text-gray-700 mt-2">
                                Delivery Notes (optional):
                            </label>
                            <textarea
                                rows={3}
                                value={deliveryNotes || purchaseOrder.deliveryNotes || ''}
                                onChange={(e) => setDeliveryNotes(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                placeholder="Enter any notes about the delivery..."
                            />
                        </div>
                        <button
                            onClick={handleMarkAsReceived}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
                        >
                            Mark as Received
                        </button>
                    </div>
                )}

                {/* Status Display for Received/Closed */}
                {(purchaseOrder.status === 'RECEIVED') && (
                    <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
                        <p className="text-sm text-gray-700">
                            <strong>Status:</strong> Purchase Order has been {purchaseOrder.status.toLowerCase()}.
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

                {purchaseOrder.deliveryNotes && (
                    <div className="mt-6 border-t pt-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Delivery Notes</h2>
                        <p className="text-gray-600">{purchaseOrder.deliveryNotes}</p>
                    </div>
                )}
            </div>

            <ConfirmDialog />
            <ApprovalDialog />
        </>
    );
}
