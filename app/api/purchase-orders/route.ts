import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import PurchaseOrder from '@/lib/models/PurchaseOrder';
import JobOrder from '@/lib/models/JobOrder';
import { CreatePurchaseOrderInput } from '@/types';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const joId = searchParams.get('joId');
    const limit = parseInt(searchParams.get('limit') || '9', 10);
    const skip = parseInt(searchParams.get('skip') || '0', 10);
    const status = searchParams.get('status'); // Optional status filter

    if (joId) {
      // Get PO for specific Job Order
      const purchaseOrder = await PurchaseOrder.findOne({ joId })
        .populate('joId', 'joNumber type')
        .populate('srId', 'srNumber');
      return NextResponse.json({ purchaseOrders: purchaseOrder ? [purchaseOrder] : [] });
    }

    // Build base query
    let query: any = {};

    // Apply status filter if provided
    // By default, exclude CLOSED status unless explicitly requested
    const includeClosed = searchParams.get('includeClosed') === 'true';
    if (status === 'everything') {
      // Don't filter by status at all
    } else if (status === 'all') {
      // When "All" is selected, show ALL statuses without any exclusions
      // No status filter applied
    } else if (status) {
      // Specific status selected
      query.status = status;
    } else {
      // Exclude CLOSED and REJECTED status by default when no specific status is requested
      query.status = { $nin: ['CLOSED', 'REJECTED'] };
    }

    // Use aggregation to sort by status priority, then by createdAt, with pagination
    const pipeline: any[] = [
      { $match: query },
      {
        $addFields: {
          statusPriority: {
            $switch: {
              branches: [
                { case: { $eq: ['$status', 'DRAFT'] }, then: 1 },
                { case: { $eq: ['$status', 'SUBMITTED'] }, then: 2 },
                { case: { $eq: ['$status', 'APPROVED'] }, then: 3 },
                { case: { $eq: ['$status', 'REJECTED'] }, then: 4 },
                { case: { $eq: ['$status', 'PURCHASED'] }, then: 5 },
                { case: { $eq: ['$status', 'RECEIVED'] }, then: 6 },
                { case: { $eq: ['$status', 'CLOSED'] }, then: 7 }
              ],
              default: 99
            }
          }
        }
      },
      { $sort: { statusPriority: 1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'joborders',
          localField: 'joId',
          foreignField: '_id',
          as: 'joId_populated'
        }
      },
      {
        $lookup: {
          from: 'servicerequests',
          localField: 'srId',
          foreignField: '_id',
          as: 'srId_populated'
        }
      },
      {
        $unwind: {
          path: '$joId_populated',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $unwind: {
          path: '$srId_populated',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          poNumber: 1,
          joId: {
            $cond: {
              if: { $ne: ['$joId_populated', null] },
              then: {
                _id: '$joId_populated._id',
                joNumber: '$joId_populated.joNumber',
                type: '$joId_populated.type'
              },
              else: '$joId'
            }
          },
          srId: {
            $cond: {
              if: { $ne: ['$srId_populated', null] },
              then: {
                _id: '$srId_populated._id',
                srNumber: '$srId_populated.srNumber'
              },
              else: '$srId'
            }
          },
          dateRequested: 1,
          requestedBy: 1,
          department: 1,
          priority: 1,
          items: 1,
          supplierName: 1,
          supplierContact: 1,
          supplierAddress: 1,
          subtotal: 1,
          tax: 1,
          totalAmount: 1,
          status: 1,
          expectedDeliveryDate: 1,
          actualDeliveryDate: 1,
          deliveryNotes: 1,
          closedAt: 1,
          approvals: 1,
          createdAt: 1,
          updatedAt: 1
        }
      }
    ];

    const [purchaseOrders, totalCount] = await Promise.all([
      PurchaseOrder.aggregate(pipeline),
      PurchaseOrder.countDocuments(query)
    ]);

    return NextResponse.json({
      purchaseOrders,
      totalCount,
      hasMore: skip + limit < totalCount
    });
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase orders' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authorization - only Purchasing department, ADMIN, or SUPER_ADMIN can create Purchase Orders
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      );
    }

    const userRole = authUser.role;
    const userDepartment = (authUser as any).department;
    const canCreatePO = userRole === 'ADMIN' ||
      userRole === 'SUPER_ADMIN' ||
      (userRole === 'APPROVER' && userDepartment === 'Purchasing');

    if (!canCreatePO) {
      return NextResponse.json(
        { error: 'Unauthorized - Only Purchasing department, ADMIN, or SUPER_ADMIN can create Purchase Orders' },
        { status: 403 }
      );
    }

    await connectDB();
    const body: CreatePurchaseOrderInput = await request.json();
    const { joId, items, supplierName, supplierContact, supplierAddress, tax = 0, expectedDeliveryDate } = body;

    // Validate that JO exists and is Material Requisition type
    // Use lean() to get plain object and ensure type field is included
    const jobOrder = await JobOrder.findById(joId).lean() as any;
    if (!jobOrder) {
      return NextResponse.json(
        { error: 'Job Order not found' },
        { status: 404 }
      );
    }

    // Check type - handle both cases where type might be missing or different
    const jobOrderType = (jobOrder as any)?.type;
    const joNumber = (jobOrder as any).joNumber;

    console.log('PO Creation - Job Order Check:', {
      joId,
      joNumber,
      type: jobOrderType,
      typeExists: !!jobOrderType,
      isMaterialRequisition: jobOrderType === 'MATERIAL_REQUISITION'
    });

    if (!jobOrderType || jobOrderType !== 'MATERIAL_REQUISITION') {
      return NextResponse.json(
        {
          error: 'Purchase Order can only be created from Material Requisition Job Orders',
          details: `Job Order ${joNumber || joId} has type: "${jobOrderType || 'NOT SET'}". You must create a NEW Job Order and select "Material Requisition" as the type when creating it.`,
          jobOrderType: jobOrderType || 'NOT SET',
          jobOrderNumber: joNumber,
          solution: 'Go back and create a new Job Order. In the form, select "Material Requisition" (not "Service") as the Job Order Type.'
        },
        { status: 400 }
      );
    }

    // For Material Requisition, check if budget has been approved by President
    const approvals = (jobOrder as any)?.approvals || [];
    const presidentBudgetApproved = approvals.some(
      (a: any) => a.role === 'MANAGEMENT' && a.action === 'BUDGET_APPROVED'
    );

    if (!presidentBudgetApproved) {
      return NextResponse.json(
        {
          error: 'Budget must be approved before Purchase Order can be created',
          details: 'The budget for this Material Requisition Job Order must be approved by President before a Purchase Order can be created.',
          solution: 'Please ensure the budget is approved in the Budget Information section before creating a Purchase Order.'
        },
        { status: 400 }
      );
    }

    // Check if PO already exists for this JO
    const existingPO = await PurchaseOrder.findOne({ joId });
    if (existingPO) {
      return NextResponse.json(
        { error: 'Purchase Order already exists for this Job Order' },
        { status: 400 }
      );
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    const totalAmount = subtotal + (tax || 0);

    const now = new Date().toISOString();

    // Ensure all items have expectedDeliveryDate field (use item-level or fallback to primary)
    const itemsWithDeliveryDates = items.map(item => ({
      ...item,
      expectedDeliveryDate: item.expectedDeliveryDate || expectedDeliveryDate || '',
    }));

    console.log('PO Creation - Items with delivery dates:', itemsWithDeliveryDates.map(item => ({
      item: item.item,
      expectedDeliveryDate: item.expectedDeliveryDate,
    })));

    const purchaseOrder = new PurchaseOrder({
      joId: jobOrder._id.toString(),
      srId: jobOrder.srId,
      dateRequested: now,
      requestedBy: jobOrder.requestedBy,
      department: jobOrder.department,
      priority: jobOrder.priorityLevel,
      items: itemsWithDeliveryDates, // Use items with delivery dates
      supplierName: supplierName || '',
      supplierContact: supplierContact || '',
      supplierAddress: supplierAddress || '',
      subtotal: subtotal,
      tax: tax,
      totalAmount: totalAmount,
      status: 'DRAFT',
      expectedDeliveryDate: expectedDeliveryDate || '', // Primary delivery date (fallback)
    });

    await purchaseOrder.save();
    await purchaseOrder.populate('joId', 'joNumber type');
    await purchaseOrder.populate('srId', 'srNumber');

    return NextResponse.json({ purchaseOrder }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating purchase order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create purchase order' },
      { status: 500 }
    );
  }
}

