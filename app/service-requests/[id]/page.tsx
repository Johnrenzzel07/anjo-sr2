'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ServiceRequest } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import ImageModal from '@/components/ImageModal';

interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: string;
  department?: string;
}

// Helper function to get priority badge styling
const getPriorityBadgeStyle = (priority: string) => {
  switch (priority.toUpperCase()) {
    case 'URGENT':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'HIGH':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'MEDIUM':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'LOW':
      return 'bg-green-100 text-green-800 border-green-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

export default function ServiceRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [serviceRequest, setServiceRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [existingJobOrder, setExistingJobOrder] = useState<{ id: string; joNumber: string } | null>(null);
  const [checkingJobOrder, setCheckingJobOrder] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New state for approval/rejection
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectComments, setRejectComments] = useState('');

  useEffect(() => {
    if (params.id) {
      fetchServiceRequest(params.id as string);
    }
    fetchCurrentUser();
  }, [params.id]);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

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

  const handleApprove = async () => {
    if (!currentUser || !serviceRequest) return;

    const confirmed = confirm('Are you sure you want to approve this Service Request?');
    if (!confirmed) return;

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/service-requests/${serviceRequest.id || serviceRequest._id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: currentUser.role,
          userId: currentUser.id,
          userName: currentUser.name,
          action: 'APPROVED',
          comments: '',
        }),
      });

      if (response.ok) {
        alert('Service Request approved successfully!');
        // Refresh the service request data
        await fetchServiceRequest(serviceRequest.id || serviceRequest._id || '');
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to approve service request'}`);
      }
    } catch (error) {
      console.error('Error approving service request:', error);
      alert('An error occurred while approving the service request');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!currentUser || !serviceRequest || !rejectComments.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/service-requests/${serviceRequest.id || serviceRequest._id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: currentUser.role,
          userId: currentUser.id,
          userName: currentUser.name,
          action: 'REJECTED',
          comments: rejectComments,
        }),
      });

      if (response.ok) {
        alert('Service Request rejected successfully!');
        setShowRejectModal(false);
        setRejectComments('');
        // Refresh the service request data
        await fetchServiceRequest(serviceRequest.id || serviceRequest._id || '');
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to reject service request'}`);
      }
    } catch (error) {
      console.error('Error rejecting service request:', error);
      alert('An error occurred while rejecting the service request');
    } finally {
      setIsProcessing(false);
    }
  };

  const canApprove = () => {
    if (!currentUser || !serviceRequest) return false;
    if (serviceRequest.status !== 'SUBMITTED') return false;

    const userRole = currentUser.role;
    const userDept = (currentUser.department || '').toLowerCase().replace(/\s+department$/, '').trim();
    const srDept = (serviceRequest.department || '').toLowerCase().replace(/\s+department$/, '').trim();

    // Allow SUPER_ADMIN, ADMIN, or APPROVER from the same department
    return (
      userRole === 'SUPER_ADMIN' ||
      userRole === 'ADMIN' ||
      (userRole === 'APPROVER' && userDept === srDept)
    );
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
        {/* Approve/Reject Section - Show when user can approve */}
        {canApprove() && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-md border-2 border-blue-200 p-6 mb-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="bg-blue-100 rounded-full p-2 mt-1">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-blue-900 mb-1">Approval Required</h3>
                  <p className="text-sm text-blue-700">
                    This Service Request is awaiting your approval. Please review the details below and take action.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleApprove}
                  disabled={isProcessing}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-semibold shadow-md text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Approve Request
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={isProcessing}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-semibold shadow-md text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Reject Request
                </button>
              </div>
            </div>
          </div>
        )}

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
            {serviceRequest.dateNeeded && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Date Needed</h3>
                <p className="text-gray-900">{new Date(serviceRequest.dateNeeded).toLocaleDateString()}</p>
              </div>
            )}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">Service Category</h3>
              <p className="text-gray-900">{serviceRequest.serviceCategory}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">Priority</h3>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${getPriorityBadgeStyle(serviceRequest.priority)}`}>
                {serviceRequest.priority}
              </span>
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

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Reject Service Request
                </h2>
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectComments('');
                  }}
                  className="text-white hover:text-red-100 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Please provide a reason for rejecting this Service Request. This will be sent to the requester.
              </p>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectComments}
                onChange={(e) => setRejectComments(e.target.value)}
                placeholder="Enter the reason for rejection..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all resize-none"
                rows={5}
                disabled={isProcessing}
              />
              {rejectComments.trim() === '' && (
                <p className="text-sm text-red-600 mt-2">* Rejection reason is required</p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 flex flex-col sm:flex-row gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectComments('');
                }}
                disabled={isProcessing}
                className="px-6 py-2.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={isProcessing || !rejectComments.trim()}
                className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Confirm Rejection
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

