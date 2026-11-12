'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HumanResourcesPortalPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Outfit', system-ui, sans-serif",
        color: '#64748b',
        fontSize: '14px',
      }}
    >
      Redirecting to BEMS ERP...
    </div>
  );
}
