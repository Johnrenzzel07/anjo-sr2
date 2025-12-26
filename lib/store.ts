// In-memory data store (can be replaced with database)
import { ServiceRequest, JobOrder, CreateJobOrderInput, UpdateJobOrderInput, ApprovalAction, JOStatus } from '@/types';

class DataStore {
  private serviceRequests: Map<string, ServiceRequest> = new Map();
  private jobOrders: Map<string, JobOrder> = new Map();
  private joCounter = 0;

  // Service Request methods
  getAllServiceRequests(): ServiceRequest[] {
    return Array.from(this.serviceRequests.values());
  }

  getServiceRequest(id: string): ServiceRequest | undefined {
    return this.serviceRequests.get(id);
  }

  getApprovedServiceRequests(): ServiceRequest[] {
    return Array.from(this.serviceRequests.values()).filter(sr => sr.status === 'APPROVED');
  }

  createServiceRequest(sr: ServiceRequest): void {
    // Ensure we always have a concrete string key for the map
    const id = sr.id || sr._id || `sr-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const withId: ServiceRequest = { ...sr, id };
    this.serviceRequests.set(id, withId);
  }

  updateServiceRequest(id: string, updates: Partial<ServiceRequest>): ServiceRequest | null {
    const sr = this.serviceRequests.get(id);
    if (!sr) return null;
    const updated = { ...sr, ...updates, updatedAt: new Date().toISOString() };
    this.serviceRequests.set(id, updated);
    return updated;
  }

  // Job Order methods
  getAllJobOrders(): JobOrder[] {
    return Array.from(this.jobOrders.values());
  }

  getJobOrder(id: string): JobOrder | undefined {
    return this.jobOrders.get(id);
  }

  getJobOrderBySR(srId: string): JobOrder | undefined {
    return Array.from(this.jobOrders.values()).find(jo => jo.srId === srId);
  }

  generateJONumber(): string {
    this.joCounter++;
    const year = new Date().getFullYear();
    return `JO-${year}-${String(this.joCounter).padStart(4, '0')}`;
  }

  createJobOrder(sr: ServiceRequest, input: CreateJobOrderInput): JobOrder {
    const joNumber = this.generateJONumber();
    const now = new Date().toISOString();

    const id = `jo-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    const jobOrder: JobOrder = {
      id,
      joNumber,
      type: input.type,
      // sr.id is optional on the type, but JobOrder.srId is required
      // Fall back to _id or an empty string to satisfy the type
      srId: sr.id || sr._id || '',
      serviceRequest: sr,
      dateIssued: now,
      requestedBy: sr.requestedBy,
      department: sr.department,
      contactPerson: sr.contactPerson,
      priorityLevel: sr.priority,
      // These fields are optional on ServiceRequest but required on JobOrder,
      // so default them to empty strings when missing
      targetStartDate: sr.targetStartDate || '',
      targetCompletionDate: sr.targetCompletionDate || '',
      serviceCategory: sr.serviceCategory,
      workDescription: input.workDescription || sr.workDescription,
      location: sr.location || '',
      reason: sr.reason || '',
      materials: input.materials || [],
      manpower: {
        assignedUnit: '',
        supervisorInCharge: '',
        supervisorDept: '',
        ...input.manpower,
      },
      schedule: input.schedule || [],
      budget: {
        estimatedTotalCost: 0,
        // Budget source is optional on SR, required on JobOrder budget
        budgetSource: sr.budgetSource || '',
        costCenter: sr.budgetSource || '',
        withinApprovedBudget: false,
      },
      acceptance: {},
      approvals: [],
      status: 'DRAFT',
      createdAt: now,
      updatedAt: now,
    };

    this.jobOrders.set(id, jobOrder);
    return jobOrder;
  }

  updateJobOrder(id: string, input: UpdateJobOrderInput): JobOrder | null {
    const jo = this.jobOrders.get(id);
    if (!jo) return null;

    const updated: JobOrder = {
      ...jo,
      ...(input.workDescription && { workDescription: input.workDescription }),
      ...(input.materials && { materials: input.materials }),
      ...(input.manpower && { manpower: { ...jo.manpower, ...input.manpower } }),
      ...(input.schedule && { schedule: input.schedule }),
      ...(input.budget && { budget: { ...jo.budget, ...input.budget } }),
      ...(input.acceptance && { acceptance: { ...jo.acceptance, ...input.acceptance } }),
      updatedAt: new Date().toISOString(),
    };

    this.jobOrders.set(id, updated);
    return updated;
  }

  addApproval(id: string, approval: ApprovalAction): JobOrder | null {
    const jo = this.jobOrders.get(id);
    if (!jo) return null;

    const newApproval = {
      ...approval,
      timestamp: new Date().toISOString(),
    };

    // Remove existing approval from same role if exists
    const filteredApprovals = jo.approvals.filter(a => a.role !== approval.role);
    
    const updated: JobOrder = {
      ...jo,
      approvals: [...filteredApprovals, newApproval],
      updatedAt: new Date().toISOString(),
    };

    // Update status based on approvals
    updated.status = this.calculateStatus(updated);

    this.jobOrders.set(id, updated);
    return updated;
  }

  private calculateStatus(jo: JobOrder): JOStatus {
    const hasPrepared = jo.approvals.some(a => a.action === 'PREPARED');
    const hasReviewed = jo.approvals.some(a => a.action === 'REVIEWED');
    const hasNoted = jo.approvals.some(a => a.action === 'NOTED');
    const hasApproved = jo.approvals.some(a => a.action === 'APPROVED');

    if (jo.status === 'CLOSED') return 'CLOSED';
    if (hasApproved) return 'APPROVED';
    if (hasNoted) return 'BUDGET_CLEARED';
    if (hasPrepared || hasReviewed) return 'DRAFT';
    return 'DRAFT';
  }

  updateStatus(id: string, status: JOStatus): JobOrder | null {
    const jo = this.jobOrders.get(id);
    if (!jo) return null;

    const updated: JobOrder = {
      ...jo,
      status,
      ...(status === 'CLOSED' && !jo.closedAt ? { closedAt: new Date().toISOString() } : {}),
      updatedAt: new Date().toISOString(),
    };

    this.jobOrders.set(id, updated);
    return updated;
  }

  // Initialize with sample data
  initializeSampleData(): void {
    // Sample Service Request
    const sampleSR: ServiceRequest = {
      id: 'sr-001',
      srNumber: 'SR-2024-0001',
      requestedBy: 'John Doe',
      department: 'IT Department',
      contactPerson: 'John Doe',
      contactEmail: 'john.doe@example.com',
      dateOfRequest: new Date('2024-01-10').toISOString(),
      priority: 'HIGH',
      targetStartDate: '2024-02-01',
      targetCompletionDate: '2024-02-15',
      serviceCategory: 'IT Services',
      workDescription: 'Network infrastructure upgrade and server maintenance',
      briefSubject: 'Network upgrade and server maintenance',
      location: 'Building A, 3rd Floor',
      reason: 'Improve network reliability and performance',
      budgetSource: 'IT-2024-001',
      status: 'APPROVED',
      createdAt: new Date('2024-01-15').toISOString(),
      updatedAt: new Date('2024-01-20').toISOString(),
    };

    this.createServiceRequest(sampleSR);

    // Sample Service Request 2
    const sampleSR2: ServiceRequest = {
      id: 'sr-002',
      srNumber: 'SR-2024-0002',
      requestedBy: 'Jane Smith',
      department: 'Facilities',
      contactPerson: 'Jane Smith',
      contactEmail: 'jane.smith@example.com',
      dateOfRequest: new Date('2024-01-12').toISOString(),
      priority: 'MEDIUM',
      targetStartDate: '2024-02-10',
      targetCompletionDate: '2024-02-28',
      serviceCategory: 'Maintenance',
      workDescription: 'Office renovation and painting',
      briefSubject: 'Office renovation and painting',
      location: 'Building B, 2nd Floor',
      reason: 'Improve office environment and aesthetics',
      budgetSource: 'FAC-2024-002',
      status: 'APPROVED',
      createdAt: new Date('2024-01-18').toISOString(),
      updatedAt: new Date('2024-01-22').toISOString(),
    };

    this.createServiceRequest(sampleSR2);
  }
}

// Singleton instance
export const dataStore = new DataStore();

// Initialize with sample data on first import
if (typeof window === 'undefined') {
  dataStore.initializeSampleData();
}

