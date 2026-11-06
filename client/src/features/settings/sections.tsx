import {
  changeEmailSchema,
  changePasswordSchema,
  NOTIFICATION_KEYS,
  PASSWORD_MIN,
  PRIVACY_KEYS,
  type Me,
  type UpdatePreferencesInput,
  type UpdatePrivacyInput,
  type Visibility,
} from '@pace/shared';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { TextField } from '../../components/Field';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Toggle } from '../../components/Toggle';
import { api } from '../../lib/api';
import {
  apiFieldErrors,
  fieldMessage,
  formMessage,
  validate,
  type FieldErrors,
} from '../../lib/forms';
import { useCurrentUser, useLogout, useMeMutation } from '../auth/session';

export function usePreferences() {
  return useMeMutation((body: UpdatePreferencesInput) =>
    api<Me>('/me/preferences', { method: 'PATCH', body }),
  );
}

function SaveError({ error }: { error: unknown }) {
  const { t } = useTranslation();
  return error ? (
    <div className="mt-3">
      <Alert>{formMessage(t, error)}</Alert>
    </div>
  ) : null;
}

export function AccountSection() {
  const { t } = useTranslation();
  const me = useCurrentUser();
  const navigate = useNavigate();
  const logoutAll = useLogout(true);

  return (
    <Card title={t('settings.account.title')} description={t('settings.account.description')}>
      <div className="grid gap-8">
        <EmailForm key={me.email} currentEmail={me.email} />
        <PasswordForm />
        <div className="flex flex-col items-start gap-2 border-t border-border pt-6">
          <h3 className="text-sm font-medium">{t('settings.account.sessions')}</h3>
          <p className="text-sm text-muted">{t('settings.account.sessionsHelp')}</p>
          <Button
            variant="secondary"
            disabled={logoutAll.isPending}
            onClick={() =>
              logoutAll.mutate(undefined, {
                onSuccess: () => navigate('/login', { replace: true }),
              })
            }
          >
            {t('settings.account.logoutAll')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function EmailForm({ currentEmail }: { currentEmail: string }) {
  const { t } = useTranslation();
  const [values, setValues] = useState({ email: currentEmail, password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [done, setDone] = useState(false);
  const save = useMeMutation((body: { email: string; password: string }) =>
    api<Me>('/me/email', { method: 'PUT', body }),
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    const { data, errors } = validate(changeEmailSchema, values);
    setErrors(errors ?? {});
    setDone(false);
    if (!data) return;
    save.mutate(data, {
      onSuccess: () => setDone(true),
      onError: (err) => setErrors(apiFieldErrors(err)),
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <h3 className="text-sm font-medium">{t('settings.account.email')}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t('fields.email')}
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(e) => setValues({ ...values, email: e.target.value })}
          error={fieldMessage(t, 'email', errors.email)}
        />
        <TextField
          label={t('fields.currentPassword')}
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={(e) => setValues({ ...values, password: e.target.value })}
          error={fieldMessage(t, 'password', errors.password)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          variant="secondary"
          disabled={save.isPending || values.email === currentEmail}
        >
          {t('settings.account.changeEmail')}
        </Button>
        {done && <span className="text-sm text-success">{t('common.saved')}</span>}
      </div>
      {save.error && !Object.keys(apiFieldErrors(save.error)).length && (
        <SaveError error={save.error} />
      )}
    </form>
  );
}

function PasswordForm() {
  const { t } = useTranslation();
  const [values, setValues] = useState({ currentPassword: '', newPassword: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const { data, errors } = validate(changePasswordSchema, values);
    setErrors(errors ?? {});
    setDone(false);
    setError(undefined);
    if (!data) return;
    setBusy(true);
    try {
      await api('/me/password', { method: 'PUT', body: data });
      setValues({ currentPassword: '', newPassword: '' });
      setDone(true);
    } catch (err) {
      const fields = apiFieldErrors(err);
      if (Object.keys(fields).length) setErrors(fields);
      else setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 border-t border-border pt-6">
      <h3 className="text-sm font-medium">{t('settings.account.password')}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t('fields.currentPassword')}
          type="password"
          autoComplete="current-password"
          value={values.currentPassword}
          onChange={(e) => setValues({ ...values, currentPassword: e.target.value })}
          error={fieldMessage(t, 'currentPassword', errors.currentPassword)}
        />
        <TextField
          label={t('fields.newPassword')}
          type="password"
          autoComplete="new-password"
          value={values.newPassword}
          onChange={(e) => setValues({ ...values, newPassword: e.target.value })}
          hint={t('fields.passwordHint', { min: PASSWORD_MIN })}
          error={fieldMessage(t, 'password', errors.newPassword)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="secondary" disabled={busy}>
          {t('settings.account.changePassword')}
        </Button>
        {done && (
          <span className="text-sm text-success">{t('settings.account.passwordChanged')}</span>
        )}
      </div>
      <SaveError error={error} />
    </form>
  );
}

export function PrivacySection() {
  const { t } = useTranslation();
  const me = useCurrentUser();
  const save = useMeMutation((body: UpdatePrivacyInput) =>
    api<Me>('/me/privacy', { method: 'PATCH', body }),
  );
  const options = [
    { value: 'private', label: t('settings.privacy.private') },
    { value: 'friends', label: t('settings.privacy.friends') },
  ] as const;

  return (
    <Card title={t('settings.privacy.title')} description={t('settings.privacy.description')}>
      <Toggle
        label={t('settings.privacy.discoverable')}
        description={t('settings.privacy.discoverableHelp')}
        checked={me.privacy.discoverable}
        disabled={save.isPending}
        onChange={(discoverable) => save.mutate({ discoverable })}
      />
      <div className="divide-y divide-border border-t border-border">
        {PRIVACY_KEYS.map((key) => (
          <div
            key={key}
            className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-medium">{t(`settings.privacy.items.${key}.label`)}</p>
              <p className="mt-0.5 text-sm text-muted">{t(`settings.privacy.items.${key}.help`)}</p>
            </div>
            <SegmentedControl
              label={t(`settings.privacy.items.${key}.label`)}
              value={me.privacy[key]}
              options={options}
              onChange={(value: Visibility) => save.mutate({ [key]: value })}
            />
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted">{t('settings.privacy.neverShared')}</p>
      <SaveError error={save.error} />
    </Card>
  );
}

export function NotificationsSection() {
  const { t } = useTranslation();
  const me = useCurrentUser();
  const save = usePreferences();
  return (
    <Card
      title={t('settings.notifications.title')}
      description={t('settings.notifications.description')}
    >
      <div className="divide-y divide-border">
        {NOTIFICATION_KEYS.map((key) => (
          <Toggle
            key={key}
            label={t(`settings.notifications.items.${key}`)}
            checked={me.preferences.notifications[key]}
            disabled={save.isPending}
            onChange={(on) => save.mutate({ notifications: { [key]: on } })}
          />
        ))}
      </div>
      <SaveError error={save.error} />
    </Card>
  );
}

export function DeleteAccountSection({ onDelete }: { onDelete: () => void }) {
  const { t } = useTranslation();
  return (
    <Card
      title={t('settings.delete.title')}
      description={t('settings.delete.description')}
      className="border-danger/40"
    >
      <Button variant="secondary" className="text-danger" onClick={onDelete}>
        {t('settings.delete.button')}
      </Button>
    </Card>
  );
}
