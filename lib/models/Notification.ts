import mongoose, { Schema, models, model } from 'mongoose';

export type NotificationType =
  | 'SERVICE_REQUEST_SUBMITTED'
  | 'SERVICE_REQUEST_APPROVED'
  | 'SERVICE_REQUEST_REJECTED'
  | 'JOB_ORDER_CREATED'
  | 'JOB_ORDER_NEEDS_APPROVAL'
  | 'JOB_ORDER_APPROVED'
  | 'JOB_ORDER_STATUS_CHANGED'
  | 'PURCHASE_ORDER_CREATED'
  | 'PURCHASE_ORDER_NEEDS_APPROVAL'
  | 'PURCHASE_ORDER_APPROVED';

export interface INotification {
  _id?: string;
  id?: string;
  userId: string; // User who should receive this notification
  type: NotificationType;
  title: string;
  message: string;
  link?: string; // URL to the relevant document (e.g., /job-orders/123)
  relatedEntityType?: 'SERVICE_REQUEST' | 'JOB_ORDER' | 'PURCHASE_ORDER';
  relatedEntityId?: string; // ID of the related entity
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

const NotificationSchema = new Schema<INotification>({
  userId: {
    type: String,
    required: true,
    index: true, // For faster queries
  },
  type: {
    type: String,
    enum: [
      'SERVICE_REQUEST_SUBMITTED',
      'SERVICE_REQUEST_APPROVED',
      'SERVICE_REQUEST_REJECTED',
      'JOB_ORDER_CREATED',
      'JOB_ORDER_NEEDS_APPROVAL',
      'JOB_ORDER_APPROVED',
      'JOB_ORDER_STATUS_CHANGED',
      'PURCHASE_ORDER_CREATED',
      'PURCHASE_ORDER_NEEDS_APPROVAL',
      'PURCHASE_ORDER_APPROVED',
    ],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  link: {
    type: String,
  },
  relatedEntityType: {
    type: String,
    enum: ['SERVICE_REQUEST', 'JOB_ORDER', 'PURCHASE_ORDER'],
  },
  relatedEntityId: {
    type: String,
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true,
  },
  createdAt: {
    type: String,
    default: () => new Date().toISOString(),
  },
  readAt: {
    type: String,
  },
}, {
  timestamps: false,
});

// Index for efficient queries
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });

const Notification = (models.Notification as mongoose.Model<INotification>) ||
  model<INotification>('Notification', NotificationSchema);

export default Notification;

