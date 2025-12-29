import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import JobOrder from '@/lib/models/JobOrder';
import { ApprovalAction } from '@/types';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body: ApprovalAction = await request.json();

    const jobOrder = await JobOrder.findById(id);
    
    if (!jobOrder) {
      return NextResponse.json(
        { error: 'Job order not found' },
        { status: 404 }
      );
    }

    const newApproval = {
      ...body,
      timestamp: new Date().toISOString(),
    };

    // Remove existing approval from same role if exists
    const filteredApprovals = jobOrder.approvals.filter(
      (a: any) => a.role !== body.role || a.action !== body.action
    );

    jobOrder.approvals = [...filteredApprovals, newApproval];
    jobOrder.updatedAt = new Date().toISOString();

    // Update status based on approvals
    const hasPrepared = jobOrder.approvals.some((a: any) => a.action === 'PREPARED');
    const hasReviewed = jobOrder.approvals.some((a: any) => a.action === 'REVIEWED');
    const hasNoted = jobOrder.approvals.some((a: any) => a.action === 'NOTED');
    const hasApproved = jobOrder.approvals.some((a: any) => a.action === 'APPROVED');
    
    // Check for Service type sequential approvals
    const isServiceType = jobOrder.type === 'SERVICE';
    // For SERVICE type: Creating the JO counts as handling department approval
    // Only President approval is needed
    const presidentApproved = jobOrder.approvals.some((a: any) => 
      a.role === 'MANAGEMENT' && a.action === 'APPROVED'
    );
    
    // Legacy check for Operations approval (for backward compatibility with old JOs)
    const operationsApproved = jobOrder.approvals.some((a: any) => 
      a.role === 'OPERATIONS' && a.action === 'APPROVED'
    );

    if (jobOrder.status !== 'CLOSED') {
      if (isServiceType) {
        // For Service type: Only President approval is needed (creating JO = handling dept approval)
        if (presidentApproved) {
          jobOrder.status = 'APPROVED';
        } else {
          // Still waiting for President approval
          jobOrder.status = 'DRAFT';
        }
      } else {
        // For Material Requisition type
        if (hasApproved) {
          jobOrder.status = 'APPROVED';
        } else if (hasNoted) {
          jobOrder.status = 'BUDGET_CLEARED';
        } else {
          jobOrder.status = 'DRAFT';
        }
      }
    }

    await jobOrder.save();
    await jobOrder.populate('srId');
    
    // Notify next approver if needed
    const { notifyJobOrderNeedsApproval } = await import('@/lib/utils/notifications');
    
    // Get the name of the current approver
    const currentApprover = body.userName;
    
    if (isServiceType) {
      // For Service type: When President approves, notify handling department that they can start execution
      if (presidentApproved) {
        const { notifyHandlingDepartmentReadyForExecution } = await import('@/lib/utils/notifications');
        await notifyHandlingDepartmentReadyForExecution(
          jobOrder._id.toString(),
          jobOrder.joNumber,
          jobOrder.serviceCategory,
          currentApprover,
          body.role // Pass the approver's role (e.g., 'MANAGEMENT' for President)
        );
      }
    } else {
      // For Material Requisition: If Finance approved, notify Management
      const financeApproved = jobOrder.approvals.some((a: any) => 
        a.role === 'FINANCE' && (a.action === 'NOTED' || a.action === 'BUDGET_APPROVED')
      );
      if (financeApproved && !presidentApproved) {
        // Find the Finance approver name
        const financeApprover = jobOrder.approvals.find((a: any) => 
          a.role === 'FINANCE' && (a.action === 'NOTED' || a.action === 'BUDGET_APPROVED')
        );
        const approverName = financeApprover?.userName || currentApprover;
        
        await notifyJobOrderNeedsApproval(
          jobOrder._id.toString(),
          jobOrder.joNumber,
          'MANAGEMENT',
          'MATERIAL_REQUISITION',
          approverName
        );
      } else if (!financeApproved) {
        // If no Finance approval yet, notify Finance
        await notifyJobOrderNeedsApproval(
          jobOrder._id.toString(),
          jobOrder.joNumber,
          'FINANCE',
          'MATERIAL_REQUISITION'
        );
      }
    }
    
    return NextResponse.json({ jobOrder });
  } catch (error: any) {
    console.error('Error adding approval:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add approval' },
      { status: 500 }
    );
  }
}
