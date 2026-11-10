'use client';
import { useEffect, useState } from 'react';
import { hasGmdFeatureAccess } from '@/lib/gmd-access';

export function useGmdAccess(role: string): boolean {
  // Default to true so executive users (SUPER_ADMIN, SYSTEM_ADMIN, GMD) immediately evaluate to true synchronously
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const c = new AbortController();
    if (role === 'SUPER_ADMIN' || role === 'SYSTEM_ADMIN') {
      fetch('/api/meta/features', { cache: 'no-store', signal: c.signal })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!c.signal.aborted && d && typeof d.superAdminGmdAccess === 'boolean') {
            setEnabled(d.superAdminGmdAccess);
          }
        })
        .catch(() => {});
    }
    return () => c.abort();
  }, [role]);

  return hasGmdFeatureAccess(role, enabled);
}
