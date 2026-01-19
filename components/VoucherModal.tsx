'use client';

import React from 'react';
import { ReceivingReport } from '@/types';

interface VoucherModalProps {
  receivingReport: ReceivingReport;
  onClose: () => void;
}

export default function VoucherModal({ receivingReport, onClose }: VoucherModalProps) {
  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden">
        <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white z-10">
            <div>
              <h2 className="text-xl font-semibold">{receivingReport.rrNumber}</h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Generate Voucher
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
          
          <div className="p-8" id="voucher-content">
            {/* Voucher content will be rendered here */}
            <div className="voucher-page bg-white">
              {/* Company Header */}
              <div className="text-center mb-6">
                <h1 className="text-xl font-bold">Cebu Belmont, Inc.: Anjo Global Sourcing Inc.</h1>
                <p className="text-sm">Calajo-an, Minglanilla</p>
                <p className="text-sm">CEBU 6046</p>
                <p className="text-sm">Philippines</p>
              </div>

              {/* Document Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm"><strong>Number:</strong> {receivingReport.rrNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm"><strong>Date:</strong> {new Date(receivingReport.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  <p className="text-sm"><strong>Terms:</strong> {receivingReport.memo || ''}</p>
                </div>
              </div>

              {/* Supplier Information */}
              <div className="mb-6 p-4 border border-gray-300">
                <p className="text-sm font-bold mb-2">Supplier Name:</p>
                <p className="text-sm">{receivingReport.supplierName}</p>
                {receivingReport.supplierAddress && (
                  <p className="text-sm">{receivingReport.supplierAddress}</p>
                )}
                {receivingReport.supplierContact && (
                  <p className="text-sm">{receivingReport.supplierContact}</p>
                )}
              </div>

              {/* Delivery Address */}
              <div className="mb-6 p-4 border border-gray-300">
                <p className="text-sm font-bold mb-2">Delivery Address:</p>
                <p className="text-sm">{receivingReport.toLocation || 'Calajo-an, Minglanilla'}</p>
                <p className="text-sm">CEBU 6046</p>
                <p className="text-sm">Philippines</p>
              </div>

              {/* Items Table */}
              <table className="w-full border-collapse border border-gray-400 mb-6">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-400 p-2 text-left text-sm">Item Description</th>
                    <th className="border border-gray-400 p-2 text-center text-sm">Quantity</th>
                    <th className="border border-gray-400 p-2 text-center text-sm">UOM</th>
                    <th className="border border-gray-400 p-2 text-center text-sm">Tax Inc</th>
                    <th className="border border-gray-400 p-2 text-right text-sm">Unit Price</th>
                    <th className="border border-gray-400 p-2 text-right text-sm">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {receivingReport.items.map((item, index) => (
                    <tr key={index}>
                      <td className="border border-gray-400 p-2 text-sm">{item.description || item.item}</td>
                      <td className="border border-gray-400 p-2 text-center text-sm">{item.receivedQuantity}</td>
                      <td className="border border-gray-400 p-2 text-center text-sm">{item.unit}</td>
                      <td className="border border-gray-400 p-2 text-center text-sm">0%</td>
                      <td className="border border-gray-400 p-2 text-right text-sm">{formatCurrency(item.unitPrice)}</td>
                      <td className="border border-gray-400 p-2 text-right text-sm">{formatCurrency(item.totalPrice)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="border border-gray-400 p-2 text-sm">Total</td>
                    <td className="border border-gray-400 p-2 text-center text-sm">
                      {receivingReport.items.reduce((sum, item) => sum + item.receivedQuantity, 0)}
                    </td>
                    <td className="border border-gray-400 p-2" colSpan={2}></td>
                    <td className="border border-gray-400 p-2 text-right text-sm">PHP</td>
                    <td className="border border-gray-400 p-2 text-right text-sm">
                      {formatCurrency(receivingReport.totalAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Remarks */}
              {receivingReport.deliveryNotes && (
                <div className="mb-8">
                  <p className="text-sm"><strong>Remarks:</strong> {receivingReport.deliveryNotes}</p>
                </div>
              )}

              {/* Signature Section */}
              <div className="grid grid-cols-1 gap-6 mt-12">
                <div>
                  <p className="text-sm mb-8">Purchasing In-charge</p>
                  <p className="text-sm">Prepared By _________________________</p>
                </div>
                <div>
                  <p className="text-sm mb-8">Accounting Officer _________________________</p>
                </div>
                <div>
                  <p className="text-sm mb-8">Noted By _________________________</p>
                  <p className="text-sm font-bold text-center">{receivingReport.receivedByName}</p>
                </div>
                <div>
                  <p className="text-sm mb-8">Approved BY _________________________</p>
                  <p className="text-sm text-center">____</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          
          #voucher-content,
          #voucher-content * {
            visibility: visible;
          }
          
          #voucher-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0.5in;
          }

          .voucher-page {
            width: 100%;
            max-width: 8.5in;
            margin: 0 auto;
            font-size: 10pt;
          }

          .voucher-page h1 {
            font-size: 14pt;
            margin-bottom: 4pt;
          }

          .voucher-page p {
            font-size: 9pt;
            line-height: 1.3;
            margin: 2pt 0;
          }

          .voucher-page table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9pt;
          }

          .voucher-page th,
          .voucher-page td {
            padding: 4pt;
            border: 1pt solid #000;
          }

          .voucher-page .grid {
            display: grid;
            gap: 8pt;
          }

          /* Hide modal chrome in print */
          .print\\:hidden {
            display: none !important;
          }

          /* Ensure proper page break */
          @page {
            margin: 0.5in;
            size: letter;
          }
        }
      `}</style>
    </>
  );
}
