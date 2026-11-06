import { addDays } from '@pace/shared';
import { ChevronRight, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PageHeader } from '../../app/PageHeader';
import { useReports } from '../dashboard/queries';
import { formatDay, toHours } from '../training/format';

export function ReportsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const reports = useReports();

  return (
    <>
      <PageHeader title={t('reports.title')} subtitle={t('reports.subtitle')} />
      {reports.isError && <p className="text-sm text-danger">{t('errors.api.unknown_error')}</p>}
      {reports.data?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <FileText className="mx-auto mb-3 size-6 text-muted" aria-hidden="true" />
          <p className="font-medium">{t('reports.empty')}</p>
          <p className="mt-1 text-sm text-muted">{t('reports.emptyHint')}</p>
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {reports.data?.map((r) => (
          <li key={r.weekStart}>
            <Link
              to={`/reports/${r.weekStart}`}
              className="flex items-center gap-4 rounded-2xl border border-border bg-surface px-4 py-3 transition-colors duration-150 hover:bg-surface-2"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-medium">
                  {formatDay(r.weekStart, lang, { day: 'numeric', month: 'short' })} –{' '}
                  {formatDay(addDays(r.weekStart, 6), lang, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                  {!r.viewedAt && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-on-accent">
                      {t('reports.new')}
                    </span>
                  )}
                </span>
                <span className="tabular mt-0.5 block text-sm text-muted">
                  {t('training.stats.hoursShort', { value: toHours(r.totalMinutes, lang) })} ·{' '}
                  {t('reports.daysCount', { count: r.trainingDays })} ·{' '}
                  {r.goalsTotal > 0
                    ? t('reports.goalsCount', { achieved: r.goalsAchieved, total: r.goalsTotal })
                    : t('reports.noGoals')}
                </span>
              </span>
              <ChevronRight className="size-4 text-muted" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
