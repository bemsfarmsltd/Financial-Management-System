'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StaffApprovalsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/?tab=Staff+onboarding');
  }, [router]);

  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: '#0b1220', color: '#fff' }}>
      <p>Redirecting to Executive Command Center…</p>
    </div>
  );
}
