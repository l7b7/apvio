'use server';

import { createHash, randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../lib/supabase/server';
import { requireAdmin } from '../lib/supabase/admin';

const categories = new Set(['productivity', 'photography', 'personalization', 'tools']);
const clean = (value, max) => String(value || '').trim().slice(0, max);
const safeFileName = (name) => name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);

export async function loginAction(formData) {
  const email = clean(formData.get('email'), 254).toLowerCase();
  const password = String(formData.get('password') || '');
  const supabase = await createClient();
  if (!password || password.length > 128) redirect('/login?message=تعذر%20تسجيل%20الدخول.%20تحقق%20من%20البيانات.');
  if (email !== process.env.APVIO_ADMIN_EMAIL?.toLowerCase()) redirect('/login?message=هذا%20الحساب%20غير%20مصرح%20له.');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect('/login?message=تعذر%20تسجيل%20الدخول.%20تحقق%20من%20البيانات.');
  const { user } = await requireAdmin();
  if (!user) { await supabase.auth.signOut(); redirect('/login?message=الحساب%20غير%20مضاف%20لقائمة%20المشرفين.'); }
  redirect('/');
}

export async function requestAdminAccessAction(formData) {
  const email = clean(formData.get('email'), 254).toLowerCase();
  if (email !== process.env.APVIO_ADMIN_EMAIL?.toLowerCase()) redirect('/login?message=هذا%20البريد%20غير%20مصرح%20له.');
  const password = String(formData.get('newPassword') || '');
  if (password.length < 12 || password.length > 128) redirect('/login?message=استخدم%20كلمة%20مرور%20من%2012%20إلى%20128%20حرفاً.');
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password, options: {
    emailRedirectTo: `${process.env.APVIO_ADMIN_URL}/auth/confirm`,
  }});
  if (error) redirect('/login?message=تعذر%20إنشاء%20الحساب.%20قد%20يكون%20مسجلاً%20مسبقاً.');
  redirect('/login?message=أرسلنا%20رابط%20تأكيد%20إلى%20البريد.%20افتحه%20ثم%20سجّل%20الدخول.');
}

export async function resendAdminConfirmationAction(formData) {
  const email = clean(formData.get('email'), 254).toLowerCase();
  if (email !== process.env.APVIO_ADMIN_EMAIL?.toLowerCase()) {
    redirect('/login?message=هذا%20البريد%20غير%20مصرح%20له.');
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${process.env.APVIO_ADMIN_URL}/auth/confirm` },
  });
  if (error) redirect('/login?message=تعذر%20إرسال%20الرابط.%20انتظر%20قليلاً%20ثم%20حاول%20مجدداً.');
  redirect('/login?message=أرسلنا%20رابط%20تأكيد%20جديداً%20إذا%20كان%20الحساب%20بانتظار%20التأكيد.%20راجع%20البريد%20والمزعج.');
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login?message=تم%20تسجيل%20الخروج.');
}

export async function createUploadAction(formData) {
  const { supabase, user } = await requireAdmin();
  if (!user) return { error: 'انتهت الجلسة، سجّل الدخول من جديد.' };
  const fileName = safeFileName(clean(formData.get('fileName'), 180));
  const size = Number(formData.get('size'));
  const platform = clean(formData.get('platform'), 10);
  const ext = fileName.toLowerCase().split('.').pop();
  if (!['ios', 'android'].includes(platform) || (platform === 'ios' ? ext !== 'ipa' : ext !== 'apk')) return { error: 'امتداد الملف لا يطابق المنصة.' };
  if (!Number.isSafeInteger(size) || size < 1 || size > 50 * 1024 * 1024) return { error: 'الحد الأقصى لحجم الملف 50 ميغابايت.' };
  const path = `${randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from('apvio-app-files').createSignedUploadUrl(path);
  if (error || !data) return { error: 'تعذر تجهيز رفع الملف. تحقق من إعداد التخزين.' };
  return { path, token: data.token };
}

export async function saveAppAction(formData) {
  const { supabase, user } = await requireAdmin();
  if (!user) return { error: 'انتهت الجلسة، سجّل الدخول من جديد.' };
  const id = clean(formData.get('id'), 36) || undefined;
  const platform = clean(formData.get('platform'), 10);
  const category = clean(formData.get('category'), 30);
  const name = clean(formData.get('name'), 100);
  const version = clean(formData.get('version'), 40);
  const short_description = clean(formData.get('short_description'), 240);
  const description = clean(formData.get('description'), 5000);
  const requirements = clean(formData.get('requirements'), 180);
  const developer = clean(formData.get('developer'), 120);
  const license = clean(formData.get('license'), 80);
  const source_url = clean(formData.get('source_url'), 500);
  const file_path = clean(formData.get('file_path'), 300);
  const file_name = clean(formData.get('file_name'), 180);
  if (![name, version, short_description, description, requirements, developer, license, source_url, file_path, file_name].every(Boolean)) return { error: 'كمّل كل الحقول المطلوبة وارفع ملفاً.' };
  if (!['ios', 'android'].includes(platform) || !categories.has(category) || !/^https:\/\//i.test(source_url)) return { error: 'تحقق من المنصة والتصنيف ورابط المصدر الآمن.' };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(ipa|apk)$/i.test(file_path)) return { error: 'مسار الملف غير صالح.' };
  const { data: file, error: downloadError } = await supabase.storage.from('apvio-app-files').download(file_path);
  if (downloadError || !file) return { error: 'الملف غير موجود أو تعذر التحقق منه.' };
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = file_name.toLowerCase().split('.').pop();
  if (bytes.length < 4 || bytes.length > 50 * 1024 * 1024 || !['ipa', 'apk'].includes(ext) || !file_path.toLowerCase().endsWith(`.${ext}`) || bytes[0] !== 0x50 || bytes[1] !== 0x4b || ![0x03,0x05,0x07].includes(bytes[2]) || ![0x04,0x06,0x08].includes(bytes[3])) {
    await supabase.storage.from('apvio-app-files').remove([file_path]);
    return { error: 'الملف ليس أرشيف APK/IPA صالحاً أو تجاوز الحد المسموح.' };
  }
  const payload = { name, platform, category, version, short_description, description, requirements, developer, license, source_url, rights_confirmed: formData.get('rights_confirmed') === 'on', file_path, file_name, file_size_bytes: bytes.length, file_sha256: createHash('sha256').update(bytes).digest('hex'), is_published: false, updated_at: new Date().toISOString() };
  const result = id ? await supabase.from('apvio_apps').update(payload).eq('id', id) : await supabase.from('apvio_apps').insert(payload);
  if (result.error) {
    if (!id || file_path !== clean(formData.get('previous_file_path'), 300)) await supabase.storage.from('apvio-app-files').remove([file_path]);
    return { error: 'تعذر حفظ التطبيق. تأكد من تأكيد حقوق التوزيع والحقول.' };
  }
  const previousPath = clean(formData.get('previous_file_path'), 300);
  if (previousPath && previousPath !== file_path) await supabase.storage.from('apvio-app-files').remove([previousPath]);
  revalidatePath('/');
  return { ok: true };
}

export async function deleteAppAction(formData) {
  const { supabase, user } = await requireAdmin();
  if (!user) return { error: 'انتهت الجلسة.' };
  const id = clean(formData.get('id'), 36);
  const { data: app } = await supabase.from('apvio_apps').select('id,file_path').eq('id', id).maybeSingle();
  if (!app) return { error: 'التطبيق غير موجود.' };
  const { error } = await supabase.from('apvio_apps').delete().eq('id', id);
  if (error) return { error: 'تعذر حذف التطبيق.' };
  await supabase.storage.from('apvio-app-files').remove([app.file_path]);
  revalidatePath('/');
  return { ok: true };
}

export async function togglePublishAction(formData) {
  const { supabase, user } = await requireAdmin();
  if (!user) return { error: 'انتهت الجلسة.' };
  const id = clean(formData.get('id'), 36);
  const publish = formData.get('publish') === 'true';
  const { data: current } = await supabase.from('apvio_apps').select('rights_confirmed').eq('id', id).maybeSingle();
  if (!current) return { error: 'التطبيق غير موجود.' };
  if (publish && !current.rights_confirmed) return { error: 'أكد حق التوزيع داخل بيانات التطبيق قبل النشر.' };
  const { error } = await supabase.from('apvio_apps').update({ is_published: publish }).eq('id', id);
  if (error) return { error: 'لا يمكن نشر تطبيق قبل تأكيد حقوق توزيعه.' };
  revalidatePath('/');
  return { ok: true };
}

