'use client';

import { PurchaseOrder } from '@/types';

interface POApprovalsSectionProps {
    purchaseOrder: PurchaseOrder;
}

export default function POApprovalsSection({ purchaseOrder }: POApprovalsSectionProps) {
    if (!purchaseOrder.approvals || purchaseOrder.approvals.length === 0) {
        return null;
    }

    return (
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
                                <p className={`text-sm font-medium ${approval.action === 'APPROVED' ? 'text-green-600' :
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
    );
}
