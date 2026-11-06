import { useTranslation } from 'react-i18next';
import { Card } from '../../components/Card';
import { toHours } from './format';
import { useStats } from './queries';
import { SportDistribution } from './SportDistribution';

/** Training days, hours and sessions for a period, plus hours per sport. */
export function StatsSummary({ from, to, title }: { from: string; to: string; title: string }) {
  const { t, i18n } = useTranslation();
  const stats = useStats(from, to);
  const data = stats.data;

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
              <SportDistribution items={data.perSport} />
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
