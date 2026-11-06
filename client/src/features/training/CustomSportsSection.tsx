import type { Sport } from '@pace/shared';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ApiError } from '../../lib/api';
import { formMessage } from '../../lib/forms';
import { useDeleteSport, useSports } from './queries';
import { SportForm } from './SportForm';

/** The user's own sports: add, rename, recolour, or delete when no session uses them. */
export function CustomSportsSection() {
  const { t } = useTranslation();
  const sports = useSports();
  const remove = useDeleteSport();
  const [editing, setEditing] = useState<Sport | 'new' | null>(null);
  const own = (sports.data ?? []).filter((s) => !s.slug);

  const deleteError =
    remove.error instanceof ApiError && remove.error.code === 'sport_in_use'
      ? t('training.sports.inUse')
      : remove.error && formMessage(t, remove.error);

  return (
    <Card title={t('training.sports.title')} description={t('training.sports.description')}>
      {own.length > 0 && (
        <ul className="mb-4 divide-y divide-border rounded-lg border border-border">
          {own.map((sport) =>
            editing !== 'new' && editing?.id === sport.id ? (
              <li key={sport.id} className="p-2">
                <SportForm
                  sport={sport}
                  onSaved={() => setEditing(null)}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={sport.id} className="flex items-center gap-3 px-3 py-2">
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: sport.color }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{sport.name}</span>
                <Button
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => setEditing(sport)}
                  aria-label={`${t('training.sports.edit')}: ${sport.name}`}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  className="h-8 px-2 hover:text-danger"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(sport.id)}
                  aria-label={`${t('training.sports.delete')}: ${sport.name}`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </li>
            ),
          )}
        </ul>
      )}
      {own.length === 0 && editing !== 'new' && (
        <p className="mb-4 text-sm text-muted">{t('training.sports.none')}</p>
      )}
      {deleteError && (
        <div className="mb-4">
          <Alert>{deleteError}</Alert>
        </div>
      )}
      {editing === 'new' ? (
        <SportForm onSaved={() => setEditing(null)} onCancel={() => setEditing(null)} />
      ) : (
        <Button variant="secondary" onClick={() => setEditing('new')}>
          <Plus className="size-4" aria-hidden="true" />
          {t('training.sports.add')}
        </Button>
      )}
    </Card>
  );
}
