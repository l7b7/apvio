'use client';

import { useMemo, useState, useTransition } from 'react';
import { createClient } from '../../lib/supabase/browser';
import { createUploadAction, deleteAppAction, logoutAction, saveAppAction, togglePublishAction } from '../actions';

const labels = { productivity: 'إنتاجية', photography: 'تصوير', personalization: 'تخصيص', tools: 'أدوات' };
const empty = { name: '', platform: 'ios', category: 'tools', version: '', short_description: '', description: '', requirements: '', developer: '', license: '', source_url: '', rights_confirmed: false, file_path: '', file_name: '' };

export default function Dashboard({ email, apps, loadError }) {
  const [rows, setRows] = useState(apps);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [file, setFile] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, startTransition] = useTransition();
  const filtered = useMemo(() => rows.filter((app) => `${app.name} ${app.short_description}`.toLowerCase().includes(query.toLowerCase())), [rows, query]);
  const formAction = async (formData) => {
    setNotice('');
    let path = editing?.file_path || '';
    let filename = editing?.file_name || '';
    if (file) {
      const uploadData = new FormData(); uploadData.set('fileName', file.name); uploadData.set('size', String(file.size)); uploadData.set('platform', String(formData.get('platform')));
      const signed = await createUploadAction(uploadData);
      if (signed.error) { setNotice(signed.error); return; }
      const supabase = createClient();
      const { error } = await supabase.storage.from('apvio-app-files').uploadToSignedUrl(signed.path, signed.token, file, { contentType: 'application/octet-stream' });
      if (error) { setNotice('تعذر رفع الملف إلى التخزين.'); return; }
      path = signed.path; filename = file.name;
    }
    formData.set('id', editing?.id || ''); formData.set('file_path', path); formData.set('file_name', filename); formData.set('previous_file_path', editing?.file_path || '');
    const result = await saveAppAction(formData);
    if (result.error) { setNotice(result.error); return; }
    setNotice(editing ? 'تم تحديث التطبيق.' : 'انضاف التطبيق إلى المكتبة كمسودة.');
    setEditing(null); setFile(null); window.location.reload();
  };
  const deleteApp = (app) => {
    if (!window.confirm(`حذف ${app.name} وملفه نهائياً؟`)) return;
    const data = new FormData(); data.set('id', app.id);
    startTransition(async () => { const result = await deleteAppAction(data); setNotice(result.error || 'تم حذف التطبيق وملفه.'); if (!result.error) setRows((items) => items.filter((x) => x.id !== app.id)); });
  };
  const publish = (app) => {
    const data = new FormData(); data.set('id', app.id); data.set('publish', String(!app.is_published));
    startTransition(async () => { const result = await togglePublishAction(data); setNotice(result.error || (app.is_published ? 'أُلغي النشر.' : 'تم نشر التطبيق.')); if (!result.error) setRows((items) => items.map((x) => x.id === app.id ? { ...x, is_published: !x.is_published } : x)); });
  };
  const startEdit = (app) => { setEditing(app); setFile(null); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return <><header className="topbar"><a className="brand" href="https://apvio-apps.vercel.app/"><span className="brand-glyph">أ</span><span>أبفيو<span className="brand-dot">.</span></span></a><div className="admin-crumb"><span>الإدارة الآمنة</span><b> / </b><span>لوحة التحكم</span></div><div className="top-actions"><a className="back-site" href="https://apvio-apps.vercel.app/">عرض الموقع ↗</a><form action={logoutAction}><button className="button form-cancel">تسجيل الخروج</button></form></div></header>
    <main className="admin-layout"><aside className="admin-sidebar"><div className="sidebar-label">القائمة الرئيسية</div><a className="side-link current" href="#overview">▦ نظرة عامة</a><a className="side-link" href="#apps">▤ التطبيقات <i>{rows.length}</i></a><a className="side-link" href="#editor">＋ إضافة تطبيق</a><div className="sidebar-divider"/><div className="sidebar-label">حساب المشرف</div><div className="sidebar-bottom"><span className="admin-avatar">أ</span><span><b>مشرف أبفيو</b><small>{email}</small></span><span className="presence"/></div></aside>
    <section className="admin-content" id="overview"><div className="admin-title-row"><div><div className="eyebrow"><span className="eyebrow-line"/> مساحة الإدارة</div><h1>أهلاً بك <span>✳</span></h1><p>إدارة آمنة للمحتوى والملفات المنشورة.</p></div><a className="button button-primary" href="#editor">＋ أضف تطبيقاً</a></div>
      <div className="admin-stats"><article><div className="admin-stat-icon green">▤</div><div><span>إجمالي التطبيقات</span><b>{rows.length}</b><small>على قاعدة البيانات</small></div></article><article><div className="admin-stat-icon violet">◉</div><div><span>للآيفون</span><b>{rows.filter((x) => x.platform === 'ios').length}</b><small>iOS</small></div></article><article><div className="admin-stat-icon blue">⌘</div><div><span>للأندرويد</span><b>{rows.filter((x) => x.platform === 'android').length}</b><small>Android</small></div></article></div>
      <section className="admin-panel editor-panel" id="editor"><div className="panel-heading"><div><h2>{editing ? 'تعديل التطبيق' : 'إضافة تطبيق حقيقي'}</h2><p>الملفات الخاصة، بحد أقصى 50 ميغابايت. يبدأ كل تطبيق كمسودة.</p></div></div><form action={formAction} className="form-grid">
        <label>اسم التطبيق<input name="name" required maxLength={100} defaultValue={editing?.name || ''}/></label><label>المنصة<select name="platform" defaultValue={editing?.platform || 'ios'}><option value="ios">آيفون / iOS</option><option value="android">أندرويد</option></select></label>
        <label>التصنيف<select name="category" defaultValue={editing?.category || 'tools'}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>الإصدار<input name="version" required maxLength={40} defaultValue={editing?.version || ''}/></label>
        <label className="full">وصف مختصر<input name="short_description" required maxLength={240} defaultValue={editing?.short_description || ''}/></label><label className="full">شرح التطبيق والمميزات<textarea name="description" required minLength={10} maxLength={6000} rows={4} defaultValue={editing?.description || ''}/></label>
        <label>متطلبات النظام<input name="requirements" required maxLength={180} defaultValue={editing?.requirements || ''}/></label><label>المطور<input name="developer" required maxLength={120} defaultValue={editing?.developer || ''}/></label><label>الترخيص<input name="license" required maxLength={80} placeholder="مثال: MIT / إذن توزيع" defaultValue={editing?.license || ''}/></label><label>رابط المصدر<input name="source_url" type="url" required maxLength={500} placeholder="https://..." defaultValue={editing?.source_url || ''}/></label>
        <label className="full upload-field">ملف التطبيق (.ipa أو .apk)<input type="file" accept={editing?.platform === 'android' ? '.apk,application/vnd.android.package-archive' : '.ipa,application/octet-stream'} onChange={(event) => setFile(event.target.files?.[0] || null)} required={!editing?.file_path}/><small>{file ? `${file.name} · ${(file.size / 1048576).toFixed(1)} MB` : editing?.file_name || 'ارفع ملفاً حقيقياً، وسنتحقق من الحجم وبنية ZIP ونحسب بصمته.'}</small></label>
        <label className="rights-check full"><input type="checkbox" name="rights_confirmed" defaultChecked={editing?.rights_confirmed || false}/> أؤكد أن لدي حق توزيع هذا التطبيق والملف، وأن المصدر والترخيص موضحان للمستخدم.</label>
        <div className="form-actions full"><button className="button button-primary" disabled={busy}>{busy ? 'جارٍ الحفظ…' : editing ? 'حفظ التعديلات' : 'إضافة كمسودة'}</button>{editing && <button className="button form-cancel" type="button" onClick={() => { setEditing(null); setFile(null); }}>إلغاء التعديل</button>}</div>
      </form>{notice && <p role="status" className="form-message">{notice}</p>}</section>
      <section className="admin-panel" id="apps"><div className="panel-heading"><div><h2>تطبيقات المكتبة</h2><p>إدارة التفاصيل والنشر والحذف</p></div><label className="admin-search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث عن تطبيق…"/></label></div>
      {loadError && <p className="form-message">تعذر تحميل القائمة من قاعدة البيانات.</p>}<div className="table-wrap"><table><thead><tr><th>التطبيق</th><th>المنصة</th><th>التصنيف</th><th>الإصدار</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>{filtered.map((app) => <tr key={app.id}><td><b>{app.name}</b><small className="table-subtitle">{app.file_name}</small></td><td>{app.platform === 'ios' ? 'آيفون' : 'أندرويد'}</td><td>{labels[app.category] || app.category}</td><td>{app.version}</td><td><span className="status-pill">{app.is_published ? 'منشور' : 'مسودة'}</span></td><td className="row-actions"><button type="button" onClick={() => startEdit(app)}>تعديل</button><button type="button" onClick={() => publish(app)}>{app.is_published ? 'إيقاف' : 'نشر'}</button><button type="button" className="delete-row" onClick={() => deleteApp(app)}>حذف</button></td></tr>)}</tbody></table>{!filtered.length && <div className="admin-empty">ماكو تطبيقات حالياً. أضف أول تطبيق مرخّص من النموذج أعلاه.</div>}</div></section>
      <section className="admin-guide"><div className="guide-symbol">✓</div><div><b>الجلسة والملفات محمية</b><p>جلسة المشرف محفوظة بملفات تعريف ارتباط HttpOnly، وملفات APK/IPA في مخزن خاص وتظهر روابطها فقط عند النشر.</p></div></section>
    </section></main></>;
}

