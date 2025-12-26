import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ServiceRequest from '@/lib/models/ServiceRequest';
import JobOrder from '@/lib/models/JobOrder';
import { CreateJobOrderInput } from '@/types';

export async function GET() {
  try {
    await connectDB();
    const jobOrders = await JobOrder.find({})
      .populate('srId', 'srNumber requestedBy department')
      .sort({ createdAt: -1 });
    return NextResponse.json({ jobOrders });
  } catch (error) {
    console.error('Error fetching job orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job orders' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const body: { srId: string; input?: CreateJobOrderInput } = await request.json();
    const { srId, input = {} as CreateJobOrderInput } = body;
    
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
        withinApprovedBudget: false,
      },
      acceptance: {},
      approvals: [],
      status: 'DRAFT',
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
    const verifySave = await JobOrder.findById(jobOrder._id).lean();
    console.log('After save verification:', {
      _id: verifySave?._id,
      type: (verifySave as any)?.type,
      joNumber: (verifySave as any)?.joNumber,
      allFields: Object.keys(verifySave || {})
    });
    
    // Reload the jobOrder object to get the updated type
    const savedJO = await JobOrder.findById(jobOrder._id);
    if (savedJO) {
      (savedJO as any).type = jobOrderType;
      await savedJO.save();
    }
    
    // Final verification
    const finalCheck = await JobOrder.findById(jobOrder._id).lean();
    console.log('Final type check:', {
      type: (finalCheck as any)?.type,
      expected: jobOrderType,
      match: (finalCheck as any)?.type === jobOrderType
    });
    
    // Populate service request for response
    await jobOrder.populate('srId', 'srNumber requestedBy department');
    
    // Notify relevant approvers about new Job Order
    const { notifyJobOrderCreated } = await import('@/lib/utils/notifications');
    await notifyJobOrderCreated(
      jobOrder._id.toString(),
      jobOrder.joNumber,
      jobOrderType as 'SERVICE' | 'MATERIAL_REQUISITION'
    );
    
    return NextResponse.json({ jobOrder }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating job order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create job order' },
      { status: 500 }
    );
  }
}
