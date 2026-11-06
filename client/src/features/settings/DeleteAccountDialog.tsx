import { deleteAccountSchema } from '@pace/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { TextField } from '../../components/Field';
import { api } from '../../lib/api';
import {
  apiFieldErrors,
  fieldMessage,
  formMessage,
  validate,
  type FieldErrors,
} from '../../lib/forms';
import { ME_KEY } from '../auth/session';

export function DeleteAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const { data, errors } = validate(deleteAccountSchema, { password });
    setErrors(errors ?? {});
    setFormError(undefined);
    if (!data) return;
    setBusy(true);
    try {
      await api('/me', { method: 'DELETE', body: data });
      queryClient.clear();
      queryClient.setQueryData(ME_KEY, null);
      navigate('/login', { replace: true, state: { notice: 'settings.delete.done' } });
    } catch (err) {
      const fields = apiFieldErrors(err);
      if (Object.keys(fields).length) setErrors(fields);
      else setFormError(formMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} title={t('settings.delete.confirmTitle')} onClose={onClose}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t('settings.delete.confirmText')}</p>
        {formError && <Alert>{formError}</Alert>}
        <TextField
          label={t('fields.password')}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldMessage(t, 'password', errors.password)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={busy} className="bg-danger hover:bg-danger/90">
            {t('settings.delete.confirmButton')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
