import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ReceivingReport from '@/lib/models/ReceivingReport';
// Import models for populate to work - DO NOT REMOVE even if unused
import PurchaseOrder from '@/lib/models/PurchaseOrder';
import JobOrder from '@/lib/models/JobOrder';
import ServiceRequest from '@/lib/models/ServiceRequest';
import { getAuthUser } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      );
    }

    await connectDB();
    
    // Force models to register by accessing their modelName
    // This ensures Mongoose knows about these models before populate
    [PurchaseOrder.modelName, JobOrder.modelName, ServiceRequest.modelName];
    
    const { id } = await params;
    const receivingReport = await ReceivingReport.findById(id)
      .populate({
        path: 'poId',
        select: 'poNumber joId srId status supplierName supplierContact supplierAddress items',
        populate: [
          { path: 'joId', select: 'joNumber type department' },
          { path: 'srId', select: 'srNumber' }
        ]
      })
      .lean();

    if (!receivingReport) {
      return NextResponse.json(
        { error: 'Receiving Report not found' },
        { status: 404 }
      );
    }

    // Format the response
    const formattedReport = {
      ...receivingReport,
      id: receivingReport._id.toString(),
      _id: receivingReport._id.toString(),
      poId: typeof receivingReport.poId === 'object' && (receivingReport.poId as any)?._id
        ? {
            ...(receivingReport.poId as any),
            id: (receivingReport.poId as any)._id.toString(),
            _id: (receivingReport.poId as any)._id.toString(),
          }
        : receivingReport.poId,
    };

    return NextResponse.json({ receivingReport: formattedReport });
  } catch (error: any) {
    console.error('Error fetching receiving report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch receiving report' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      );
    }

    const userRole = authUser.role;
    const userDepartment = (authUser as any).department;

    // Only Purchasing, ADMIN, or SUPER_ADMIN can update receiving reports
    const canUpdate = userRole === 'ADMIN' ||
      userRole === 'SUPER_ADMIN' ||
      (userRole === 'APPROVER' && userDepartment === 'Purchasing');

    if (!canUpdate) {
      return NextResponse.json(
        { error: 'Unauthorized - Only Purchasing department, ADMIN, or SUPER_ADMIN can update Receiving Reports' },
        { status: 403 }
      );
    }

    await connectDB();
    const { id } = await params;
    const body = await request.json();
    const { status, items, deliveryNotes, memo } = body;

    const receivingReport = await ReceivingReport.findById(id);
    if (!receivingReport) {
      return NextResponse.json(
        { error: 'Receiving Report not found' },
        { status: 404 }
      );
    }

    // Update fields
    if (status) receivingReport.status = status;
    if (items) {
      receivingReport.items = items;
      // Recalculate totals
      const subtotal = items.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);
      receivingReport.subtotal = subtotal;
      receivingReport.totalAmount = subtotal + (receivingReport.tax || 0);
    }
    if (deliveryNotes !== undefined) receivingReport.deliveryNotes = deliveryNotes;
    if (memo !== undefined) receivingReport.memo = memo;

    receivingReport.updatedAt = new Date().toISOString();
    await receivingReport.save();

    await receivingReport.populate('poId', 'poNumber status supplierName');

    return NextResponse.json({ receivingReport });
  } catch (error: any) {
    console.error('Error updating receiving report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update receiving report' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      );
    }

    // Only SUPER_ADMIN can delete receiving reports
    if (authUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Only SUPER_ADMIN can delete Receiving Reports' },
        { status: 403 }
      );
    }

    await connectDB();
    const { id } = await params;
    const receivingReport = await ReceivingReport.findByIdAndDelete(id);

    if (!receivingReport) {
      return NextResponse.json(
        { error: 'Receiving Report not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Receiving Report deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting receiving report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete receiving report' },
      { status: 500 }
    );
  }
}
