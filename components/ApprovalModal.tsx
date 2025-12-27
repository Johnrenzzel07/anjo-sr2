'use client';

import { useState, useEffect } from 'react';

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (comments: string) => void;
  title: string;
  message?: string;
  confirmButtonText?: string;
  confirmButtonColor?: 'green' | 'blue' | 'red' | 'purple';
  placeholder?: string;
  showComments?: boolean; // Whether to show comments field
}

export default function ApprovalModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmButtonText = 'Approve',
  confirmButtonColor = 'green',
  placeholder = 'Enter approval comments (optional)...',
  showComments = true, // Default to showing comments for backward compatibility
}: ApprovalModalProps) {
  const [comments, setComments] = useState('');

  useEffect(() => {
    if (isOpen) {
      setComments('');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(comments);
    setComments('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const buttonColorClasses = {
    green: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
    blue: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    red: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    purple: 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" />
      
      {/* Modal */}
      <div
        className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6 transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        {message && (
          <p className="text-sm text-gray-600 mb-4">{message}</p>
        )}
        
        {showComments && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {confirmButtonColor === 'red' ? 'Rejection Reason:' : 'Comments:'}
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder={placeholder}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
              autoFocus
            />
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 text-sm font-medium transition-colors ${buttonColorClasses[confirmButtonColor] || buttonColorClasses.green}`}
          >
            {confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
}

