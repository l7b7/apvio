'use client';

import { useState } from 'react';
import { loginAction, requestAdminAccessAction, resendAdminConfirmationAction } from '../actions';

export default function LoginForm({ message }) {
  const [create, setCreate] = useState(false);
  const [resend, setResend] = useState(false);
  return <form className="login-form" action={resend ? resendAdminConfirmationAction : create ? requestAdminAccessAction : loginAction}>
    <label>البريد الإلكتروني<input type="email" name="email" autoComplete="username" required maxLength={254} dir="ltr"/></label>
    {!resend && <label>{create ? 'أنشئ كلمة مرور' : 'كلمة المرور'}<input type="password" name={create ? 'newPassword' : 'password'} autoComplete={create ? 'new-password' : 'current-password'} required minLength={create ? 12 : 10} maxLength={128} dir="ltr"/></label>}
    {message && <p className="form-message" role="status">{message}</p>}
    <button className="button button-primary login-submit" type="submit">{resend ? 'إعادة إرسال رابط التأكيد' : create ? 'إرسال رابط التأكيد' : 'تسجيل الدخول'} <span>←</span></button>
    <button className="login-mode" type="button" onClick={() => { setCreate(!create); setResend(false); }}>{create ? 'عندي حساب بالفعل' : 'إعداد حساب المشرف لأول مرة'}</button>
    {!create && <button className="login-mode" type="button" onClick={() => setResend(!resend)}>{resend ? 'الرجوع لتسجيل الدخول' : 'ما وصلني رابط التأكيد؟ أعد إرساله'}</button>}
  </form>;
}

