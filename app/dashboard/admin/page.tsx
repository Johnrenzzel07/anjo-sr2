'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ServiceRequest, JobOrder, PurchaseOrder } from '@/types';
import ServiceRequestCard from '@/components/ServiceRequestCard';
import JobOrderCard from '@/components/JobOrderCard';
import JobOrderForm from '@/components/JobOrderForm';
import PurchaseOrderCard from '@/components/PurchaseOrderCard';
import StatusBadge from '@/components/StatusBadge';
import NotificationBell from '@/components/NotificationBell';
import SettingsMenu from '@/components/SettingsMenu';
import Link from 'next/link';

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [jobOrders, setJobOrders] = useState<JobOrder[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sr' | 'jo' | 'po' | 'approvals'>('sr');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedSR, setSelectedSR] = useState<ServiceRequest | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [srSkip, setSrSkip] = useState(0);
  const [srLoadingMore, setSrLoadingMore] = useState(false);
  const [srHasMore, setSrHasMore] = useState(true);

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchData(true);
    }
  }, [user, filterStatus]);

  // Reset when search query changes
  useEffect(() => {
    if (user && searchQuery === '' && activeTab === 'sr') {
      fetchData(true);
    }
  }, [searchQuery, activeTab]);

  const loadMoreSRs = async () => {
    if (srLoadingMore || !srHasMore || activeTab !== 'sr' || searchQuery.trim()) return;
    setSrLoadingMore(true);
    try {
      const currentSrSkip = srSkip;
      const statusParam = filterStatus !== 'all' ? `&status=${filterStatus}` : '';
      const deptParam = (user?.role === 'APPROVER' && user?.department) ? `&department=${encodeURIComponent(user.department)}` : '';
      
      const srRes = await fetch(`/api/service-requests?limit=9&skip=${currentSrSkip}${statusParam}${deptParam}`);
      const srData = await srRes.json();
      
      // Normalize data
      const normalizedSRs = (srData.serviceRequests || []).map((sr: any) => ({
        ...sr,
        id: sr._id?.toString() || sr.id,
      }));
      
      // Always append new items (never replace)
      setServiceRequests(prev => {
        const existingIds = new Set(prev.map(sr => sr.id || sr._id?.toString()));
        const newItems = normalizedSRs.filter(sr => !existingIds.has(sr.id || sr._id?.toString()));
        return [...prev, ...newItems];
      });
      
      // Update pagination state
      const fetchedCount = srData.serviceRequests?.length || 0;
      setSrHasMore(srData.hasMore && fetchedCount === 9);
      setSrSkip(currentSrSkip + fetchedCount);
    } catch (error) {
      console.error('Error loading more service requests:', error);
    } finally {
      setSrLoadingMore(false);
    }
  };

  // Handle scroll for infinite loading (only for SR tab without search)
  useEffect(() => {
    if (activeTab !== 'sr' || !srHasMore || srLoadingMore || searchQuery.trim()) return;

    let timeoutId: NodeJS.Timeout;
    const handleScroll = () => {
      // Debounce scroll events
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;

        // Load more when user is 200px from bottom
        if (scrollTop + windowHeight >= documentHeight - 200) {
          loadMoreSRs();
        }
      }, 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [srHasMore, srLoadingMore, activeTab, searchQuery, srSkip, filterStatus, user]);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        // Redirect if not admin/approver
        if (!['ADMIN', 'APPROVER', 'SUPER_ADMIN'].includes(data.user.role)) {
          router.push('/dashboard/requester');
        }
      } else {
        router.push('/login');
      }
    } catch (error) {
      router.push('/login');
    }
  };

  const fetchData = async (resetSR = false) => {
    try {
      if (resetSR) {
        setSrSkip(0);
        setServiceRequests([]);
        setSrHasMore(true);
      }
      
      const currentSrSkip = resetSR ? 0 : srSkip;
      // Include status and department filters in API call
      const statusParam = filterStatus !== 'all' ? `&status=${filterStatus}` : '';
      const deptParam = (user?.role === 'APPROVER' && user?.department) ? `&department=${encodeURIComponent(user.department)}` : '';
      const [srRes, joRes, poRes] = await Promise.all([
        fetch(`/api/service-requests?limit=9&skip=${currentSrSkip}${statusParam}${deptParam}`),
        fetch('/api/job-orders'),
        fetch('/api/purchase-orders'),
      ]);
      
      const srData = await srRes.json();
      const joData = await joRes.json();
      const poData = await poRes.json();
      
      // Normalize data (no need for client-side department filtering since it's done on server)
      const normalizedSRs = (srData.serviceRequests || []).map((sr: any) => ({
        ...sr,
        id: sr._id?.toString() || sr.id,
      }));
      
      // Append or replace based on reset flag
      if (resetSR) {
        setServiceRequests(normalizedSRs);
      } else {
        // Only append if we have new items and they're not duplicates
        setServiceRequests(prev => {
          const existingIds = new Set(prev.map(sr => sr.id || sr._id?.toString()));
          const newItems = normalizedSRs.filter(sr => !existingIds.has(sr.id || sr._id?.toString()));
          return [...prev, ...newItems];
        });
      }
      
      // Update pagination state based on actual fetched count (not filtered)
      const fetchedCount = srData.serviceRequests?.length || 0;
      setSrHasMore(srData.hasMore && fetchedCount === 9);
      setSrSkip(currentSrSkip + fetchedCount);
      
      // Filter Job Orders based on user role and department
      let jos = joData.jobOrders || [];
      if (user?.role === 'APPROVER' && user?.department) {
        const userDeptNorm = normalizeDept(user.department);
        // Special case: Operations head (Ina) should see ALL Job Orders (they manage execution)
        if (userDeptNorm !== 'operations') {
          // Other department heads only see JOs from their own department
          jos = jos.filter((jo: any) => normalizeDept(jo.department) === userDeptNorm);
        }
      }

      const normalizedJOs = jos.map((jo: any) => ({
        ...jo,
        id: jo._id?.toString() || jo.id,
        srId: typeof jo.srId === 'object' ? jo.srId._id?.toString() || jo.srId.id : jo.srId,
        serviceRequest: typeof jo.srId === 'object' ? {
          ...jo.srId,
          id: jo.srId._id?.toString() || jo.srId.id,
        } : jo.serviceRequest,
      }));

      // Filter Purchase Orders based on user role and department (for Approvers)
      let pos = poData.purchaseOrders || [];
      if (user?.role === 'APPROVER' && user?.department) {
        const userDeptNorm = normalizeDept(user.department);
        pos = pos.filter((po: any) => normalizeDept(po.department) === userDeptNorm);
      }

      const normalizedPOs = pos.map((po: any) => ({
        ...po,
        // Normalize only the top-level id; keep populated joId object so we can access joNumber
        id: po._id?.toString() || po.id,
        joId: po.joId, // may be populated object with joNumber and type
        srId: typeof po.srId === 'object' ? po.srId._id?.toString() || po.srId.id : po.srId,
      }));

      setServiceRequests(normalizedSRs);
      setJobOrders(normalizedJOs);
      setPurchaseOrders(normalizedPOs);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleApproveSR = async (srId: string) => {
    try {
      const response = await fetch(`/api/service-requests/${srId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      });

      if (response.ok) {
        fetchData();
      } else {
        alert('Failed to approve service request');
      }
    } catch (error) {
      console.error('Error approving SR:', error);
      alert('Failed to approve service request');
    }
  };

  const handleRejectSR = async (srId: string) => {
    try {
      const response = await fetch(`/api/service-requests/${srId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED' }),
      });

      if (response.ok) {
        fetchData();
      } else {
        alert('Failed to reject service request');
      }
    } catch (error) {
      console.error('Error rejecting SR:', error);
      alert('Failed to reject service request');
    }
  };

  const handleCreateJO = (srId: string) => {
    const sr = serviceRequests.find(s => (s.id || s._id) === srId);
    if (sr) {
      setSelectedSR(sr);
      setShowCreateForm(true);
    }
  };

  const handleSubmitJO = async (data: {
    workDescription?: string;
    materials: any[];
    manpower: any;
    schedule: any[];
    createMR?: boolean;
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

  const pendingSRs = serviceRequests.filter(sr => sr.status === 'SUBMITTED');
  const approvedSRs = serviceRequests.filter(sr => sr.status === 'APPROVED');
  const allJOs = jobOrders;
  const inProgressJOs = jobOrders.filter(jo => jo.status === 'IN_PROGRESS');
  const completedJOs = jobOrders.filter(jo => jo.status === 'COMPLETED');

  // Search filter functions
  const filterBySearch = (items: any[], type: 'sr' | 'jo' | 'po') => {
    if (!searchQuery.trim()) return items;
    
    const query = searchQuery.toLowerCase().trim();
    return items.filter((item) => {
      if (type === 'sr') {
        return (
          item.srNumber?.toLowerCase().includes(query) ||
          item.department?.toLowerCase().includes(query) ||
          item.serviceCategory?.toLowerCase().includes(query) ||
          item.workDescription?.toLowerCase().includes(query) ||
          item.briefSubject?.toLowerCase().includes(query) ||
          item.requestedBy?.toLowerCase().includes(query) ||
          item.status?.toLowerCase().includes(query) ||
          item.priority?.toLowerCase().includes(query)
        );
      } else if (type === 'jo') {
        return (
          item.joNumber?.toLowerCase().includes(query) ||
          item.department?.toLowerCase().includes(query) ||
          item.serviceCategory?.toLowerCase().includes(query) ||
          item.workDescription?.toLowerCase().includes(query) ||
          item.status?.toLowerCase().includes(query) ||
          item.priorityLevel?.toLowerCase().includes(query) ||
          item.serviceRequest?.srNumber?.toLowerCase().includes(query)
        );
      } else if (type === 'po') {
        return (
          item.poNumber?.toLowerCase().includes(query) ||
          item.department?.toLowerCase().includes(query) ||
          item.status?.toLowerCase().includes(query) ||
          item.supplierName?.toLowerCase().includes(query) ||
          item.jobOrder?.joNumber?.toLowerCase().includes(query)
        );
      }
      return false;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <img 
                src="/logo.png" 
                alt="ANJO WORLD" 
                className="h-10 w-10 sm:h-12 sm:w-12 md:h-16 md:w-16 object-contain flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
                  {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'} Dashboard
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 mt-1 truncate">
                  {user?.name} ({user?.department || user?.role})
                </p>
              </div>
            </div>
            <div className="flex gap-2 sm:gap-3 items-center flex-shrink-0">
              <NotificationBell />
              <SettingsMenu userRole={user?.role} />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm font-medium text-gray-500">Pending Requests</div>
            <div className="text-3xl font-bold text-yellow-600 mt-2">{pendingSRs.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm font-medium text-gray-500">Approved Requests</div>
            <div className="text-3xl font-bold text-green-600 mt-2">{approvedSRs.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm font-medium text-gray-500">Job Orders</div>
            <div className="text-3xl font-bold text-blue-600 mt-2">{allJOs.length}</div>
            <div className="text-xs text-gray-500 mt-1">
              {inProgressJOs.length} in progress, {completedJOs.length} completed
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm font-medium text-gray-500">Purchase Orders</div>
            <div className="text-3xl font-bold text-purple-600 mt-2">{purchaseOrders.length}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
              <button
                onClick={() => setActiveTab('sr')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'sr'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Service Requests ({serviceRequests.length})
              </button>
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
                onClick={() => setActiveTab('po')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'po'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Purchase Orders ({purchaseOrders.length})
              </button>
            </nav>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          {/* Search Bar */}
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder={`Search ${activeTab === 'sr' ? 'Service Requests' : activeTab === 'jo' ? 'Job Orders' : 'Purchase Orders'}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          {/* Status Filter */}
          {activeTab === 'sr' && (
            <div className="sm:w-auto">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
              >
                <option value="all">All Status</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="DRAFT">Draft</option>
              </select>
            </div>
          )}
        </div>

        {/* Content */}
        {activeTab === 'sr' && (
          <div>
            {(() => {
              // Status filter is now applied on server-side, so we only need to filter by search
              let filteredSRs = filterBySearch(serviceRequests, 'sr');
              
              return filteredSRs.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {filteredSRs.map((sr) => {
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
                        currentUser={user}
                        onApprovalUpdate={fetchData}
                      />
                      {hasJO && (
                        <div className="mt-2 text-sm text-green-600 text-center">
                          ✓ Job Order already created
                        </div>
                      )}
                    </div>
                  );
                    })}
                  </div>
                  {/* Loading indicator for infinite scroll */}
                  {!searchQuery && srHasMore && (
                    <div className="mt-6 text-center">
                      {srLoadingMore ? (
                        <div className="flex items-center justify-center gap-2 text-gray-500">
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Loading more...</span>
                        </div>
                      ) : (
                        <button
                          onClick={loadMoreSRs}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Load more
                        </button>
                      )}
                    </div>
                  )}
                  {!searchQuery && !srHasMore && serviceRequests.length > 9 && (
                    <div className="mt-6 text-center text-gray-500 text-sm">
                      No more service requests to load
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-white rounded-lg shadow-md p-12 text-center">
                  <p className="text-gray-500">
                    {searchQuery || filterStatus !== 'all' 
                      ? 'No service requests match your search criteria.' 
                      : 'No service requests found.'}
                  </p>
                </div>
              );
            })()}
          </div>
        )}
        {activeTab === 'jo' && (
          <div>
            {(() => {
              const filteredJOs = filterBySearch(jobOrders, 'jo');
              
              return filteredJOs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {filteredJOs.map((jo) => (
                    <JobOrderCard key={jo.id || jo._id} jobOrder={jo} />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-md p-12 text-center">
                  <p className="text-gray-500">
                    {searchQuery 
                      ? 'No job orders match your search criteria.' 
                      : 'No job orders found.'}
                  </p>
                </div>
              );
            })()}
          </div>
        )}
        {activeTab === 'po' && (
          <div>
            {(() => {
              const filteredPOs = filterBySearch(purchaseOrders, 'po');
              
              return filteredPOs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {filteredPOs.map((po) => (
                    <PurchaseOrderCard key={po.id || po._id} purchaseOrder={po} />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-md p-12 text-center">
                  <p className="text-gray-500">
                    {searchQuery 
                      ? 'No purchase orders match your search criteria.' 
                      : 'No purchase orders found.'}
                  </p>
                </div>
              );
            })()}
          </div>
        )}

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
                  className="text-gray-400 hover:text-gray-600 text-2xl"
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
      </main>
    </div>
  );
}

