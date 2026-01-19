'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ReceivingReport } from '@/types';
import { useToast } from '@/components/ToastContainer';
import LoadingSpinner from '@/components/LoadingSpinner';
import VoucherModal from '@/components/VoucherModal';

export default function ReceivingReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const [receivingReport, setReceivingReport] = useState<ReceivingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showVoucher, setShowVoucher] = useState(false);

  // Format currency with commas
  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user && params.id) {
      fetchReceivingReport();
    }
  }, [user, params.id]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        router.push('/login');
      }
    } catch (error) {
      router.push('/login');
    }
  };

  const fetchReceivingReport = async () => {
    try {
      const response = await fetch(`/api/receiving-reports/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setReceivingReport(data.receivingReport);
      } else {
        toast.showError('Failed to fetch receiving report');
      }
    } catch (error) {
      toast.showError('Error fetching receiving report');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!receivingReport) return;

    try {
      const response = await fetch(`/api/receiving-reports/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const data = await response.json();
        setReceivingReport(data.receivingReport);
        toast.showSuccess(`Status updated to ${newStatus}`);
      } else {
        const error = await response.json();
        toast.showError(error.error || 'Failed to update status');
      }
    } catch (error) {
      toast.showError('Error updating status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      case 'SUBMITTED':
        return 'bg-blue-100 text-blue-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const canUpdateStatus = user && (
    user.role === 'ADMIN' ||
    user.role === 'SUPER_ADMIN' ||
    (user.role === 'APPROVER' && user.department === 'Purchasing')
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="78" speed="1.4" color="#9333ea" />
      </div>
    );
  }

  if (!receivingReport) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Receiving Report not found</p>
          <Link
            href="/dashboard/admin"
            className="text-purple-600 hover:text-purple-800 underline"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const poInfo = typeof receivingReport.poId === 'object' && receivingReport.poId !== null 
    ? receivingReport.poId as any 
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {receivingReport.rrNumber}
                </h1>
                <p className="text-sm text-gray-500">
                  From PO: {receivingReport.createdFrom}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowVoucher(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center gap-2"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Generate Voucher
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 flex items-center gap-2"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                  />
                </svg>
                Print
              </button>
              <span
                className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(
                  receivingReport.status
                )}`}
              >
                {receivingReport.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Primary Information */}
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Primary Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Reference #</p>
                <p className="text-sm text-gray-900 mt-1">{receivingReport.referenceNumber || receivingReport.rrNumber}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Created From</p>
                <p className="text-sm text-gray-900 mt-1">
                  {poInfo ? (
                    <Link
                      href={`/purchase-orders/${poInfo._id || poInfo.id}`}
                      className="text-purple-600 hover:text-purple-800 underline"
                    >
                      {receivingReport.createdFrom}
                    </Link>
                  ) : (
                    receivingReport.createdFrom
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Posting Period</p>
                <p className="text-sm text-gray-900 mt-1">{receivingReport.postingPeriod || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Supplier</p>
                <p className="text-sm text-gray-900 mt-1">{receivingReport.supplierName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Date</p>
                <p className="text-sm text-gray-900 mt-1">
                  {new Date(receivingReport.date).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Delivery Date</p>
                <p className="text-sm text-gray-900 mt-1">
                  {new Date(receivingReport.actualDeliveryDate).toLocaleDateString()}
                </p>
              </div>
              {receivingReport.memo && (
                <div className="col-span-3">
                  <p className="text-sm font-medium text-gray-500">Memo</p>
                  <p className="text-sm text-gray-900 mt-1">{receivingReport.memo}</p>
                </div>
              )}
            </div>
          </div>

          {/* POS Information */}
          {(receivingReport.storeNo || receivingReport.terminalNo) && (
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">POS Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Store No.</p>
                  <p className="text-sm text-gray-900 mt-1">{receivingReport.storeNo || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Terminal No.</p>
                  <p className="text-sm text-gray-900 mt-1">{receivingReport.terminalNo || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Original PO No.</p>
                  <p className="text-sm text-gray-900 mt-1">{receivingReport.originalPONumber || receivingReport.createdFrom}</p>
                </div>
              </div>
            </div>
          )}

          {/* Classification */}
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Classification</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {receivingReport.division && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Division</p>
                  <p className="text-sm text-gray-900 mt-1">{receivingReport.division}</p>
                </div>
              )}
              {receivingReport.toLocation && (
                <div>
                  <p className="text-sm font-medium text-gray-500">To Location</p>
                  <p className="text-sm text-gray-900 mt-1">{receivingReport.toLocation}</p>
                </div>
              )}
              {receivingReport.class && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Class</p>
                  <p className="text-sm text-gray-900 mt-1">{receivingReport.class}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-500">Department</p>
                <p className="text-sm text-gray-900 mt-1">{receivingReport.department}</p>
              </div>
              {receivingReport.subsidiary && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Subsidiary</p>
                  <p className="text-sm text-gray-900 mt-1">{receivingReport.subsidiary}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-500">Exchange Rate</p>
                <p className="text-sm text-gray-900 mt-1">{receivingReport.exchangeRate || 1.00}</p>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Items</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Description
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Unit
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Rate
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Currency
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {receivingReport.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                        {item.item}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {item.description}
                      </td>
                      <td className="px-4 py-4 text-sm text-center text-gray-900">
                        {item.receivedQuantity}
                      </td>
                      <td className="px-4 py-4 text-sm text-center text-gray-900">
                        {item.unit}
                      </td>
                      <td className="px-4 py-4 text-sm text-right text-gray-900">
                        ₱{formatCurrency(item.unitPrice)}
                      </td>
                      <td className="px-4 py-4 text-sm text-right text-gray-900">
                        {item.currency || 'PHP'}
                      </td>
                      <td className="px-4 py-4 text-sm text-right font-medium text-gray-900">
                        ₱{formatCurrency(item.totalPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-end">
              <div className="w-80">
                <div className="flex justify-between">
                  <span className="text-base font-bold text-gray-900">Total Amount:</span>
                  <span className="text-base font-bold text-purple-600">
                    ₱{formatCurrency(receivingReport.totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Receiver Information */}
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Receiver Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Received By</p>
                <p className="text-sm text-gray-900 mt-1">{receivingReport.receivedByName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Created At</p>
                <p className="text-sm text-gray-900 mt-1">
                  {new Date(receivingReport.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
            {receivingReport.deliveryNotes && (
              <div className="col-span-3 mt-4">
                <p className="text-sm font-medium text-gray-500">Delivery Notes</p>
                <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">
                  {receivingReport.deliveryNotes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Print Styles */}
        <style jsx global>{`
          @media print {
            @page {
              size: A4;
              margin: 5mm 8mm;
            }

            /* Hide elements that shouldn't be printed */
            .no-print {
              display: none !important;
            }
            
            /* Hide navigation and other UI elements */
            nav, header, footer, .print-hide {
              display: none !important;
            }
            
            /* Reset layout for print */
            body {
              margin: 0;
              padding: 0;
              font-size: 9pt;
              background: white !important;
              color: black !important;
              line-height: 1.3 !important;
            }
            
            /* Allow background colors/graphics */
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            /* Main container adjustments */
            .max-w-7xl {
              max-width: 100% !important;
              padding: 0 !important;
              margin: 0 !important;
            }

            /* Card adjustments */
            .bg-white {
              box-shadow: none !important;
              border-radius: 0 !important;
            }

            /* Minimize all padding */
            .py-8, .px-4, .sm\\:px-6, .lg\\:px-8 {
              padding: 0 !important;
            }

            /* Table optimizations */
            table {
              width: 100% !important;
              border-collapse: collapse !important;
              font-size: 8.5pt !important;
              margin: 0 !important;
            }
            
            tbody tr {
              border-bottom: 0.5pt solid #e5e7eb !important;
            }
            
            th {
              background-color: #f3f4f6 !important; 
              color: #4b5563 !important;
              font-weight: bold !important;
              border-bottom: 1pt solid #d1d5db !important;
              padding: 3pt 4pt !important;
              font-size: 8.5pt !important;
            }

            td {
              padding: 3pt 4pt !important;
              font-size: 8.5pt !important;
            }

            /* Typography - slightly bigger */
            h1 { 
              font-size: 16pt !important; 
              margin: 0 0 2pt 0 !important;
              line-height: 1.1 !important;
            }
            h2 { 
              font-size: 11pt !important; 
              margin: 5pt 0 3pt 0 !important;
              color: #111827 !important;
              font-weight: 600 !important;
            }

            p, label {
              font-size: 9pt !important;
              line-height: 1.3 !important;
              margin: 0 !important;
            }
            
            /* Action buttons should be hidden */
            button {
              display: none !important;
            }
            
            /* Sections - minimal spacing */
            .border-b {
              border-bottom: 0.5pt solid #e5e7eb !important;
            }

            /* Grid layouts */
            .grid {
              display: grid !important;
              gap: 4pt !important;
            }

            .grid-cols-1, .sm\\:grid-cols-3, .md\\:grid-cols-3, .grid-cols-3 {
              grid-template-columns: repeat(3, 1fr) !important;
            }

            .col-span-3 {
              grid-column: span 3 !important;
            }

            /* Reduce padding but keep it readable */
            .p-6, .p-4 {
              padding: 5pt 8pt !important;
            }

            .mb-4, .mt-4, .mb-6, .mt-6 {
              margin-bottom: 3pt !important;
              margin-top: 3pt !important;
            }

            .gap-4 {
              gap: 4pt !important;
            }

            .mt-1 {
              margin-top: 1.5pt !important;
            }

            /* Print-only header */
            .bg-gray-50 {
              background: white !important;
            }

            /* Add document title for print - compact but visible */
            .bg-white.rounded-lg:first-of-type::before {
              content: "RECEIVING REPORT";
              display: block;
              text-align: center;
              font-size: 15pt;
              font-weight: bold;
              color: #7c3aed;
              margin-bottom: 3pt;
              padding-bottom: 2pt;
              border-bottom: 1.5pt solid #7c3aed;
            }

            /* Hide optional sections if empty to save space */
            .overflow-hidden {
              overflow: visible !important;
            }

            /* Readable text fields */
            .text-sm {
              font-size: 8.5pt !important;
            }

            .text-xs {
              font-size: 7.5pt !important;
            }

            .text-base {
              font-size: 9pt !important;
            }

            .text-lg {
              font-size: 10pt !important;
            }

            /* Remove extra space from overflow containers */
            .overflow-x-auto {
              overflow: visible !important;
            }

            /* Financial summary */
            .w-80 {
              width: 40% !important;
            }

            /* Status badges */
            .rounded-full {
              padding: 2pt 6pt !important;
              font-size: 8pt !important;
            }

            /* Font weight adjustments for better readability */
            .font-medium {
              font-weight: 500 !important;
            }

            .font-semibold {
              font-weight: 600 !important;
            }

            .font-bold {
              font-weight: 700 !important;
            }
          }
        `}</style>
      </div>

      {/* Voucher Modal */}
      {showVoucher && receivingReport && (
        <VoucherModal
          receivingReport={receivingReport}
          onClose={() => setShowVoucher(false)}
        />
      )}
    </div>
  );
}
