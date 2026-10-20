'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StaffPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: '#0b1220', color: '#fff' }}>
      <p>Redirecting to Executive Command Center…</p>
    </div>
  );
}
