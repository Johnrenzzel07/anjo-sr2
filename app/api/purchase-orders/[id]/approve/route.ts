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

    // Get user info to check department
    // Note: We need to get the actual user from database to check department
    // For now, we'll use the role from the request body
    // Finance users send role 'FINANCE' in the request
    const isFinance = body.role === 'FINANCE';
    const isPresident = body.role === 'SUPER_ADMIN' || body.role === 'MANAGEMENT' || body.role === 'ADMIN';
    
    // Check approval order: Finance must approve first, then President
    const financeApproved = purchaseOrder.approvals.some(
      (a: any) => a.role === 'FINANCE' && a.action === 'APPROVED'
    );
    const presidentApproved = purchaseOrder.approvals.some(
      (a: any) => a.role === 'MANAGEMENT' && a.action === 'APPROVED'
    );

    // If President trying to approve but Finance hasn't approved yet
    if (body.action === 'APPROVED' && isPresident && !financeApproved) {
      return NextResponse.json(
        { error: 'Finance must approve the Purchase Order before President can approve' },
        { status: 400 }
      );
    }

    // Map role for approval record
    let approvalRole: UserRole;
    if (isFinance) {
      approvalRole = 'FINANCE';
    } else if (isPresident) {
      approvalRole = 'MANAGEMENT';
    } else {
      approvalRole = body.role;
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

    // Update status based on approval action and sequence
    if (body.action === 'APPROVED') {
      // If Finance approved, status becomes APPROVED (pending President)
      // If President approved (after Finance), status stays APPROVED
      if (isFinance) {
        purchaseOrder.status = 'APPROVED'; // Finance approved, waiting for President
      } else if (isPresident && financeApproved) {
        purchaseOrder.status = 'APPROVED'; // Both approved, fully approved
      }
    } else if (body.action === 'REJECTED') {
      purchaseOrder.status = 'REJECTED';
    } else if (body.action === 'SUBMITTED' && purchaseOrder.status === 'DRAFT') {
      purchaseOrder.status = 'SUBMITTED';
    }

    await purchaseOrder.save();
    await purchaseOrder.populate('joId', 'joNumber type');
    await purchaseOrder.populate('srId', 'srNumber');

    return NextResponse.json({ purchaseOrder });
  } catch (error: any) {
    console.error('Error approving purchase order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to approve purchase order' },
      { status: 500 }
    );
  }
}

