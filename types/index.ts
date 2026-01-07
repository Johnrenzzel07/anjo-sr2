// Service Request and Job Order Types

export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type SRStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export type JOStatus =
  | 'DRAFT'
  | 'PENDING_CANVASS'
  | 'BUDGET_CLEARED'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CLOSED';
export type UserRole = 'OPERATIONS' | 'DEPARTMENT_HEAD' | 'FINANCE' | 'MANAGEMENT' | 'SUPPLIER' | 'PURCHASING' | 'SUPER_ADMIN' | 'ADMIN';
export type SourceType = 'IN_HOUSE' | 'PURCHASE';
export type JobOrderType = 'SERVICE' | 'MATERIAL_REQUISITION';
export type POStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'PURCHASED'
  | 'RECEIVED'
  | 'CLOSED';

export interface ServiceRequest {
  id?: string;
  _id?: string;
  srNumber: string;
  requestedBy: string;
  department: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone?: string;
  dateOfRequest: string;
  timeOfRequest?: string;
  priority: PriorityLevel;
  targetStartDate?: string;
  targetCompletionDate?: string;
  serviceCategory: string;
  workDescription: string;
  briefSubject: string;
  location?: string;
  reason?: string;
  budgetSource?: string;
  status: SRStatus;
  approvals?: Approval[];
  departmentHeadApproval?: {
    approved: boolean;
    approverName: string;
    approverId: string;
    approvedAt: string;
    comments?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface MaterialItem {
  id: string;
  item: string;
  description: string;
  quantity: number;
  unit: string;
  size?: string;
  color?: string;
  estimatedCost: number;
  source: SourceType;
}

export interface ManpowerAssignment {
  assignedUnit: string;
  supervisorInCharge: string;
  supervisorDept: string;
  outsource?: string;
  outsourcePrice?: number;
}

export interface ScheduleMilestone {
  id: string;
  activity: string;
  startDate: string;
  endDate: string;
}

export interface BudgetInfo {
  estimatedTotalCost: number;
  budgetSource: string;
  costCenter: string;
  withinApprovedBudget: boolean;
}

export interface AcceptanceInfo {
  actualStartDate?: string;
  actualCompletionDate?: string;
  workCompletionNotes?: string;
  serviceAcceptedBy?: string;
  dateAccepted?: string;
}

export interface MaterialTransferItem {
  id: string;
  item: string;
  description: string;
  quantity: number;
  unit: string;
  transferredQuantity?: number;
  transferDate?: string;
  transferredBy?: string;
  notes?: string;
  status: 'PENDING' | 'PARTIAL' | 'COMPLETED';
}

export interface MaterialTransferInfo {
  items: MaterialTransferItem[];
  transferCompleted: boolean;
  transferCompletedDate?: string;
  transferCompletedBy?: string;
  transferNotes?: string;
}

export interface Approval {
  role: UserRole;
  userId: string;
  userName: string;
  action: 'PREPARED' | 'REVIEWED' | 'NOTED' | 'APPROVED' | 'REJECTED' | 'SUBMITTED' | 'BUDGET_APPROVED' | 'BUDGET_REJECTED' | 'CANVASS_COMPLETED';
  timestamp: string;
  comments?: string;
}

export interface JobOrder {
  id?: string;
  _id?: string;
  joNumber: string;
  srId: string;
  serviceRequest?: ServiceRequest;

  // Type: Service or Material Requisition
  type: JobOrderType;

  // Header
  dateIssued: string;
  requestedBy: string;
  department: string;
  contactPerson: string;
  priorityLevel: PriorityLevel;
  targetStartDate: string;
  targetCompletionDate: string;

  // Job Description
  serviceCategory: string;
  workDescription: string;
  location: string;
  reason: string;

  // Materials & Services
  materials: MaterialItem[];

  // Manpower (for Service type only)
  manpower: ManpowerAssignment;

  // Schedule
  schedule: ScheduleMilestone[];

  // Budget
  budget: BudgetInfo;

  // Acceptance
  acceptance: AcceptanceInfo;

  // Material Transfer (for Material Requisition type)
  materialTransfer?: MaterialTransferInfo;

  // Approvals
  approvals: Approval[];

  // Status
  status: JOStatus;

  // Metadata for Dashboard indicators
  hasPurchaseOrder?: boolean;
  poStatus?: POStatus;

  // Metadata
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface CreateJobOrderInput {
  srId: string;
  type: JobOrderType; // SERVICE or MATERIAL_REQUISITION
  workDescription?: string; // Editable override
  materials?: MaterialItem[];
  manpower?: Partial<ManpowerAssignment>;
  schedule?: ScheduleMilestone[];
}

export interface UpdateJobOrderInput {
  workDescription?: string;
  materials?: MaterialItem[];
  manpower?: Partial<ManpowerAssignment>;
  schedule?: ScheduleMilestone[];
  budget?: Partial<BudgetInfo>;
  acceptance?: Partial<AcceptanceInfo>;
}

export interface ApprovalAction {
  role: UserRole;
  userId: string;
  userName: string;
  action: 'PREPARED' | 'REVIEWED' | 'NOTED' | 'APPROVED' | 'REJECTED' | 'SUBMITTED' | 'BUDGET_APPROVED' | 'BUDGET_REJECTED';
  comments?: string;
}

export interface SupplierInfo {
  name: string;
  contact?: string;
  address?: string;
}

export interface PurchaseOrderItem {
  id: string;
  materialItemId?: string; // Reference to MaterialItem from JO
  item: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  supplier?: string; // Legacy field for backward compatibility
  supplierInfo?: SupplierInfo; // Full supplier information for this item
  expectedDeliveryDate?: string; // Expected delivery date for this specific item
}

export interface PurchaseOrder {
  id?: string;
  _id?: string;
  poNumber: string;
  joId: string;
  jobOrder?: JobOrder;
  srId: string;
  serviceRequest?: ServiceRequest;

  // Header
  dateRequested: string;
  requestedBy: string;
  department: string;
  priority: PriorityLevel;

  // Items
  items: PurchaseOrderItem[];

  // Supplier Information
  supplierName?: string;
  supplierContact?: string;
  supplierAddress?: string;

  // Financial
  subtotal: number;
  tax?: number;
  totalAmount: number;

  // Status
  status: POStatus;

  // Approvals
  approvals: Approval[];

  // Delivery
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  deliveryNotes?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface CreatePurchaseOrderInput {
  joId: string;
  items: PurchaseOrderItem[];
  supplierName?: string;
  supplierContact?: string;
  supplierAddress?: string;
  tax?: number;
  expectedDeliveryDate?: string;
}
