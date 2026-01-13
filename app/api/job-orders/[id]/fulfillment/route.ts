import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import JobOrder from '@/lib/models/JobOrder';
import { notifyJobOrderFulfillmentCompleted } from '@/lib/utils/notifications';
import { getAuthUser } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();
    const { action, actualStartDate, actualCompletionDate, workCompletionNotes } = body;
    const authUser = getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const jobOrder = await JobOrder.findById(id).populate('srId');
    if (!jobOrder) {
      return NextResponse.json(
        { error: 'Job Order not found' },
        { status: 404 }
      );
    }

    // Authorization check
    const userDept = (authUser.department || '').toLowerCase().replace(/\s+department$/, '').trim();
    const userRole = authUser.role;
    const userId = authUser.id;
    const userName = authUser.name;

    // Mapping for handling departments
    const SERVICE_CATEGORY_TO_DEPARTMENT: Record<string, string[]> = {
      'Technical Support': ['it'],
      'Facility Maintenance': ['maintenance'],
      'Account/Billing Inquiry': ['accounting'],
      'General Inquiry': ['general services'],
      'Other': ['operations'],
    };

    const isHandlingDept = (() => {
      if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userDept === 'president') return true;
      const authorizedDepts = SERVICE_CATEGORY_TO_DEPARTMENT[jobOrder.serviceCategory] || ['operations'];
      return authorizedDepts.includes(userDept);
    })();

    const isRequester = userId === jobOrder.serviceRequest?.requestedBy ||
      userName === jobOrder.requestedBy ||
      userName === (jobOrder.srId as any)?.requestedBy ||
      userId === (jobOrder.srId as any)?.requestedBy;

    console.log('Backend Fulfillment Auth Check:', {
      action,
      userId,
      userName,
      joRequestedBy: jobOrder.requestedBy,
      srId_requestedBy: (jobOrder.srId as any)?.requestedBy,
      isRequester,
      isHandlingDept
    });

    const canManageFulfillment = isHandlingDept || isRequester || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' ||
      (userRole === 'APPROVER' && userDept === 'operations');

    if (!canManageFulfillment) {
      return NextResponse.json(
        { error: 'You are not authorized to manage fulfillment for this Job Order' },
        { status: 403 }
      );
    }

    // Handle different fulfillment actions
    switch (action) {
      case 'START':
        // Start fulfillment - update status to IN_PROGRESS and set actual start date
        if (jobOrder.status !== 'APPROVED' && jobOrder.status !== 'BUDGET_CLEARED') {
          return NextResponse.json(
            { error: 'Job Order must be APPROVED or BUDGET_CLEARED to start fulfillment' },
            { status: 400 }
          );
        }

        jobOrder.status = 'IN_PROGRESS';
        if (actualStartDate) {
          jobOrder.acceptance = {
            ...(jobOrder.acceptance || {}),
            actualStartDate,
          };
        } else {
          jobOrder.acceptance = {
            ...(jobOrder.acceptance || {}),
            actualStartDate: new Date().toISOString(),
          };
        }
        break;

      case 'UPDATE_MILESTONE':
        // Update milestone progress (can be done while IN_PROGRESS)
        if (jobOrder.status !== 'IN_PROGRESS') {
          return NextResponse.json(
            { error: 'Job Order must be IN_PROGRESS to update milestones' },
            { status: 400 }
          );
        }
        // Milestone updates can be handled through schedule updates
        break;

      case 'COMPLETE':
        // Complete fulfillment - update status to COMPLETED and set completion date
        if (jobOrder.status !== 'IN_PROGRESS') {
          return NextResponse.json(
            { error: 'Job Order must be IN_PROGRESS to complete fulfillment' },
            { status: 400 }
          );
        }

        jobOrder.status = 'COMPLETED';
        if (actualCompletionDate) {
          jobOrder.acceptance = {
            ...(jobOrder.acceptance || {}),
            actualCompletionDate,
          };
        } else {
          jobOrder.acceptance = {
            ...(jobOrder.acceptance || {}),
            actualCompletionDate: new Date().toISOString(),
          };
        }

        if (workCompletionNotes) {
          jobOrder.acceptance = {
            ...(jobOrder.acceptance || {}),
            workCompletionNotes,
          };
        }
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use START, UPDATE_MILESTONE, or COMPLETE' },
          { status: 400 }
        );
    }

    await jobOrder.save();

    // Notify requester's department head and requester when fulfillment is completed
    if (action === 'COMPLETE' && jobOrder.department) {
      // Get requester email from service request
      const requesterEmail = (jobOrder.srId as any)?.contactEmail;

      await notifyJobOrderFulfillmentCompleted(
        jobOrder._id.toString(),
        jobOrder.joNumber,
        jobOrder.department,
        requesterEmail
      );
    }

    // Populate service request for response
    await jobOrder.populate('srId', 'srNumber requestedBy department');

    return NextResponse.json({ jobOrder });
  } catch (error: any) {
    console.error('Error updating fulfillment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update fulfillment' },
      { status: 500 }
    );
  }
}

