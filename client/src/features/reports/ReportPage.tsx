import type { ReportLine, ReportSession, WeekSummary, WeeklyReport } from '@pace/shared';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BatteryLow,
  BatteryFull,
  Check,
  HeartPulse,
  Minus,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { Card } from '../../components/Card';
import { BarChart } from '../../components/charts/BarChart';
import { goalLabel, goalValue } from '../dashboard/goalText';
import { useReport } from '../dashboard/queries';
import { sportName } from '../profile/sports';
import { formatDay, formatDuration, toHours } from '../training/format';

export function ReportPage() {
  const { t, i18n } = useTranslation();
  const { weekStart = '' } = useParams();
  const report = useReport(weekStart);
  const lang = i18n.language;

  if (report.isPending) return null;
  if (report.isError || !report.data) {
    return (
      <div className="py-12 text-center">
        <p className="font-medium">{t('reports.notFound')}</p>
        <Link to="/reports" className="mt-2 inline-block text-sm font-medium text-accent">
          {t('reports.back')}
        </Link>
      </div>
    );
  }
  const r = report.data;
  const range = `${formatDay(r.weekStart, lang, { day: 'numeric', month: 'long' })} – ${formatDay(r.weekEnd, lang, { day: 'numeric', month: 'long', year: 'numeric' })}`;

  return (
    <article className="flex flex-col gap-6">
      <header>
        <Link
          to="/reports"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('reports.back')}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t('reports.reportTitle')}
        </h1>
        <p className="mt-1 text-muted">{range}</p>
      </header>

      <Card title={t('reports.sections.conclusion')}>
        <Lines lines={r.conclusion.summary} />
      </Card>

      <WeekStats stats={r.stats} />

      <Card title={t('reports.sections.goals')}>
        {r.goalResults.length === 0 ? (
          <p className="text-sm text-muted">{t('reports.noGoalsSet')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {r.goalResults.map((g, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full ${g.achieved ? 'bg-success/15 text-success' : 'bg-danger/10 text-danger'}`}
                >
                  {g.achieved ? (
                    <Check className="size-3.5" aria-hidden="true" />
                  ) : (
                    <X className="size-3.5" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  {goalLabel(t, g, lang)}
                  <span className="block text-xs text-muted">
                    {g.achieved ? t('goals.achieved') : t('goals.notAchieved')}
                  </span>
                </span>
                <span className="tabular text-sm text-muted">
                  <b className="font-semibold text-text">{goalValue(t, g, g.actual, lang)}</b> /{' '}
                  {goalValue(t, g, g.target, lang)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t('reports.sections.wentWell')}>
          <Lines lines={r.conclusion.wentWell} empty={t('reports.nothingToSay')} />
          <Sessions sessions={r.highlights.best} title={t('reports.bestSessions')} tone="good" />
        </Card>
        <Card title={t('reports.sections.improve')}>
          <Lines lines={r.conclusion.improve} empty={t('reports.nothingToSay')} />
          <Sessions sessions={r.highlights.worst} title={t('reports.worstSessions')} tone="bad" />
        </Card>
      </div>

      <BodyCard energy={r.highlights.energy ?? []} injuries={r.highlights.injuries ?? []} />

      <Comparison report={r} />
    </article>
  );
}

function Lines({ lines, empty }: { lines: ReportLine[]; empty?: string }) {
  const { t } = useTranslation();
  if (lines.length === 0) return empty ? <p className="text-sm text-muted">{empty}</p> : null;
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm marker:text-muted">
      {lines.map((line, i) => (
        <li key={i}>
          {t(`reports.lines.${line.key}`, { ...line.params, count: line.params?.count })}
        </li>
      ))}
    </ul>
  );
}

function Sessions({
  sessions,
  title,
  tone,
}: {
  sessions: ReportSession[];
  title: string;
  tone: 'good' | 'bad';
}) {
  const { t, i18n } = useTranslation();
  if (sessions.length === 0) return null;
  const Icon = tone === 'good' ? ThumbsUp : ThumbsDown;
  return (
    <div className="mt-5">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <ul className="flex flex-col gap-2">
        {sessions.map((s) => (
          <li key={s.id} className="rounded-xl border border-border p-3 text-sm">
            <div className="flex items-center gap-2">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: s.sport.color }}
                aria-hidden="true"
              />
              <span className="font-medium">{sportName(t, s.sport)}</span>
              <span className="text-muted">
                · {formatDay(s.date, i18n.language, { weekday: 'long' })} ·{' '}
                {formatDuration(s.durationMinutes)}
              </span>
              <span className="tabular ml-auto inline-flex items-center gap-1 text-muted">
                <Icon
                  className={`size-3.5 ${tone === 'good' ? 'text-success' : 'text-danger'}`}
                  aria-hidden="true"
                />
                {t('training.short.rating')} {s.rating}/5
              </span>
            </div>
            {s.ratingReason && <p className="mt-1.5">“{s.ratingReason}”</p>}
            {s.reflection && <p className="mt-1.5 text-muted">“{s.reflection}”</p>}
            {tone === 'bad' && !s.ratingReason && !s.reflection && (
              <p className="mt-1.5 text-muted">{t('reports.noReasonGiven')}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function WeekStats({ stats }: { stats: WeekSummary }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const tiles = [
    { label: t('dashboard.kpi.hours'), value: toHours(stats.totalMinutes, lang) },
    { label: t('training.stats.trainingDays'), value: String(stats.trainingDays) },
    { label: t('training.stats.sessions'), value: String(stats.sessions) },
    {
      label: t('dashboard.kpi.averageDuration'),
      value: stats.averageMinutes != null ? formatDuration(stats.averageMinutes) : '–',
    },
    {
      label: t('dashboard.kpi.punctuality'),
      value: stats.punctualityPct != null ? `${stats.punctualityPct}%` : '–',
      detail: stats.sessions
        ? t('reports.punctualityDetail', { onTime: stats.onTime, late: stats.late })
        : undefined,
    },
  ];
  return (
    <Card title={t('reports.sections.stats')}>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-xl bg-surface-2 px-3 py-3">
            <dt className="text-xs text-muted">{tile.label}</dt>
            <dd className="tabular mt-1 text-2xl font-semibold">{tile.value}</dd>
            {tile.detail && <dd className="mt-0.5 text-xs text-muted">{tile.detail}</dd>}
          </div>
        ))}
      </dl>
      {stats.perSport.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium">{t('reports.sportsPractised')}</h3>
          <ul className="flex flex-wrap gap-2">
            {stats.perSport.map((p) => (
              <li
                key={p.sport.id}
                className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: p.sport.color }}
                  aria-hidden="true"
                />
                {sportName(t, p.sport)}
                <span className="tabular text-muted">{formatDuration(p.minutes)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function Change({
  now,
  before,
  unit = 'pct',
}: {
  now: number | null;
  before: number | null;
  unit?: 'pct' | 'points' | 'count';
}) {
  const { t } = useTranslation();
  if (now == null || before == null) return <span className="text-muted">–</span>;
  const diff = now - before;
  const value =
    unit !== 'pct'
      ? Math.abs(diff)
      : before === 0
        ? null
        : Math.round((Math.abs(diff) / before) * 100);
  const Icon = diff > 0 ? ArrowUp : diff < 0 ? ArrowDown : Minus;
  const label =
    diff > 0
      ? t('reports.change.up')
      : diff < 0
        ? t('reports.change.down')
        : t('reports.change.same');
  return (
    <span className="tabular inline-flex items-center gap-1">
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="sr-only">{label}</span>
      {diff === 0
        ? ''
        : value == null
          ? ''
          : unit === 'points'
            ? t('reports.change.points', { value })
            : unit === 'count'
              ? value
              : `${value}%`}
    </span>
  );
}

function Comparison({ report }: { report: WeeklyReport }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const prev = report.previous;
  const now = report.stats;
  if (!prev) {
    return (
      <Card title={t('reports.sections.comparison')}>
        <p className="text-sm text-muted">{t('reports.noPreviousWeek')}</p>
      </Card>
    );
  }
  const rows = [
    {
      label: t('dashboard.kpi.hours'),
      now: toHours(now.totalMinutes, lang),
      before: toHours(prev.totalMinutes, lang),
      change: <Change now={now.totalMinutes} before={prev.totalMinutes} />,
    },
    {
      label: t('training.stats.trainingDays'),
      now: now.trainingDays,
      before: prev.trainingDays,
      change: <Change now={now.trainingDays} before={prev.trainingDays} />,
    },
    {
      label: t('training.stats.sessions'),
      now: now.sessions,
      before: prev.sessions,
      change: <Change now={now.sessions} before={prev.sessions} />,
    },
    {
      label: t('dashboard.kpi.punctuality'),
      now: now.punctualityPct != null ? `${now.punctualityPct}%` : '–',
      before: `${prev.punctualityPct}%`,
      change: <Change now={now.punctualityPct} before={prev.punctualityPct} unit="points" />,
    },
    {
      label: t('reports.goalsReached'),
      now: `${now.goalsAchieved}/${now.goalsTotal}`,
      before: `${prev.goalsAchieved}/${prev.goalsTotal}`,
      change: <Change now={now.goalsAchieved} before={prev.goalsAchieved} unit="count" />,
    },
  ];
  return (
    <Card title={t('reports.sections.comparison')}>
      <div className="overflow-x-auto">
        <table className="tabular w-full text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th scope="col" className="py-2 pr-3 font-medium">
                <span className="sr-only">{t('reports.metric')}</span>
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {t('reports.thisWeek')}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {t('reports.lastWeek')}
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">
                {t('reports.change.title')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="py-2 pr-3 font-normal text-muted">
                  {row.label}
                </th>
                <td className="px-3 py-2 text-right font-semibold">{row.now}</td>
                <td className="px-3 py-2 text-right">{row.before}</td>
                <td className="py-2 pl-3 text-right">{row.change}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6">
        <h3 className="mb-3 text-sm font-medium">{t('reports.perDay')}</h3>
        <BarChart
          title={t('reports.perDay')}
          categories={now.perDay.map((d) => ({
            label: formatDay(d.date, lang, { weekday: 'short' }),
            fullLabel: formatDay(d.date, lang, { weekday: 'long' }),
          }))}
          series={[
            {
              id: 'now',
              name: t('reports.thisWeek'),
              color: 'var(--accent)',
              values: now.perDay.map((d) => d.minutes / 60),
            },
            {
              id: 'before',
              name: t('reports.lastWeek'),
              color: 'var(--chart-2)',
              values: prev.perDay.map((d) => d.minutes / 60),
            },
          ]}
          format={(hours) => t('training.stats.hoursShort', { value: toHours(hours * 60, lang) })}
        />
      </div>
    </Card>
  );
}

/** Energy levels and injuries of the week, with the reasons the user gave. */
function BodyCard({ energy, injuries }: { energy: ReportSession[]; injuries: ReportSession[] }) {
  const { t, i18n } = useTranslation();
  if (energy.length === 0 && injuries.length === 0) return null;
  const when = (s: ReportSession) =>
    `${sportName(t, s.sport)} · ${formatDay(s.date, i18n.language, { weekday: 'long' })}`;
  return (
    <Card title={t('reports.sections.body')}>
      <div className="grid gap-6 lg:grid-cols-2">
        {energy.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium">{t('reports.energySessions')}</h3>
            <ul className="flex flex-col gap-2">
              {energy.map((s) => {
                const low = (s.energy ?? 3) < 3;
                const Icon = low ? BatteryLow : BatteryFull;
                return (
                  <li key={s.id} className="rounded-xl border border-border p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{when(s)}</span>
                      <span className="ml-auto inline-flex items-center gap-1 text-muted">
                        <Icon
                          className={`size-3.5 ${low ? 'text-danger' : 'text-success'}`}
                          aria-hidden="true"
                        />
                        {t(`training.checkin.energy.labels.${s.energy}`)}
                      </span>
                    </div>
                    <p className={`mt-1.5 ${s.energyReason ? '' : 'text-muted'}`}>
                      {s.energyReason ? `“${s.energyReason}”` : t('reports.noReasonGiven')}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {injuries.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium">{t('reports.injurySessions')}</h3>
            <ul className="flex flex-col gap-2">
              {injuries.map((s) => (
                <li key={s.id} className="rounded-xl border border-border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <HeartPulse className="size-3.5 text-danger" aria-hidden="true" />
                    <span className="font-medium">{when(s)}</span>
                  </div>
                  <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    <dt className="text-muted">{t('reports.injuryWhere')}</dt>
                    <dd>{s.injuryNote || '–'}</dd>
                    <dt className="text-muted">{t('reports.injuryCause')}</dt>
                    <dd>{s.injuryCause || '–'}</dd>
                  </dl>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
