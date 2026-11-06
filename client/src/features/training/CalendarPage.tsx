import {
  addDays,
  addMonths,
  endOfMonth,
  isIsoDate,
  startOfMonth,
  startOfWeek,
  todayIn,
  type TrainingSession,
} from '@pace/shared';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { PageHeader } from '../../app/PageHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { SegmentedControl } from '../../components/SegmentedControl';
import { useCurrentUser } from '../auth/session';
import { sportName } from '../profile/sports';
import { formatDay, formatDuration } from './format';
import { useCalendarSessions } from './queries';
import { SessionCard } from './SessionCard';
import { SessionDialog } from './SessionDialog';
import { StatsSummary } from './StatsSummary';

type View = 'month' | 'week';
type DialogState = { session?: TrainingSession; date?: string } | null;

/** The days shown in the grid: whole weeks, Monday to Sunday. */
function visibleDays(view: View, anchor: string) {
  const first = view === 'month' ? startOfWeek(startOfMonth(anchor)) : startOfWeek(anchor);
  const last = view === 'month' ? addDays(startOfWeek(endOfMonth(anchor)), 6) : addDays(first, 6);
  const days: string[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(d);
  return days;
}

export function CalendarPage() {
  const { t, i18n } = useTranslation();
  const me = useCurrentUser();
  const today = todayIn(me.profile.timezone);
  const [params, setParams] = useSearchParams();
  const view: View = params.get('view') === 'week' ? 'week' : 'month';
  const dateParam = params.get('date');
  const anchor = dateParam && isIsoDate(dateParam) ? dateParam : today;
  const [selected, setSelected] = useState(anchor);
  const [dialog, setDialog] = useState<DialogState>(null);

  const days = useMemo(() => visibleDays(view, anchor), [view, anchor]);
  const from = days[0]!;
  const to = days[days.length - 1]!;
  const sessions = useCalendarSessions(from, to);

  const byDay = useMemo(() => {
    const map = new Map<string, TrainingSession[]>();
    for (const s of sessions.data ?? []) map.set(s.date, [...(map.get(s.date) ?? []), s]);
    return map;
  }, [sessions.data]);

  // Statistics follow what the user is looking at: the month itself, or the week.
  const statsFrom = view === 'month' ? startOfMonth(anchor) : from;
  const statsTo = view === 'month' ? endOfMonth(anchor) : to;

  const navigate = (date: string, nextView: View = view) => {
    setParams({ view: nextView, date }, { replace: true });
    setSelected(date);
  };
  const step = (dir: 1 | -1) =>
    navigate(view === 'month' ? addMonths(anchor, dir) : addDays(anchor, 7 * dir));

  const title =
    view === 'month'
      ? formatDay(anchor, i18n.language, { month: 'long', year: 'numeric' })
      : `${formatDay(from, i18n.language, { day: 'numeric', month: 'short' })} – ${formatDay(to, i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const openNew = (date?: string) => setDialog({ date: date ?? today });
  const openSession = (session: TrainingSession) => setDialog({ session });
  const selectedSessions = byDay.get(selected) ?? [];

  return (
    <>
      <PageHeader
        title={t('training.calendar.title')}
        subtitle={t('training.calendar.subtitle')}
        actions={
          <>
            {/* On phones the bottom bar has no room for History; it's one tap away here. */}
            <Link to="/history" className="mt-1 shrink-0 text-sm font-medium text-accent md:hidden">
              {t('nav.history')}
            </Link>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            onClick={() => step(-1)}
            aria-label={t('training.calendar.previous')}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <Button variant="secondary" onClick={() => navigate(today)}>
            {t('training.calendar.today')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => step(1)}
            aria-label={t('training.calendar.next')}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <h2 className="text-lg font-semibold capitalize" aria-live="polite">
          {title}
        </h2>
        <div className="ml-auto flex items-center gap-2">
          <SegmentedControl
            label={t('training.calendar.view')}
            value={view}
            options={[
              { value: 'month', label: t('training.calendar.month') },
              { value: 'week', label: t('training.calendar.week') },
            ]}
            onChange={(v) => navigate(selected, v)}
          />
          <Button onClick={() => openNew(selected <= today ? selected : today)}>
            <Plus className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('training.add')}</span>
            <span className="sr-only sm:hidden">{t('training.add')}</span>
          </Button>
        </div>
      </div>

      {sessions.isError && (
        <p className="mb-4 text-sm text-danger">{t('errors.api.unknown_error')}</p>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {view === 'month' ? (
            <MonthGrid
              days={days}
              month={anchor.slice(0, 7)}
              today={today}
              selected={selected}
              byDay={byDay}
              onSelectDay={setSelected}
              onSelectSession={openSession}
            />
          ) : (
            <WeekColumns
              days={days}
              today={today}
              byDay={byDay}
              onAdd={openNew}
              onSelectSession={openSession}
            />
          )}

          {view === 'month' && (
            <Card
              title={formatDay(selected, i18n.language, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
              actions={
                selected <= today && (
                  <Button variant="secondary" onClick={() => openNew(selected)}>
                    <Plus className="size-4" aria-hidden="true" />
                    {t('training.add')}
                  </Button>
                )
              }
            >
              {selectedSessions.length ? (
                <div className="flex flex-col gap-2">
                  {selectedSessions.map((s) => (
                    <SessionCard key={s.id} session={s} onSelect={openSession} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">
                  {selected > today
                    ? t('training.calendar.futureDay')
                    : t('training.calendar.restDay')}
                </p>
              )}
            </Card>
          )}
        </div>

        <StatsSummary
          from={statsFrom}
          to={statsTo}
          title={view === 'month' ? t('training.stats.thisMonth') : t('training.stats.thisWeek')}
        />
      </div>

      <SessionDialog
        open={dialog !== null}
        session={dialog?.session}
        date={dialog?.date}
        onClose={() => setDialog(null)}
      />
    </>
  );
}

function WeekdayHeader({ days }: { days: string[] }) {
  const { i18n } = useTranslation();
  return (
    <div className="grid grid-cols-7 border-b border-border text-center text-xs font-medium text-muted">
      {days.slice(0, 7).map((d) => (
        <div key={d} className="py-2">
          {formatDay(d, i18n.language, { weekday: 'short' })}
        </div>
      ))}
    </div>
  );
}

interface MonthGridProps {
  days: string[];
  month: string;
  today: string;
  selected: string;
  byDay: Map<string, TrainingSession[]>;
  onSelectDay: (date: string) => void;
  onSelectSession: (session: TrainingSession) => void;
}

function MonthGrid({
  days,
  month,
  today,
  selected,
  byDay,
  onSelectDay,
  onSelectSession,
}: MonthGridProps) {
  const { t, i18n } = useTranslation();
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <WeekdayHeader days={days} />
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const list = byDay.get(day) ?? [];
          const inMonth = day.startsWith(month);
          const isSelected = day === selected;
          const label = formatDay(day, i18n.language, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          });
          return (
            <div
              key={day}
              className={`relative min-h-16 border-r border-b border-border p-1 last:border-r-0 sm:min-h-24 sm:p-1.5 [&:nth-child(7n)]:border-r-0 ${
                isSelected ? 'bg-accent-soft/60' : ''
              } ${inMonth ? '' : 'bg-surface-2/50'}`}
            >
              {/* The whole cell selects the day; session chips on top open the session. */}
              <button
                type="button"
                onClick={() => onSelectDay(day)}
                aria-pressed={isSelected}
                aria-label={`${label}, ${t('training.stats.sessionCount', { count: list.length })}`}
                className="absolute inset-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
              />
              <span
                className={`tabular pointer-events-none relative flex size-6 items-center justify-center rounded-full text-xs ${
                  day === today
                    ? 'bg-accent font-semibold text-on-accent'
                    : inMonth
                      ? 'font-medium'
                      : 'text-muted'
                }`}
              >
                {Number(day.slice(8))}
              </span>
              {/* Phones: one dot per session. */}
              <span className="pointer-events-none relative mt-1 flex flex-wrap gap-0.5 sm:hidden">
                {list.slice(0, 4).map((s) => (
                  <span
                    key={s.id}
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: s.sport.color }}
                  />
                ))}
              </span>
              {/* Larger screens: a chip per session. */}
              <span className="relative mt-1 hidden flex-col gap-0.5 sm:flex">
                {list.slice(0, 3).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onSelectSession(s)}
                    className="truncate rounded-md border-l-[3px] bg-surface-2 px-1.5 py-0.5 text-left text-[11px] leading-4 hover:bg-border focus-visible:outline-2 focus-visible:outline-accent"
                    style={{ borderLeftColor: s.sport.color }}
                  >
                    <span className="font-medium">{sportName(t, s.sport)}</span>
                    <span className="tabular text-muted">
                      {' '}
                      · {formatDuration(s.durationMinutes)}
                    </span>
                  </button>
                ))}
                {list.length > 3 && (
                  <span className="pointer-events-none px-1.5 text-[11px] text-muted">
                    {t('training.calendar.more', { count: list.length - 3 })}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface WeekColumnsProps {
  days: string[];
  today: string;
  byDay: Map<string, TrainingSession[]>;
  onAdd: (date: string) => void;
  onSelectSession: (session: TrainingSession) => void;
}

function WeekColumns({ days, today, byDay, onAdd, onSelectSession }: WeekColumnsProps) {
  const { t, i18n } = useTranslation();
  return (
    <ol className="flex flex-col gap-2">
      {days.map((day) => {
        const list = byDay.get(day) ?? [];
        const longLabel = formatDay(day, i18n.language, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        });
        return (
          <li
            key={day}
            className="grid gap-2 rounded-2xl border border-border bg-surface p-3 sm:grid-cols-[8rem_1fr] sm:gap-4"
          >
            <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-start sm:justify-start">
              <span
                className={`text-sm ${day === today ? 'font-semibold text-accent' : 'font-medium'}`}
              >
                <span className="capitalize">
                  {formatDay(day, i18n.language, { weekday: 'long' })}
                </span>
                <span className="tabular block text-xs font-normal text-muted">
                  {formatDay(day, i18n.language, { day: 'numeric', month: 'short' })}
                </span>
              </span>
              {day <= today && (
                <Button
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => onAdd(day)}
                  aria-label={`${t('training.add')}: ${longLabel}`}
                >
                  <Plus className="size-4" aria-hidden="true" />
                </Button>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              {list.map((s) => (
                <SessionCard key={s.id} session={s} onSelect={onSelectSession} />
              ))}
              {list.length === 0 && (
                <p className="py-1 text-sm text-muted">
                  {day > today ? t('training.calendar.futureDay') : t('training.calendar.restDay')}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
