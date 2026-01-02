import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import JobOrder from '@/lib/models/JobOrder';
import { UpdateJobOrderInput } from '@/types';
import { notifyJobOrderServiceAccepted } from '@/lib/utils/notifications';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const jobOrder = await JobOrder.findById(id)
      .populate('srId');
    
    if (!jobOrder) {
      return NextResponse.json(
        { error: 'Job order not found' },
        { status: 404 }
      );
    }
    
    // Auto-fix status for existing JOs: If SERVICE type has President approval but status is DRAFT, update to APPROVED
    if (jobOrder.type === 'SERVICE' && jobOrder.status === 'DRAFT') {
      const presidentApproved = jobOrder.approvals?.some((a: any) => 
        a.role === 'MANAGEMENT' && a.action === 'APPROVED'
      );
      
      if (presidentApproved) {
        jobOrder.status = 'APPROVED';
        await jobOrder.save();
      }
    }
    
    return NextResponse.json({ jobOrder });
  } catch (error) {
    console.error('Error fetching job order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job order' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body: UpdateJobOrderInput = await request.json();

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (body.workDescription !== undefined) {
      updateData.workDescription = body.workDescription;
    }
    if (body.materials !== undefined) {
      updateData.materials = body.materials;
    }
    if (body.manpower !== undefined) {
      updateData.manpower = { ...body.manpower };
    }
    if (body.schedule !== undefined) {
      updateData.schedule = body.schedule;
    }
    if (body.budget !== undefined) {
      updateData.budget = { ...body.budget };
    }
    // Get the original job order to check if acceptance is new
    const originalJobOrder = await JobOrder.findById(id);
    if (!originalJobOrder) {
      return NextResponse.json(
        { error: 'Job order not found' },
        { status: 404 }
      );
    }

    const wasAlreadyAccepted = !!originalJobOrder.acceptance?.serviceAcceptedBy;
    
    if (body.acceptance !== undefined) {
      updateData.acceptance = { ...body.acceptance };
    }

    const jobOrder = await JobOrder.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('srId');
    
    if (!jobOrder) {
      return NextResponse.json(
        { error: 'Job order not found' },
        { status: 404 }
      );
    }
    
    // Notify handling department when service is accepted (if it's a new acceptance)
    if (body.acceptance?.serviceAcceptedBy && !wasAlreadyAccepted && jobOrder.serviceCategory) {
      await notifyJobOrderServiceAccepted(
        jobOrder._id.toString(),
        jobOrder.joNumber,
        jobOrder.serviceCategory,
        body.acceptance.serviceAcceptedBy
      );
    }
    
    return NextResponse.json({ jobOrder });
  } catch (error: any) {
    console.error('Error updating job order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update job order' },
      { status: 500 }
    );
  }
}
