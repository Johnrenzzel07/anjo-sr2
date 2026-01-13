import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ServiceRequest from '@/lib/models/ServiceRequest';
import JobOrder from '@/lib/models/JobOrder';
import PurchaseOrder from '@/lib/models/PurchaseOrder';

export async function GET(request: Request) {
    try {
        await connectDB();

        const { searchParams } = new URL(request.url);
        const timeRange = searchParams.get('timeRange') || 'all';

        // Calculate date filter based on time range
        let dateFilter: any = {};
        const now = new Date();

        if (timeRange === 'week') {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            dateFilter = { createdAt: { $gte: weekAgo.toISOString() } };
        } else if (timeRange === 'month') {
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            dateFilter = { createdAt: { $gte: monthAgo.toISOString() } };
        }

        // Fetch Service Requests Analytics
        const serviceRequests = await ServiceRequest.find(dateFilter);
        const srTotal = serviceRequests.length;

        const srByStatus = serviceRequests.reduce((acc: any, sr: any) => {
            acc[sr.status] = (acc[sr.status] || 0) + 1;
            return acc;
        }, {});

        const srByPriority = serviceRequests.reduce((acc: any, sr: any) => {
            acc[sr.priority] = (acc[sr.priority] || 0) + 1;
            return acc;
        }, {});

        const srByDepartment = serviceRequests.reduce((acc: any, sr: any) => {
            acc[sr.department] = (acc[sr.department] || 0) + 1;
            return acc;
        }, {});

        const srByCategory = serviceRequests.reduce((acc: any, sr: any) => {
            acc[sr.serviceCategory] = (acc[sr.serviceCategory] || 0) + 1;
            return acc;
        }, {});

        // Fetch Job Orders Analytics
        const jobOrders = await JobOrder.find(dateFilter);
        const joTotal = jobOrders.length;

        const joByStatus = jobOrders.reduce((acc: any, jo: any) => {
            acc[jo.status] = (acc[jo.status] || 0) + 1;
            return acc;
        }, {});

        const joByType = jobOrders.reduce((acc: any, jo: any) => {
            acc[jo.type] = (acc[jo.type] || 0) + 1;
            return acc;
        }, {});

        const joByPriority = jobOrders.reduce((acc: any, jo: any) => {
            acc[jo.priorityLevel] = (acc[jo.priorityLevel] || 0) + 1;
            return acc;
        }, {});

        const joByDepartment = jobOrders.reduce((acc: any, jo: any) => {
            acc[jo.department] = (acc[jo.department] || 0) + 1;
            return acc;
        }, {});

        // Fetch Purchase Orders Analytics
        const purchaseOrders = await PurchaseOrder.find(dateFilter);
        const poTotal = purchaseOrders.length;

        const poByStatus = purchaseOrders.reduce((acc: any, po: any) => {
            acc[po.status] = (acc[po.status] || 0) + 1;
            return acc;
        }, {});

        const poByDepartment = purchaseOrders.reduce((acc: any, po: any) => {
            acc[po.department] = (acc[po.department] || 0) + 1;
            return acc;
        }, {});

        const poTotalValue = purchaseOrders.reduce((sum: number, po: any) => sum + (po.totalAmount || 0), 0);
        const poAvgValue = poTotal > 0 ? Math.round(poTotalValue / poTotal) : 0;

        // Calculate trends (last month vs this month)
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const lastMonthSRs = await ServiceRequest.countDocuments({
            createdAt: {
                $gte: lastMonthStart.toISOString(),
                $lte: lastMonthEnd.toISOString(),
            },
        });

        const thisMonthSRs = await ServiceRequest.countDocuments({
            createdAt: { $gte: thisMonthStart.toISOString() },
        });

        const lastMonthJOs = await JobOrder.countDocuments({
            createdAt: {
                $gte: lastMonthStart.toISOString(),
                $lte: lastMonthEnd.toISOString(),
            },
        });

        const thisMonthJOs = await JobOrder.countDocuments({
            createdAt: { $gte: thisMonthStart.toISOString() },
        });

        const lastMonthPOs = await PurchaseOrder.countDocuments({
            createdAt: {
                $gte: lastMonthStart.toISOString(),
                $lte: lastMonthEnd.toISOString(),
            },
        });

        const thisMonthPOs = await PurchaseOrder.countDocuments({
            createdAt: { $gte: thisMonthStart.toISOString() },
        });

        // Calculate response times
        // SR → JO: Time from SR creation to JO creation
        const srsWithJOs = await ServiceRequest.find(dateFilter).lean();
        const srToJoTimes: number[] = [];
        const srToJoDetails: any[] = [];

        for (const sr of srsWithJOs) {
            const jo = await JobOrder.findOne({ srId: sr._id }).lean();
            if (jo && sr.createdAt && (jo as any).createdAt) {
                const srDate = new Date(sr.createdAt);
                const joDate = new Date((jo as any).createdAt);
                const timeDiff = joDate.getTime() - srDate.getTime();
                const hours = timeDiff / (1000 * 60 * 60);

                srToJoTimes.push(hours);
                srToJoDetails.push({
                    srNumber: sr.srNumber,
                    joNumber: (jo as any).joNumber,
                    hours: Math.round(hours * 10) / 10,
                    srDate: sr.createdAt,
                    joDate: (jo as any).createdAt,
                });
            }
        }

        const avgSrToJo = srToJoTimes.length > 0
            ? Math.round((srToJoTimes.reduce((a, b) => a + b, 0) / srToJoTimes.length) * 10) / 10
            : 0;

        // Sort to find slowest SR→JO conversions
        const slowestSrToJo = srToJoDetails
            .sort((a, b) => b.hours - a.hours)
            .slice(0, 5);

        // JO → PO: Time from JO approval to PO creation (for Material Requisitions)
        const materialJOs = await JobOrder.find({
            ...dateFilter,
            type: 'MATERIAL_REQUISITION',
        }).lean();

        const joToPOTimes: number[] = [];
        const joToPODetails: any[] = [];

        for (const jo of materialJOs) {
            // Find when JO was approved (budget approved)
            const budgetApproval = jo.approvals?.find(
                (a: any) => a.action === 'BUDGET_APPROVED'
            );

            if (budgetApproval) {
                const po = await PurchaseOrder.findOne({ joId: jo._id }).lean();
                if (po && (po as any).createdAt) {
                    const approvalDate = new Date(budgetApproval.timestamp);
                    const poDate = new Date((po as any).createdAt);
                    const timeDiff = poDate.getTime() - approvalDate.getTime();
                    const hours = timeDiff / (1000 * 60 * 60);

                    joToPOTimes.push(hours);
                    joToPODetails.push({
                        joNumber: jo.joNumber,
                        poNumber: (po as any).poNumber,
                        hours: Math.round(hours * 10) / 10,
                        approvalDate: budgetApproval.timestamp,
                        poDate: (po as any).createdAt,
                    });
                }
            }
        }

        const avgJoToPO = joToPOTimes.length > 0
            ? Math.round((joToPOTimes.reduce((a, b) => a + b, 0) / joToPOTimes.length) * 10) / 10
            : 0;

        // Sort to find slowest JO→PO conversions
        const slowestJoToPO = joToPODetails
            .sort((a, b) => b.hours - a.hours)
            .slice(0, 5);

        // Format response
        const analytics = {
            serviceRequests: {
                total: srTotal,
                byStatus: Object.entries(srByStatus).map(([status, count]) => ({ status, count })),
                byPriority: Object.entries(srByPriority).map(([priority, count]) => ({ priority, count })),
                byDepartment: Object.entries(srByDepartment)
                    .map(([department, count]) => ({ department, count }))
                    .sort((a: any, b: any) => b.count - a.count),
                byCategory: Object.entries(srByCategory)
                    .map(([category, count]) => ({ category, count }))
                    .sort((a: any, b: any) => b.count - a.count),
                avgProcessingTime: 0,
            },
            jobOrders: {
                total: joTotal,
                byStatus: Object.entries(joByStatus).map(([status, count]) => ({ status, count })),
                byType: Object.entries(joByType).map(([type, count]) => ({ type, count })),
                byPriority: Object.entries(joByPriority).map(([priority, count]) => ({ priority, count })),
                byDepartment: Object.entries(joByDepartment)
                    .map(([department, count]) => ({ department, count }))
                    .sort((a: any, b: any) => b.count - a.count),
                avgCompletionTime: 0,
            },
            purchaseOrders: {
                total: poTotal,
                byStatus: Object.entries(poByStatus).map(([status, count]) => ({ status, count })),
                totalValue: poTotalValue,
                avgOrderValue: poAvgValue,
                byDepartment: Object.entries(poByDepartment)
                    .map(([department, count]) => ({ department, count }))
                    .sort((a: any, b: any) => b.count - a.count),
            },
            responseTimes: {
                srToJo: {
                    avgHours: avgSrToJo,
                    totalProcessed: srToJoTimes.length,
                    slowest: slowestSrToJo,
                },
                joToPO: {
                    avgHours: avgJoToPO,
                    totalProcessed: joToPOTimes.length,
                    slowest: slowestJoToPO,
                },
            },
            trends: {
                lastMonth: {
                    serviceRequests: lastMonthSRs,
                    jobOrders: lastMonthJOs,
                    purchaseOrders: lastMonthPOs,
                },
                thisMonth: {
                    serviceRequests: thisMonthSRs,
                    jobOrders: thisMonthJOs,
                    purchaseOrders: thisMonthPOs,
                },
            },
        };

        return NextResponse.json(analytics);
    } catch (error: any) {
        console.error('Error fetching analytics:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch analytics' },
            { status: 500 }
        );
    }
}
