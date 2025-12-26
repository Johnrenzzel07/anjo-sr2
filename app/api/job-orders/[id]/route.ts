import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import JobOrder from '@/lib/models/JobOrder';
import { UpdateJobOrderInput } from '@/types';

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
    
    return NextResponse.json({ jobOrder });
  } catch (error: any) {
    console.error('Error updating job order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update job order' },
      { status: 500 }
    );
  }
}
