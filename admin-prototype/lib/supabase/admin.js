import { createClient } from './server';

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || user.email?.toLowerCase() !== process.env.APVIO_ADMIN_EMAIL?.toLowerCase()) {
    return { supabase: null, user: null };
  }
  const { data: allowed, error: allowError } = await supabase
    .from('apvio_admin_allowlist').select('email').eq('email', user.email.toLowerCase()).maybeSingle();
  if (allowError || !allowed) return { supabase: null, user: null };
  return { supabase, user };
}

