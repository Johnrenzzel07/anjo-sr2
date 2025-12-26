import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ServiceRequest from '@/lib/models/ServiceRequest';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const serviceRequest = await ServiceRequest.findById(id);
    
    if (!serviceRequest) {
      return NextResponse.json(
        { error: 'Service request not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ serviceRequest });
  } catch (error) {
    console.error('Error fetching service request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch service request' },
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
    const body = await request.json();
    
    const serviceRequest = await ServiceRequest.findByIdAndUpdate(
      id,
      { ...body, updatedAt: new Date().toISOString() },
      { new: true, runValidators: true }
    );
    
    if (!serviceRequest) {
      return NextResponse.json(
        { error: 'Service request not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ serviceRequest });
  } catch (error: any) {
    console.error('Error updating service request:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update service request' },
      { status: 500 }
    );
  }
}
