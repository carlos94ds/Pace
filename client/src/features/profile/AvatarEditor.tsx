import type { Me } from '@pace/shared';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '../../components/Alert';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { api } from '../../lib/api';
import { formMessage } from '../../lib/forms';
import { useCurrentUser, useMeMutation } from '../auth/session';

export function AvatarEditor() {
  const { t } = useTranslation();
  const me = useCurrentUser();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();

  const upload = useMeMutation((file: File) => {
    const form = new FormData();
    form.append('avatar', file);
    return api<Me>('/me/avatar', { method: 'POST', body: form });
  });
  const remove = useMeMutation(() => api<Me>('/me/avatar', { method: 'DELETE' }));
  const busy = upload.isPending || remove.isPending;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <Avatar url={me.profile.avatarUrl} name={me.profile.firstName} size="lg" />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => input.current?.click()}>
            {me.profile.avatarUrl ? t('profile.avatar.change') : t('profile.avatar.upload')}
          </Button>
          {me.profile.avatarUrl && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setError(undefined);
                remove.mutate(undefined, { onError: (err) => setError(formMessage(t, err)) });
              }}
            >
              {t('profile.avatar.remove')}
            </Button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setError(undefined);
            upload.mutate(file, { onError: (err) => setError(formMessage(t, err)) });
          }}
        />
      </div>
      <p className="text-xs text-muted">{t('profile.avatar.hint')}</p>
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
