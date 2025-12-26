'use client';

import { JobOrder } from '@/types';
import StatusBadge from './StatusBadge';
import Link from 'next/link';

interface JobOrderCardProps {
  jobOrder: JobOrder;
}

export default function JobOrderCard({ jobOrder }: JobOrderCardProps) {
  return (
    <Link href={`/job-orders/${jobOrder.id || jobOrder._id}`}>
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-0 mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 break-words">{jobOrder.joNumber}</h3>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              SR: {jobOrder.serviceRequest?.srNumber || 'N/A'}
            </p>
          </div>
          <StatusBadge status={jobOrder.status} type="jo" />
        </div>
        
        <div className="space-y-2 mb-4">
          <p className="text-sm">
            <span className="font-medium text-gray-700">Department:</span>{' '}
            <span className="text-gray-600">{jobOrder.department}</span>
          </p>
          <p className="text-sm">
            <span className="font-medium text-gray-700">Category:</span>{' '}
            <span className="text-gray-600">{jobOrder.serviceCategory}</span>
          </p>
          <p className="text-sm">
            <span className="font-medium text-gray-700">Priority:</span>{' '}
            <span className="text-gray-600">{jobOrder.priorityLevel}</span>
          </p>
          <p className="text-sm text-gray-600 line-clamp-2">{jobOrder.workDescription}</p>
        </div>

        {/* Execution Status */}
        {jobOrder.status === 'IN_PROGRESS' && jobOrder.acceptance?.actualStartDate && (
          <div className="mt-3 p-2 bg-blue-50 rounded-md border border-blue-200">
            <p className="text-xs text-blue-700">
              <span className="font-medium">Started:</span>{' '}
              {new Date(jobOrder.acceptance.actualStartDate).toLocaleDateString()}
            </p>
          </div>
        )}
        
        {jobOrder.status === 'COMPLETED' && jobOrder.acceptance?.actualCompletionDate && (
          <div className="mt-3 p-2 bg-green-50 rounded-md border border-green-200">
            <p className="text-xs text-green-700">
              <span className="font-medium">Completed:</span>{' '}
              {new Date(jobOrder.acceptance.actualCompletionDate).toLocaleDateString()}
            </p>
          </div>
        )}

        <div className="flex justify-between items-center text-xs text-gray-500 mt-4 pt-4 border-t">
          <span>Issued: {new Date(jobOrder.dateIssued).toLocaleDateString()}</span>
          <span>Materials: {jobOrder.materials.length} items</span>
        </div>
      </div>
    </Link>
  );
}

