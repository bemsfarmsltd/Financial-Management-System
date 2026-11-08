'use client';
import {useEffect,useState} from 'react';
import {hasGmdFeatureAccess} from '@/lib/gmd-access';
export function useGmdAccess(role: string): boolean {
  const [enabled,setEnabled]=useState(false);
  useEffect(()=>{const c=new AbortController();setEnabled(false);if(role==='SUPER_ADMIN'||role==='SYSTEM_ADMIN')fetch('/api/meta/features',{cache:'no-store',signal:c.signal}).then(r=>r.ok?r.json():null).then(d=>{if(!c.signal.aborted)setEnabled(d?.superAdminGmdAccess===true);}).catch(()=>{});return()=>c.abort();},[role]);
  return hasGmdFeatureAccess(role,enabled);
}
