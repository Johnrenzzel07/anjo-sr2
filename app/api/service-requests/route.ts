import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ServiceRequest from '@/lib/models/ServiceRequest';
import JobOrder from '@/lib/models/JobOrder';
import mongoose from 'mongoose';
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

    // If user is a requester, filter by their email, name, or department
    if (authUser && authUser.role === 'REQUESTER') {
      const userEmail = (authUser.email || '').trim().toLowerCase();
      const userName = (authUser.name || '').trim().toLowerCase();
      const userDepartment = (authUser.department || '').trim().toLowerCase();

      const requesterConditions: any[] = [];

      // Match by exact email
      if (userEmail) {
        requesterConditions.push({ contactEmail: { $regex: new RegExp(`^${userEmail}$`, 'i') } });
      }

      // Match by exact name
      if (userName) {
        requesterConditions.push({ requestedBy: { $regex: new RegExp(`^${userName}$`, 'i') } });
        // Also match if requestedBy contains the user's name
        requesterConditions.push({ requestedBy: { $regex: new RegExp(userName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } });
      }

      // Match by department (users can see all SRs from their department)
      if (userDepartment) {
        requesterConditions.push({ department: { $regex: new RegExp(`^${userDepartment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s+department)?$`, 'i') } });
      }

      if (requesterConditions.length > 0) {
        query.$or = requesterConditions;
      }
    }

    if (status === 'everything') {
      // Don't filter by status at all - used for absolute total counts
    } else if (status === 'all') {
      // When "All" is selected, show ALL statuses without any exclusions
      // No status filter applied
    } else if (status) {
      // Specific status selected
      query.status = status;
    } else if (authUser && authUser.role === 'REQUESTER') {
      // For REQUESTER: Show all their requests including REJECTED (but not DRAFT)
      query.status = { $nin: ['DRAFT'] };
    } else {
      // DEFAULT VIEW for admins/approvers: Exclude REJECTED and DRAFT status
      // This ensures they only appear when specifically filtered
      query.status = { $nin: ['REJECTED', 'DRAFT'] };
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

    // Get Service Request IDs that already have Job Orders
    // Only exclude SRs with Job Orders when viewing "All Status" (no specific status filter)
    // When a specific status is selected, show all SRs with that status (including ones with Job Orders)
    // When status is explicitly 'all', show everything including SRs with Job Orders
    const excludeHasJO = searchParams.get('excludeHasJO') !== 'false' && !status;
    let srIdsWithJO: mongoose.Types.ObjectId[] = [];
    if (excludeHasJO) {
      const jobOrders = await JobOrder.find({}, { srId: 1 }).lean();
      srIdsWithJO = jobOrders
        .map(jo => {
          const srId = (jo as any).srId;
          if (!srId) return null;
          try {
            return typeof srId === 'string' ? new mongoose.Types.ObjectId(srId) : srId;
          } catch {
            return null;
          }
        })
        .filter((id): id is mongoose.Types.ObjectId => id !== null);
    }

    // Use aggregation to sort by status priority (SUBMITTED first), then by createdAt
    const pipeline: any[] = [
      { $match: query },
      // Exclude Service Requests that already have Job Orders (only when viewing all statuses)
      ...(excludeHasJO && srIdsWithJO.length > 0 ? [{
        $match: {
          _id: { $nin: srIdsWithJO }
        }
      }] : []),
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

    // Build count query with same exclusions
    let countQuery: any = { ...query };
    if (excludeHasJO && srIdsWithJO.length > 0) {
      countQuery._id = { $nin: srIdsWithJO };
    }

    const [serviceRequests, totalCount] = await Promise.all([
      ServiceRequest.aggregate(pipeline),
      ServiceRequest.countDocuments(countQuery)
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
      serviceRequest.serviceCategory, // Pass service category to notify the correct handling department
      serviceRequest.contactEmail // Pass requester email to notify them
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
