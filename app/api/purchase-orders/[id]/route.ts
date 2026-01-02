import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import PurchaseOrder from '@/lib/models/PurchaseOrder';
import JobOrder from '@/lib/models/JobOrder';
import { POStatus } from '@/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const purchaseOrder = await PurchaseOrder.findById(id)
      .populate('joId')
      .populate('srId');
    
    if (!purchaseOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ purchaseOrder });
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase order' },
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
    const body: { 
      status?: POStatus; 
      items?: any[]; 
      supplierName?: string;
      supplierContact?: string;
      supplierAddress?: string;
      tax?: number;
      expectedDeliveryDate?: string;
      actualDeliveryDate?: string;
      deliveryNotes?: string;
    } = await request.json();

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (body.status !== undefined) {
      const previousPO = await PurchaseOrder.findById(id);
      const wasSubmitted = previousPO?.status === 'SUBMITTED';
      const isNowSubmitted = body.status === 'SUBMITTED';
      
      updateData.status = body.status;
      if (body.status === 'CLOSED') {
        updateData.closedAt = new Date().toISOString();
      }
      
      // Notify President when PO is submitted for approval
      if (!wasSubmitted && isNowSubmitted) {
        const { notifyPurchaseOrderNeedsApproval } = await import('@/lib/utils/notifications');
        if (previousPO) {
          await notifyPurchaseOrderNeedsApproval(
            id,
            previousPO.poNumber,
            previousPO.requestedBy,
            previousPO.department
          );
        }
      }
      
      // Auto-update Job Order status when PO is RECEIVED
      if (body.status === 'RECEIVED') {
        const currentPO = await PurchaseOrder.findById(id);
        if (currentPO) {
          const joId = (currentPO as any).joId?.toString() || currentPO.joId;
          if (joId) {
            const jobOrder = await JobOrder.findById(joId);
            if (jobOrder && jobOrder.status !== 'IN_PROGRESS' && jobOrder.status !== 'COMPLETED') {
              // Only update if not already in progress or completed
              jobOrder.status = 'IN_PROGRESS';
              if (!jobOrder.acceptance?.actualStartDate) {
                jobOrder.acceptance = {
                  ...(jobOrder.acceptance || {}),
                  actualStartDate: new Date().toISOString(),
                };
              }
              await jobOrder.save();
              console.log(`Job Order ${jobOrder.joNumber} automatically set to IN_PROGRESS when PO was RECEIVED`);
            }
          }
        }
      }
    }

    if (body.items !== undefined) {
      updateData.items = body.items;
      // Recalculate totals
      const subtotal = body.items.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);
      updateData.subtotal = subtotal;
      updateData.totalAmount = subtotal + (body.tax || updateData.tax || 0);
    }

    if (body.supplierName !== undefined) updateData.supplierName = body.supplierName;
    if (body.supplierContact !== undefined) updateData.supplierContact = body.supplierContact;
    if (body.supplierAddress !== undefined) updateData.supplierAddress = body.supplierAddress;
    if (body.tax !== undefined) {
      updateData.tax = body.tax;
      // Recalculate total if items exist
      if (body.items) {
        const subtotal = body.items.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);
        updateData.totalAmount = subtotal + body.tax;
      }
    }
    if (body.expectedDeliveryDate !== undefined) updateData.expectedDeliveryDate = body.expectedDeliveryDate;
    if (body.actualDeliveryDate !== undefined) updateData.actualDeliveryDate = body.actualDeliveryDate;
    if (body.deliveryNotes !== undefined) updateData.deliveryNotes = body.deliveryNotes;

    const purchaseOrder = await PurchaseOrder.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('joId').populate('srId');
    
    if (!purchaseOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ purchaseOrder });
  } catch (error: any) {
    console.error('Error updating purchase order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update purchase order' },
      { status: 500 }
    );
  }
}

