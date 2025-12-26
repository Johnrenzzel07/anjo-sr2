import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ServiceRequest from '@/lib/models/ServiceRequest';

export async function GET() {
  try {
    await connectDB();
    const approvedSRs = await ServiceRequest.find({ status: 'APPROVED' }).sort({ createdAt: -1 });
    return NextResponse.json({ serviceRequests: approvedSRs });
  } catch (error) {
    console.error('Error fetching approved service requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch approved service requests' },
      { status: 500 }
    );
  }
}
