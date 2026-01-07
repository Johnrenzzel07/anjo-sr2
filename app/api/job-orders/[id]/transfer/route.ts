import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import JobOrder from '@/lib/models/JobOrder';
import PurchaseOrder from '@/lib/models/PurchaseOrder';
import { MaterialTransferItem, MaterialTransferInfo } from '@/types';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body: {
      items: MaterialTransferItem[];
      transferNotes?: string;
      transferCompleted?: boolean;
      transferCompletedBy?: string;
    } = await request.json();

    const jobOrder = await JobOrder.findById(id);
    if (!jobOrder) {
      return NextResponse.json(
        { error: 'Job Order not found' },
        { status: 404 }
      );
    }

    // Verify that PO is RECEIVED before allowing transfer
    const purchaseOrder = await PurchaseOrder.findOne({ joId: id });
    if (!purchaseOrder || purchaseOrder.status !== 'RECEIVED') {
      return NextResponse.json(
        { error: 'Purchase Order must be RECEIVED before materials can be transferred' },
        { status: 400 }
      );
    }

    // Initialize or update material transfer
    const existingTransfer: MaterialTransferInfo = jobOrder.materialTransfer || {
      items: [],
      transferCompleted: false,
    };
    const updatedTransfer: MaterialTransferInfo = {
      items: body.items || existingTransfer.items || [],
      transferNotes: body.transferNotes !== undefined ? body.transferNotes : existingTransfer.transferNotes,
      transferCompleted: body.transferCompleted !== undefined ? body.transferCompleted : (existingTransfer.transferCompleted || false),
      transferCompletedDate: body.transferCompleted ? new Date().toISOString() : existingTransfer.transferCompletedDate,
      transferCompletedBy: body.transferCompleted ? (body.transferCompletedBy || 'Unknown') : existingTransfer.transferCompletedBy,
    };

    // Update job order
    jobOrder.materialTransfer = updatedTransfer;

    // If transfer is completed, update Job Order status
    if (body.transferCompleted && jobOrder.status !== 'COMPLETED' && jobOrder.status !== 'CLOSED') {
      if (jobOrder.type === 'MATERIAL_REQUISITION') {
        // For Material Requisition, transfer completion means the JO is COMPLETED
        jobOrder.status = 'COMPLETED';
        jobOrder.acceptance = {
          ...(jobOrder.acceptance || {}),
          actualCompletionDate: new Date().toISOString(),
          workCompletionNotes: body.transferNotes || 'Materials transferred successfully.',
        };
      } else if (jobOrder.status !== 'IN_PROGRESS') {
        // For Service Type, transfer completion moves it to IN_PROGRESS so work can begin
        jobOrder.status = 'IN_PROGRESS';
        jobOrder.acceptance = {
          ...(jobOrder.acceptance || {}),
          actualStartDate: new Date().toISOString(),
        };
      }
    }

    await jobOrder.save();

    // If completed, send notifications
    if (body.transferCompleted && jobOrder.type === 'MATERIAL_REQUISITION') {
      try {
        const { notifyJobOrderFulfillmentCompleted } = await import('@/lib/utils/notifications');
        await notifyJobOrderFulfillmentCompleted(
          jobOrder._id.toString(),
          jobOrder.joNumber,
          jobOrder.department
        );
      } catch (notifError) {
        console.error('Error sending fulfillment notification:', notifError);
      }
    }

    return NextResponse.json({
      jobOrder,
      message: body.transferCompleted && jobOrder.type === 'MATERIAL_REQUISITION' ? 'Material transfer completed and Job Order fulfilled' : (body.transferCompleted ? 'Material transfer completed successfully' : 'Material transfer updated successfully')
    });
  } catch (error: any) {
    console.error('Error updating material transfer:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update material transfer' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    const jobOrder = await JobOrder.findById(id);
    if (!jobOrder) {
      return NextResponse.json(
        { error: 'Job Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      materialTransfer: jobOrder.materialTransfer || null
    });
  } catch (error: any) {
    console.error('Error fetching material transfer:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch material transfer' },
      { status: 500 }
    );
  }
}

