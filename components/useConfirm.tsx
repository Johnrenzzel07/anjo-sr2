'use client';

import { useState, useCallback } from 'react';
import ConfirmationModal from './ConfirmationModal';

export function useConfirm() {
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    message: string;
    title: string;
    onConfirm: (() => void) | null;
    onCancel: (() => void) | null;
    confirmText?: string;
    cancelText?: string;
    confirmButtonColor?: 'green' | 'blue' | 'red' | 'purple';
  }>({
    isOpen: false,
    message: '',
    title: 'Confirm',
    onConfirm: null,
    onCancel: null,
  });

  const confirm = useCallback((
    message: string,
    options?: {
      title?: string;
      confirmText?: string;
      cancelText?: string;
      confirmButtonColor?: 'green' | 'blue' | 'red' | 'purple';
    }
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        message,
        title: options?.title || 'Confirm',
        confirmText: options?.confirmText,
        cancelText: options?.cancelText,
        confirmButtonColor: options?.confirmButtonColor,
        onConfirm: () => {
          setConfirmState((prev) => ({ ...prev, isOpen: false, onConfirm: null, onCancel: null }));
          resolve(true);
        },
        onCancel: () => {
          setConfirmState((prev) => ({ ...prev, isOpen: false, onConfirm: null, onCancel: null }));
          resolve(false);
        },
      });
    });
  }, []);

  const handleCancel = useCallback(() => {
    if (confirmState.onCancel) {
      confirmState.onCancel();
    } else {
      setConfirmState((prev) => ({ ...prev, isOpen: false, onConfirm: null, onCancel: null }));
    }
  }, [confirmState.onCancel]);

  const ConfirmDialog = () => (
    <ConfirmationModal
      isOpen={confirmState.isOpen}
      title={confirmState.title}
      message={confirmState.message}
      confirmText={confirmState.confirmText}
      cancelText={confirmState.cancelText}
      confirmButtonColor={confirmState.confirmButtonColor}
      onConfirm={() => {
        confirmState.onConfirm?.();
      }}
      onCancel={() => {
        confirmState.onCancel?.();
      }}
    />
  );

  return { confirm, ConfirmDialog };
}

