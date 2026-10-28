import { redirect } from 'next/navigation';

export default function AdminSettingsRedirectPage() {
  redirect('/finance?tab=Settings');
}
