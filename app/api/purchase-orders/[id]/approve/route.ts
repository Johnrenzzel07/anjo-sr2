import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import PurchaseOrder from '@/lib/models/PurchaseOrder';
import { ApprovalAction, UserRole } from '@/types';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body: ApprovalAction = await request.json();

    const purchaseOrder = await PurchaseOrder.findById(id);
    if (!purchaseOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    // Check if user already approved
    const hasApproved = purchaseOrder.approvals.some(
      (a: any) => a.userId === body.userId && a.action === body.action
    );

    if (hasApproved) {
      return NextResponse.json(
        { error: `Purchase Order already ${body.action} by this user` },
        { status: 400 }
      );
    }

    // Only President (MANAGEMENT, SUPER_ADMIN, ADMIN) can approve Purchase Orders
    const isPresident = body.role === 'SUPER_ADMIN' || body.role === 'MANAGEMENT' || body.role === 'ADMIN';

    // Check if President has already approved
    const presidentApproved = purchaseOrder.approvals.some(
      (a: any) => a.role === 'MANAGEMENT' && a.action === 'APPROVED'
    );

    // Only President can approve
    if (body.action === 'APPROVED' && !isPresident) {
      return NextResponse.json(
        { error: 'Only President can approve Purchase Orders' },
        { status: 403 }
      );
    }

    // Map role for approval record - only MANAGEMENT role for approvals
    let approvalRole: UserRole;
    if (isPresident) {
      approvalRole = 'MANAGEMENT';
    } else {
      return NextResponse.json(
        { error: 'Only President can approve Purchase Orders' },
        { status: 403 }
      );
    }

    // Add approval
    const approval = {
      role: approvalRole,
      userId: body.userId,
      userName: body.userName,
      action: body.action,
      timestamp: new Date().toISOString(),
      comments: body.comments || '',
    };

    purchaseOrder.approvals.push(approval);

    // Update status based on approval action
    if (body.action === 'APPROVED') {
      // President approved, status becomes APPROVED
      purchaseOrder.status = 'APPROVED';
    } else if (body.action === 'REJECTED') {
      purchaseOrder.status = 'REJECTED';
    } else if (body.action === 'SUBMITTED' && purchaseOrder.status === 'DRAFT') {
      purchaseOrder.status = 'SUBMITTED';
    }

    await purchaseOrder.save();
    await purchaseOrder.populate('joId', 'joNumber type');
    await purchaseOrder.populate('srId', 'srNumber');

    // Notify Purchasing department when President approves the PO
    if (body.action === 'APPROVED') {
      const { notifyPurchaseOrderApproved } = await import('@/lib/utils/notifications');
      await notifyPurchaseOrderApproved(
        purchaseOrder._id.toString(),
        purchaseOrder.poNumber,
        purchaseOrder.requestedBy,
        purchaseOrder.department
      );
    }

    return NextResponse.json({ purchaseOrder });
  } catch (error: any) {
    console.error('Error approving purchase order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to approve purchase order' },
      { status: 500 }
    );
  }
}

