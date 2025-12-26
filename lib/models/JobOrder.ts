import mongoose, { Schema, models, model } from 'mongoose';
import { JobOrder as IJobOrder, PriorityLevel, JOStatus, JobOrderType } from '@/types';

const MaterialItemSchema = new Schema({
  id: String,
  item: String,
  description: String,
  quantity: Number,
  unit: String,
  estimatedCost: Number,
  source: {
    type: String,
    enum: ['IN_HOUSE', 'PURCHASE'],
  },
}, { _id: false });

const ManpowerAssignmentSchema = new Schema({
  assignedUnit: String,
  supervisorInCharge: String,
  supervisorDept: String,
  outsource: String,
  outsourcePrice: Number,
}, { _id: false });

const ScheduleMilestoneSchema = new Schema({
  id: String,
  activity: String,
  startDate: String,
  endDate: String,
}, { _id: false });

const BudgetInfoSchema = new Schema({
  estimatedTotalCost: Number,
  budgetSource: String,
  costCenter: String,
  withinApprovedBudget: Boolean,
}, { _id: false });

const AcceptanceInfoSchema = new Schema({
  actualStartDate: String,
  actualCompletionDate: String,
  workCompletionNotes: String,
  serviceAcceptedBy: String,
  dateAccepted: String,
}, { _id: false });

const MaterialTransferItemSchema = new Schema({
  id: String,
  item: String,
  description: String,
  quantity: Number,
  unit: String,
  transferredQuantity: Number,
  transferDate: String,
  transferredBy: String,
  notes: String,
  status: {
    type: String,
    enum: ['PENDING', 'PARTIAL', 'COMPLETED'],
    default: 'PENDING',
  },
}, { _id: false });

const MaterialTransferInfoSchema = new Schema({
  items: [MaterialTransferItemSchema],
  transferCompleted: {
    type: Boolean,
    default: false,
  },
  transferCompletedDate: String,
  transferCompletedBy: String,
  transferNotes: String,
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
    enum: ['PREPARED', 'REVIEWED', 'NOTED', 'APPROVED', 'BUDGET_APPROVED', 'BUDGET_REJECTED'],
  },
  timestamp: String,
  comments: String,
}, { _id: false });

const JobOrderSchema = new Schema<IJobOrder>({
  joNumber: {
    type: String,
    required: false, // Will be auto-generated in pre-save hook
    unique: true,
    default: null,
  },
  srId: {
    type: String,
    required: true,
    ref: 'ServiceRequest',
  },
  type: {
    type: String,
    enum: ['SERVICE', 'MATERIAL_REQUISITION'],
    required: true,
    default: 'SERVICE',
  },
  dateIssued: {
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
  contactPerson: {
    type: String,
    required: true,
  },
  priorityLevel: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    required: true,
  },
  targetStartDate: {
    type: String,
  },
  targetCompletionDate: {
    type: String,
  },
  serviceCategory: {
    type: String,
    required: true,
  },
  workDescription: {
    type: String,
    required: true,
  },
  location: {
    type: String,
  },
  reason: {
    type: String,
  },
  materials: {
    type: [MaterialItemSchema],
    default: [],
  },
  manpower: {
    type: ManpowerAssignmentSchema,
    default: {},
  },
  schedule: {
    type: [ScheduleMilestoneSchema],
    default: [],
  },
  budget: {
    type: BudgetInfoSchema,
    default: {},
  },
  acceptance: {
    type: AcceptanceInfoSchema,
    default: {},
  },
  materialTransfer: {
    type: MaterialTransferInfoSchema,
    default: {},
  },
  approvals: {
    type: [ApprovalSchema],
    default: [],
  },
  status: {
    type: String,
    enum: ['DRAFT', 'BUDGET_CLEARED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'],
    default: 'DRAFT',
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

// Auto-generate JO Number before save
JobOrderSchema.pre('save', async function() {
  if (this.isNew && !this.joNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('JobOrder').countDocuments({});
    this.joNumber = `JO-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  this.updatedAt = new Date().toISOString();
});

let JobOrder: mongoose.Model<IJobOrder>;
if (models.JobOrder) {
  JobOrder = models.JobOrder as mongoose.Model<IJobOrder>;
} else {
  JobOrder = model<IJobOrder>('JobOrder', JobOrderSchema);
}

export default JobOrder;

