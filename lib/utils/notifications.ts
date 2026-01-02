import connectDB from '@/lib/mongodb';
import Notification, { NotificationType } from '@/lib/models/Notification';
import User from '@/lib/models/User';
import { getAuthorizedDepartments } from '@/lib/utils/joAuthorization';

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
 * Notifies the REQUESTER'S department head for approval
 */
export async function notifyServiceRequestSubmitted(
  serviceRequestId: string,
  srNumber: string,
  requestedBy: string,
  requesterDepartment: string,
  serviceCategory?: string
) {
  try {
    // Notify the REQUESTER'S department head for SR approval
    const deptHeadIds = await findUsersByRole('APPROVER', requesterDepartment);
    
    // Always include super admins
    const superAdminIds = await findUsersByRole('SUPER_ADMIN');
    const allUserIds = [...new Set([...deptHeadIds, ...superAdminIds])];

    if (allUserIds.length === 0) {
      console.warn(`No approvers found for department: ${requesterDepartment}`);
      return;
    }

    const categoryText = serviceCategory ? ` (${serviceCategory})` : '';
    await createNotificationsForUsers(allUserIds, {
      type: 'SERVICE_REQUEST_SUBMITTED',
      title: `New Service Request: ${srNumber}`,
      message: `${requestedBy} has submitted a new service request${categoryText} that requires your approval.`,
      link: `/service-requests/${serviceRequestId}`,
      relatedEntityType: 'SERVICE_REQUEST',
      relatedEntityId: serviceRequestId,
    });
  } catch (error) {
    console.error('Error notifying service request submitted:', error);
  }
}

/**
 * Notify the HANDLING department when Service Request is approved
 * The handling department (based on service category) will create the Job Order
 */
export async function notifyHandlingDepartmentForJO(
  serviceRequestId: string,
  srNumber: string,
  serviceCategory: string,
  requesterDepartment: string
) {
  try {
    const handlingDepts = getAuthorizedDepartments(serviceCategory);
    let allUserIds: string[] = [];
    
    for (const dept of handlingDepts) {
      const deptHeadIds = await findUsersByRole('APPROVER', dept);
      allUserIds.push(...deptHeadIds);
      
      // Also try with "Department" suffix
      const deptWithSuffix = `${dept} Department`;
      const deptHeadIdsWithSuffix = await findUsersByRole('APPROVER', deptWithSuffix);
      allUserIds.push(...deptHeadIdsWithSuffix);
    }
    
    // Always include super admins
    const superAdminIds = await findUsersByRole('SUPER_ADMIN');
    allUserIds = [...new Set([...allUserIds, ...superAdminIds])];

    if (allUserIds.length === 0) {
      console.warn(`No handling department found for service category: ${serviceCategory}`);
      return;
    }

    await createNotificationsForUsers(allUserIds, {
      type: 'SERVICE_REQUEST_APPROVED',
      title: `Service Request Approved: ${srNumber}`,
      message: `A service request for "${serviceCategory}" from ${requesterDepartment} has been approved. Please create a Job Order.`,
      link: `/service-requests/${serviceRequestId}`,
      relatedEntityType: 'SERVICE_REQUEST',
      relatedEntityId: serviceRequestId,
    });
  } catch (error) {
    console.error('Error notifying handling department for JO:', error);
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
  type: 'SERVICE' | 'MATERIAL_REQUISITION',
  creatorName?: string,
  creatorDepartment?: string
) {
  try {
    // Format creator information
    const creatorInfo = creatorName && creatorDepartment 
      ? ` by ${creatorName} (${creatorDepartment})`
      : creatorName 
      ? ` by ${creatorName}`
      : '';
    
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
          message: `A new Service Job Order ${joNumber} has been created${creatorInfo} and requires your approval.`,
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
          message: `A new Material Requisition ${joNumber} has been created${creatorInfo} and requires budget approval.`,
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
 * Notify handling department when Job Order is approved and ready for execution
 */
export async function notifyHandlingDepartmentReadyForExecution(
  jobOrderId: string,
  joNumber: string,
  serviceCategory: string,
  approverName?: string,
  approverRole?: string
) {
  try {
    const { getAuthorizedDepartments } = await import('@/lib/utils/joAuthorization');
    const handlingDepts = getAuthorizedDepartments(serviceCategory);
    let allUserIds: string[] = [];
    
    for (const dept of handlingDepts) {
      const deptHeadIds = await findUsersByRole('APPROVER', dept);
      allUserIds.push(...deptHeadIds);
      
      // Also try with "Department" suffix
      const deptWithSuffix = `${dept} Department`;
      const deptHeadIdsWithSuffix = await findUsersByRole('APPROVER', deptWithSuffix);
      allUserIds.push(...deptHeadIdsWithSuffix);
    }
    
    // Always include super admins
    const superAdminIds = await findUsersByRole('SUPER_ADMIN');
    allUserIds = [...new Set([...allUserIds, ...superAdminIds])];

    if (allUserIds.length > 0) {
      // Format approver text with role
      let approverText = '';
      if (approverName) {
        if (approverRole === 'MANAGEMENT' || approverRole === 'ADMIN' || approverRole === 'SUPER_ADMIN') {
          approverText = ` by President (${approverName})`;
        } else {
          approverText = ` by ${approverName}`;
        }
      }
      
      await createNotificationsForUsers(allUserIds, {
        type: 'JOB_ORDER_NEEDS_APPROVAL',
        title: `Job Order Approved: ${joNumber}`,
        message: `Job Order ${joNumber} has been approved${approverText}. You can now start execution.`,
        link: `/job-orders/${jobOrderId}`,
        relatedEntityType: 'JOB_ORDER',
        relatedEntityId: jobOrderId,
      });
    }
  } catch (error) {
    console.error('Error notifying handling department ready for execution:', error);
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
 * Notify Purchasing when Material Requisition Job Order budget is approved
 */
export async function notifyPurchasingBudgetApproved(
  jobOrderId: string,
  joNumber: string
) {
  try {
    const purchasingIds = await findUsersByRole('APPROVER', 'Purchasing');
    
    if (purchasingIds.length > 0) {
      await createNotificationsForUsers(purchasingIds, {
        type: 'JOB_ORDER_NEEDS_APPROVAL',
        title: `Material Requisition Ready for Purchase: ${joNumber}`,
        message: `Material Requisition ${joNumber} budget has been approved. You can now create a Purchase Order.`,
        link: `/job-orders/${jobOrderId}`,
        relatedEntityType: 'JOB_ORDER',
        relatedEntityId: jobOrderId,
      });
    }
  } catch (error) {
    console.error('Error notifying purchasing budget approved:', error);
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

/**
 * Notify President when Purchase Order needs approval
 */
export async function notifyPurchaseOrderNeedsApproval(
  purchaseOrderId: string,
  poNumber: string,
  creatorName?: string,
  creatorDepartment?: string
) {
  try {
    // Notify President (SUPER_ADMIN, ADMIN - these have MANAGEMENT role in approvals)
    const superAdminIds = await findUsersByRole('SUPER_ADMIN');
    const adminIds = await findUsersByRole('ADMIN');
    const userIds = [...new Set([...superAdminIds, ...adminIds])];

    if (userIds.length === 0) {
      console.warn('No President users found for Purchase Order approval');
      return;
    }

    // Format creator information
    const creatorInfo = creatorName && creatorDepartment 
      ? ` by ${creatorName} (${creatorDepartment})`
      : creatorName 
      ? ` by ${creatorName}`
      : '';

    await createNotificationsForUsers(userIds, {
      type: 'PURCHASE_ORDER_NEEDS_APPROVAL',
      title: `Purchase Order Needs Approval: ${poNumber}`,
      message: `Purchase Order ${poNumber} has been submitted${creatorInfo} and requires your approval.`,
      link: `/purchase-orders/${purchaseOrderId}`,
      relatedEntityType: 'PURCHASE_ORDER',
      relatedEntityId: purchaseOrderId,
    });
  } catch (error) {
    console.error('Error notifying purchase order needs approval:', error);
  }
}

/**
 * Notify requester's department head when Job Order execution is completed
 */
export async function notifyJobOrderExecutionCompleted(
  jobOrderId: string,
  joNumber: string,
  requesterDepartment: string
) {
  try {
    // Notify the REQUESTER'S department head (the department that originally requested the SR)
    const deptHeadIds = await findUsersByRole('APPROVER', requesterDepartment);
    
    // Also try with "Department" suffix
    const deptWithSuffix = `${requesterDepartment} Department`;
    const deptHeadIdsWithSuffix = await findUsersByRole('APPROVER', deptWithSuffix);
    
    // Always include super admins
    const superAdminIds = await findUsersByRole('SUPER_ADMIN');
    const allUserIds = [...new Set([...deptHeadIds, ...deptHeadIdsWithSuffix, ...superAdminIds])];

    if (allUserIds.length === 0) {
      console.warn(`No department head found for department: ${requesterDepartment}`);
      return;
    }

    await createNotificationsForUsers(allUserIds, {
      type: 'JOB_ORDER_STATUS_CHANGED',
      title: `Job Order Completed: ${joNumber}`,
      message: `Job Order ${joNumber} has been executed and completed. Please review and accept the service.`,
      link: `/job-orders/${jobOrderId}`,
      relatedEntityType: 'JOB_ORDER',
      relatedEntityId: jobOrderId,
    });
  } catch (error) {
    console.error('Error notifying job order execution completed:', error);
  }
}

/**
 * Notify handling department when Job Order service is accepted by requester's department head
 */
export async function notifyJobOrderServiceAccepted(
  jobOrderId: string,
  joNumber: string,
  serviceCategory: string,
  acceptedBy: string
) {
  try {
    const { getAuthorizedDepartments } = await import('@/lib/utils/joAuthorization');
    const handlingDepts = getAuthorizedDepartments(serviceCategory);
    let allUserIds: string[] = [];
    
    for (const dept of handlingDepts) {
      // Normalize department name
      const normalizedDept = dept.toLowerCase().replace(/\s+department$/, '').trim();
      
      const deptHeadIds = await findUsersByRole('APPROVER', dept);
      allUserIds.push(...deptHeadIds);
      
      // Also try with normalized name
      const deptHeadIdsNormalized = await findUsersByRole('APPROVER', normalizedDept);
      allUserIds.push(...deptHeadIdsNormalized);
      
      // Also try with "Department" suffix
      const deptWithSuffix = `${normalizedDept} Department`;
      const deptHeadIdsWithSuffix = await findUsersByRole('APPROVER', deptWithSuffix);
      allUserIds.push(...deptHeadIdsWithSuffix);
    }
    
    // Always include super admins
    const superAdminIds = await findUsersByRole('SUPER_ADMIN');
    allUserIds = [...new Set([...allUserIds, ...superAdminIds])];

    if (allUserIds.length > 0) {
      await createNotificationsForUsers(allUserIds, {
        type: 'JOB_ORDER_STATUS_CHANGED',
        title: `Service Accepted: ${joNumber}`,
        message: `Job Order ${joNumber} has been accepted by ${acceptedBy}. The service has been formally accepted and the Job Order is now closed.`,
        link: `/job-orders/${jobOrderId}`,
        relatedEntityType: 'JOB_ORDER',
        relatedEntityId: jobOrderId,
      });
    }
  } catch (error) {
    console.error('Error notifying job order service accepted:', error);
  }
}

