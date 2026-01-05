'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ServiceRequest, JobOrder, PurchaseOrder } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import NotificationBell from '@/components/NotificationBell';
import SettingsMenu from '@/components/SettingsMenu';
import JobOrderForm from '@/components/JobOrderForm';
import { useToast } from '@/components/ToastContainer';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function RequesterDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [jobOrders, setJobOrders] = useState<JobOrder[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedSR, setSelectedSR] = useState<ServiceRequest | null>(null);
  const [sortBy, setSortBy] = useState<string>('newest');
  const toast = useToast();

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchServiceRequests(true);
      fetchRelatedData();
    }
  }, [user]);

  const fetchRelatedData = async () => {
    try {
      // Fetch Job Orders and Purchase Orders
      const [joRes, poRes] = await Promise.all([
        fetch('/api/job-orders'),
        fetch('/api/purchase-orders'),
      ]);

      if (joRes.ok) {
        const joData = await joRes.json();
        const normalizedJOs = (joData.jobOrders || []).map((jo: any) => ({
          ...jo,
          id: jo._id?.toString() || jo.id,
          srId: typeof jo.srId === 'object' ? jo.srId._id?.toString() || jo.srId.id : jo.srId,
        }));
        setJobOrders(normalizedJOs);
      }

      if (poRes.ok) {
        const poData = await poRes.json();
        const normalizedPOs = (poData.purchaseOrders || []).map((po: any) => ({
          ...po,
          id: po._id?.toString() || po.id,
          srId: typeof po.srId === 'object' ? po.srId._id?.toString() || po.srId.id : po.srId,
        }));
        setPurchaseOrders(normalizedPOs);
      }
    } catch (error) {
      console.error('Error fetching related data:', error);
    }
  };

  // Reset and reload when search query changes
  useEffect(() => {
    if (user && searchQuery === '') {
      fetchServiceRequests(true);
    }
  }, [searchQuery]);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        // Redirect if user is not a requester
        if (data.user.role !== 'REQUESTER') {
          if (['ADMIN', 'APPROVER', 'SUPER_ADMIN'].includes(data.user.role)) {
            router.replace('/dashboard/admin');
          } else {
            router.replace('/login');
          }
          return;
        }
        setUser(data.user);
      } else {
        router.replace('/login');
      }
    } catch (error) {
      router.replace('/login');
    }
  };

  const fetchServiceRequests = async (reset = false) => {
    try {
      if (reset) {
        setSkip(0);
        setServiceRequests([]);
        setHasMore(true);
      }

      const currentSkip = reset ? 0 : skip;
      const response = await fetch(`/api/service-requests?limit=9&skip=${currentSkip}&excludeHasJO=false`);
      if (response.ok) {
        const data = await response.json();
        // Filter to show only requester's own requests
        // Use case-insensitive matching and trim whitespace for better matching
        const userRequests = (data.serviceRequests || []).filter((sr: any) => {
          const srRequestedBy = (sr.requestedBy || '').trim().toLowerCase();
          const srContactEmail = (sr.contactEmail || '').trim().toLowerCase();
          const srDepartment = (sr.department || '').trim().toLowerCase();
          const userName = (user?.name || '').trim().toLowerCase();
          const userEmail = (user?.email || '').trim().toLowerCase();
          const userDepartment = (user?.department || '').trim().toLowerCase();

          // Match by name, email, or if the SR department matches the user's department
          // (for cases where users in a department can see all department requests)
          return srRequestedBy === userName ||
            srContactEmail === userEmail ||
            srRequestedBy.includes(userName) ||
            userName.includes(srRequestedBy) ||
            (userDepartment && srDepartment === userDepartment);
        });
        // Normalize MongoDB _id
        const normalized = userRequests.map((sr: any) => ({
          ...sr,
          id: sr._id?.toString() || sr.id,
        }));

        if (reset) {
          setServiceRequests(normalized);
        } else {
          // Only append if we have new items and they're not duplicates
          setServiceRequests(prev => {
            const existingIds = new Set(prev.map(sr => sr.id || sr._id?.toString()));
            const newItems = normalized.filter((sr: ServiceRequest) => !existingIds.has(sr.id || sr._id?.toString()));
            return [...prev, ...newItems];
          });
        }

        // Use actual fetched count from API for pagination, not filtered count
        const fetchedCount = data.serviceRequests?.length || 0;
        setHasMore(data.hasMore && fetchedCount === 9);
        setSkip(currentSkip + fetchedCount);

        // Refresh related data when service requests are fetched
        if (reset) {
          fetchRelatedData();
        }
      }
    } catch (error) {
      console.error('Error fetching service requests:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || searchQuery.trim()) return;
    setLoadingMore(true);
    try {
      const currentSkip = skip;
      const response = await fetch(`/api/service-requests?limit=9&skip=${currentSkip}&excludeHasJO=false`);

      if (response.ok) {
        const data = await response.json();
        // Filter to show only requester's own requests
        const userRequests = (data.serviceRequests || []).filter((sr: any) => {
          const srRequestedBy = (sr.requestedBy || '').trim().toLowerCase();
          const srContactEmail = (sr.contactEmail || '').trim().toLowerCase();
          const srDepartment = (sr.department || '').trim().toLowerCase();
          const userName = (user?.name || '').trim().toLowerCase();
          const userEmail = (user?.email || '').trim().toLowerCase();
          const userDepartment = (user?.department || '').trim().toLowerCase();

          return srRequestedBy === userName ||
            srContactEmail === userEmail ||
            srRequestedBy.includes(userName) ||
            userName.includes(srRequestedBy) ||
            (userDepartment && srDepartment === userDepartment);
        });

        // Normalize MongoDB _id
        const normalized = userRequests.map((sr: any) => ({
          ...sr,
          id: sr._id?.toString() || sr.id,
        }));

        // Always append new items (never replace)
        setServiceRequests(prev => {
          const existingIds = new Set(prev.map(sr => sr.id || sr._id?.toString()));
          const newItems = normalized.filter((sr: ServiceRequest) => !existingIds.has(sr.id || sr._id?.toString()));
          return [...prev, ...newItems];
        });

        // Update pagination state
        const fetchedCount = data.serviceRequests?.length || 0;
        setHasMore(data.hasMore && fetchedCount === 9);
        setSkip(currentSkip + fetchedCount);
      }
    } catch (error) {
      console.error('Error loading more service requests:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Handle scroll for infinite loading
  useEffect(() => {
    if (!hasMore || loadingMore || searchQuery.trim()) return;

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
          loadMore();
        }
      }, 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [hasMore, loadingMore, searchQuery, skip, user]);

  // Handle creating a Job Order
  const handleCreateJO = (srId: string) => {
    const sr = serviceRequests.find(s => s.id === srId || s._id === srId);
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
        // Refresh data to update the hasJO check
        await fetchRelatedData();

        toast.showSuccess(`Job Order ${result.jobOrder.joNumber} created successfully!`);
      } else {
        const error = await response.json();
        toast.showError(error.error || 'Failed to create Job Order');
      }
    } catch (error) {
      console.error('Error creating Job Order:', error);
      toast.showError('Failed to create Job Order');
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

  // Show loading until user is confirmed
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="78" speed="1.4" color="#3b82f6" />
      </div>
    );
  }

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
                <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 truncate">Requester Dashboard</h1>
                <p className="text-xs sm:text-sm text-gray-600 mt-1 truncate">
                  Welcome, {user?.name} ({user?.department || 'No Department'})
                </p>
              </div>
            </div>
            <div className="flex gap-2 sm:gap-3 items-center flex-shrink-0">
              <NotificationBell />
              <Link
                href="/service-requests/new"
                className="bg-purple-600 text-white px-2 sm:px-3 md:px-4 py-2 rounded-md hover:bg-purple-700 transition-colors font-medium text-xs sm:text-sm md:text-base whitespace-nowrap"
              >
                <span className="hidden md:inline">+ New Service Request</span>
                <span className="hidden sm:inline md:hidden">+ New Request</span>
                <span className="sm:hidden">+ New</span>
              </Link>
              <SettingsMenu userRole={user?.role} />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Create Job Order Form Modal */}
        {showCreateForm && selectedSR && (
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Create Job Order (Material Requisition) from {selectedSR.srNumber}
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

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm font-medium text-gray-500">Total Requests</div>
            <div className="text-3xl font-bold text-gray-900 mt-2">{serviceRequests.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm font-medium text-gray-500">Pending</div>
            <div className="text-3xl font-bold text-yellow-600 mt-2">
              {serviceRequests.filter(sr => sr.status === 'SUBMITTED').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm font-medium text-gray-500">Approved</div>
            <div className="text-3xl font-bold text-green-600 mt-2">
              {serviceRequests.filter(sr => sr.status === 'APPROVED').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm font-medium text-gray-500">Rejected</div>
            <div className="text-3xl font-bold text-red-600 mt-2">
              {serviceRequests.filter(sr => sr.status === 'REJECTED').length}
            </div>
          </div>
        </div>

        {/* Service Requests List */}
        <div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">My Service Requests</h2>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
              >
                <option value="newest">Date: Newest First</option>
                <option value="oldest">Date: Oldest First</option>
                <option value="status">Status</option>
                <option value="priority">Priority</option>
                <option value="srNumber">SR Number</option>
              </select>
              {/* Search Bar */}
              <div className="w-full sm:w-auto sm:min-w-[250px]">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search service requests..."
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
            </div>
          </div>
          {(() => {
            // Filter first
            let filteredSRs = searchQuery.trim()
              ? serviceRequests.filter((sr) => {
                const query = searchQuery.toLowerCase().trim();
                return (
                  sr.srNumber?.toLowerCase().includes(query) ||
                  sr.department?.toLowerCase().includes(query) ||
                  sr.serviceCategory?.toLowerCase().includes(query) ||
                  sr.workDescription?.toLowerCase().includes(query) ||
                  sr.briefSubject?.toLowerCase().includes(query) ||
                  sr.status?.toLowerCase().includes(query) ||
                  sr.priority?.toLowerCase().includes(query)
                );
              })
              : [...serviceRequests];

            // Then sort
            const priorityOrder: Record<string, number> = { 'URGENT': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
            const statusOrder: Record<string, number> = { 'SUBMITTED': 0, 'APPROVED': 1, 'REJECTED': 2, 'DRAFT': 3 };

            filteredSRs.sort((a, b) => {
              switch (sortBy) {
                case 'newest':
                  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                case 'oldest':
                  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                case 'status':
                  return (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
                case 'priority':
                  return (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
                case 'srNumber':
                  return (a.srNumber || '').localeCompare(b.srNumber || '');
                default:
                  return 0;
              }
            });

            return filteredSRs.length > 0 ? (
              <>
                <div className="columns-1 md:columns-2 lg:columns-3 gap-4 sm:gap-6">
                  {filteredSRs.map((sr) => (
                    <div key={sr.id || sr._id} className="break-inside-avoid mb-4 sm:mb-6">
                      <Link href={`/service-requests/${sr.id || sr._id}`}>
                        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">{sr.srNumber}</h3>
                              <p className="text-sm text-gray-500 mt-1">{sr.department}</p>
                            </div>
                            <StatusBadge status={sr.status} type="sr" />
                          </div>

                          <div className="space-y-2 mb-4">
                            <p className="text-sm">
                              <span className="font-medium text-gray-700">Category:</span>{' '}
                              <span className="text-gray-600">{sr.serviceCategory}</span>
                            </p>
                            <p className="text-sm">
                              <span className="font-medium text-gray-700">Priority:</span>{' '}
                              <span className="text-gray-600">{sr.priority}</span>
                            </p>
                            <p className="text-sm text-gray-600 line-clamp-2">{sr.briefSubject || sr.workDescription}</p>
                          </div>

                          {/* Related Job Orders and Purchase Orders */}
                          {(() => {
                            const srId = sr.id || sr._id;
                            const relatedJOs = jobOrders.filter(jo => jo.srId === srId);
                            const relatedPOs = purchaseOrders.filter(po => po.srId === srId);

                            if (relatedJOs.length === 0 && relatedPOs.length === 0) {
                              return null;
                            }

                            return (
                              <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                                {relatedJOs.length > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-gray-700 mb-1">Related Job Orders:</p>
                                    <div className="space-y-1">
                                      {relatedJOs.map((jo) => (
                                        <div
                                          key={jo.id || jo._id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            router.push(`/job-orders/${jo.id || jo._id}`);
                                          }}
                                          className="flex items-center justify-between text-xs bg-blue-50 hover:bg-blue-100 rounded px-2 py-1 transition-colors cursor-pointer"
                                        >
                                          <span className="text-blue-700 font-medium">{jo.joNumber}</span>
                                          <div className="flex items-center gap-2">
                                            {jo.type && (
                                              <span className={`text-xs px-1.5 py-0.5 rounded ${jo.type === 'SERVICE'
                                                ? 'bg-blue-100 text-blue-800'
                                                : 'bg-purple-100 text-purple-800'
                                                }`}>
                                                {jo.type === 'SERVICE' ? 'Service' : 'Material'}
                                              </span>
                                            )}
                                            <StatusBadge status={jo.status} type="jo" />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {relatedPOs.length > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-gray-700 mb-1">Related Purchase Orders:</p>
                                    <div className="space-y-1">
                                      {relatedPOs.map((po) => (
                                        <div
                                          key={po.id || po._id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            router.push(`/purchase-orders/${po.id || po._id}`);
                                          }}
                                          className="flex items-center justify-between text-xs bg-green-50 hover:bg-green-100 rounded px-2 py-1 transition-colors cursor-pointer"
                                        >
                                          <span className="text-green-700 font-medium">{po.poNumber}</span>
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-600">₱{po.totalAmount?.toLocaleString() || '0'}</span>
                                            <StatusBadge status={po.status} type="po" />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Create Job Order Button - Show for APPROVED SRs without a JO */}
                          {(() => {
                            const srId = sr.id || sr._id;
                            const hasJO = jobOrders.some(jo => jo.srId === srId);

                            if (sr.status === 'APPROVED' && !hasJO) {
                              return (
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md mb-3">
                                    <p className="text-xs text-blue-700 font-medium">✓ Your request has been approved! You can now create a Material Requisition Job Order.</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleCreateJO(srId || '');
                                    }}
                                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                                  >
                                    Create Job Order (Material Requisition)
                                  </button>
                                </div>
                              );
                            }
                            return null;
                          })()}

                          <div className="text-xs text-gray-500 mt-4 pt-4 border-t">
                            Created: {new Date(sr.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
                {/* Loading indicator for infinite scroll */}
                {!searchQuery && hasMore && (
                  <div className="mt-6 text-center">
                    {loadingMore ? (
                      <div className="flex items-center justify-center gap-2 text-gray-500">
                        <LoadingSpinner size="30" speed="1.4" color="#6b7280" />
                        <span>Loading more...</span>
                      </div>
                    ) : (
                      <button
                        onClick={loadMore}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Load more
                      </button>
                    )}
                  </div>
                )}
                {!searchQuery && !hasMore && serviceRequests.length > 9 && (
                  <div className="mt-6 text-center text-gray-500 text-sm">
                    No more service requests to load
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                {searchQuery ? (
                  <p className="text-gray-500 mb-4">No service requests match your search criteria.</p>
                ) : (
                  <>
                    <p className="text-gray-500 mb-4">No service requests yet.</p>
                    <Link
                      href="/service-requests/new"
                      className="inline-block bg-purple-600 text-white px-6 py-2 rounded-md hover:bg-purple-700 transition-colors font-medium"
                    >
                      Create Your First Service Request
                    </Link>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      </main>
    </div>
  );
}

