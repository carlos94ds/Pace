import { PASSWORD_MIN, registerSchema, type Me } from '@pace/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { TextField } from '../../components/Field';
import { api } from '../../lib/api';
import {
  apiFieldErrors,
  fieldMessage,
  formMessage,
  validate,
  type FieldErrors,
} from '../../lib/forms';
import { AuthHeading } from './AuthLayout';
import { ME_KEY } from './session';

export function RegisterPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [values, setValues] = useState({ firstName: '', username: '', email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const set = (field: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues({ ...values, [field]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const { data, errors } = validate(registerSchema, {
      ...values,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: i18n.resolvedLanguage,
    });
    setErrors(errors ?? {});
    setFormError(undefined);
    if (!data) return;
    setBusy(true);
    try {
      const me = await api<Me>('/auth/register', { method: 'POST', body: data });
      // PublicOnly sees the session and redirects to the profile.
      queryClient.setQueryData(ME_KEY, me);
    } catch (err) {
      const fields = apiFieldErrors(err);
      if (Object.keys(fields).length) setErrors(fields);
      else setFormError(formMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AuthHeading title={t('auth.register.title')} subtitle={t('auth.register.subtitle')} />
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {formError && <Alert>{formError}</Alert>}
        <TextField
          label={t('fields.firstName')}
          autoComplete="given-name"
          value={values.firstName}
          onChange={set('firstName')}
          error={fieldMessage(t, 'firstName', errors.firstName)}
        />
        <TextField
          label={t('fields.username')}
          autoComplete="username"
          autoCapitalize="none"
          value={values.username}
          onChange={set('username')}
          hint={t('fields.usernameHint')}
          error={fieldMessage(t, 'username', errors.username)}
        />
        <TextField
          label={t('fields.email')}
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={set('email')}
          error={fieldMessage(t, 'email', errors.email)}
        />
        <TextField
          label={t('fields.password')}
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={set('password')}
          hint={t('fields.passwordHint', { min: PASSWORD_MIN })}
          error={fieldMessage(t, 'password', errors.password)}
        />
        <Button type="submit" disabled={busy} className="h-10">
          {t('auth.register.submit')}
        </Button>
        <p className="text-xs text-muted">{t('auth.register.privacyNote')}</p>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {t('auth.register.haveAccount')}{' '}
        <Link to="/login" className="font-medium text-accent hover:underline">
          {t('auth.login.link')}
        </Link>
      </p>
    </>
  );
}
