'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ServiceRequest } from '@/types';
import JobOrderForm from '@/components/JobOrderForm';
import LoadingSpinner from '@/components/LoadingSpinner';
import Link from 'next/link';
import { useToast } from '@/components/ToastContainer';

export default function NewJobOrderPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const toast = useToast();
    const srId = searchParams.get('srId');

    const [serviceRequest, setServiceRequest] = useState<ServiceRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (srId) {
            fetchServiceRequest(srId);
        } else {
            setError('No Service Request ID provided');
            setLoading(false);
        }
    }, [srId]);

    const fetchServiceRequest = async (id: string) => {
        try {
            const response = await fetch(`/api/service-requests/${id}`);
            if (response.ok) {
                const data = await response.json();
                const sr = data.serviceRequest;
                if (sr._id && !sr.id) {
                    sr.id = sr._id.toString();
                }
                setServiceRequest(sr);
            } else {
                setError('Failed to fetch Service Request');
            }
        } catch (error) {
            console.error('Error fetching Service Request:', error);
            setError('Error loading Service Request');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (data: any) => {
        if (!serviceRequest) return;

        try {
            const response = await fetch('/api/job-orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    srId: serviceRequest.id || serviceRequest._id,
                    input: data,
                }),
            });

            if (response.ok) {
                const result = await response.json();
                toast.showSuccess('Job Order created successfully!');

                // Redirect to the job order detail page
                router.push(`/job-orders/${result.jobOrder._id || result.jobOrder.id}`);
            } else {
                const error = await response.json();
                toast.showError(error.error || 'Failed to create Job Order');
            }
        } catch (error) {
            console.error('Error creating Job Order:', error);
            toast.showError('Failed to create Job Order');
        }
    };

    const handleCancel = () => {
        if (srId) {
            router.push(`/service-requests/${srId}`);
        } else {
            router.push('/dashboard/admin?tab=sr');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <LoadingSpinner size="78" speed="1.4" color="#3b82f6" />
            </div>
        );
    }

    if (error || !serviceRequest) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-600 mb-4">{error || 'Service Request not found'}</p>
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
                        href={`/service-requests/${srId}`}
                        className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block"
                    >
                        ← Back to Service Request
                    </Link>
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div className="flex items-center gap-2 sm:gap-4">
                            <img
                                src="/logo.png"
                                alt="ANJO WORLD"
                                className="h-10 w-10 sm:h-12 sm:w-12 object-contain"
                            />
                            <div>
                                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Create Job Order</h1>
                                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                                    From Service Request: {serviceRequest.srNumber}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-2">Service Request Details</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-md">
                            <div>
                                <span className="font-medium text-gray-700">Requested By:</span>{' '}
                                <span className="text-gray-600">{serviceRequest.requestedBy}</span>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Department:</span>{' '}
                                <span className="text-gray-600">{serviceRequest.department}</span>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Category:</span>{' '}
                                <span className="text-gray-600">{serviceRequest.serviceCategory}</span>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Priority:</span>{' '}
                                <span className="text-gray-600">{serviceRequest.priority}</span>
                            </div>
                        </div>
                    </div>

                    <JobOrderForm
                        serviceRequest={serviceRequest}
                        onSubmit={handleSubmit}
                        onCancel={handleCancel}
                    />
                </div>
            </main>
        </div>
    );
}
