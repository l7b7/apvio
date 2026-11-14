import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import LoginForm from '../ui/login-form';

export default async function LoginPage({ searchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/');
  const params = await searchParams;
  return <main className="login-shell"><section className="login-card"><a className="brand" href="https://apvio-apps.vercel.app/"><span className="brand-glyph">أ</span><span>أبفيو<span className="brand-dot">.</span></span></a><div className="eyebrow"><span className="eyebrow-line"/> مساحة خاصة</div><h1>دخول المشرف</h1><p className="login-copy">لوحة إدارة مكتبة التطبيقات. الوصول مخصص للمشرف المعتمد فقط.</p><LoginForm message={params?.message || ''}/><a className="login-back" href="https://apvio-apps.vercel.app/">العودة للموقع ↗</a></section></main>;
}

