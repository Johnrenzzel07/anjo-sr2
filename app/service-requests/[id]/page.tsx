'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ServiceRequest } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import ImageModal from '@/components/ImageModal';

export default function ServiceRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [serviceRequest, setServiceRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [existingJobOrder, setExistingJobOrder] = useState<{ id: string; joNumber: string } | null>(null);
  const [checkingJobOrder, setCheckingJobOrder] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

        // Check if job order exists for this SR
        if (sr.status === 'APPROVED') {
          await checkForExistingJobOrder(sr.id || sr._id);
        }

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

  const checkForExistingJobOrder = async (srId: string) => {
    setCheckingJobOrder(true);
    try {
      const response = await fetch(`/api/job-orders?srId=${srId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.jobOrders && data.jobOrders.length > 0) {
          const jo = data.jobOrders[0];
          setExistingJobOrder({
            id: jo._id || jo.id,
            joNumber: jo.joNumber,
          });
        }
      }
    } catch (error) {
      console.error('Error checking for existing job order:', error);
    } finally {
      setCheckingJobOrder(false);
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
        {/* Create Job Order Section - Show when SR is approved and check is complete */}
        {serviceRequest.status === 'APPROVED' && !checkingJobOrder && (
          existingJobOrder ? (
            // Job order already exists
            <div className="bg-white rounded-lg shadow-md border-2 border-green-200 p-6 mb-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="bg-green-100 rounded-full p-2 mt-1">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-green-900 mb-1">Job Order Already Created</h3>
                    <p className="text-sm text-green-700">
                      A job order has been created for this service request: <span className="font-semibold">{existingJobOrder.joNumber}</span>
                    </p>
                  </div>
                </div>
                <Link
                  href={`/job-orders/${existingJobOrder.id}`}
                  className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-semibold shadow-md text-base text-center"
                >
                  View Job Order
                </Link>
              </div>
            </div>
          ) : (
            // No job order exists, show create button
            <div className="bg-white rounded-lg shadow-md border-2 border-blue-200 p-6 mb-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 rounded-full p-2 mt-1">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-blue-900 mb-1">Ready for Job Order Creation</h3>
                    <p className="text-sm text-blue-700">You can now create a Job Order for this Service Request</p>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/job-orders/new?srId=${serviceRequest.id || serviceRequest._id}`)}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold shadow-md text-base"
                >
                  Create Job Order
                </button>
              </div>
            </div>
          )
        )}

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
            {serviceRequest.attachments && serviceRequest.attachments.length > 0 && (
              <div className="col-span-2 mt-8 pt-8 border-t border-gray-100">
                <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Photo Attachments ({serviceRequest.attachments.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {serviceRequest.attachments.map((url, idx) => (
                    <div key={idx} className="group relative">
                      <button
                        onClick={() => {
                          setSelectedImageUrl(url);
                          setIsModalOpen(true);
                        }}
                        className="w-full block aspect-video rounded-xl overflow-hidden border-2 border-gray-100 hover:border-blue-500 transition-all shadow-sm hover:shadow-md bg-gray-50 bg-[url('/logo.png')] bg-[length:40px_40px] bg-center bg-no-repeat text-left"
                      >
                        <img
                          src={url}
                          alt={`Attachment ${idx + 1}`}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <span className="bg-white/90 text-gray-900 px-3 py-1.5 rounded-full text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                            View Full Resolution
                          </span>
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <ImageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        imageUrl={selectedImageUrl || ''}
      />
    </div>
  );
}

