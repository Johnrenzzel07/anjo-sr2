import { SRStatus, JOStatus, POStatus } from '@/types';

interface StatusBadgeProps {
  status: SRStatus | JOStatus | POStatus;
  type?: 'sr' | 'jo' | 'po';
}

const statusColors: Record<string, string> = {
  // SR Statuses
  DRAFT: 'bg-gray-100 text-gray-800',
  SUBMITTED: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  // JO Statuses
  BUDGET_CLEARED: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CLOSED: 'bg-slate-100 text-slate-800',
  // PO Statuses
  PURCHASED: 'bg-blue-100 text-blue-800',
  RECEIVED: 'bg-green-100 text-green-800',
};

export default function StatusBadge({ status, type = 'jo' }: StatusBadgeProps) {
  const colorClass = statusColors[status] || 'bg-gray-100 text-gray-800';
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

