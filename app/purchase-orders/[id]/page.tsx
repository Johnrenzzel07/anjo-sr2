'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PurchaseOrder, UserRole } from '@/types';
import Link from 'next/link';

import LoadingSpinner from '@/components/LoadingSpinner';
import StatusModal from '@/components/StatusModal';
import {
  PODetailsSection,
  POItemsTable,
  POSupplierSection,
  POApprovalsSection,
  POActionsSection,
  formatCurrency,
  getPriorityBadgeStyle
} from '@/components/PurchaseOrder';

interface ModalState {
  isOpen: boolean;
  type: 'success' | 'error';
  title: string;
  message: string;
}

export default function PurchaseOrderDetailPage() {
  const router = useRouter();
  const params = useParams();

  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ role: UserRole; id: string; name: string; department?: string } | null>(null);

  // Status modal state
  const [statusModal, setStatusModal] = useState<ModalState>({
    isOpen: false,
    type: 'success',
    title: '',
    message: '',
  });

  // Normalize department name for comparison
  const normalizeDept = (dept: string | undefined): string => {
    return (dept || '').toLowerCase().replace(/\s+department$/, '').trim();
  };

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
        const po = {
          ...data.purchaseOrder,
          id: data.purchaseOrder._id?.toString() || data.purchaseOrder.id,
        };
        setPurchaseOrder(po);

        // Mark related notifications as read
        try {
          await fetch('/api/notifications/mark-read-by-entity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              relatedEntityType: 'PURCHASE_ORDER',
              relatedEntityId: po.id || po._id?.toString(),
            }),
          });

          // Trigger NotificationBell refresh
          window.dispatchEvent(new Event('refreshNotifications'));
        } catch (notifError) {
          console.error('Error marking notifications as read:', notifError);
        }
      } else {
        setStatusModal({
          isOpen: true,
          type: 'error',
          title: 'Error',
          message: 'Failed to fetch purchase order',
        });
        router.push('/dashboard/admin');
      }
    } catch (error) {
      console.error('Error fetching purchase order:', error);
      setStatusModal({
        isOpen: true,
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch purchase order',
      });
    } finally {
      setLoading(false);
    }
  };

  // Print functionality
  const handlePrint = () => {
    window.print();
  };



  const handleItemDeliveryDateChange = async (index: number, newDate: string) => {
    if (!purchaseOrder || !newDate) return;

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
        setStatusModal({
          isOpen: true,
          type: 'error',
          title: 'Error',
          message: 'Failed to update delivery date',
        });
      }
    } catch (error) {
      console.error('Error updating delivery date:', error);
      setStatusModal({
        isOpen: true,
        type: 'error',
        title: 'Error',
        message: 'Failed to update delivery date',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="78" speed="1.4" color="#3b82f6" />
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
        <div className="no-print mb-6">
          <Link
            href="/dashboard/admin"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <PODetailsSection
            purchaseOrder={purchaseOrder}
            onPrint={handlePrint}
          />

          <POSupplierSection
            purchaseOrder={purchaseOrder}
            onItemDeliveryDateChange={handleItemDeliveryDateChange}
          />

          <POItemsTable purchaseOrder={purchaseOrder} />

          <POApprovalsSection purchaseOrder={purchaseOrder} />

          <POActionsSection
            purchaseOrder={purchaseOrder}
            currentUser={currentUser}
            onRefresh={fetchPurchaseOrder}
            onShowStatus={(status) => setStatusModal({ ...status, isOpen: true })}
          />

          {/* Status Modal */}
          <StatusModal
            isOpen={statusModal.isOpen}
            onClose={() => setStatusModal({ ...statusModal, isOpen: false })}
            type={statusModal.type}
            title={statusModal.title}
            message={statusModal.message}
          />

          <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }

          /* Hide elements that shouldn't be printed */
          .no-print {
            display: none !important;
          }
          
          /* Hide navigation and other UI elements */
          nav, header, footer, .print-hide, .status-badge-container {
            display: none !important;
          }
          
          /* Reset layout for print */
          body {
            margin: 0;
            padding: 0;
            font-size: 10pt;
            background: white !important;
            color: black !important;
          }
          
          /* Allow background colors/graphics */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Reset borders for new component style */
          .border, .border-gray-200, .border-gray-100 {
            border: none !important;
          }

          /* Card backgrounds */
          .bg-[#f8fafc] {
            background-color: #f8fafc !important;
          }

          /* Table optimizations */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 9pt !important;
          }
          
          /* Only bottom border for rows */
          tbody tr {
            border-bottom: 1pt solid #f3f4f6 !important;
          }
          
          th {
            background-color: #f8fafc !important; 
            color: #9ca3af !important;
            font-weight: bold !important;
            border-bottom: 1pt solid #e5e7eb !important;
            padding: 4pt !important;
          }

          td {
            padding: 6pt 4pt !important;
          }

          /* Typography */
          h1 { font-size: 20pt !important; margin-bottom: 2pt !important; }
          h2 { font-size: 14pt !important; margin: 12pt 0 6pt 0 !important; }
          h3 { font-size: 11pt !important; margin-bottom: 2pt !important; }
          
          /* Action buttons inside components should be hidden */
          button {
             display: none !important;
          }
          
          /* Adjust grid layout for print */
          .grid {
             display: grid !important;
             grid-template-columns: repeat(2, 1fr) !important;
             gap: 20pt !important;
          }
          
          /* Force Supplier section to act as block/grid */
          .md\:col-span-8, .md\:col-span-4 {
             grid-column: span 1 !important; /* Force side-by-side in print */
          }

          thead {
            display: table-header-group;
            background-color: #f3f4f6 !important;
          }
          
          /* Aggressively fit to one page */
          html, body {
            height: 100%;
            overflow: hidden !important;
          }
          /* Logo adjustments */
          .po-logo {
             display: block !important;
             visibility: visible !important;
             height: 60pt !important;
             width: 60pt !important;
             max-width: none !important;
             object-fit: contain !important;
             opacity: 1 !important;
             position: static !important;
          }

          .max-w-4xl {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            zoom: 0.95; 
          }

          /* Extreme spacing reduction for lists and grids */
          .space-y-4 > * + * {
            margin-top: 4pt !important;
          }
          
          .grid {
            gap: 8pt !important;
          }

          /* Hide empty/unnecessary elements in print */
          .empty-state, :empty {
            display: none !important;
          }
        }
      `}</style>
        </div>
      </div>
    </div>
  );
}