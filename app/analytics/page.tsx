'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import NotificationBell from '@/components/NotificationBell';
import SettingsMenu from '@/components/SettingsMenu';
import Link from 'next/link';

interface AnalyticsData {
    serviceRequests: {
        total: number;
        byStatus: { status: string; count: number }[];
        byPriority: { priority: string; count: number }[];
        byDepartment: { department: string; count: number }[];
        byCategory: { category: string; count: number }[];
        avgProcessingTime: number;
    };
    jobOrders: {
        total: number;
        byStatus: { status: string; count: number }[];
        byType: { type: string; count: number }[];
        byPriority: { priority: string; count: number }[];
        byDepartment: { department: string; count: number }[];
        avgCompletionTime: number;
    };
    purchaseOrders: {
        total: number;
        byStatus: { status: string; count: number }[];
        totalValue: number;
        avgOrderValue: number;
        byDepartment: { department: string; count: number }[];
    };
    trends: {
        lastMonth: {
            serviceRequests: number;
            jobOrders: number;
            purchaseOrders: number;
        };
        thisMonth: {
            serviceRequests: number;
            jobOrders: number;
            purchaseOrders: number;
        };
    };
}

export default function AnalyticsPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [timeRange, setTimeRange] = useState<'all' | 'month' | 'week'>('all');

    useEffect(() => {
        fetchUser();
    }, []);

    useEffect(() => {
        if (user) {
            fetchAnalytics();
        }
    }, [user, timeRange]);

    const fetchUser = async () => {
        try {
            const response = await fetch('/api/auth/me');
            if (response.ok) {
                const data = await response.json();
                // Only allow admins and approvers to view analytics
                if (!['ADMIN', 'APPROVER', 'SUPER_ADMIN'].includes(data.user.role)) {
                    router.replace('/dashboard/requester');
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

    const fetchAnalytics = async () => {
        try {
            const response = await fetch(`/api/analytics?timeRange=${timeRange}`);
            if (response.ok) {
                const data = await response.json();
                setAnalytics(data);
            }
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            SUBMITTED: 'bg-yellow-100 text-yellow-800',
            APPROVED: 'bg-green-100 text-green-800',
            REJECTED: 'bg-red-100 text-red-800',
            DRAFT: 'bg-gray-100 text-gray-800',
            IN_PROGRESS: 'bg-blue-100 text-blue-800',
            COMPLETED: 'bg-green-100 text-green-800',
            CLOSED: 'bg-gray-100 text-gray-800',
            PURCHASED: 'bg-purple-100 text-purple-800',
            RECEIVED: 'bg-green-100 text-green-800',
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    };

    const getPriorityColor = (priority: string) => {
        const colors: Record<string, string> = {
            URGENT: 'bg-red-100 text-red-800',
            HIGH: 'bg-orange-100 text-orange-800',
            MEDIUM: 'bg-yellow-100 text-yellow-800',
            LOW: 'bg-green-100 text-green-800',
        };
        return colors[priority] || 'bg-gray-100 text-gray-800';
    };

    const calculateGrowth = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
    };

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
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <img
                                src="/logo.png"
                                alt="ANJO WORLD"
                                className="h-12 w-12 md:h-16 md:w-16 object-contain"
                            />
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
                                <p className="text-sm text-gray-600 mt-1">
                                    Insights and metrics for Service Requests, Job Orders, and Purchase Orders
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 items-center">
                            <NotificationBell />
                            <Link
                                href="/dashboard/admin"
                                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                            >
                                ← Back to Dashboard
                            </Link>
                            <SettingsMenu userRole={user?.role} />
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Time Range Selector */}
                <div className="mb-6 flex justify-end">
                    <div className="inline-flex rounded-md shadow-sm">
                        <button
                            onClick={() => setTimeRange('week')}
                            className={`px-4 py-2 text-sm font-medium rounded-l-lg border ${timeRange === 'week'
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            This Week
                        </button>
                        <button
                            onClick={() => setTimeRange('month')}
                            className={`px-4 py-2 text-sm font-medium border-t border-b ${timeRange === 'month'
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            This Month
                        </button>
                        <button
                            onClick={() => setTimeRange('all')}
                            className={`px-4 py-2 text-sm font-medium rounded-r-lg border ${timeRange === 'all'
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            All Time
                        </button>
                    </div>
                </div>

                {analytics && (
                    <>
                        {/* Overview Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            {/* Service Requests */}
                            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900">Service Requests</h3>
                                    <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <div className="text-3xl font-bold text-gray-900 mb-2">
                                    {analytics.serviceRequests.total}
                                </div>
                                {analytics.trends && (
                                    <div className="flex items-center gap-2">
                                        {calculateGrowth(analytics.trends.thisMonth.serviceRequests, analytics.trends.lastMonth.serviceRequests) >= 0 ? (
                                            <span className="text-green-600 text-sm font-medium">
                                                ↑ {calculateGrowth(analytics.trends.thisMonth.serviceRequests, analytics.trends.lastMonth.serviceRequests)}%
                                            </span>
                                        ) : (
                                            <span className="text-red-600 text-sm font-medium">
                                                ↓ {Math.abs(calculateGrowth(analytics.trends.thisMonth.serviceRequests, analytics.trends.lastMonth.serviceRequests))}%
                                            </span>
                                        )}
                                        <span className="text-gray-500 text-sm">vs last month</span>
                                    </div>
                                )}
                            </div>

                            {/* Job Orders */}
                            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900">Job Orders</h3>
                                    <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                    </svg>
                                </div>
                                <div className="text-3xl font-bold text-gray-900 mb-2">
                                    {analytics.jobOrders.total}
                                </div>
                                {analytics.trends && (
                                    <div className="flex items-center gap-2">
                                        {calculateGrowth(analytics.trends.thisMonth.jobOrders, analytics.trends.lastMonth.jobOrders) >= 0 ? (
                                            <span className="text-green-600 text-sm font-medium">
                                                ↑ {calculateGrowth(analytics.trends.thisMonth.jobOrders, analytics.trends.lastMonth.jobOrders)}%
                                            </span>
                                        ) : (
                                            <span className="text-red-600 text-sm font-medium">
                                                ↓ {Math.abs(calculateGrowth(analytics.trends.thisMonth.jobOrders, analytics.trends.lastMonth.jobOrders))}%
                                            </span>
                                        )}
                                        <span className="text-gray-500 text-sm">vs last month</span>
                                    </div>
                                )}
                            </div>

                            {/* Purchase Orders */}
                            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900">Purchase Orders</h3>
                                    <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                </div>
                                <div className="text-3xl font-bold text-gray-900 mb-2">
                                    {analytics.purchaseOrders.total}
                                </div>
                                <div className="text-sm text-gray-600">
                                    Total Value: <span className="font-semibold text-green-600">₱{analytics.purchaseOrders.totalValue.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Service Requests Analytics */}
                        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                            <h2 className="text-xl font-bold text-gray-900 mb-6">Service Requests Breakdown</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* By Status */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3">By Status</h3>
                                    <div className="space-y-2">
                                        {analytics.serviceRequests.byStatus.map((item) => (
                                            <div key={item.status} className="flex items-center justify-between">
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(item.status)}`}>
                                                    {item.status}
                                                </span>
                                                <span className="text-sm font-medium text-gray-900">{item.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* By Priority */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3">By Priority</h3>
                                    <div className="space-y-2">
                                        {analytics.serviceRequests.byPriority.map((item) => (
                                            <div key={item.priority} className="flex items-center justify-between">
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(item.priority)}`}>
                                                    {item.priority}
                                                </span>
                                                <span className="text-sm font-medium text-gray-900">{item.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* By Department */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3">By Department</h3>
                                    <div className="space-y-2">
                                        {analytics.serviceRequests.byDepartment.slice(0, 5).map((item) => (
                                            <div key={item.department} className="flex items-center justify-between">
                                                <span className="text-sm text-gray-700">{item.department}</span>
                                                <span className="text-sm font-medium text-gray-900">{item.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* By Category */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3">By Category</h3>
                                    <div className="space-y-2">
                                        {analytics.serviceRequests.byCategory.slice(0, 5).map((item) => (
                                            <div key={item.category} className="flex items-center justify-between">
                                                <span className="text-sm text-gray-700">{item.category}</span>
                                                <span className="text-sm font-medium text-gray-900">{item.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Job Orders Analytics */}
                        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                            <h2 className="text-xl font-bold text-gray-900 mb-6">Job Orders Breakdown</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* By Status */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3">By Status</h3>
                                    <div className="space-y-2">
                                        {analytics.jobOrders.byStatus.map((item) => (
                                            <div key={item.status} className="flex items-center justify-between">
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(item.status)}`}>
                                                    {item.status}
                                                </span>
                                                <span className="text-sm font-medium text-gray-900">{item.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* By Type */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3">By Type</h3>
                                    <div className="space-y-2">
                                        {analytics.jobOrders.byType.map((item) => (
                                            <div key={item.type} className="flex items-center justify-between">
                                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                                    {item.type.replace('_', ' ')}
                                                </span>
                                                <span className="text-sm font-medium text-gray-900">{item.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* By Priority */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3">By Priority</h3>
                                    <div className="space-y-2">
                                        {analytics.jobOrders.byPriority.map((item) => (
                                            <div key={item.priority} className="flex items-center justify-between">
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(item.priority)}`}>
                                                    {item.priority}
                                                </span>
                                                <span className="text-sm font-medium text-gray-900">{item.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* By Department */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3">By Department</h3>
                                    <div className="space-y-2">
                                        {analytics.jobOrders.byDepartment.slice(0, 5).map((item) => (
                                            <div key={item.department} className="flex items-center justify-between">
                                                <span className="text-sm text-gray-700">{item.department}</span>
                                                <span className="text-sm font-medium text-gray-900">{item.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Purchase Orders Analytics */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-6">Purchase Orders Breakdown</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* By Status */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3">By Status</h3>
                                    <div className="space-y-2">
                                        {analytics.purchaseOrders.byStatus.map((item) => (
                                            <div key={item.status} className="flex items-center justify-between">
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(item.status)}`}>
                                                    {item.status}
                                                </span>
                                                <span className="text-sm font-medium text-gray-900">{item.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Financial Summary */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Financial Summary</h3>
                                    <div className="space-y-3">
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                            <div className="text-xs text-green-700 font-medium">Total Value</div>
                                            <div className="text-2xl font-bold text-green-900">
                                                ₱{analytics.purchaseOrders.totalValue.toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                            <div className="text-xs text-blue-700 font-medium">Average Order Value</div>
                                            <div className="text-2xl font-bold text-blue-900">
                                                ₱{analytics.purchaseOrders.avgOrderValue.toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* By Department */}
                                <div className="md:col-span-2">
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3">By Department</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {analytics.purchaseOrders.byDepartment.map((item) => (
                                            <div key={item.department} className="bg-gray-50 rounded-lg p-3">
                                                <div className="text-xs text-gray-600">{item.department}</div>
                                                <div className="text-lg font-bold text-gray-900">{item.count}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
