'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ServiceRequest, JobOrder } from '@/types';
import ServiceRequestCard from '@/components/ServiceRequestCard';
import JobOrderCard from '@/components/JobOrderCard';
import JobOrderForm from '@/components/JobOrderForm';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [jobOrders, setJobOrders] = useState<JobOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sr' | 'jo'>('jo');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedSR, setSelectedSR] = useState<ServiceRequest | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        // Redirect to appropriate dashboard
        if (data.user.role === 'REQUESTER') {
          router.push('/dashboard/requester');
        } else if (['ADMIN', 'APPROVER', 'SUPER_ADMIN'].includes(data.user.role)) {
          router.push('/dashboard/admin');
        }
      } else {
        router.push('/login');
      }
    } catch (error) {
      router.push('/login');
    }
  };

  const fetchData = async () => {
    try {
      const [srRes, joRes] = await Promise.all([
        fetch('/api/service-requests/approved'),
        fetch('/api/job-orders'),
      ]);
      
      const srData = await srRes.json();
      const joData = await joRes.json();
      
      // Normalize MongoDB _id to id
      const normalizedSRs = (srData.serviceRequests || []).map((sr: any) => ({
        ...sr,
        id: sr._id?.toString() || sr.id,
      }));
      
      const normalizedJOs = (joData.jobOrders || []).map((jo: any) => ({
        ...jo,
        id: jo._id?.toString() || jo.id,
        srId: typeof jo.srId === 'object' ? jo.srId._id?.toString() || jo.srId.id : jo.srId,
        serviceRequest: typeof jo.srId === 'object' ? {
          ...jo.srId,
          id: jo.srId._id?.toString() || jo.srId.id,
        } : jo.serviceRequest,
      }));
      
      setServiceRequests(normalizedSRs);
      setJobOrders(normalizedJOs);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateJO = (srId: string) => {
    const sr = serviceRequests.find(s => s.id === srId);
    if (sr) {
      setSelectedSR(sr);
      setShowCreateForm(true);
    }
  };

  const handleSubmitJO = async (data: {
    type: string;
    workDescription?: string;
    materials: any[];
    manpower: any;
    schedule: any[];
  }) => {
    if (!selectedSR) return;

    try {
      const response = await fetch('/api/job-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          srId: selectedSR.id || selectedSR._id,
          input: {
            type: data.type,
            workDescription: data.workDescription,
            materials: data.materials,
            manpower: data.manpower,
            schedule: data.schedule,
          },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setShowCreateForm(false);
        setSelectedSR(null);
        // Refresh data immediately to update the hasJO check
        await fetchData();
        setActiveTab('jo');
        
        // Show success message
        alert(`Job Order ${result.jobOrder.joNumber} created successfully!`);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create Job Order');
        // Refresh data even on error to ensure UI is up to date
        fetchData();
      }
    } catch (error) {
      console.error('Error creating Job Order:', error);
      alert('Failed to create Job Order');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-2 sm:gap-4">
              <img 
                src="/logo.png" 
                alt="ANJO WORLD" 
                className="h-12 w-12 sm:h-16 sm:w-16 object-contain"
              />
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Service Request System</h1>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">Job Order Management</p>
              </div>
            </div>
            <Link
              href="/service-requests/new"
              className="bg-purple-600 text-white px-4 sm:px-6 py-2 rounded-md hover:bg-purple-700 transition-colors font-medium text-sm sm:text-base w-full sm:w-auto text-center"
            >
              <span className="hidden sm:inline">+ New Service Request</span>
              <span className="sm:hidden">+ New Request</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('jo')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'jo'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Job Orders ({jobOrders.length})
              </button>
              <button
                onClick={() => setActiveTab('sr')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'sr'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Approved Service Requests ({serviceRequests.length})
              </button>
            </nav>
          </div>
        </div>

        {/* Create Job Order Form Modal */}
        {showCreateForm && selectedSR && (
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Create Job Order from {selectedSR.srNumber}
                </h2>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setSelectedSR(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              <JobOrderForm
                serviceRequest={selectedSR}
                onSubmit={handleSubmitJO}
                onCancel={() => {
                  setShowCreateForm(false);
                  setSelectedSR(null);
                }}
              />
            </div>
          </div>
        )}

        {/* Content */}
        {activeTab === 'jo' ? (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">Job Orders</h2>
            </div>
            {jobOrders.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {jobOrders.map((jo) => (
                  <JobOrderCard key={jo.id} jobOrder={jo} />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <p className="text-gray-500 mb-4">No Job Orders created yet.</p>
                <p className="text-sm text-gray-400">
                  Create a Job Order from an approved Service Request.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">Approved Service Requests</h2>
            </div>
            {serviceRequests.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {serviceRequests.map((sr) => {
                  const srId = sr.id || sr._id || '';
                  const srIdString = srId.toString();
                  const srIdMongo = sr._id?.toString() || srIdString;
                  
                  // More robust comparison - check both string and object formats
                  const hasJO = jobOrders.some(jo => {
                    // Check jo.srId in various formats
                    let joSrId: string = '';
                    if (typeof jo.srId === 'object' && jo.srId !== null) {
                      joSrId = (jo.srId as any)?._id?.toString() || (jo.srId as any)?.id?.toString() || '';
                    } else if (jo.srId) {
                      joSrId = jo.srId.toString();
                    }
                    
                    // Also check serviceRequest object if it exists
                    const joServiceRequestId = jo.serviceRequest?.id?.toString() || jo.serviceRequest?._id?.toString() || '';
                    
                    // Compare with all possible SR ID formats
                    return joSrId === srIdString || 
                           joSrId === srIdMongo || 
                           joSrId === sr._id?.toString() ||
                           joServiceRequestId === srIdString ||
                           joServiceRequestId === srIdMongo ||
                           joServiceRequestId === sr._id?.toString();
                  });
                  
                  // Show button if SR is APPROVED and no JO exists
                  const canCreateJO = sr.status === 'APPROVED' && !hasJO;
                  
                  return (
                    <div key={srId}>
                      <ServiceRequestCard
                        serviceRequest={sr}
                        showCreateJO={canCreateJO}
                        onCreateJO={handleCreateJO}
                      />
                      {hasJO && (
                        <div className="mt-2 text-sm text-gray-500 text-center">
                          Job Order already created
                        </div>
                      )}
                      {sr.status !== 'APPROVED' && (
                        <div className="mt-2 text-sm text-yellow-600 text-center">
                          Status: {sr.status} - Must be APPROVED to create Job Order
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <p className="text-gray-500">No approved Service Requests available.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
