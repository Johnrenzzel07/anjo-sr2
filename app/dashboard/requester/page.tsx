'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ServiceRequest } from '@/types';
import ServiceRequestCard from '@/components/ServiceRequestCard';
import StatusBadge from '@/components/StatusBadge';
import NotificationBell from '@/components/NotificationBell';
import SettingsMenu from '@/components/SettingsMenu';
import Link from 'next/link';

export default function RequesterDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchServiceRequests(true);
    }
  }, [user]);

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
        setUser(data.user);
      } else {
        router.push('/login');
      }
    } catch (error) {
      router.push('/login');
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
      const response = await fetch(`/api/service-requests?limit=9&skip=${currentSkip}`);
      if (response.ok) {
        const data = await response.json();
        // Filter to show only requester's own requests
        // Use case-insensitive matching and trim whitespace for better matching
        const userRequests = (data.serviceRequests || []).filter((sr: any) => {
          const srRequestedBy = (sr.requestedBy || '').trim().toLowerCase();
          const srContactEmail = (sr.contactEmail || '').trim().toLowerCase();
          const userName = (user?.name || '').trim().toLowerCase();
          const userEmail = (user?.email || '').trim().toLowerCase();
          
          return srRequestedBy === userName || srContactEmail === userEmail;
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
      const response = await fetch(`/api/service-requests?limit=9&skip=${currentSkip}`);
      
      if (response.ok) {
        const data = await response.json();
        // Filter to show only requester's own requests
        const userRequests = (data.serviceRequests || []).filter((sr: any) => {
          const srRequestedBy = (sr.requestedBy || '').trim().toLowerCase();
          const srContactEmail = (sr.contactEmail || '').trim().toLowerCase();
          const userName = (user?.name || '').trim().toLowerCase();
          const userEmail = (user?.email || '').trim().toLowerCase();
          
          return srRequestedBy === userName || srContactEmail === userEmail;
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

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
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
            {/* Search Bar */}
            <div className="w-full sm:w-auto sm:min-w-[300px]">
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
          {(() => {
            const filteredSRs = searchQuery.trim() 
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
              : serviceRequests;
            
            return filteredSRs.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {filteredSRs.map((sr) => (
                <Link key={sr.id || sr._id} href={`/service-requests/${sr.id || sr._id}`}>
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

                    <div className="text-xs text-gray-500 mt-4 pt-4 border-t">
                      Created: {new Date(sr.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </Link>
                  ))}
                </div>
                {/* Loading indicator for infinite scroll */}
                {!searchQuery && hasMore && (
                  <div className="mt-6 text-center">
                    {loadingMore ? (
                      <div className="flex items-center justify-center gap-2 text-gray-500">
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
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

