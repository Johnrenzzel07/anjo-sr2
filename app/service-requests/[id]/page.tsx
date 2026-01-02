'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ServiceRequest } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function ServiceRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [serviceRequest, setServiceRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchServiceRequest(params.id as string);
    }
  }, [params.id]);

  const fetchServiceRequest = async (id: string) => {
    try {
      const response = await fetch(`/api/service-requests/${id}`);
      if (response.ok) {
        const data = await response.json();
        // Convert MongoDB _id to id for consistency
        const sr = data.serviceRequest;
        if (sr._id && !sr.id) {
          sr.id = sr._id.toString();
        }
        setServiceRequest(sr);
        
        // Mark related notifications as read
        try {
          await fetch('/api/notifications/mark-read-by-entity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              relatedEntityType: 'SERVICE_REQUEST',
              relatedEntityId: sr.id || sr._id?.toString(),
            }),
          });
        } catch (notifError) {
          console.error('Error marking notifications as read:', notifError);
        }
      } else {
        console.error('Failed to fetch Service Request');
      }
    } catch (error) {
      console.error('Error fetching Service Request:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="78" speed="1.4" color="#3b82f6" />
      </div>
    );
  }

  if (!serviceRequest) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Service Request not found</p>
          <Link
            href="/dashboard/admin?tab=sr"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href="/dashboard/admin?tab=sr"
            className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div className="flex items-center gap-2 sm:gap-4">
              <img 
                src="/logo.png" 
                alt="ANJO WORLD" 
                className="h-10 w-10 sm:h-12 sm:w-12 object-contain"
              />
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Service Request Details</h1>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">{serviceRequest.srNumber}</p>
              </div>
            </div>
            <StatusBadge status={serviceRequest.status} type="sr" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">Requester Name</h3>
              <p className="text-gray-900">{serviceRequest.requestedBy}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">Department</h3>
              <p className="text-gray-900">{serviceRequest.department}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">Contact Email</h3>
              <p className="text-gray-900">{serviceRequest.contactEmail}</p>
            </div>
            {serviceRequest.contactPhone && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Contact Phone</h3>
                <p className="text-gray-900">{serviceRequest.contactPhone}</p>
              </div>
            )}
            {serviceRequest.dateOfRequest && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Date of Request</h3>
                <p className="text-gray-900">{new Date(serviceRequest.dateOfRequest).toLocaleDateString()}</p>
              </div>
            )}
            {serviceRequest.timeOfRequest && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Time</h3>
                <p className="text-gray-900">{serviceRequest.timeOfRequest}</p>
              </div>
            )}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">Service Category</h3>
              <p className="text-gray-900">{serviceRequest.serviceCategory}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">Priority</h3>
              <p className="text-gray-900">{serviceRequest.priority}</p>
            </div>
            <div className="col-span-2">
              <h3 className="text-sm font-medium text-gray-700 mb-1">Brief Subject / Summary</h3>
              <p className="text-gray-900">{serviceRequest.briefSubject}</p>
            </div>
            <div className="col-span-2">
              <h3 className="text-sm font-medium text-gray-700 mb-1">Detailed Description</h3>
              <p className="text-gray-900 whitespace-pre-wrap">{serviceRequest.workDescription}</p>
            </div>
            {serviceRequest.location && (
              <div className="col-span-2">
                <h3 className="text-sm font-medium text-gray-700 mb-1">Location</h3>
                <p className="text-gray-900">{serviceRequest.location}</p>
              </div>
            )}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">Status</h3>
              <StatusBadge status={serviceRequest.status} type="sr" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">Created At</h3>
              <p className="text-gray-900">{new Date(serviceRequest.createdAt).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

