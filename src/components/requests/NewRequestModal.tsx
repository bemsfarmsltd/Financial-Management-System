'use client';

import React, { useEffect } from 'react';
import { NewRequestForm } from '@/app/requests/new/NewRequestForm';

interface NewRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  subsidiaries: any[];
  vendors: any[];
  employees?: any[];
  currentStaff?: any;
}

export function NewRequestModal({
  isOpen,
  onClose,
  subsidiaries,
  vendors,
  employees,
  currentStaff,
}: NewRequestModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#f8fafc',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '920px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #cbd5e1',
          padding: '24px',
        }}
      >
        <NewRequestForm
          subsidiaries={subsidiaries}
          vendors={vendors}
          employees={employees}
          currentStaff={currentStaff}
          onClose={onClose}
          isModal={true}
        />
      </div>
    </div>
  );
}
