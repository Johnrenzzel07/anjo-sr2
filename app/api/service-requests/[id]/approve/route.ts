import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ServiceRequest from '@/lib/models/ServiceRequest';
import { getAuthUser } from '@/lib/auth';
import { ApprovalAction } from '@/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body: ApprovalAction = await request.json();

    // Get current user for authorization
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const serviceRequest = await ServiceRequest.findById(id);
    if (!serviceRequest) {
      return NextResponse.json(
        { error: 'Service request not found' },
        { status: 404 }
      );
    }

    // Check if user already approved
    const hasApproved = serviceRequest.approvals?.some(
      (a: any) => a.userId === body.userId && a.action === body.action
    );

    if (hasApproved) {
      return NextResponse.json(
        { error: `Service Request already ${body.action} by this user` },
        { status: 400 }
      );
    }

    // Helper to normalize department names (e.g., 'IT' vs 'IT Department')
    const normalizeDept = (dept: string | undefined) =>
      (dept || '').toLowerCase().replace(/\s+department$/, '').trim();

    // Check if user is department head for this SR's department
    const userDepartment = (user as any).department as string | undefined;
    const userDeptNorm = normalizeDept(userDepartment);
    const srDeptNorm = normalizeDept(serviceRequest.department);

    const userRole = user.role as string;
    const isDepartmentHead = 
      (userRole === 'APPROVER' || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') &&
      userDeptNorm === srDeptNorm;

    // Only department head of the same department can approve
    if (body.action === 'APPROVED' && !isDepartmentHead && userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only the Department Head of the requesting department can approve this Service Request' },
        { status: 403 }
      );
    }

    // Map user role to approval role
    let approvalRole: string;
    if (isDepartmentHead || (userRole === 'APPROVER' && userDeptNorm === srDeptNorm)) {
      approvalRole = 'DEPARTMENT_HEAD';
    } else if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') {
      approvalRole = 'MANAGEMENT';
    } else {
      approvalRole = userRole;
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

    if (!serviceRequest.approvals) {
      serviceRequest.approvals = [];
    }
    serviceRequest.approvals.push(approval);

    // Update status based on approval action
    if (body.action === 'APPROVED') {
      serviceRequest.status = 'APPROVED';
    } else if (body.action === 'REJECTED') {
      serviceRequest.status = 'REJECTED';
    }

    await serviceRequest.save();

    // Notify requester about approval/rejection
    const { notifyServiceRequestStatusChanged } = await import('@/lib/utils/notifications');
    await notifyServiceRequestStatusChanged(
      serviceRequest._id.toString(),
      serviceRequest.srNumber,
      serviceRequest.status as 'APPROVED' | 'REJECTED',
      serviceRequest.contactEmail
    );

    // If approved, notify Operations to create Job Order
    if (body.action === 'APPROVED') {
      const { notifyServiceRequestApprovedForJO } = await import('@/lib/utils/notifications');
      await notifyServiceRequestApprovedForJO(
        serviceRequest._id.toString(),
        serviceRequest.srNumber,
        body.userName // Include approver name
      );
    }

    return NextResponse.json({ serviceRequest });
  } catch (error: any) {
    console.error('Error approving service request:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to approve service request' },
      { status: 500 }
    );
  }
}

