import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import JobOrder from '@/lib/models/JobOrder';
import PurchaseOrder from '@/lib/models/PurchaseOrder';
import { MaterialTransferItem } from '@/types';

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
    const existingTransfer = jobOrder.materialTransfer || { items: [] };
    const updatedTransfer = {
      items: body.items || existingTransfer.items || [],
      transferNotes: body.transferNotes !== undefined ? body.transferNotes : existingTransfer.transferNotes,
      transferCompleted: body.transferCompleted !== undefined ? body.transferCompleted : (existingTransfer.transferCompleted || false),
      transferCompletedDate: body.transferCompleted ? new Date().toISOString() : existingTransfer.transferCompletedDate,
      transferCompletedBy: body.transferCompleted ? (body.transferCompletedBy || 'Unknown') : existingTransfer.transferCompletedBy,
    };

    // Update job order
    jobOrder.materialTransfer = updatedTransfer as any;
    
    // If transfer is completed, ensure Job Order is IN_PROGRESS (if not already completed/closed)
    if (body.transferCompleted && jobOrder.status !== 'COMPLETED' && jobOrder.status !== 'CLOSED') {
      if (jobOrder.status !== 'IN_PROGRESS') {
        jobOrder.status = 'IN_PROGRESS';
      }
    }

    await jobOrder.save();

    return NextResponse.json({ 
      jobOrder,
      message: body.transferCompleted ? 'Material transfer completed successfully' : 'Material transfer updated successfully'
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

