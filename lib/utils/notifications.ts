import connectDB from '@/lib/mongodb';
import Notification, { NotificationType } from '@/lib/models/Notification';
import User from '@/lib/models/User';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  relatedEntityType?: 'SERVICE_REQUEST' | 'JOB_ORDER' | 'PURCHASE_ORDER';
  relatedEntityId?: string;
}

/**
 * Create a notification for a specific user
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    await connectDB();
    
    const notification = new Notification({
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link,
      relatedEntityType: params.relatedEntityType,
      relatedEntityId: params.relatedEntityId,
      isRead: false,
    });

    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Create notifications for multiple users
 */
export async function createNotificationsForUsers(
  userIds: string[],
  params: Omit<CreateNotificationParams, 'userId'>
) {
  try {
    await connectDB();
    
    const notifications = userIds.map(userId => ({
      userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link,
      relatedEntityType: params.relatedEntityType,
      relatedEntityId: params.relatedEntityId,
      isRead: false,
      createdAt: new Date().toISOString(),
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }
    
    return notifications;
  } catch (error) {
    console.error('Error creating notifications for users:', error);
    throw error;
  }
}

/**
 * Find users by role and optionally department
 */
export async function findUsersByRole(
  role: string,
  department?: string
): Promise<string[]> {
  try {
    await connectDB();
    
    const query: any = { 
      role,
      isActive: true,
    };
    
    if (department) {
      query.department = department;
    }
    
    const users = await User.find(query).select('_id');
    return users.map(u => u._id?.toString() || '');
  } catch (error) {
    console.error('Error finding users by role:', error);
    return [];
  }
}

/**
 * Find user by email
 */
export async function findUserByEmail(email: string): Promise<string | null> {
  try {
    await connectDB();
    
    const user = await User.findOne({ 
      email: email.toLowerCase().trim(),
      isActive: true,
    }).select('_id');
    
    return user?._id?.toString() || null;
  } catch (error) {
    console.error('Error finding user by email:', error);
    return null;
  }
}

/**
 * Notify Department Head when Service Request is submitted
 */
export async function notifyServiceRequestSubmitted(
  serviceRequestId: string,
  srNumber: string,
  requestedBy: string,
  department: string
) {
  try {
    // Find Department Head users (APPROVER role with matching department or SUPER_ADMIN)
    const deptHeadIds = await findUsersByRole('APPROVER', department);
    const superAdminIds = await findUsersByRole('SUPER_ADMIN');
    const allUserIds = [...new Set([...deptHeadIds, ...superAdminIds])];

    if (allUserIds.length === 0) {
      console.warn(`No approvers found for department: ${department}`);
      return;
    }

    await createNotificationsForUsers(allUserIds, {
      type: 'SERVICE_REQUEST_SUBMITTED',
      title: `New Service Request: ${srNumber}`,
      message: `${requestedBy} from ${department} has submitted a new service request that requires your approval.`,
      link: `/service-requests/${serviceRequestId}`,
      relatedEntityType: 'SERVICE_REQUEST',
      relatedEntityId: serviceRequestId,
    });
  } catch (error) {
    console.error('Error notifying service request submitted:', error);
  }
}

/**
 * Notify requester when Service Request is approved/rejected
 */
export async function notifyServiceRequestStatusChanged(
  serviceRequestId: string,
  srNumber: string,
  status: 'APPROVED' | 'REJECTED',
  requesterEmail: string
) {
  try {
    const userId = await findUserByEmail(requesterEmail);
    if (!userId) {
      console.warn(`User not found for email: ${requesterEmail}`);
      return;
    }

    const isApproved = status === 'APPROVED';
    await createNotification({
      userId,
      type: isApproved ? 'SERVICE_REQUEST_APPROVED' : 'SERVICE_REQUEST_REJECTED',
      title: `Service Request ${isApproved ? 'Approved' : 'Rejected'}: ${srNumber}`,
      message: `Your service request ${srNumber} has been ${status.toLowerCase()}.`,
      link: `/service-requests/${serviceRequestId}`,
      relatedEntityType: 'SERVICE_REQUEST',
      relatedEntityId: serviceRequestId,
    });
  } catch (error) {
    console.error('Error notifying service request status change:', error);
  }
}

/**
 * Notify Operations when Service Request is approved (to create Job Order)
 */
export async function notifyServiceRequestApprovedForJO(
  serviceRequestId: string,
  srNumber: string,
  approverName?: string
) {
  try {
    // Find Operations users (APPROVER with Operations department or SUPER_ADMIN)
    const operationsIds = await findUsersByRole('APPROVER', 'Operations');
    const superAdminIds = await findUsersByRole('SUPER_ADMIN');
    const allUserIds = [...new Set([...operationsIds, ...superAdminIds])];

    if (allUserIds.length === 0) {
      console.warn('No Operations users found');
      return;
    }

    const approverText = approverName ? ` by ${approverName}` : '';
    await createNotificationsForUsers(allUserIds, {
      type: 'JOB_ORDER_NEEDS_APPROVAL',
      title: `Service Request Approved: ${srNumber}`,
      message: `Service Request ${srNumber} has been approved${approverText}. Please create a Job Order.`,
      link: `/service-requests/${serviceRequestId}`,
      relatedEntityType: 'SERVICE_REQUEST',
      relatedEntityId: serviceRequestId,
    });
  } catch (error) {
    console.error('Error notifying service request approved for JO:', error);
  }
}

/**
 * Notify relevant approvers when Job Order is created
 */
export async function notifyJobOrderCreated(
  jobOrderId: string,
  joNumber: string,
  type: 'SERVICE' | 'MATERIAL_REQUISITION'
) {
  try {
    // For Service type: Notify Operations to approve
    // For Material Requisition: Notify Finance and Management
    if (type === 'SERVICE') {
      const operationsIds = await findUsersByRole('APPROVER', 'Operations');
      const superAdminIds = await findUsersByRole('SUPER_ADMIN');
      const allUserIds = [...new Set([...operationsIds, ...superAdminIds])];

      if (allUserIds.length > 0) {
        await createNotificationsForUsers(allUserIds, {
          type: 'JOB_ORDER_NEEDS_APPROVAL',
          title: `New Job Order Created: ${joNumber}`,
          message: `A new Service Job Order ${joNumber} has been created and requires your approval.`,
          link: `/job-orders/${jobOrderId}`,
          relatedEntityType: 'JOB_ORDER',
          relatedEntityId: jobOrderId,
        });
      }
    } else {
      // Material Requisition: Notify Finance first
      const financeIds = await findUsersByRole('APPROVER', 'Finance');
      const superAdminIds = await findUsersByRole('SUPER_ADMIN');
      const allUserIds = [...new Set([...financeIds, ...superAdminIds])];

      if (allUserIds.length > 0) {
        await createNotificationsForUsers(allUserIds, {
          type: 'JOB_ORDER_NEEDS_APPROVAL',
          title: `New Material Requisition: ${joNumber}`,
          message: `A new Material Requisition ${joNumber} has been created and requires budget approval.`,
          link: `/job-orders/${jobOrderId}`,
          relatedEntityType: 'JOB_ORDER',
          relatedEntityId: jobOrderId,
        });
      }
    }
  } catch (error) {
    console.error('Error notifying job order created:', error);
  }
}

/**
 * Notify next approver when Job Order needs approval
 */
export async function notifyJobOrderNeedsApproval(
  jobOrderId: string,
  joNumber: string,
  approverRole: 'OPERATIONS' | 'DEPARTMENT_HEAD' | 'FINANCE' | 'MANAGEMENT',
  type: 'SERVICE' | 'MATERIAL_REQUISITION',
  previousApproverName?: string
) {
  try {
    let userIds: string[] = [];

    if (approverRole === 'OPERATIONS') {
      const operationsIds = await findUsersByRole('APPROVER', 'Operations');
      const superAdminIds = await findUsersByRole('SUPER_ADMIN');
      userIds = [...new Set([...operationsIds, ...superAdminIds])];
    } else if (approverRole === 'FINANCE') {
      const financeIds = await findUsersByRole('APPROVER', 'Finance');
      const superAdminIds = await findUsersByRole('SUPER_ADMIN');
      userIds = [...new Set([...financeIds, ...superAdminIds])];
    } else if (approverRole === 'MANAGEMENT') {
      const superAdminIds = await findUsersByRole('SUPER_ADMIN');
      const adminIds = await findUsersByRole('ADMIN');
      userIds = [...new Set([...superAdminIds, ...adminIds])];
    } else if (approverRole === 'DEPARTMENT_HEAD') {
      const approverIds = await findUsersByRole('APPROVER');
      const superAdminIds = await findUsersByRole('SUPER_ADMIN');
      userIds = [...new Set([...approverIds, ...superAdminIds])];
    }

    if (userIds.length > 0) {
      // Include previous approver name in message if provided (especially for Management notifications)
      const approverText = previousApproverName 
        ? ` (approved by ${previousApproverName})` 
        : '';
      
      await createNotificationsForUsers(userIds, {
        type: 'JOB_ORDER_NEEDS_APPROVAL',
        title: `Job Order Needs Approval: ${joNumber}`,
        message: `Job Order ${joNumber} requires ${approverRole} approval${approverText}.`,
        link: `/job-orders/${jobOrderId}`,
        relatedEntityType: 'JOB_ORDER',
        relatedEntityId: jobOrderId,
      });
    }
  } catch (error) {
    console.error('Error notifying job order needs approval:', error);
  }
}

/**
 * Notify requester when Job Order status changes
 */
export async function notifyJobOrderStatusChanged(
  jobOrderId: string,
  joNumber: string,
  status: string,
  requesterEmail: string
) {
  try {
    const userId = await findUserByEmail(requesterEmail);
    if (!userId) {
      console.warn(`User not found for email: ${requesterEmail}`);
      return;
    }

    await createNotification({
      userId,
      type: 'JOB_ORDER_STATUS_CHANGED',
      title: `Job Order Status Updated: ${joNumber}`,
      message: `Job Order ${joNumber} status has been updated to ${status}.`,
      link: `/job-orders/${jobOrderId}`,
      relatedEntityType: 'JOB_ORDER',
      relatedEntityId: jobOrderId,
    });
  } catch (error) {
    console.error('Error notifying job order status change:', error);
  }
}

