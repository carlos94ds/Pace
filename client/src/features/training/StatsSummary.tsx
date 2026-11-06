import { useTranslation } from 'react-i18next';
import { Card } from '../../components/Card';
import { sportName } from '../profile/sports';
import { toHours } from './format';
import { useStats } from './queries';

/** Training days, hours and sessions for a period, plus hours per sport. */
export function StatsSummary({ from, to, title }: { from: string; to: string; title: string }) {
  const { t, i18n } = useTranslation();
  const stats = useStats(from, to);
  const data = stats.data;
  const max = Math.max(1, ...(data?.perSport.map((s) => s.minutes) ?? []));

  const tiles = [
    { label: t('training.stats.trainingDays'), value: data?.trainingDays },
    { label: t('training.stats.hours'), value: data && toHours(data.totalMinutes, i18n.language) },
    { label: t('training.stats.sessions'), value: data?.sessions },
  ];

  return (
    <Card title={title}>
      {stats.isError ? (
        <p className="text-sm text-danger">{t('errors.api.unknown_error')}</p>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3">
            {tiles.map((tile) => (
              <div key={tile.label} className="rounded-xl bg-surface-2 px-3 py-3">
                <dt className="text-xs text-muted">{tile.label}</dt>
                <dd className="tabular mt-1 text-2xl font-semibold">{tile.value ?? '–'}</dd>
              </div>
            ))}
          </dl>
          {data && data.perSport.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-3 text-sm font-medium">{t('training.stats.perSport')}</h3>
              <ul className="flex flex-col gap-3">
                {data.perSport.map(({ sport, minutes, sessions }) => (
                  <li key={sport.id}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate">{sportName(t, sport)}</span>
                      <span className="tabular shrink-0 text-muted">
                        {t('training.stats.hoursShort', { value: toHours(minutes, i18n.language) })}
                        {' · '}
                        {t('training.stats.sessionCount', { count: sessions })}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(minutes / max) * 100}%`, backgroundColor: sport.color }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data && data.sessions === 0 && (
            <p className="mt-4 text-sm text-muted">{t('training.stats.empty')}</p>
          )}
        </>
      )}
    </Card>
  );
}
