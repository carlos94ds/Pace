import { loginSchema, type Me } from '@pace/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { TextField } from '../../components/Field';
import { api } from '../../lib/api';
import { fieldMessage, formMessage, validate, type FieldErrors } from '../../lib/forms';
import { AuthHeading } from './AuthLayout';
import { ME_KEY } from './session';

export function LoginPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const { data, errors } = validate(loginSchema, values);
    setErrors(errors ?? {});
    setFormError(undefined);
    if (!data) return;
    setBusy(true);
    try {
      const me = await api<Me>('/auth/login', { method: 'POST', body: data });
      // PublicOnly sees the session and redirects.
      queryClient.setQueryData(ME_KEY, me);
    } catch (err) {
      setFormError(formMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AuthHeading title={t('auth.login.title')} subtitle={t('auth.login.subtitle')} />
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {notice && <Alert tone="success">{t(notice)}</Alert>}
        {formError && <Alert>{formError}</Alert>}
        <TextField
          label={t('fields.email')}
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(e) => setValues({ ...values, email: e.target.value })}
          error={fieldMessage(t, 'email', errors.email)}
        />
        <TextField
          label={t('fields.password')}
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={(e) => setValues({ ...values, password: e.target.value })}
          error={fieldMessage(t, 'password', errors.password)}
        />
        <Link to="/forgot-password" className="-mt-1 self-end text-sm text-accent hover:underline">
          {t('auth.login.forgot')}
        </Link>
        <Button type="submit" disabled={busy} className="h-10">
          {t('auth.login.submit')}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {t('auth.login.noAccount')}{' '}
        <Link to="/register" className="font-medium text-accent hover:underline">
          {t('auth.register.link')}
        </Link>
      </p>
    </>
  );
}
