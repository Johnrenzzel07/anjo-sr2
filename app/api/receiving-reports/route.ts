import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ReceivingReport from '@/lib/models/ReceivingReport';
// Import models for populate to work - DO NOT REMOVE even if unused
import PurchaseOrder from '@/lib/models/PurchaseOrder';
import JobOrder from '@/lib/models/JobOrder';
import ServiceRequest from '@/lib/models/ServiceRequest';
import { getAuthUser } from '@/lib/auth';
import { CreateReceivingReportInput } from '@/types';

export async function GET(request: Request) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      );
    }

    await connectDB();
    
    // Force models to register - ensures Mongoose knows about these models
    [PurchaseOrder.modelName, JobOrder.modelName, ServiceRequest.modelName];

    const { searchParams } = new URL(request.url);
    const poId = searchParams.get('poId');
    const status = searchParams.get('status');
    const department = searchParams.get('department');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = parseInt(searchParams.get('skip') || '0');

    let query: any = {};

    if (poId) {
      query.poId = poId;
    }

    // Only filter by status if it's not "all"
    if (status && status !== 'all') {
      query.status = status;
    }

    // Filter by department unless user is ADMIN or SUPER_ADMIN
    if (authUser.role !== 'ADMIN' && authUser.role !== 'SUPER_ADMIN') {
      const userDepartment = (authUser as any).department;
      if (department) {
        query.department = department;
      } else if (userDepartment) {
        query.department = userDepartment;
      }
    } else if (department) {
      query.department = department;
    }

    // Get total count for pagination
    const totalCount = await ReceivingReport.countDocuments(query);

    const receivingReports = await ReceivingReport.find(query)
      .populate({
        path: 'poId',
        select: 'poNumber joId srId status supplierName',
        populate: [
          { path: 'joId', select: 'joNumber type' },
          { path: 'srId', select: 'srNumber' }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    // Convert _id to id for consistency
    const formattedReports = receivingReports.map((rr: any) => ({
      ...rr,
      id: rr._id.toString(),
      _id: rr._id.toString(),
      poId: typeof rr.poId === 'object' && rr.poId?._id
        ? { ...rr.poId, id: rr.poId._id.toString(), _id: rr.poId._id.toString() }
        : rr.poId,
    }));

    const hasMore = skip + receivingReports.length < totalCount;

    return NextResponse.json({ 
      receivingReports: formattedReports,
      totalCount,
      hasMore
    });
  } catch (error: any) {
    console.error('Error fetching receiving reports:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch receiving reports' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authorization
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      );
    }

    const userRole = authUser.role;
    const userDepartment = (authUser as any).department;
    
    // Only Purchasing, ADMIN, or SUPER_ADMIN can create receiving reports
    const canCreate = userRole === 'ADMIN' ||
      userRole === 'SUPER_ADMIN' ||
      (userRole === 'APPROVER' && userDepartment === 'Purchasing');

    if (!canCreate) {
      return NextResponse.json(
        { error: 'Unauthorized - Only Purchasing department, ADMIN, or SUPER_ADMIN can create Receiving Reports' },
        { status: 403 }
      );
    }

    await connectDB();
    const body: CreateReceivingReportInput = await request.json();
    const {
      poId,
      items,
      actualDeliveryDate,
      deliveryNotes,
      storeNo,
      terminalNo,
      division,
      toLocation,
      class: className,
      subsidiary,
      exchangeRate = 1.00,
      memo,
    } = body;

    // Validate that PO exists
    const purchaseOrder = await PurchaseOrder.findById(poId).lean() as any;
    if (!purchaseOrder) {
      return NextResponse.json(
        { error: 'Purchase Order not found' },
        { status: 404 }
      );
    }

    console.log('PO Data:', {
      poId: purchaseOrder._id,
      supplierName: purchaseOrder.supplierName,
      supplierContact: purchaseOrder.supplierContact,
      itemsCount: purchaseOrder.items?.length,
      firstItemSupplier: purchaseOrder.items?.[0]?.supplier,
      firstItemSupplierInfo: purchaseOrder.items?.[0]?.supplierInfo,
    });

    // Check if PO is in RECEIVED status
    if (purchaseOrder.status !== 'RECEIVED') {
      return NextResponse.json(
        { error: 'Purchase Order must be in RECEIVED status to create a Receiving Report. Please mark the PO as received first.' },
        { status: 400 }
      );
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    const totalAmount = subtotal;

    const now = new Date().toISOString();
    const postingPeriod = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    // Extract supplier information from items (prioritize item-level supplier info)
    let supplierName = '';
    let supplierContact = '';
    let supplierAddress = '';
    
    if (purchaseOrder.items && purchaseOrder.items.length > 0) {
      const firstItem = purchaseOrder.items[0];
      const itemSupplier = firstItem.supplierInfo || {
        name: firstItem.supplier || purchaseOrder.supplierName || '',
        contact: purchaseOrder.supplierContact || '',
        address: purchaseOrder.supplierAddress || '',
      };
      supplierName = itemSupplier.name || firstItem.supplier || purchaseOrder.supplierName || 'Unknown Supplier';
      supplierContact = itemSupplier.contact || purchaseOrder.supplierContact || '';
      supplierAddress = itemSupplier.address || purchaseOrder.supplierAddress || '';
    } else {
      // Fallback to PO-level supplier info if no items
      supplierName = purchaseOrder.supplierName || 'Unknown Supplier';
      supplierContact = purchaseOrder.supplierContact || '';
      supplierAddress = purchaseOrder.supplierAddress || '';
    }

    console.log('Extracted Supplier Info:', {
      supplierName,
      supplierContact,
      supplierAddress,
    });

    console.log('Auth User Info:', {
      id: authUser.id,
      name: authUser.name,
      email: authUser.email,
    });

    // Validate required fields before creating document
    if (!supplierName || supplierName.trim() === '') {
      return NextResponse.json(
        { error: 'Supplier name is required but could not be determined from Purchase Order. Please ensure the PO has supplier information.' },
        { status: 400 }
      );
    }

    if (!authUser.id) {
      return NextResponse.json(
        { error: 'User ID is required but could not be determined from authentication.' },
        { status: 400 }
      );
    }

    if (!actualDeliveryDate) {
      return NextResponse.json(
        { error: 'Actual delivery date is required.' },
        { status: 400 }
      );
    }

    const receivingReport = new ReceivingReport({
      poId: purchaseOrder._id.toString(),
      createdFrom: purchaseOrder.poNumber,
      referenceNumber: purchaseOrder.poNumber,
      postingPeriod,
      supplierName,
      supplierContact,
      supplierAddress,
      date: now,
      memo,
      storeNo,
      terminalNo,
      originalPONumber: purchaseOrder.poNumber,
      division,
      toLocation,
      class: className,
      department: purchaseOrder.department,
      subsidiary,
      exchangeRate,
      subtotal,
      tax: 0,
      totalAmount,
      items,
      status: 'DRAFT',
      receivedBy: authUser.id,
      receivedByName: authUser.name || authUser.email,
      actualDeliveryDate,
      deliveryNotes,
    });

    await receivingReport.save();
    await receivingReport.populate('poId', 'poNumber status supplierName');

    // Update PO delivery information (status is already RECEIVED)
    await PurchaseOrder.findByIdAndUpdate(
      poId,
      {
        actualDeliveryDate,
        deliveryNotes,
        updatedAt: now,
      }
    );

    return NextResponse.json({ receivingReport }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating receiving report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create receiving report' },
      { status: 500 }
    );
  }
}
