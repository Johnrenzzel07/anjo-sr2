import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import PurchaseOrder from '@/lib/models/PurchaseOrder';
import JobOrder from '@/lib/models/JobOrder';
import { CreatePurchaseOrderInput } from '@/types';

export async function GET(request: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const joId = searchParams.get('joId');
    
    if (joId) {
      // Get PO for specific Job Order
      const purchaseOrder = await PurchaseOrder.findOne({ joId })
        .populate('joId', 'joNumber type')
        .populate('srId', 'srNumber');
      return NextResponse.json({ purchaseOrders: purchaseOrder ? [purchaseOrder] : [] });
    }
    
    // Get all purchase orders
    const purchaseOrders = await PurchaseOrder.find({})
      .populate('joId', 'joNumber type')
      .populate('srId', 'srNumber')
      .sort({ createdAt: -1 });
    return NextResponse.json({ purchaseOrders });
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase orders' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const body: CreatePurchaseOrderInput = await request.json();
    const { joId, items, supplierName, supplierContact, supplierAddress, tax = 0, expectedDeliveryDate } = body;

    // Validate that JO exists and is Material Requisition type
    // Use lean() to get plain object and ensure type field is included
    const jobOrder = await JobOrder.findById(joId).lean();
    if (!jobOrder) {
      return NextResponse.json(
        { error: 'Job Order not found' },
        { status: 404 }
      );
    }

    // Check type - handle both cases where type might be missing or different
    const jobOrderType = (jobOrder as any)?.type;
    const joNumber = (jobOrder as any).joNumber;
    
    console.log('PO Creation - Job Order Check:', {
      joId,
      joNumber,
      type: jobOrderType,
      typeExists: !!jobOrderType,
      isMaterialRequisition: jobOrderType === 'MATERIAL_REQUISITION'
    });
    
    if (!jobOrderType || jobOrderType !== 'MATERIAL_REQUISITION') {
      return NextResponse.json(
        { 
          error: 'Purchase Order can only be created from Material Requisition Job Orders',
          details: `Job Order ${joNumber || joId} has type: "${jobOrderType || 'NOT SET'}". You must create a NEW Job Order and select "Material Requisition" as the type when creating it.`,
          jobOrderType: jobOrderType || 'NOT SET',
          jobOrderNumber: joNumber,
          solution: 'Go back and create a new Job Order. In the form, select "Material Requisition" (not "Service") as the Job Order Type.'
        },
        { status: 400 }
      );
    }

    // Check if PO already exists for this JO
    const existingPO = await PurchaseOrder.findOne({ joId });
    if (existingPO) {
      return NextResponse.json(
        { error: 'Purchase Order already exists for this Job Order' },
        { status: 400 }
      );
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    const totalAmount = subtotal + (tax || 0);

    const now = new Date().toISOString();

    // Ensure all items have expectedDeliveryDate field (use item-level or fallback to primary)
    const itemsWithDeliveryDates = items.map(item => ({
      ...item,
      expectedDeliveryDate: item.expectedDeliveryDate || expectedDeliveryDate || '',
    }));

    console.log('PO Creation - Items with delivery dates:', itemsWithDeliveryDates.map(item => ({
      item: item.item,
      expectedDeliveryDate: item.expectedDeliveryDate,
    })));

    const purchaseOrder = new PurchaseOrder({
      joId: jobOrder._id.toString(),
      srId: jobOrder.srId,
      dateRequested: now,
      requestedBy: jobOrder.requestedBy,
      department: jobOrder.department,
      priority: jobOrder.priorityLevel,
      items: itemsWithDeliveryDates, // Use items with delivery dates
      supplierName: supplierName || '',
      supplierContact: supplierContact || '',
      supplierAddress: supplierAddress || '',
      subtotal: subtotal,
      tax: tax,
      totalAmount: totalAmount,
      status: 'DRAFT',
      expectedDeliveryDate: expectedDeliveryDate || '', // Primary delivery date (fallback)
    });

    await purchaseOrder.save();
    await purchaseOrder.populate('joId', 'joNumber type');
    await purchaseOrder.populate('srId', 'srNumber');
    
    return NextResponse.json({ purchaseOrder }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating purchase order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create purchase order' },
      { status: 500 }
    );
  }
}

