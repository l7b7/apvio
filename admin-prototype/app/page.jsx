import { redirect } from 'next/navigation';
import { requireAdmin } from '../lib/supabase/admin';
import Dashboard from './ui/dashboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { supabase, user } = await requireAdmin();
  if (!user) redirect('/login');
  const { data: apps, error } = await supabase.from('apvio_apps').select('*').order('created_at', { ascending: false });
  return <Dashboard email={user.email} apps={error ? [] : apps || []} loadError={Boolean(error)} />;
}

