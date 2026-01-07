import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import JobOrder from '@/lib/models/JobOrder';
import { getAuthUser } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();
    const { 
      estimatedTotalCost, 
      budgetSource, 
      costCenter, 
      action // 'APPROVE' or 'REJECT' for budget approval
    } = body;

    // Get current user for authorization
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is Finance (by department) or Super Admin (President)
    // Finance users have role 'APPROVER' with department 'Finance'
    const isFinance = user.department === 'Finance';
    const isPresident = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
    const canApproveBudget = isFinance || isPresident;
    
    if (!canApproveBudget && action) {
      return NextResponse.json(
        { error: 'Only Finance and President can approve budgets' },
        { status: 403 }
      );
    }
    
    // Map user role to approval role for recording
    // Finance department → FINANCE role in approvals
    // SUPER_ADMIN (President) → MANAGEMENT role in approvals
    let approvalRole: string;
    if (isFinance) {
      approvalRole = 'FINANCE';
    } else if (isPresident) {
      approvalRole = 'MANAGEMENT';
    } else {
      approvalRole = user.role;
    }

    const jobOrder = await JobOrder.findById(id);
    if (!jobOrder) {
      return NextResponse.json(
        { error: 'Job Order not found' },
        { status: 404 }
      );
    }

    // Calculate estimated total cost from materials and outsource price if not provided
    // Note: estimatedCost is already the total (quantity × unitPrice), so we just sum them up
    let calculatedCost = estimatedTotalCost;
    if (!calculatedCost) {
      // Calculate from materials
      if (jobOrder.materials && jobOrder.materials.length > 0) {
        calculatedCost = jobOrder.materials.reduce((sum: number, material: any) => {
          return sum + (material.estimatedCost || 0);
        }, 0);
      }
      
      // Add outsource price if available
      if (jobOrder.manpower?.outsourcePrice) {
        calculatedCost = (calculatedCost || 0) + jobOrder.manpower.outsourcePrice;
      }
    }

    // Update budget information
    const budgetUpdate: any = {
      estimatedTotalCost: calculatedCost || jobOrder.budget?.estimatedTotalCost || 0,
      budgetSource: budgetSource || jobOrder.budget?.budgetSource || jobOrder.budget?.budgetSource || '',
      costCenter: costCenter || jobOrder.budget?.costCenter || jobOrder.budget?.budgetSource || '',
    };

    // Check if Finance has approved (required before President can approve/update)
    const financeApproved = jobOrder.approvals.some(
      (a: any) => a.role === 'FINANCE' && a.action === 'BUDGET_APPROVED'
    );
    
    // President cannot update or approve budget until Finance has approved
    // Only block if there's an actual update attempt (action is set, or budget fields are being updated)
    const isUpdatingBudget = action || 
      (estimatedTotalCost !== undefined && estimatedTotalCost !== (jobOrder.budget?.estimatedTotalCost || 0));
    
    if (isPresident && !financeApproved && isUpdatingBudget) {
      return NextResponse.json(
        { error: 'Finance must approve the budget before President can update or approve it' },
        { status: 400 }
      );
    }

    // Handle budget approval action
    if (action === 'APPROVE') {
      // Add budget approval to approvals array
      const hasBudgetApproval = jobOrder.approvals.some(
        (a: any) => a.userId === user.id && a.action === 'BUDGET_APPROVED'
      );

      if (!hasBudgetApproval) {
        jobOrder.approvals.push({
          role: approvalRole as any,
          userId: user.id,
          userName: user.name,
          action: 'BUDGET_APPROVED' as any,
          timestamp: new Date().toISOString(),
          comments: body.comments || 'Budget approved',
        });
      }

      // Update status to APPROVED if both Finance and President approved budget
      const presidentApproved = jobOrder.approvals.some(
        (a: any) => a.role === 'MANAGEMENT' && a.action === 'BUDGET_APPROVED'
      );

      if (financeApproved && presidentApproved) {
        jobOrder.status = 'APPROVED';
        
        // Notify Purchasing if this is a Material Requisition
        if (jobOrder.type === 'MATERIAL_REQUISITION') {
          const { notifyPurchasingBudgetApproved } = await import('@/lib/utils/notifications');
          await notifyPurchasingBudgetApproved(
            jobOrder._id.toString(),
            jobOrder.joNumber
          );
        }
      }
    } else if (action === 'REJECT') {
      // Add budget rejection
      jobOrder.approvals.push({
        role: approvalRole as any,
        userId: user.id,
        userName: user.name,
        action: 'BUDGET_REJECTED' as any,
        timestamp: new Date().toISOString(),
        comments: body.comments || 'Budget rejected',
      });
      
      // Reject both Job Order and Service Request
      jobOrder.status = 'REJECTED';
      
      if (jobOrder.srId) {
        const ServiceRequest = (await import('@/lib/models/ServiceRequest')).default;
        const sr = await ServiceRequest.findById(jobOrder.srId);
        if (sr) {
          sr.status = 'REJECTED';
          await sr.save();
        }
      }
    }

    // Update budget info
    jobOrder.budget = {
      ...(jobOrder.budget || {}),
      ...budgetUpdate,
    };

    await jobOrder.save();
    
    // Notify next approver if needed (Finance approved, notify Management)
    if (action === 'APPROVE' && isFinance) {
      const presidentApproved = jobOrder.approvals.some(
        (a: any) => a.role === 'MANAGEMENT' && a.action === 'BUDGET_APPROVED'
      );
      
      if (!presidentApproved) {
        const { notifyJobOrderNeedsApproval } = await import('@/lib/utils/notifications');
        await notifyJobOrderNeedsApproval(
          jobOrder._id.toString(),
          jobOrder.joNumber,
          'MANAGEMENT',
          jobOrder.type as 'SERVICE' | 'MATERIAL_REQUISITION',
          user.name // Include Finance approver name
        );
      }
    }
    
    // Populate service request for response
    await jobOrder.populate('srId', 'srNumber requestedBy department');

    return NextResponse.json({ jobOrder });
  } catch (error: any) {
    console.error('Error updating budget:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update budget' },
      { status: 500 }
    );
  }
}

