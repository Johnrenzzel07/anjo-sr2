import mongoose, { Schema, models, model } from 'mongoose';
import { ServiceRequest as IServiceRequest, PriorityLevel, SRStatus, Approval } from '@/types';

const ServiceRequestSchema = new Schema<IServiceRequest>({
  srNumber: {
    type: String,
    required: false, // Will be auto-generated in pre-save hook
    unique: true,
    default: null,
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
  contactEmail: {
    type: String,
    required: true,
  },
  contactPhone: {
    type: String,
  },
  dateOfRequest: {
    type: String,
    required: true,
  },
  timeOfRequest: {
    type: String,
  },
  priority: {
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
  briefSubject: {
    type: String,
    required: true,
  },
  location: {
    type: String,
  },
  reason: {
    type: String,
  },
  budgetSource: {
    type: String,
  },
  status: {
    type: String,
    enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'],
    default: 'SUBMITTED',
  },
  approvals: {
    type: [{
      role: {
        type: String,
        enum: ['OPERATIONS', 'DEPARTMENT_HEAD', 'FINANCE', 'MANAGEMENT', 'SUPPLIER', 'SUPER_ADMIN'],
      },
      userId: String,
      userName: String,
      action: {
        type: String,
        enum: ['PREPARED', 'REVIEWED', 'NOTED', 'APPROVED', 'REJECTED'],
      },
      timestamp: String,
      comments: String,
    }],
    default: [],
  },
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

// Auto-generate SR Number before validation
ServiceRequestSchema.pre('validate', async function() {
  try {
    if (this.isNew && !this.srNumber) {
      const year = new Date().getFullYear();
      const count = await mongoose.model('ServiceRequest').countDocuments({});
      this.srNumber = `SR-${year}-${String(count + 1).padStart(4, '0')}`;
    }
  } catch (error: any) {
    throw error;
  }
});

ServiceRequestSchema.pre('save', function() {
  this.updatedAt = new Date().toISOString();
});

const ServiceRequest = (models.ServiceRequest as mongoose.Model<IServiceRequest>) || model<IServiceRequest>('ServiceRequest', ServiceRequestSchema);

export default ServiceRequest;

