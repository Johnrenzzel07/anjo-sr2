'use client';

import { useState, useCallback } from 'react';
import ApprovalModal from './ApprovalModal';

interface ApprovalModalOptions {
  title: string;
  message?: string;
  confirmButtonText?: string;
  confirmButtonColor?: 'green' | 'blue' | 'red' | 'purple';
  placeholder?: string;
}

export function useApprovalModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ApprovalModalOptions>({
    title: 'Enter Approval Comments',
  });
  const [resolvePromise, setResolvePromise] = useState<((value: string | null) => void) | null>(null);

  const showApproval = useCallback((opts: ApprovalModalOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      setOptions(opts);
      setIsOpen(true);
      setResolvePromise(() => resolve);
    });
  }, []);

  const handleConfirm = useCallback((comments: string) => {
    setIsOpen(false);
    if (resolvePromise) {
      resolvePromise(comments);
      setResolvePromise(null);
    }
  }, [resolvePromise]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    if (resolvePromise) {
      resolvePromise(null);
      setResolvePromise(null);
    }
  }, [resolvePromise]);

  const ApprovalDialog = () => (
    <ApprovalModal
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={options.title}
      message={options.message}
      confirmButtonText={options.confirmButtonText}
      confirmButtonColor={options.confirmButtonColor}
      placeholder={options.placeholder}
    />
  );

  return { showApproval, ApprovalDialog };
}

