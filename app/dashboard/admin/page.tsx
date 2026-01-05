'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ServiceRequest, JobOrder, PurchaseOrder, JobOrderType } from '@/types';
import ServiceRequestCard from '@/components/ServiceRequestCard';
import JobOrderCard from '@/components/JobOrderCard';
import JobOrderForm from '@/components/JobOrderForm';
import PurchaseOrderCard from '@/components/PurchaseOrderCard';
import StatusBadge from '@/components/StatusBadge';
import NotificationBell from '@/components/NotificationBell';
import SettingsMenu from '@/components/SettingsMenu';
import Link from 'next/link';
import { useToast } from '@/components/ToastContainer';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function AdminDashboard() {
  const router = useRouter();
  const toast = useToast();

  // Helper to normalize department names (e.g., 'IT' vs 'IT Department')
  const normalizeDept = (dept: string | undefined) =>
    (dept || '').toLowerCase().replace(/\s+department$/, '').trim();

  const [user, setUser] = useState<any>(null);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [jobOrders, setJobOrders] = useState<JobOrder[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Get initial tab from URL query parameter, default to 'sr'
  const [activeTab, setActiveTab] = useState<'sr' | 'jo' | 'po' | 'approvals'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'sr' || tab === 'jo' || tab === 'po' || tab === 'approvals') {
        return tab;
      }
    }
    return 'sr';
  });
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterJOStatus, setFilterJOStatus] = useState<string>('all');
  const [filterPOStatus, setFilterPOStatus] = useState<string>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedSR, setSelectedSR] = useState<ServiceRequest | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [srSkip, setSrSkip] = useState(0);
  const [srLoadingMore, setSrLoadingMore] = useState(false);
  const [srHasMore, setSrHasMore] = useState(true);
  const [joSkip, setJoSkip] = useState(0);
  const [joLoadingMore, setJoLoadingMore] = useState(false);
  const [joHasMore, setJoHasMore] = useState(true);
  const [poSkip, setPoSkip] = useState(0);
  const [poLoadingMore, setPoLoadingMore] = useState(false);
  const [poHasMore, setPoHasMore] = useState(true);
  const [srTotalCount, setSrTotalCount] = useState(0);
  const [joTotalCount, setJoTotalCount] = useState(0);
  const [poTotalCount, setPoTotalCount] = useState(0);
  const [joLoading, setJoLoading] = useState(true); // Track if job orders are still loading
  const [srIdsWithJO, setSrIdsWithJO] = useState<Set<string>>(new Set()); // Track SR IDs that have JOs

  // Stats counts (independent of filters)
  const [pendingSRCount, setPendingSRCount] = useState(0);
  const [approvedSRCount, setApprovedSRCount] = useState(0);
  const [allJOCount, setAllJOCount] = useState(0);
  const [inProgressJOCount, setInProgressJOCount] = useState(0);
  const [completedJOCount, setCompletedJOCount] = useState(0);
  const [poCount, setPoCount] = useState(0);

  useEffect(() => {
    fetchUser();
  }, []);

  // Fetch stats counts (independent of current filters)
  const fetchStatsCounts = useCallback(async () => {
    if (!user) return;

    try {
      const deptParam = (user?.role === 'APPROVER' && user?.department) ? `&department=${encodeURIComponent(user.department)}` : '';

      // Fetch Pending (SUBMITTED) Service Requests count
      const pendingSRRes = await fetch(`/api/service-requests?limit=1&skip=0&status=SUBMITTED${deptParam}`);
      const pendingSRData = await pendingSRRes.json();
      setPendingSRCount(pendingSRData.totalCount || 0);

      // Fetch Approved Service Requests count
      const approvedSRRes = await fetch(`/api/service-requests?limit=1&skip=0&status=APPROVED${deptParam}`);
      const approvedSRData = await approvedSRRes.json();
      setApprovedSRCount(approvedSRData.totalCount || 0);

      // Fetch all Job Orders count (including ALL statuses for accurate total)
      const joDeptParam = (user?.role === 'APPROVER' && user?.department) ? `&department=${encodeURIComponent(user.department)}` : '';
      const allJORes = await fetch(`/api/job-orders?limit=1&skip=0&status=everything${joDeptParam}`);
      const allJOData = await allJORes.json();
      setAllJOCount(allJOData.totalCount || 0);

      // Fetch In Progress Job Orders count
      const inProgressJORes = await fetch(`/api/job-orders?limit=1&skip=0&status=IN_PROGRESS${joDeptParam}`);
      const inProgressJOData = await inProgressJORes.json();
      setInProgressJOCount(inProgressJOData.totalCount || 0);

      // Fetch Completed Job Orders count
      const completedJORes = await fetch(`/api/job-orders?limit=1&skip=0&status=COMPLETED${joDeptParam}`);
      const completedJOData = await completedJORes.json();
      setCompletedJOCount(completedJOData.totalCount || 0);

      // Fetch Purchase Orders count (including ALL statuses for accurate total)
      if (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' ||
        (user?.role === 'APPROVER' && (normalizeDept(user.department) === 'purchasing' || normalizeDept(user.department) === 'finance'))) {
        const poRes = await fetch(`/api/purchase-orders?limit=1&skip=0&status=everything`);
        const poData = await poRes.json();
        setPoCount(poData.totalCount || 0);
      }
    } catch (error) {
      console.error('Error fetching stats counts:', error);
    }
  }, [user]);

  // Fetch absolute counts for all tabs (independent of filters)
  const fetchAllCounts = useCallback(async () => {
    if (!user) return;

    try {
      const deptParam = (user?.role === 'APPROVER' && user?.department) ? `&department=${encodeURIComponent(user.department)}` : '';

      // Fetch ALL Service Requests count (including those with Job Orders)
      const srRes = await fetch(`/api/service-requests?limit=1&skip=0&status=everything&excludeHasJO=false${deptParam}`);
      const srData = await srRes.json();
      if (srData.totalCount !== undefined) {
        setSrTotalCount(srData.totalCount);
      }

      // Fetch ALL Job Orders count (including CLOSED)
      const joDeptParam = (user?.role === 'APPROVER' && user?.department) ? `&department=${encodeURIComponent(user.department)}` : '';
      const joRes = await fetch(`/api/job-orders?limit=1&skip=0&status=everything&includeClosed=true${joDeptParam}`);
      const joData = await joRes.json();
      if (joData.totalCount !== undefined) {
        setJoTotalCount(joData.totalCount);
      }

      // Fetch ALL Purchase Orders count (including CLOSED)
      if (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' ||
        (user?.role === 'APPROVER' && (normalizeDept(user.department) === 'purchasing' || normalizeDept(user.department) === 'finance'))) {
        const poRes = await fetch(`/api/purchase-orders?limit=1&skip=0&status=everything&includeClosed=true`);
        const poData = await poRes.json();
        if (poData.totalCount !== undefined) {
          setPoTotalCount(poData.totalCount);
        }
      }
      // Fetch SR IDs that have Job Orders (for checking if Create JO button should be shown)
      const joDeptParam2 = (user?.role === 'APPROVER' && user?.department) ? `&department=${encodeURIComponent(user.department)}` : '';
      const joSrIdsRes = await fetch(`/api/job-orders?limit=1000&skip=0&status=everything&includeClosed=true${joDeptParam2}`);
      if (joSrIdsRes.ok) {
        const joSrIdsData = await joSrIdsRes.json();
        const srIds = new Set<string>();
        (joSrIdsData.jobOrders || []).forEach((jo: any) => {
          let srId = '';
          if (typeof jo.srId === 'object' && jo.srId !== null) {
            srId = jo.srId._id?.toString() || jo.srId.id?.toString() || '';
          } else if (jo.srId) {
            srId = jo.srId.toString();
          }
          if (srId) srIds.add(srId);
        });
        setSrIdsWithJO(srIds);
      }
    } catch (error) {
      console.error('Error fetching counts:', error);
    }
  }, [user]);

  // Fetch stats counts on initial load (independent of filters)
  useEffect(() => {
    if (user) {
      fetchStatsCounts();
    }
  }, [user, fetchStatsCounts]);

  // Fetch absolute counts for all tabs on initial load
  useEffect(() => {
    if (user) {
      fetchAllCounts();
    }
  }, [user, fetchAllCounts]);

  // Fetch data when user loads or filters change
  useEffect(() => {
    if (user) {
      fetchData(true);
      // Always fetch job orders when on SR tab to check for existing JOs (include closed ones for accurate checking)
      if (activeTab === 'sr' || activeTab === 'jo') {
        fetchJOData(true, activeTab === 'sr'); // Include closed when on SR tab
      }
      if (activeTab === 'po') {
        fetchPOData(true);
      }
    }
  }, [user, filterStatus, filterJOStatus, filterPOStatus]);

  // Reset when search query changes
  useEffect(() => {
    if (user && searchQuery === '' && activeTab === 'sr') {
      fetchData(true);
    }
  }, [searchQuery, activeTab]);

  // Update URL when tab changes (without page reload)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', activeTab);
      window.history.replaceState({}, '', url.toString());
    }
  }, [activeTab]);

  // Reset when tab changes
  useEffect(() => {
    if (user) {
      if (activeTab === 'jo') {
        setJoSkip(0);
        setJobOrders([]);
        setJoHasMore(true);
        fetchJOData(true, false); // Don't include closed for JO tab display
      } else if (activeTab === 'po') {
        setPoSkip(0);
        setPurchaseOrders([]);
        setPoHasMore(true);
        fetchPOData(true);
      } else if (activeTab === 'sr') {
        // When switching to SR tab, fetch JOs with closed included for accurate checking
        fetchJOData(true, true);
      }
    }
  }, [activeTab]);

  const loadMoreSRs = async () => {
    if (srLoadingMore || !srHasMore || activeTab !== 'sr' || searchQuery.trim()) return;
    setSrLoadingMore(true);
    try {
      const currentSrSkip = srSkip;
      const statusParam = filterStatus !== 'all' && filterStatus !== 'show_all' ? `&status=${filterStatus}` : (filterStatus === 'all' ? '&status=SUBMITTED' : '');
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
        const newItems = normalizedSRs.filter((sr: ServiceRequest) => !existingIds.has(sr.id || sr._id?.toString()));
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

  // Handle scroll for infinite loading (all tabs without search)
  useEffect(() => {
    if (searchQuery.trim()) return; // Don't load more when searching

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
          if (activeTab === 'sr' && srHasMore && !srLoadingMore) {
            loadMoreSRs();
          } else if (activeTab === 'jo' && joHasMore && !joLoadingMore) {
            loadMoreJOs();
          } else if (activeTab === 'po' && poHasMore && !poLoadingMore) {
            loadMorePOs();
          }
        }
      }, 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [srHasMore, srLoadingMore, joHasMore, joLoadingMore, poHasMore, poLoadingMore, activeTab, searchQuery, srSkip, joSkip, poSkip, filterStatus, filterJOStatus, filterPOStatus, user]);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        // Redirect if user is not admin/approver
        if (!['ADMIN', 'APPROVER', 'SUPER_ADMIN'].includes(data.user.role)) {
          if (data.user.role === 'REQUESTER') {
            router.replace('/dashboard/requester');
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

  const fetchData = async (resetSR = false) => {
    try {
      if (resetSR) {
        setSrSkip(0);
        setServiceRequests([]);
        setSrHasMore(true);
      }

      const currentSrSkip = resetSR ? 0 : srSkip;
      // Include status and department filters in API call
      const statusParam = filterStatus !== 'all' && filterStatus !== 'show_all' ? `&status=${filterStatus}` : (filterStatus === 'all' ? '&status=SUBMITTED' : '');
      const deptParam = (user?.role === 'APPROVER' && user?.department) ? `&department=${encodeURIComponent(user.department)}` : '';
      // Fetch Job Orders with closed included to properly check for existing JOs
      if (activeTab === 'sr') {
        await fetchJOData(false, true); // Refresh JOs with closed included to ensure we have latest data
      }
      const srRes = await fetch(`/api/service-requests?limit=9&skip=${currentSrSkip}${statusParam}${deptParam}`);
      const srData = await srRes.json();

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
          const newItems = normalizedSRs.filter((sr: ServiceRequest) => !existingIds.has(sr.id || sr._id?.toString()));
          return [...prev, ...newItems];
        });
      }

      // Update pagination state based on actual fetched count (not filtered)
      const fetchedCount = srData.serviceRequests?.length || 0;
      setSrHasMore(srData.hasMore && fetchedCount === 9);
      setSrSkip(currentSrSkip + fetchedCount);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchJOData = async (resetJO = false, includeClosed = false) => {
    try {
      if (resetJO) {
        setJoSkip(0);
        setJobOrders([]);
        setJoHasMore(true);
        setJoLoading(true); // Set loading when resetting
      }

      const currentJoSkip = resetJO ? 0 : joSkip;
      const statusParam = filterJOStatus !== 'all' && filterJOStatus !== 'show_all' ? `&status=${filterJOStatus}` : '';
      const deptParam = (user?.role === 'APPROVER' && user?.department) ? `&department=${encodeURIComponent(user.department)}` : '';
      // Include closed Job Orders when checking for existing JOs (especially when on SR tab)
      const includeClosedParam = (includeClosed || activeTab === 'sr') ? '&includeClosed=true' : '';

      const joRes = await fetch(`/api/job-orders?limit=9&skip=${currentJoSkip}${statusParam}${deptParam}${includeClosedParam}`);
      const joData = await joRes.json();

      // Job Orders are now filtered on the server side, so no need for client-side filtering
      let jos = joData.jobOrders || [];

      const normalizedJOs = jos.map((jo: any) => {
        // Normalize serviceRequest field
        let serviceRequest = jo.serviceRequest;
        if (!serviceRequest && typeof jo.srId === 'object' && jo.srId) {
          // If serviceRequest doesn't exist but srId is populated, use srId
          serviceRequest = {
            ...jo.srId,
            id: jo.srId._id?.toString() || jo.srId.id,
          };
        } else if (serviceRequest) {
          // Ensure serviceRequest has proper id field
          serviceRequest = {
            ...serviceRequest,
            id: serviceRequest.id || serviceRequest._id?.toString(),
          };
        }

        return {
          ...jo,
          id: jo._id?.toString() || jo.id,
          srId: typeof jo.srId === 'object' ? jo.srId._id?.toString() || jo.srId.id : jo.srId,
          serviceRequest: serviceRequest,
        };
      });

      if (resetJO) {
        setJobOrders(normalizedJOs);
      } else {
        setJobOrders(prev => {
          const existingIds = new Set(prev.map(jo => jo.id || jo._id?.toString()));
          const newItems = normalizedJOs.filter((jo: JobOrder) => !existingIds.has(jo.id || jo._id?.toString()));
          return [...prev, ...newItems];
        });
      }

      const fetchedCount = normalizedJOs.length;
      setJoHasMore(joData.hasMore && fetchedCount === 9);
      setJoSkip(currentJoSkip + fetchedCount);
      setJoLoading(false); // Mark as loaded after fetching
    } catch (error) {
      console.error('Error fetching job orders:', error);
      setJoLoading(false); // Mark as loaded even on error
    } finally {
      setJoLoadingMore(false);
    }
  };

  const fetchPOData = async (resetPO = false) => {
    try {
      if (resetPO) {
        setPoSkip(0);
        setPurchaseOrders([]);
        setPoHasMore(true);
      }

      const currentPoSkip = resetPO ? 0 : poSkip;
      const statusParam = filterPOStatus !== 'all' && filterPOStatus !== 'show_all' ? `&status=${filterPOStatus}` : '';

      const poRes = await fetch(`/api/purchase-orders?limit=9&skip=${currentPoSkip}${statusParam}`);
      const poData = await poRes.json();

      // Filter Purchase Orders - Purchasing, Finance, and President can see Purchase Orders
      let pos = poData.purchaseOrders || [];
      if (user?.role === 'APPROVER' && user?.department) {
        const userDeptNorm = normalizeDept(user.department);
        if (userDeptNorm !== 'purchasing' && userDeptNorm !== 'finance') {
          pos = [];
        }
      }

      const normalizedPOs = pos.map((po: any) => ({
        ...po,
        id: po._id?.toString() || po.id,
        joId: po.joId,
        srId: typeof po.srId === 'object' ? po.srId._id?.toString() || po.srId.id : po.srId,
      }));

      if (resetPO) {
        setPurchaseOrders(normalizedPOs);
      } else {
        setPurchaseOrders(prev => {
          const existingIds = new Set(prev.map(po => po.id || po._id?.toString()));
          const newItems = normalizedPOs.filter((po: PurchaseOrder) => !existingIds.has(po.id || po._id?.toString()));
          return [...prev, ...newItems];
        });
      }

      const fetchedCount = normalizedPOs.length;
      setPoHasMore(poData.hasMore && fetchedCount === 9);
      setPoSkip(currentPoSkip + fetchedCount);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    }
  };

  const loadMoreJOs = async () => {
    if (joLoadingMore || !joHasMore || activeTab !== 'jo' || searchQuery.trim()) return;
    setJoLoadingMore(true);
    try {
      await fetchJOData(false);
    } catch (error) {
      console.error('Error loading more job orders:', error);
    } finally {
      setJoLoadingMore(false);
    }
  };

  const loadMorePOs = async () => {
    if (poLoadingMore || !poHasMore || activeTab !== 'po' || searchQuery.trim()) return;
    setPoLoadingMore(true);
    try {
      await fetchPOData(false);
    } catch (error) {
      console.error('Error loading more purchase orders:', error);
    } finally {
      setPoLoadingMore(false);
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
        toast.showSuccess('Service request approved successfully!');
        await Promise.all([fetchData(), fetchStatsCounts()]);
      } else {
        toast.showError('Failed to approve service request');
      }
    } catch (error) {
      console.error('Error approving SR:', error);
      toast.showError('Failed to approve service request');
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
        toast.showSuccess('Service request rejected successfully!');
        await Promise.all([fetchData(), fetchStatsCounts()]);
      } else {
        toast.showError('Failed to reject service request');
      }
    } catch (error) {
      console.error('Error rejecting SR:', error);
      toast.showError('Failed to reject service request');
    }
  };

  const handleCreateJO = async (srId: string) => {
    const sr = serviceRequests.find(s => (s.id || s._id) === srId);
    if (sr) {
      setSelectedSR(sr);
      setShowCreateForm(true);

      // Mark related notifications as read when clicking Create Job Order button
      try {
        await fetch('/api/notifications/mark-read-by-entity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            relatedEntityType: 'SERVICE_REQUEST',
            relatedEntityId: srId,
          }),
        });
      } catch (notifError) {
        console.error('Error marking notifications as read:', notifError);
      }
    }
  };

  const handleSubmitJO = async (data: {
    type: JobOrderType;
    workDescription?: string;
    materials: any[];
    manpower: any;
    schedule: any[];
    createMR?: boolean;
  }): Promise<void> => {
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
        // Refresh both service requests and job orders to update the hasJO check
        await Promise.all([fetchData(true), fetchJOData(true), fetchAllCounts(), fetchStatsCounts()]);
        setActiveTab('jo');

        // Show success message
        toast.showSuccess(`Job Order ${result.jobOrder.joNumber} created successfully!`);
      } else {
        const error = await response.json();
        toast.showError(error.error || 'Failed to create Job Order');
        // Refresh data even on error to ensure UI is up to date
        await Promise.all([fetchData(true), fetchJOData(true), fetchStatsCounts()]);
        throw new Error(error.error || 'Failed to create Job Order');
      }
    } catch (error) {
      console.error('Error creating Job Order:', error);
      toast.showError('Failed to create Job Order');
      throw error; // Re-throw to let the form handle it
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

  // Stats are now fetched independently from the API, so we don't need to filter here
  // Keeping these for backwards compatibility if needed elsewhere
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
        <div className={`grid grid-cols-2 sm:grid-cols-2 ${(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || (user?.role === 'APPROVER' && normalizeDept(user?.department) === 'purchasing')) ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4 sm:gap-6 mb-8`}>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm font-medium text-gray-500">Pending Requests</div>
            <div className="text-3xl font-bold text-yellow-600 mt-2">{pendingSRCount}</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm font-medium text-gray-500">Approved Requests</div>
            <div className="text-3xl font-bold text-green-600 mt-2">{approvedSRCount}</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm font-medium text-gray-500">Job Orders</div>
            <div className="text-3xl font-bold text-blue-600 mt-2">{allJOCount}</div>
          </div>
          {/* Show Purchase Orders stat to Purchasing, Finance, President, ADMIN, and SUPER_ADMIN */}
          {(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' ||
            (user?.role === 'APPROVER' && (normalizeDept(user?.department) === 'purchasing' || normalizeDept(user?.department) === 'finance'))) && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="text-sm font-medium text-gray-500">Purchase Orders</div>
                <div className="text-3xl font-bold text-purple-600 mt-2">{poCount}</div>
              </div>
            )}
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
              <button
                onClick={() => setActiveTab('sr')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'sr'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Service Requests ({srTotalCount})
              </button>
              <button
                onClick={() => setActiveTab('jo')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'jo'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Job Orders ({joTotalCount})
              </button>
              {/* Show Purchase Orders tab to Purchasing, Finance, President, ADMIN, and SUPER_ADMIN */}
              {(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' ||
                (user?.role === 'APPROVER' && (normalizeDept(user?.department) === 'purchasing' || normalizeDept(user?.department) === 'finance'))) && (
                  <button
                    onClick={() => setActiveTab('po')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'po'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    Purchase Orders ({poTotalCount})
                  </button>
                )}
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
                <option value="show_all">All</option>
                <option value="all">Submitted</option>
                {/* <option value="SUBMITTED">Submitted</option> */}
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="DRAFT">Draft</option>
              </select>
            </div>
          )}
          {activeTab === 'jo' && (
            <div className="sm:w-auto">
              <select
                value={filterJOStatus}
                onChange={(e) => setFilterJOStatus(e.target.value)}
                className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
              >
                <option value="show_all">All</option>
                <option value="all">Needs Approval</option>
                {/* <option value="needs_approval">Needs Approval</option> */}
                <option value="DRAFT">Draft</option>
                {/* <option value="BUDGET_CLEARED">Budget Cleared</option> */}
                <option value="APPROVED">Approved</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="REJECTED">Rejected</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
          )}
          {/* Show Purchase Orders filter to Purchasing, Finance, President, ADMIN, and SUPER_ADMIN */}
          {activeTab === 'po' && (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' ||
            (user?.role === 'APPROVER' && (normalizeDept(user?.department) === 'purchasing' || normalizeDept(user?.department) === 'finance'))) && (
              <div className="sm:w-auto">
                <select
                  value={filterPOStatus}
                  onChange={(e) => setFilterPOStatus(e.target.value)}
                  className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                >
                  <option value="show_all">All</option>
                  <option value="all">Needs Approval</option>
                  {/* <option value="needs_approval">Needs Approval</option> */}
                  {/* <option value="DRAFT">Draft</option>
                  <option value="SUBMITTED">Submitted</option> */}
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="PURCHASED">Purchased</option>
                  <option value="RECEIVED">Received</option>
                  <option value="CLOSED">Closed</option>
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
                  <div className="columns-1 md:columns-2 lg:columns-3 gap-4 sm:gap-6">
                    {filteredSRs.map((sr) => {
                      const srId = sr.id || sr._id || '';
                      const srIdString = srId.toString();
                      const srIdMongo = sr._id?.toString() || srIdString;

                      // Check if this SR has a JO using the pre-fetched Set
                      const hasJO = srIdsWithJO.has(srIdString) || srIdsWithJO.has(srIdMongo);

                      // Show button if SR is APPROVED and no JO exists
                      const canCreateJO = sr.status === 'APPROVED' && !hasJO;

                      return (
                        <div key={srId} className="break-inside-avoid mb-4 sm:mb-6">
                          <ServiceRequestCard
                            serviceRequest={sr}
                            showCreateJO={canCreateJO}
                            onCreateJO={handleCreateJO}
                            currentUser={user}
                            onApprovalUpdate={async () => {
                              await Promise.all([fetchData(true), fetchStatsCounts(), fetchAllCounts()]);
                            }}
                            hasJobOrder={hasJO}
                          />
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
              let filteredJOs = filterBySearch(jobOrders, 'jo');

              // Apply status filter
              if (filterJOStatus === 'needs_approval') {
                // Filter to show only Job Orders that need approval
                filteredJOs = filteredJOs.filter((jo) => {
                  if (jo.status === 'CLOSED') return false;
                  const isServiceType = jo.type === 'SERVICE';
                  const operationsApproved = jo.approvals?.some((a: any) =>
                    a.role === 'OPERATIONS' && a.action === 'APPROVED'
                  );
                  const managementApproved = jo.approvals?.some((a: any) =>
                    a.role === 'MANAGEMENT' && a.action === 'APPROVED'
                  );
                  const financeApproved = jo.approvals?.some((a: any) =>
                    a.role === 'FINANCE' && (a.action === 'NOTED' || a.action === 'BUDGET_APPROVED')
                  );
                  if (isServiceType) {
                    return !operationsApproved || !managementApproved;
                  } else {
                    return !financeApproved || !managementApproved;
                  }
                });
              } else if (filterJOStatus !== 'all' && filterJOStatus !== 'show_all') {
                filteredJOs = filteredJOs.filter((jo) => jo.status === filterJOStatus);
              }
              // When filterJOStatus is 'show_all', no filter applied - show all items

              return filteredJOs.length > 0 ? (
                <div className="columns-1 md:columns-2 lg:columns-3 gap-4 sm:gap-6">
                  {filteredJOs.map((jo) => (
                    <div key={jo.id || jo._id} className="break-inside-avoid mb-4 sm:mb-6">
                      <JobOrderCard jobOrder={jo} currentUser={user} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-md p-12 text-center">
                  <p className="text-gray-500">
                    {searchQuery || filterJOStatus !== 'all'
                      ? 'No job orders match your search criteria.'
                      : 'No job orders found.'}
                  </p>
                </div>
              );
            })()}
          </div>
        )}
        {/* Show Purchase Orders content to Purchasing, Finance, President, ADMIN, and SUPER_ADMIN */}
        {activeTab === 'po' && (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' ||
          (user?.role === 'APPROVER' && (normalizeDept(user?.department) === 'purchasing' || normalizeDept(user?.department) === 'finance'))) && (
            <div>
              {(() => {
                let filteredPOs = filterBySearch(purchaseOrders, 'po');

                // Apply status filter
                if (filterPOStatus === 'needs_approval') {
                  // Filter to show only Purchase Orders that need approval
                  filteredPOs = filteredPOs.filter((po) => {
                    if (po.status === 'CLOSED' || po.status === 'REJECTED' || po.status === 'DRAFT') return false;
                    const financeApproved = po.approvals?.some((a: any) =>
                      a.role === 'FINANCE' && a.action === 'APPROVED'
                    );
                    const managementApproved = po.approvals?.some((a: any) =>
                      a.role === 'MANAGEMENT' && a.action === 'APPROVED'
                    );
                    return !financeApproved || !managementApproved;
                  });
                } else if (filterPOStatus !== 'all' && filterPOStatus !== 'show_all') {
                  filteredPOs = filteredPOs.filter((po) => po.status === filterPOStatus);
                }
                // When filterPOStatus is 'show_all', no filter applied - show all items

                return filteredPOs.length > 0 ? (
                  <div className="columns-1 md:columns-2 lg:columns-3 gap-4 sm:gap-6">
                    {filteredPOs.map((po) => (
                      <div key={po.id || po._id} className="break-inside-avoid mb-4 sm:mb-6">
                        <PurchaseOrderCard purchaseOrder={po} currentUser={user} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow-md p-12 text-center">
                    <p className="text-gray-500">
                      {searchQuery || filterPOStatus !== 'all'
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

