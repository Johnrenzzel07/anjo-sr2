import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ServiceRequest from '@/lib/models/ServiceRequest';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    // Get pagination and filter parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '9', 10);
    const skip = parseInt(searchParams.get('skip') || '0', 10);
    const status = searchParams.get('status'); // Optional status filter
    const department = searchParams.get('department'); // Optional department filter
    
    // Get current user if authenticated
    const authUser = getAuthUser(request);
    
    // Build base query
    let query: any = {};
    
    // If user is a requester, filter by their email or name
    if (authUser && authUser.role === 'REQUESTER') {
      const userEmail = (authUser.email || '').trim().toLowerCase();
      const userName = (authUser.name || '').trim().toLowerCase();
      
      query = {
        $or: [
          { contactEmail: { $regex: new RegExp(`^${userEmail}$`, 'i') } },
          { requestedBy: { $regex: new RegExp(`^${userName}$`, 'i') } }
        ]
      };
    }
    
    // Apply status filter if provided
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Apply department filter if provided (for APPROVER role)
    if (department) {
      // Normalize department name for matching
      const normalizeDept = (dept: string) => dept.toLowerCase().replace(/\s+department$/, '').trim();
      const deptNorm = normalizeDept(department);
      
      // Use regex to match department (case-insensitive, handles "IT" vs "IT Department")
      query.department = { $regex: new RegExp(`^${deptNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s+department)?$`, 'i') };
    }
    
    // Use aggregation to sort by status priority (SUBMITTED first), then by createdAt
    const pipeline: any[] = [
      { $match: query },
      {
        $addFields: {
          statusPriority: {
            $switch: {
              branches: [
                { case: { $eq: ['$status', 'SUBMITTED'] }, then: 1 },
                { case: { $eq: ['$status', 'APPROVED'] }, then: 2 },
                { case: { $eq: ['$status', 'REJECTED'] }, then: 3 },
                { case: { $eq: ['$status', 'DRAFT'] }, then: 4 }
              ],
              default: 5
            }
          }
        }
      },
      { $sort: { statusPriority: 1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    ];
    
    const [serviceRequests, totalCount] = await Promise.all([
      ServiceRequest.aggregate(pipeline),
      ServiceRequest.countDocuments(query)
    ]);
    
    return NextResponse.json({ 
      serviceRequests,
      totalCount,
      hasMore: skip + limit < totalCount
    });
  } catch (error) {
    console.error('Error fetching service requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch service requests' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const body = await request.json();
    
    // Set default date if not provided
    const dateOfRequest = body.dateOfRequest || new Date().toISOString().split('T')[0];
    const timeOfRequest = body.timeOfRequest || new Date().toTimeString().slice(0, 5);
    
    const serviceRequest = new ServiceRequest({
      requestedBy: body.requestedBy,
      department: body.department,
      contactPerson: body.contactPerson || body.requestedBy,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      dateOfRequest,
      timeOfRequest,
      priority: body.priority || body.requestUrgency || 'MEDIUM',
      serviceCategory: body.serviceCategory,
      workDescription: body.workDescription || body.detailedDescription,
      briefSubject: body.briefSubject,
      location: body.location,
      reason: body.reason,
      budgetSource: body.budgetSource,
      status: 'SUBMITTED',
    });

    await serviceRequest.save();
    
    // Notify Department Head about new Service Request
    const { notifyServiceRequestSubmitted } = await import('@/lib/utils/notifications');
    await notifyServiceRequestSubmitted(
      serviceRequest._id.toString(),
      serviceRequest.srNumber,
      serviceRequest.requestedBy,
      serviceRequest.department
    );
    
    return NextResponse.json({ serviceRequest }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating service request:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create service request' },
      { status: 500 }
    );
  }
}
