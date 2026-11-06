import type { UserProfileView } from '@pace/shared';
import { Check, Flame, Lock, MapPin, UserMinus, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router';
import { Alert } from '../../components/Alert';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { BarChart } from '../../components/charts/BarChart';
import { LineChart } from '../../components/charts/LineChart';
import { formMessage } from '../../lib/forms';
import { useCurrentUser } from '../auth/session';
import { goalLabel, goalValue } from '../dashboard/goalText';
import { sportName } from '../profile/sports';
import { formatDay, toHours } from '../training/format';
import { AchievementIcon, achievementTitle } from './Achievements';
import { FriendSessionBody } from './FeedItemCard';
import { useFriendAction, useUserProfile } from './queries';
import { Reactions } from './Reactions';

export function UserProfilePage() {
  const { t, i18n } = useTranslation();
  const { username = '' } = useParams();
  const me = useCurrentUser();
  const profile = useUserProfile(username);

  if (username.toLowerCase() === me.profile.username) return <Navigate to="/profile" replace />;
  if (profile.isPending) return null;
  if (profile.isError) {
    return (
      <div className="py-12 text-center">
        <p className="font-medium">{t('social.profile.notFound')}</p>
        <Link to="/friends?tab=find" className="mt-2 inline-block text-sm font-medium text-accent">
          {t('social.findFriends')}
        </Link>
      </div>
    );
  }
  const view = profile.data;
  const nothingShared =
    view.user.relation === 'friends' &&
    !view.profile &&
    !view.activity &&
    !view.streaks &&
    !view.achievements &&
    !view.report &&
    !view.weight;

  return (
    <div className="flex flex-col gap-6">
      <Header view={view} />
      {view.user.relation !== 'friends' && (
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{t('social.profile.onlyFriends', { name: view.user.firstName })}</p>
        </div>
      )}
      {nothingShared && (
        <p className="text-sm text-muted">
          {t('social.profile.nothingShared', { name: view.user.firstName })}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          {view.activity && <Activity view={view} />}
          {view.report && <ReportSummary report={view.report} />}
          {view.weight && view.weight.length > 0 && (
            <Card
              title={t('weight.title')}
              description={t('social.profile.weightShared', { name: view.user.firstName })}
            >
              {view.weight.length > 1 ? (
                <LineChart
                  title={t('weight.history')}
                  points={[...view.weight].reverse().map((w) => ({
                    label: formatDay(w.measuredOn, i18n.language, {
                      day: 'numeric',
                      month: 'short',
                    }),
                    fullLabel: formatDay(w.measuredOn, i18n.language, {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    }),
                    value: w.weightKg,
                  }))}
                  format={(v) =>
                    `${v.toLocaleString(i18n.language, { maximumFractionDigits: 1 })} kg`
                  }
                  height={160}
                />
              ) : (
                <p className="tabular text-2xl font-semibold">
                  {view.weight[0]!.weightKg.toLocaleString(i18n.language, {
                    maximumFractionDigits: 1,
                  })}{' '}
                  kg
                </p>
              )}
            </Card>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          {view.streaks && (
            <Card title={t('dashboard.kpi.currentStreak')}>
              {view.streaks.current === null ? (
                <p className="text-sm text-muted">
                  {t('social.profile.noStreakGoal', { name: view.user.firstName })}
                </p>
              ) : (
                <p className="tabular flex items-center gap-2 text-3xl font-semibold">
                  <Flame className="size-6 text-accent" aria-hidden="true" />
                  {t('dashboard.weeks', { count: view.streaks.current })}
                </p>
              )}
              {view.streaks.longest !== null && (
                <p className="mt-1 text-sm text-muted">
                  {t('dashboard.kpi.longestStreak')}:{' '}
                  {t('dashboard.weeks', { count: view.streaks.longest })}
                </p>
              )}
            </Card>
          )}
          {view.achievements && (
            <Card title={t('achievements.title')}>
              {view.achievements.length === 0 ? (
                <p className="text-sm text-muted">{t('social.profile.noAchievements')}</p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {view.achievements.map((a) => (
                    <li key={a.id} className="flex gap-3">
                      <AchievementIcon code={a.code} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{achievementTitle(t, a)}</p>
                        <p className="mb-2 text-xs text-muted">
                          {t(`achievements.codes.${a.code}.description`)}
                        </p>
                        <Reactions targetType="achievement" targetId={a.id} summary={a.reactions} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Header({ view }: { view: UserProfileView }) {
  const { t } = useTranslation();
  const action = useFriendAction();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const { user } = view;
  const run = (kind: 'request' | 'accept' | 'decline' | 'cancel' | 'remove') =>
    action.mutate(
      { kind, userId: user.id, requestId: user.requestId },
      { onSuccess: () => setConfirmRemove(false) },
    );

  return (
    <header className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:flex-row sm:items-center">
      <Avatar url={user.avatarUrl} name={user.firstName} size="lg" />
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold tracking-tight">{user.firstName}</h1>
        <p className="text-sm text-muted">@{user.username}</p>
        {view.profile && (
          <div className="mt-2 flex flex-col gap-2 text-sm">
            {view.profile.bio && <p>{view.profile.bio}</p>}
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
              <span>{t(`trainingLevels.${view.profile.trainingLevel}`)}</span>
              {view.profile.gym && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {view.profile.gym.name}, {view.profile.gym.city}
                </span>
              )}
            </p>
            {view.profile.sports.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {view.profile.sports.map((s) => (
                  <li
                    key={s.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs"
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: s.color }}
                      aria-hidden="true"
                    />
                    {sportName(t, s)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {user.relation === 'none' && (
          <Button onClick={() => run('request')} disabled={action.isPending}>
            <UserPlus className="size-4" aria-hidden="true" />
            {t('social.actions.add')}
          </Button>
        )}
        {user.relation === 'outgoing' && (
          <>
            <span className="text-sm text-muted">{t('social.relation.outgoing')}</span>
            <Button variant="ghost" onClick={() => run('cancel')} disabled={action.isPending}>
              {t('social.actions.cancel')}
            </Button>
          </>
        )}
        {user.relation === 'incoming' && (
          <>
            <Button onClick={() => run('accept')} disabled={action.isPending}>
              <Check className="size-4" aria-hidden="true" />
              {t('social.actions.accept')}
            </Button>
            <Button variant="ghost" onClick={() => run('decline')} disabled={action.isPending}>
              <X className="size-4" aria-hidden="true" />
              {t('social.actions.decline')}
            </Button>
          </>
        )}
        {user.relation === 'friends' &&
          (confirmRemove ? (
            <>
              <span className="text-sm text-muted">{t('social.actions.removeConfirm')}</span>
              <Button
                className="bg-danger text-white hover:bg-danger/90"
                onClick={() => run('remove')}
                disabled={action.isPending}
              >
                {t('social.actions.remove')}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmRemove(false)}>
                {t('common.cancel')}
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmRemove(true)}>
              <UserMinus className="size-4" aria-hidden="true" />
              {t('social.actions.remove')}
            </Button>
          ))}
      </div>
      {action.error && (
        <div className="w-full">
          <Alert>{formMessage(t, action.error)}</Alert>
        </div>
      )}
    </header>
  );
}

function Activity({ view }: { view: UserProfileView }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const activity = view.activity!;
  return (
    <>
      <Card title={t('social.profile.weeklyHours')}>
        <BarChart
          title={t('social.profile.weeklyHours')}
          categories={activity.weeks.map((w) => ({
            label: formatDay(w.weekStart, lang, { day: 'numeric', month: 'short' }),
            fullLabel: t('social.profile.weekOf', {
              date: formatDay(w.weekStart, lang, { day: 'numeric', month: 'long' }),
            }),
          }))}
          series={[
            {
              id: 'hours',
              name: t('dashboard.kpi.hours'),
              color: 'var(--accent)',
              values: activity.weeks.map((w) => w.minutes / 60),
            },
          ]}
          format={(hours) => t('training.stats.hoursShort', { value: toHours(hours * 60, lang) })}
          height={160}
        />
      </Card>
      <Card title={t('social.profile.recent')}>
        {activity.recent.length === 0 ? (
          <p className="text-sm text-muted">{t('training.history.empty')}</p>
        ) : (
          <ul className="-my-3 divide-y divide-border">
            {activity.recent.map((s) => (
              <li key={s.id} className="py-3">
                <FriendSessionBody session={s} reactions={s.reactions} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function ReportSummary({ report }: { report: NonNullable<UserProfileView['report']> }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  return (
    <Card
      title={t('social.profile.lastReport')}
      description={t('social.profile.weekOf', {
        date: formatDay(report.weekStart, lang, { day: 'numeric', month: 'long' }),
      })}
    >
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [t('dashboard.kpi.hours'), toHours(report.totalMinutes, lang)],
          [t('training.stats.trainingDays'), String(report.trainingDays)],
          [t('training.stats.sessions'), String(report.sessions)],
          [
            t('dashboard.kpi.punctuality'),
            report.punctualityPct === null ? '–' : `${report.punctualityPct}%`,
          ],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-surface-2 px-3 py-2.5">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="tabular mt-0.5 text-xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {report.goalResults.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2 text-sm">
          {report.goalResults.map((g, i) => (
            <li key={i} className="flex items-center gap-2">
              {g.achieved ? (
                <Check className="size-4 text-success" aria-hidden="true" />
              ) : (
                <X className="size-4 text-danger" aria-hidden="true" />
              )}
              <span className="flex-1">{goalLabel(t, g, lang)}</span>
              <span className="tabular text-muted">
                {goalValue(t, g, g.actual, lang)} / {goalValue(t, g, g.target, lang)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
