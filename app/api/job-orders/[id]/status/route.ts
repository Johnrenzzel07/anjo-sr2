import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import JobOrder from '@/lib/models/JobOrder';
import { JOStatus } from '@/types';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body: { status: JOStatus } = await request.json();

    const updateData: any = {
      status: body.status,
      updatedAt: new Date().toISOString(),
    };

    if (body.status === 'CLOSED') {
      updateData.closedAt = new Date().toISOString();
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
    console.error('Error updating status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update status' },
      { status: 500 }
    );
  }
}
