'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ReceivingReport } from '@/types';
import ReceivingReportCard from '@/components/ReceivingReportCard';
import { useToast } from '@/components/ToastContainer';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function ReceivingReportsPage() {
  const router = useRouter();
  const toast = useToast();
  const [user, setUser] = useState<any>(null);
  const [receivingReports, setReceivingReports] = useState<ReceivingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      fetchReceivingReports();
    }
  }, [user, statusFilter]);

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

  const fetchReceivingReports = async () => {
    try {
      let url = '/api/receiving-reports';
      if (statusFilter !== 'ALL') {
        url += `?status=${statusFilter}`;
      }
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setReceivingReports(data.receivingReports);
      } else {
        toast.showError('Failed to fetch receiving reports');
      }
    } catch (error) {
      toast.showError('Error fetching receiving reports');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="78" speed="1.4" color="#9333ea" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Receiving Reports</h1>
              <p className="text-sm text-gray-500 mt-1">
                Track and manage receiving reports
              </p>
            </div>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              Back
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              statusFilter === 'ALL'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('DRAFT')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              statusFilter === 'DRAFT'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Draft
          </button>
          <button
            onClick={() => setStatusFilter('SUBMITTED')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              statusFilter === 'SUBMITTED'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Submitted
          </button>
          <button
            onClick={() => setStatusFilter('COMPLETED')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              statusFilter === 'COMPLETED'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Completed
          </button>
        </div>

        {/* Receiving Reports Grid */}
        {receivingReports.length > 0 ? (
          <div className="columns-1 md:columns-2 lg:columns-3 gap-6">
            {receivingReports.map((rr) => (
              <ReceivingReportCard
                key={rr.id || rr._id}
                receivingReport={rr}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
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
            <h3 className="mt-2 text-sm font-medium text-gray-900">No Receiving Reports</h3>
            <p className="mt-1 text-sm text-gray-500">
              {statusFilter === 'ALL'
                ? 'No receiving reports have been created yet.'
                : `No ${statusFilter.toLowerCase()} receiving reports found.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
