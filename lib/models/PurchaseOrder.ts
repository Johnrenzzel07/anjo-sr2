import mongoose, { Schema, models, model } from 'mongoose';
import { PurchaseOrder as IPurchaseOrder, PriorityLevel, POStatus } from '@/types';

const SupplierInfoSchema = new Schema({
  name: String,
  contact: String,
  address: String,
}, { _id: false });

const PurchaseOrderItemSchema = new Schema({
  id: String,
  materialItemId: String,
  item: String,
  description: String,
  quantity: Number,
  unit: String,
  unitPrice: Number,
  totalPrice: Number,
  supplier: String, // Legacy field for backward compatibility
  supplierInfo: SupplierInfoSchema, // Full supplier information for this item
  expectedDeliveryDate: String, // Expected delivery date for this specific item
}, { _id: false });

const ApprovalSchema = new Schema({
  role: {
    type: String,
    enum: ['OPERATIONS', 'DEPARTMENT_HEAD', 'FINANCE', 'MANAGEMENT', 'SUPPLIER'],
  },
  userId: String,
  userName: String,
  action: {
    type: String,
    enum: ['PREPARED', 'REVIEWED', 'NOTED', 'APPROVED', 'REJECTED', 'SUBMITTED'],
  },
  timestamp: String,
  comments: String,
}, { _id: false });

const PurchaseOrderSchema = new Schema<IPurchaseOrder>({
  poNumber: {
    type: String,
    required: false, // Will be auto-generated
    unique: true,
    default: null,
  },
  joId: {
    type: String,
    required: true,
    ref: 'JobOrder',
  },
  srId: {
    type: String,
    required: true,
    ref: 'ServiceRequest',
  },
  dateRequested: {
    type: String,
    required: true,
  },
  requestedBy: {
    type: String,
    required: true,
  },
  department: {
    type: String,
    required: true,
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    required: true,
  },
  items: {
    type: [PurchaseOrderItemSchema],
    required: true,
    default: [],
  },
  supplierName: {
    type: String,
  },
  supplierContact: {
    type: String,
  },
  supplierAddress: {
    type: String,
  },
  subtotal: {
    type: Number,
    required: true,
    default: 0,
  },
  tax: {
    type: Number,
    default: 0,
  },
  totalAmount: {
    type: Number,
    required: true,
    default: 0,
  },
  status: {
    type: String,
    enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PURCHASED', 'RECEIVED', 'CLOSED'],
    default: 'DRAFT',
  },
  approvals: {
    type: [ApprovalSchema],
    default: [],
  },
  expectedDeliveryDate: {
    type: String,
  },
  actualDeliveryDate: {
    type: String,
  },
  deliveryNotes: {
    type: String,
  },
  createdAt: {
    type: String,
    default: () => new Date().toISOString(),
  },
  updatedAt: {
    type: String,
    default: () => new Date().toISOString(),
  },
  closedAt: {
    type: String,
  },
}, {
  timestamps: false,
});

// Auto-generate PO Number before save
PurchaseOrderSchema.pre('save', async function () {
  if (this.isNew && !this.poNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('PurchaseOrder').countDocuments({});
    this.poNumber = `PO-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  this.updatedAt = new Date().toISOString();
});

const PurchaseOrder = models.PurchaseOrder || model<IPurchaseOrder>('PurchaseOrder', PurchaseOrderSchema);
export default PurchaseOrder;

