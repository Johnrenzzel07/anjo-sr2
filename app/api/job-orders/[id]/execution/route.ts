import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import JobOrder from '@/lib/models/JobOrder';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();
    const { action, actualStartDate, actualCompletionDate, workCompletionNotes } = body;

    const jobOrder = await JobOrder.findById(id);
    if (!jobOrder) {
      return NextResponse.json(
        { error: 'Job Order not found' },
        { status: 404 }
      );
    }

    // Handle different execution actions
    switch (action) {
      case 'START':
        // Start execution - update status to IN_PROGRESS and set actual start date
        if (jobOrder.status !== 'APPROVED' && jobOrder.status !== 'BUDGET_CLEARED') {
          return NextResponse.json(
            { error: 'Job Order must be APPROVED or BUDGET_CLEARED to start execution' },
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
        // Complete execution - update status to COMPLETED and set completion date
        if (jobOrder.status !== 'IN_PROGRESS') {
          return NextResponse.json(
            { error: 'Job Order must be IN_PROGRESS to complete execution' },
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
    
    // Populate service request for response
    await jobOrder.populate('srId', 'srNumber requestedBy department');

    return NextResponse.json({ jobOrder });
  } catch (error: any) {
    console.error('Error updating execution:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update execution' },
      { status: 500 }
    );
  }
}

