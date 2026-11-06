import { PASSWORD_MIN, resetPasswordSchema } from '@pace/shared';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { TextField } from '../../components/Field';
import { api } from '../../lib/api';
import { fieldMessage, formMessage, validate, type FieldErrors } from '../../lib/forms';
import { AuthHeading } from './AuthLayout';

// Read once, then removed from the address bar so it doesn't linger in history.
function takeToken(): string {
  const url = new URL(window.location.href);
  const token = url.searchParams.get('token') ?? '';
  if (token) {
    url.searchParams.delete('token');
    window.history.replaceState(window.history.state, '', url);
  }
  return token;
}

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [token] = useState(takeToken);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const { data, errors } = validate(resetPasswordSchema, { token, password });
    setErrors(errors ?? {});
    setFormError(errors?.token ? t('errors.api.invalid_token') : undefined);
    if (!data) return;
    setBusy(true);
    try {
      await api('/auth/reset-password', { method: 'POST', body: data });
      navigate('/login', { replace: true, state: { notice: 'auth.reset.done' } });
    } catch (err) {
      setFormError(formMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AuthHeading title={t('auth.reset.title')} subtitle={t('auth.reset.subtitle')} />
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {formError && <Alert>{formError}</Alert>}
        <TextField
          label={t('fields.newPassword')}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={t('fields.passwordHint', { min: PASSWORD_MIN })}
          error={fieldMessage(t, 'password', errors.password)}
        />
        <Button type="submit" disabled={busy} className="h-10">
          {t('auth.reset.submit')}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link to="/forgot-password" className="font-medium text-accent hover:underline">
          {t('auth.reset.newLink')}
        </Link>
      </p>
    </>
  );
}
