import { Schema, model, models } from 'mongoose';
import { ReceivingReport as IReceivingReport } from '@/types';

const ReceivingReportItemSchema = new Schema({
  id: String,
  poItemId: String,
  item: String,
  description: String,
  orderedQuantity: Number,
  receivedQuantity: Number,
  unit: String,
  size: String,
  color: String,
  unitPrice: Number,
  totalPrice: Number,
  onHandQuantity: Number,
  toLocation: String,
  vendorName: String,
  rate: Number,
  currency: String,
  notes: String,
}, { _id: false });

const ReceivingReportSchema = new Schema<IReceivingReport>({
  rrNumber: {
    type: String,
    required: false,
    unique: true,
    default: null,
  },
  poId: {
    type: String,
    required: true,
    ref: 'PurchaseOrder',
  },
  
  // Primary Information
  referenceNumber: String,
  createdFrom: String, // PO Number
  postingPeriod: String,
  supplierName: {
    type: String,
    required: true,
  },
  supplierContact: String,
  supplierAddress: String,
  date: {
    type: String,
    required: true,
  },
  memo: String,
  
  // POS Information
  storeNo: String,
  terminalNo: String,
  originalPONumber: String,
  
  // Classification
  division: String,
  toLocation: String,
  class: String,
  department: {
    type: String,
    required: true,
  },
  subsidiary: String,
  
  // Financial
  exchangeRate: {
    type: Number,
    default: 1.00,
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
  
  // Items
  items: {
    type: [ReceivingReportItemSchema],
    required: true,
    default: [],
  },
  
  // Status
  status: {
    type: String,
    enum: ['DRAFT', 'SUBMITTED', 'COMPLETED'],
    default: 'DRAFT',
  },
  
  // Receiver Information
  receivedBy: {
    type: String,
    required: true,
  },
  receivedByName: {
    type: String,
    required: true,
  },
  actualDeliveryDate: {
    type: String,
    required: true,
  },
  deliveryNotes: String,
  
  // Metadata
  createdAt: {
    type: String,
    default: () => new Date().toISOString(),
  },
  updatedAt: {
    type: String,
    default: () => new Date().toISOString(),
  },
}, {
  timestamps: false,
});

// Auto-generate RR Number before save
ReceivingReportSchema.pre('save', async function(next) {
  if (!this.rrNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Find the last RR for today
    const prefix = `RR-${year}${month}${day}`;
    const lastRR = await (this.constructor as any)
      .findOne({ rrNumber: new RegExp(`^${prefix}`) })
      .sort({ rrNumber: -1 })
      .lean();
    
    let sequence = 1;
    if (lastRR && lastRR.rrNumber) {
      const lastSequence = parseInt(lastRR.rrNumber.split('-').pop() || '0');
      sequence = lastSequence + 1;
    }
    
    this.rrNumber = `${prefix}-${String(sequence).padStart(4, '0')}`;
  }
  next();
});

// Update timestamp before each save
ReceivingReportSchema.pre('save', function(next) {
  this.updatedAt = new Date().toISOString();
  next();
});

const ReceivingReport = models.ReceivingReport || model<IReceivingReport>('ReceivingReport', ReceivingReportSchema);

export default ReceivingReport;
