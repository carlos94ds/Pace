import type { AchievementCode, EarnedAchievement } from '@pace/shared';
import { Award, Clock, Flame, Target, type LucideIcon } from 'lucide-react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/Card';
import { formatDay } from '../training/format';
import { useMyAchievements } from './queries';
import { Reactions } from './Reactions';

const ICONS: Record<AchievementCode, LucideIcon> = {
  FIRST_SESSION: Award,
  STREAK_3W: Flame,
  STREAK_7W: Flame,
  STREAK_26W: Flame,
  WEEK_20H: Clock,
  TOTAL_100H: Clock,
  TOTAL_500H: Clock,
  WEEKLY_GOAL: Target,
};

export function AchievementIcon({
  code,
  earned = true,
}: {
  code: AchievementCode;
  earned?: boolean;
}) {
  const Icon = ICONS[code];
  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
        earned ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted'
      }`}
    >
      <Icon className="size-4" aria-hidden="true" />
    </span>
  );
}

/** "Weekly goals reached · week 45" for repeatables, the plain title otherwise. */
export function achievementTitle(t: TFunction, a: Pick<EarnedAchievement, 'code' | 'period'>) {
  const title = t(`achievements.codes.${a.code}.title`);
  return a.period
    ? `${title} · ${t('achievements.week', { week: Number(a.period.split('-W')[1]) })}`
    : title;
}

/** The user's own achievements: everything that can be earned, and what has been. */
export function MyAchievementsCard() {
  const { t, i18n } = useTranslation();
  const data = useMyAchievements();

  return (
    <Card title={t('achievements.title')} description={t('achievements.description')}>
      <ul className="grid gap-3 sm:grid-cols-2">
        {data.data?.catalogue.map((c) => {
          const earned = c.earned > 0;
          const latest = data.data.recent.find((r) => r.code === c.code);
          return (
            <li
              key={c.code}
              className={`flex gap-3 rounded-xl border border-border p-3 ${earned ? '' : 'opacity-70'}`}
            >
              <AchievementIcon code={c.code} earned={earned} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {t(`achievements.codes.${c.code}.title`)}
                  {c.earned > 1 && (
                    <span className="tabular ml-1.5 text-xs text-muted">× {c.earned}</span>
                  )}
                </p>
                <p className="text-xs text-muted">
                  {t(`achievements.codes.${c.code}.description`)}
                </p>
                <p className="mt-1 text-xs">
                  {earned && c.lastEarnedAt ? (
                    <span className="text-success">
                      {t('achievements.earnedOn', {
                        date: formatDay(c.lastEarnedAt.slice(0, 10), i18n.language, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        }),
                      })}
                    </span>
                  ) : (
                    <span className="text-muted">{t('achievements.notYet')}</span>
                  )}
                </p>
                {latest && (
                  <div className="mt-2">
                    <Reactions
                      targetType="achievement"
                      targetId={latest.id}
                      summary={latest.reactions}
                      readOnly
                    />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
