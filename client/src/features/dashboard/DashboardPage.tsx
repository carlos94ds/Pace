import {
  addDays,
  addMonths,
  endOfMonth,
  isIsoDate,
  startOfMonth,
  startOfWeek,
  todayIn,
  type Bucket,
  type Dashboard,
} from '@pace/shared';
import { ChevronLeft, ChevronRight, FileText, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { PageHeader } from '../../app/PageHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { BarChart } from '../../components/charts/BarChart';
import { TextField } from '../../components/Field';
import { SegmentedControl } from '../../components/SegmentedControl';
import { useCurrentUser } from '../auth/session';
import { formatDay, formatDuration, toHours } from '../training/format';
import { SessionDialog } from '../training/SessionDialog';
import { SportDistribution } from '../training/SportDistribution';
import { GoalsCard } from './GoalsCard';
import { useDashboard, useReports } from './queries';

const PERIODS = ['week', 'month', 'year', 'custom'] as const;
type Period = (typeof PERIODS)[number];

function rangeFor(period: Period, anchor: string, from?: string, to?: string) {
  if (period === 'week') return { from: startOfWeek(anchor), to: addDays(startOfWeek(anchor), 6) };
  if (period === 'month') return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
  if (period === 'year')
    return { from: `${anchor.slice(0, 4)}-01-01`, to: `${anchor.slice(0, 4)}-12-31` };
  const end = to ?? anchor;
  return { from: from && from <= end ? from : addDays(end, -29), to: end };
}

function step(period: Period, anchor: string, dir: 1 | -1) {
  if (period === 'week') return addDays(anchor, 7 * dir);
  if (period === 'month') return addMonths(anchor, dir);
  return `${Number(anchor.slice(0, 4)) + dir}-01-01`;
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const me = useCurrentUser();
  const today = todayIn(me.profile.timezone);
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(false);
  const lang = i18n.language;

  const periodParam = params.get('period') as Period | null;
  const period: Period = periodParam && PERIODS.includes(periodParam) ? periodParam : 'week';
  const valid = (key: string) => {
    const v = params.get(key);
    return v && isIsoDate(v) ? v : undefined;
  };
  const anchor = valid('date') ?? today;
  const range = rangeFor(period, anchor, valid('from'), valid('to'));
  const dashboard = useDashboard(range.from, range.to);
  const reports = useReports();
  const latest = reports.data?.[0];

  const update = (next: Record<string, string>) =>
    setParams(
      { period, ...(period === 'custom' ? range : { date: anchor }), ...next },
      { replace: true },
    );

  const label =
    period === 'week'
      ? `${formatDay(range.from, lang, { day: 'numeric', month: 'short' })} – ${formatDay(range.to, lang, { day: 'numeric', month: 'short', year: 'numeric' })}`
      : period === 'month'
        ? formatDay(range.from, lang, { month: 'long', year: 'numeric' })
        : period === 'year'
          ? range.from.slice(0, 4)
          : null;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title={t('dashboard.greeting', { name: me.profile.firstName })}
          subtitle={t('dashboard.subtitle')}
        />
        <Button onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden="true" />
          {t('training.add')}
        </Button>
      </div>

      {latest && !latest.viewedAt && (
        <Link
          to={`/reports/${latest.weekStart}`}
          className="mb-6 flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm transition-colors duration-150 hover:border-accent"
        >
          <FileText className="size-5 shrink-0 text-accent" aria-hidden="true" />
          <span className="flex-1">
            <b className="font-semibold">{t('reports.readyTitle')}</b>{' '}
            {t('reports.readyText', {
              range: `${formatDay(latest.weekStart, lang, { day: 'numeric', month: 'short' })} – ${formatDay(addDays(latest.weekStart, 6), lang, { day: 'numeric', month: 'short' })}`,
            })}
          </span>
          <ChevronRight className="size-4 text-accent" aria-hidden="true" />
        </Link>
      )}

      {/* One filter row scopes every number and chart below it. */}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <SegmentedControl
          label={t('dashboard.period')}
          value={period}
          options={PERIODS.map((p) => ({ value: p, label: t(`dashboard.periods.${p}`) }))}
          onChange={(p) =>
            setParams(p === 'custom' ? { period: p, ...range } : { period: p, date: anchor }, {
              replace: true,
            })
          }
        />
        {period === 'custom' ? (
          <div className="flex flex-wrap gap-3">
            <TextField
              type="date"
              label={t('training.history.from')}
              value={range.from}
              max={range.to}
              onChange={(e) => isIsoDate(e.target.value) && update({ from: e.target.value })}
            />
            <TextField
              type="date"
              label={t('training.history.to')}
              value={range.to}
              min={range.from}
              onChange={(e) => isIsoDate(e.target.value) && update({ to: e.target.value })}
            />
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              onClick={() => update({ date: step(period, anchor, -1) })}
              aria-label={t('training.calendar.previous')}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="secondary"
              onClick={() => update({ date: step(period, anchor, 1) })}
              aria-label={t('training.calendar.next')}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
            <span className="ml-2 font-semibold capitalize" aria-live="polite">
              {label}
            </span>
          </div>
        )}
      </div>

      {dashboard.isError && (
        <p className="mb-4 text-sm text-danger">{t('errors.api.unknown_error')}</p>
      )}

      <div
        className={`transition-opacity duration-150 ${dashboard.isPlaceholderData ? 'opacity-60' : ''}`}
      >
        <Kpis data={dashboard.data} />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <Card title={t('dashboard.hoursOverTime')}>
            {dashboard.data && <HoursChart data={dashboard.data} />}
          </Card>
          <Card title={t('training.stats.perSport')}>
            {dashboard.data?.totals.perSport.length ? (
              <SportDistribution items={dashboard.data.totals.perSport} />
            ) : (
              <p className="text-sm text-muted">{t('training.stats.empty')}</p>
            )}
          </Card>
        </div>
        <div className="mt-6">
          <GoalsCard results={dashboard.data?.goals.results} />
        </div>
      </div>

      <SessionDialog open={adding} date={today} onClose={() => setAdding(false)} />
    </>
  );
}

function Kpi({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="tabular mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">{value}</dd>
      {detail && <dd className="mt-1 text-xs text-muted">{detail}</dd>}
    </div>
  );
}

function Kpis({ data }: { data: Dashboard | undefined }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const dash = '–';
  const tot = data?.totals;
  const streaks = data?.streaks;
  const noStreak = streaks && streaks.dayGoal === null;
  const weeks = (n: number | null | undefined) =>
    n == null ? dash : t('dashboard.weeks', { count: n });
  const c = data?.consistency;

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Kpi label={t('dashboard.kpi.hours')} value={tot ? toHours(tot.totalMinutes, lang) : dash} />
      <Kpi label={t('training.stats.trainingDays')} value={tot ? String(tot.trainingDays) : dash} />
      <Kpi label={t('training.stats.sessions')} value={tot ? String(tot.sessions) : dash} />
      <Kpi
        label={t('dashboard.kpi.averageDuration')}
        value={tot?.averageMinutes != null ? formatDuration(tot.averageMinutes) : dash}
      />
      <Kpi
        label={t('dashboard.kpi.punctuality')}
        value={tot?.punctualityPct != null ? `${tot.punctualityPct}%` : dash}
        detail={
          tot && tot.sessions > 0
            ? t('dashboard.kpi.punctualityDetail', { onTime: tot.onTime, sessions: tot.sessions })
            : undefined
        }
      />
      <Kpi
        label={t('dashboard.kpi.consistency')}
        value={c?.pct != null ? `${c.pct}%` : dash}
        detail={
          c && c.pct != null
            ? c.basis === 'weeks'
              ? t('dashboard.kpi.consistencyWeeks', { achieved: c.achieved, total: c.total })
              : t('dashboard.kpi.consistencyDays', { achieved: c.achieved, total: c.total })
            : undefined
        }
      />
      <Kpi
        label={t('dashboard.kpi.currentStreak')}
        value={weeks(streaks?.current)}
        detail={
          noStreak
            ? t('dashboard.kpi.streakNeedsGoal')
            : streaks
              ? t('dashboard.kpi.streakGoal', { count: streaks.dayGoal ?? 0 })
              : undefined
        }
      />
      <Kpi label={t('dashboard.kpi.longestStreak')} value={weeks(streaks?.longest)} />
    </dl>
  );
}

function bucketLabels(start: string, bucket: Bucket, rangeDays: number, lang: string) {
  if (bucket === 'month')
    return {
      label: formatDay(start, lang, { month: 'short' }),
      fullLabel: formatDay(start, lang, { month: 'long', year: 'numeric' }),
    };
  if (bucket === 'week')
    return {
      label: formatDay(start, lang, { day: 'numeric', month: 'short' }),
      fullLabel: `${formatDay(start, lang, { day: 'numeric', month: 'short' })} – ${formatDay(addDays(start, 6), lang, { day: 'numeric', month: 'short' })}`,
    };
  return {
    label:
      rangeDays <= 7
        ? formatDay(start, lang, { weekday: 'short' })
        : formatDay(start, lang, { day: 'numeric' }),
    fullLabel: formatDay(start, lang, { weekday: 'long', day: 'numeric', month: 'long' }),
  };
}

function HoursChart({ data }: { data: Dashboard }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const name = t('dashboard.kpi.hours');
  return (
    <BarChart
      title={t('dashboard.hoursOverTime')}
      categories={data.series.map((p) =>
        bucketLabels(p.start, data.bucket, data.series.length, lang),
      )}
      series={[
        {
          id: 'hours',
          name,
          color: 'var(--accent)',
          values: data.series.map((p) => p.minutes / 60),
        },
      ]}
      format={(hours) => t('training.stats.hoursShort', { value: toHours(hours * 60, lang) })}
    />
  );
}
