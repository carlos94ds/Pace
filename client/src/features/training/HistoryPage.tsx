import { isIsoDate, type TrainingSession } from '@pace/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { PageHeader } from '../../app/PageHeader';
import { Button } from '../../components/Button';
import { SelectField, TextField } from '../../components/Field';
import { sportName } from '../profile/sports';
import { formatDay } from './format';
import { useHistory, useSports, type HistoryFilters } from './queries';
import { SessionCard } from './SessionCard';
import { SessionDialog } from './SessionDialog';

const FILTER_KEYS = ['sportId', 'punctuality', 'from', 'to'] as const;

/** Filters live in the URL, so a filtered list survives a refresh and can be bookmarked. */
function useFilters() {
  const [params, setParams] = useSearchParams();
  const date = (v: string | null) => (v && isIsoDate(v) ? v : undefined);
  const punctuality = params.get('punctuality');
  const filters: HistoryFilters = {
    sportId: params.get('sportId') || undefined,
    punctuality: punctuality === 'on_time' || punctuality === 'late' ? punctuality : undefined,
    from: date(params.get('from')),
    to: date(params.get('to')),
  };
  const update = (key: (typeof FILTER_KEYS)[number], value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  return { filters, update, clear: () => setParams({}, { replace: true }) };
}

export function HistoryPage() {
  const { t, i18n } = useTranslation();
  const { filters, update, clear } = useFilters();
  const sports = useSports();
  const history = useHistory(filters);
  const [dialog, setDialog] = useState<{ session?: TrainingSession } | null>(null);

  const sessions = history.data?.pages.flatMap((p) => p.items) ?? [];
  const filtered = FILTER_KEYS.some((k) => filters[k]);
  const sportOptions = (sports.data ?? [])
    .map((s) => ({ id: s.id, label: sportName(t, s) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Group by month for easier scanning.
  const groups: { month: string; items: TrainingSession[] }[] = [];
  for (const s of sessions) {
    const month = s.date.slice(0, 7);
    if (groups.at(-1)?.month !== month) groups.push({ month, items: [] });
    groups.at(-1)!.items.push(s);
  }

  return (
    <>
      <PageHeader
        title={t('training.history.title')}
        subtitle={t('training.history.subtitle')}
        actions={
          <>
            <Button onClick={() => setDialog({})}>
              <Plus className="size-4" aria-hidden="true" />
              {t('training.add')}
            </Button>
          </>
        }
      />

      <section
        aria-label={t('training.history.filters')}
        className="mb-6 grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end"
      >
        <SelectField
          label={t('training.fields.sport')}
          value={filters.sportId ?? ''}
          onChange={(e) => update('sportId', e.target.value)}
        >
          <option value="">{t('training.history.allSports')}</option>
          {sportOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('training.fields.punctuality')}
          value={filters.punctuality ?? ''}
          onChange={(e) => update('punctuality', e.target.value)}
        >
          <option value="">{t('training.history.any')}</option>
          <option value="on_time">{t('training.punctuality.on_time')}</option>
          <option value="late">{t('training.punctuality.late')}</option>
        </SelectField>
        <TextField
          type="date"
          label={t('training.history.from')}
          value={filters.from ?? ''}
          max={filters.to}
          onChange={(e) => update('from', e.target.value)}
        />
        <TextField
          type="date"
          label={t('training.history.to')}
          value={filters.to ?? ''}
          min={filters.from}
          onChange={(e) => update('to', e.target.value)}
        />
        <Button variant="ghost" onClick={clear} disabled={!filtered}>
          {t('training.history.clear')}
        </Button>
      </section>

      {history.isError && <p className="text-sm text-danger">{t('errors.api.unknown_error')}</p>}

      {history.isSuccess && sessions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <p className="font-medium">
            {filtered ? t('training.history.noResults') : t('training.history.empty')}
          </p>
          <p className="mt-1 text-sm text-muted">
            {filtered ? t('training.history.noResultsHint') : t('training.history.emptyHint')}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <section key={group.month}>
            <h2 className="mb-2 text-sm font-semibold text-muted capitalize">
              {formatDay(`${group.month}-01`, i18n.language, { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex flex-col gap-2">
              {group.items.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  showDate
                  onSelect={(session) => setDialog({ session })}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {history.hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="secondary"
            onClick={() => void history.fetchNextPage()}
            disabled={history.isFetchingNextPage}
          >
            {t('training.history.loadMore')}
          </Button>
        </div>
      )}

      <SessionDialog
        open={dialog !== null}
        session={dialog?.session}
        onClose={() => setDialog(null)}
      />
    </>
  );
}
