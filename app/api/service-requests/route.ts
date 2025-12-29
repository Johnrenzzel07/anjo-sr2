import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ServiceRequest from '@/lib/models/ServiceRequest';
import { getAuthUser } from '@/lib/auth';
import { getServiceCategoriesForDepartment } from '@/lib/utils/joAuthorization';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    // Get pagination and filter parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '9', 10);
    const skip = parseInt(searchParams.get('skip') || '0', 10);
    const status = searchParams.get('status'); // Optional status filter
    const department = searchParams.get('department'); // Optional department filter (for filtering by service category)
    
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
    
    // For APPROVER role, show:
    // 1. SUBMITTED SRs from their own department (for approval)
    // 2. APPROVED SRs that match their handling service category (for JO creation)
    if (department) {
      const normalizeDept = (dept: string) => dept.toLowerCase().replace(/\s+department$/, '').trim();
      const deptNorm = normalizeDept(department);
      const serviceCategories = getServiceCategoriesForDepartment(department);
      
      // Build OR query: own department's SRs OR approved SRs they can create JO for
      const deptConditions: any[] = [];
      
      // Condition 1: SRs from their own department (for approval)
      deptConditions.push({
        department: { $regex: new RegExp(`^${deptNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s+department)?$`, 'i') }
      });
      
      // Condition 2: APPROVED SRs with service categories they handle (for JO creation)
      if (serviceCategories.length > 0) {
        deptConditions.push({
          status: 'APPROVED',
          serviceCategory: { $in: serviceCategories }
        });
      }
      
      // Combine with $or
      if (query.$or) {
        // If there's already an $or (from REQUESTER filter), use $and
        query = { $and: [query, { $or: deptConditions }] };
      } else {
        query.$or = deptConditions;
      }
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
    
    // Notify the HANDLING Department Head about new Service Request (based on service category)
    const { notifyServiceRequestSubmitted } = await import('@/lib/utils/notifications');
    await notifyServiceRequestSubmitted(
      serviceRequest._id.toString(),
      serviceRequest.srNumber,
      serviceRequest.requestedBy,
      serviceRequest.department,
      serviceRequest.serviceCategory // Pass service category to notify the correct handling department
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
