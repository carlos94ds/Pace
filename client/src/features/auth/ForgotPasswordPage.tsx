import { forgotPasswordSchema } from '@pace/shared';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { TextField } from '../../components/Field';
import { api } from '../../lib/api';
import { fieldMessage, formMessage, validate, type FieldErrors } from '../../lib/forms';
import { AuthHeading } from './AuthLayout';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const { data, errors } = validate(forgotPasswordSchema, { email });
    setErrors(errors ?? {});
    setFormError(undefined);
    if (!data) return;
    setBusy(true);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: data });
      setSent(true);
    } catch (err) {
      setFormError(formMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AuthHeading title={t('auth.forgot.title')} subtitle={t('auth.forgot.subtitle')} />
      {sent ? (
        <Alert tone="success">{t('auth.forgot.sent')}</Alert>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {formError && <Alert>{formError}</Alert>}
          <TextField
            label={t('fields.email')}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldMessage(t, 'email', errors.email)}
          />
          <Button type="submit" disabled={busy} className="h-10">
            {t('auth.forgot.submit')}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="font-medium text-accent hover:underline">
          {t('auth.backToLogin')}
        </Link>
      </p>
    </>
  );
}
