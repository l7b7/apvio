import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const code = searchParams.get('code');
  const type = searchParams.get('type');
  const authError = searchParams.get('error') || searchParams.get('error_code');
  if (authError) return NextResponse.redirect(`${origin}/login?message=تعذر%20تأكيد%20الرابط.%20اطلب%20رابطاً%20جديداً%20وجرّبه%20من%20نفس%20المتصفح.`);
  const supabase = await createClient();
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
  }
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) return NextResponse.redirect(`${origin}/`);
  }
  return NextResponse.redirect(`${origin}/login?message=تعذر%20تأكيد%20الرابط.%20اطلب%20رسالة%20جديدة.`);
}

