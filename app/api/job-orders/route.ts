import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ServiceRequest from '@/lib/models/ServiceRequest';
import JobOrder from '@/lib/models/JobOrder';
import { CreateJobOrderInput } from '@/types';
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
    const department = searchParams.get('department'); // Optional department filter
    const srId = searchParams.get('srId'); // Optional service request ID filter

    // Get current user if authenticated
    const authUser = getAuthUser(request);

    // Helper to normalize department names
    const normalizeDept = (dept: string) => dept.toLowerCase().replace(/\s+department$/, '').trim();

    // Build base query
    let query: any = {};

    // Filter by service request ID if provided
    if (srId) {
      query.srId = srId;
    }


    // Apply status filter if provided
    // By default, exclude CLOSED status unless explicitly requested
    const includeClosed = searchParams.get('includeClosed') === 'true';
    if (status === 'everything') {
      // Don't filter by status at all
    } else if (status === 'all') {
      // When "All" is selected, show ALL statuses without any exclusions
      // No status filter applied
    } else if (status) {
      // Specific status selected
      query.status = status;
    } else {
      // Exclude CLOSED and REJECTED status by default when no specific status is requested
      query.status = { $nin: ['CLOSED', 'REJECTED'] };
    }

    // Apply department filter if provided or if user is APPROVER with department
    let departmentFilter = department;
    if (!departmentFilter && authUser && authUser.role === 'APPROVER' && authUser.department) {
      departmentFilter = authUser.department;
    }

    if (departmentFilter) {
      const userDeptNorm = normalizeDept(departmentFilter);

      // Finance should not see PENDING_CANVASS status (only Purchasing sees those)
      if (userDeptNorm === 'finance') {
        if (query.status && query.status.$nin && Array.isArray(query.status.$nin)) {
          // Already has $nin array (like ['CLOSED', 'REJECTED']), add PENDING_CANVASS
          query.status.$nin.push('PENDING_CANVASS');
        } else if (!query.status) {
          // No status filter set yet (status='all' or status='everything')
          query.status = { $ne: 'PENDING_CANVASS' };
        } else if (typeof query.status === 'string') {
          // Specific status selected
          if (query.status === 'PENDING_CANVASS') {
            // Trying to view PENDING_CANVASS explicitly - block it
            query.status = 'NONEXISTENT_STATUS_BLOCK';
          }
          // Otherwise leave it as is (e.g., 'DRAFT', 'APPROVED', etc.)
        }
      }

      // Special cases: Operations, Finance, Purchasing, and President should see ALL Job Orders
      if (userDeptNorm !== 'operations' && userDeptNorm !== 'finance' && userDeptNorm !== 'purchasing' && userDeptNorm !== 'president') {
        // Show JOs where EITHER:
        // 1. Service category matches what this department handles (handling department view)
        // 2. OR requester's department matches user's department (requester's department head view)
        const serviceCategories = getServiceCategoriesForDepartment(departmentFilter);

        const conditions: any[] = [];

        // Condition 1: Service category matches what this department handles
        if (serviceCategories.length > 0) {
          conditions.push({ serviceCategory: { $in: serviceCategories } });
        }

        // Condition 2: Requester's department matches user's department
        conditions.push({
          department: { $regex: new RegExp(`^${userDeptNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s+department)?$`, 'i') }
        });

        // Combine with $or
        if (conditions.length > 0) {
          query.$or = conditions;
        }
      }
    }

    // Use aggregation to sort by status priority, then by createdAt, with pagination
    const pipeline: any[] = [
      { $match: query },
      {
        $addFields: {
          statusPriority: {
            $switch: {
              branches: [
                { case: { $eq: ['$status', 'PENDING_CANVASS'] }, then: 0 },
                { case: { $eq: ['$status', 'DRAFT'] }, then: 1 },
                { case: { $eq: ['$status', 'BUDGET_CLEARED'] }, then: 2 },
                { case: { $eq: ['$status', 'APPROVED'] }, then: 3 },
                { case: { $eq: ['$status', 'IN_PROGRESS'] }, then: 4 },
                { case: { $eq: ['$status', 'COMPLETED'] }, then: 5 },
                { case: { $eq: ['$status', 'CLOSED'] }, then: 6 }
              ],
              default: 99
            }
          }
        }
      },
      { $sort: { statusPriority: 1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $addFields: {
          srIdString: {
            $cond: {
              if: { $eq: [{ $type: '$srId' }, 'string'] },
              then: '$srId',
              else: { $toString: '$srId' }
            }
          }
        }
      },
      {
        $lookup: {
          from: 'servicerequests',
          let: { srIdStr: '$srIdString' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [{ $toString: '$_id' }, '$$srIdStr']
                }
              }
            }
          ],
          as: 'srId_populated'
        }
      },
      {
        $lookup: {
          from: 'purchaseorders',
          let: { joIdStr: { $toString: '$_id' } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$joId', '$$joIdStr']
                }
              }
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 }
          ],
          as: 'po_populated'
        }
      },
      {
        $unwind: {
          path: '$srId_populated',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $unwind: {
          path: '$po_populated',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          joNumber: 1,
          type: 1,
          dateIssued: 1,
          requestedBy: 1,
          department: 1,
          contactPerson: 1,
          priorityLevel: 1,
          targetStartDate: 1,
          targetCompletionDate: 1,
          serviceCategory: 1,
          workDescription: 1,
          location: 1,
          reason: 1,
          materials: 1,
          manpower: 1,
          schedule: 1,
          budget: 1,
          acceptance: 1,
          approvals: 1,
          status: 1,
          materialTransfer: 1,
          createdAt: 1,
          updatedAt: 1,
          hasPurchaseOrder: { $gt: [{ $type: '$po_populated' }, 'missing'] },
          poStatus: '$po_populated.status',
          srId: {
            $cond: {
              if: { $ne: ['$srId_populated', null] },
              then: '$srId_populated._id',
              else: '$srId'
            }
          },
          serviceRequest: {
            $cond: {
              if: { $ne: ['$srId_populated', null] },
              then: {
                _id: '$srId_populated._id',
                srNumber: '$srId_populated.srNumber',
                requestedBy: '$srId_populated.requestedBy',
                department: '$srId_populated.department',
                id: { $toString: '$srId_populated._id' }
              },
              else: null
            }
          }
        }
      }
    ];

    // Count total matching documents (before pagination) - uses the filtered query
    const totalCount = await JobOrder.countDocuments(query);

    // Get paginated results
    const jobOrders = await JobOrder.aggregate(pipeline);

    // Transform to ensure serviceRequest is properly set
    const transformedJobOrders = jobOrders.map((jo: any) => {
      if (jo.serviceRequest) {
        return {
          ...jo,
          serviceRequest: {
            ...jo.serviceRequest,
            id: jo.serviceRequest.id || jo.serviceRequest._id?.toString(),
          },
          srId: jo.srId?.toString() || jo.srId,
        };
      }
      return jo;
    });

    return NextResponse.json({
      jobOrders: transformedJobOrders,
      totalCount,
      hasMore: skip + limit < totalCount
    });
  } catch (error) {
    console.error('Error fetching job orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job orders' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body: { srId: string; input?: CreateJobOrderInput } = await request.json();
    const { srId, input = {} as CreateJobOrderInput } = body;

    // Get current user who is creating the Job Order
    const authUser = getAuthUser(request);

    // Ensure type is provided, default to SERVICE if not
    const jobOrderType = input.type || 'SERVICE';

    // Validate that SR exists and is approved
    const sr = await ServiceRequest.findById(srId);
    if (!sr) {
      return NextResponse.json(
        { error: 'Service request not found' },
        { status: 404 }
      );
    }

    if (sr.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Service request must be APPROVED to create Job Order' },
        { status: 400 }
      );
    }

    // Check if JO already exists for this SR - prevent duplicates (check first)
    const existingJO = await JobOrder.findOne({ srId: sr._id.toString() });
    if (existingJO) {
      return NextResponse.json(
        { error: `Job Order already exists for this Service Request. Existing JO: ${existingJO.joNumber}` },
        { status: 400 }
      );
    }

    // Check if department head has approved
    const departmentHeadApproved = sr.approvals?.some(
      (a: any) => a.role === 'DEPARTMENT_HEAD' && a.action === 'APPROVED'
    );

    // If status is APPROVED, allow Job Order creation
    // If there's an explicit approval record, that's preferred, but if status is APPROVED
    // we allow it for backward compatibility with older records
    if (sr.status === 'APPROVED') {
      // Status is APPROVED, allow creation
      // Log if no explicit approval record for debugging
      if (!departmentHeadApproved) {
        console.warn(`Service Request ${sr.srNumber} is APPROVED but has no Department Head approval record. Allowing Job Order creation.`);
      }
    } else {
      // Status is not APPROVED, require explicit department head approval
      if (!departmentHeadApproved) {
        return NextResponse.json(
          { error: 'Service request must be approved by Department Head before creating Job Order' },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString();

    // Log the type being set
    console.log('Creating Job Order:', {
      srId: sr._id.toString(),
      type: jobOrderType,
      hasTypeInInput: !!input.type,
      inputType: input.type
    });

    // Create job order with explicit type field
    const jobOrder = new JobOrder({
      srId: sr._id.toString(),
      type: jobOrderType, // Explicitly set type
      dateIssued: now,
      requestedBy: sr.requestedBy,
      department: sr.department,
      contactPerson: sr.contactPerson,
      priorityLevel: sr.priority,
      targetStartDate: sr.targetStartDate,
      targetCompletionDate: sr.targetCompletionDate,
      serviceCategory: sr.serviceCategory,
      workDescription: input.workDescription || sr.workDescription,
      location: sr.location,
      reason: sr.reason,
      materials: input.materials || [],
      manpower: {
        assignedUnit: '',
        supervisorInCharge: '',
        supervisorDept: '',
        ...input.manpower,
      },
      schedule: input.schedule || [],
      budget: {
        estimatedTotalCost: 0,
        budgetSource: sr.budgetSource || '',
        costCenter: sr.budgetSource || '',
      },
      acceptance: {},
      approvals: [],
      // For Material Requisition, start with PENDING_CANVASS so Purchasing can add pricing first
      status: jobOrderType === 'MATERIAL_REQUISITION' ? 'PENDING_CANVASS' : 'DRAFT',
    });

    // Explicitly set the type field using set() to ensure it's properly set
    (jobOrder as any).set('type', jobOrderType);

    // Log before save to verify type is set
    const beforeSave = (jobOrder as any).toObject();
    console.log('Job Order before save:', {
      _id: jobOrder._id,
      type: beforeSave.type,
      typeFromGet: (jobOrder as any).get('type'),
      isModified: (jobOrder as any).isModified('type'),
      fullObject: JSON.stringify(beforeSave, null, 2)
    });

    // Save the document
    await jobOrder.save();

    // Force update the type field directly using updateOne to ensure it's saved
    // This is a workaround in case there's an issue with the initial save
    await JobOrder.updateOne(
      { _id: jobOrder._id },
      { $set: { type: jobOrderType } }
    );

    // After save, verify it was saved by querying the database directly
    const verifySave = await JobOrder.findById(jobOrder._id).lean() as any;
    console.log('After save verification:', {
      _id: verifySave?._id,
      type: verifySave?.type,
      joNumber: verifySave?.joNumber,
      allFields: Object.keys(verifySave || {})
    });

    // Reload the jobOrder object to get the updated type
    const savedJO = await JobOrder.findById(jobOrder._id);
    if (savedJO) {
      (savedJO as any).type = jobOrderType;
      await savedJO.save();
    }

    // Final verification
    const finalCheck = await JobOrder.findById(jobOrder._id).lean() as any;
    console.log('Final type check:', {
      type: finalCheck?.type,
      expected: jobOrderType,
      match: finalCheck?.type === jobOrderType
    });

    // Populate service request for response
    await jobOrder.populate('srId', 'srNumber requestedBy department');

    // Notify relevant approvers about new Job Order
    // For Material Requisition, notify Purchasing Department first
    const { notifyJobOrderCreated, notifyPurchasingForCanvass } = await import('@/lib/utils/notifications');

    if (jobOrderType === 'MATERIAL_REQUISITION') {
      // Notify Purchasing Department for canvassing
      await notifyPurchasingForCanvass(
        jobOrder._id.toString(),
        jobOrder.joNumber,
        authUser?.name || 'Unknown User',
        authUser?.department || 'Unknown Department'
      );
      // Also notify requester for Material Requisition
      await notifyJobOrderCreated(
        jobOrder._id.toString(),
        jobOrder.joNumber,
        'MATERIAL_REQUISITION',
        authUser?.name || 'Unknown User',
        authUser?.department || 'Unknown Department',
        sr.contactEmail
      );
    } else {
      // Standard notification for SERVICE type
      await notifyJobOrderCreated(
        jobOrder._id.toString(),
        jobOrder.joNumber,
        jobOrderType as 'SERVICE' | 'MATERIAL_REQUISITION',
        authUser?.name || 'Unknown User',
        authUser?.department || 'Unknown Department',
        sr.contactEmail
      );
    }

    return NextResponse.json({ jobOrder }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating job order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create job order' },
      { status: 500 }
    );
  }
}
