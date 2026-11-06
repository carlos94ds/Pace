import type { GoalResult, GoalType, Sport } from '@pace/shared';
import type { TFunction } from 'i18next';
import { sportName } from '../profile/sports';
import { toHours } from '../training/format';

type GoalLike = { type: GoalType; target: number; sport: Sport | null };

/** "Train 10 hours per week", "3× MMA per week" … */
export function goalLabel(t: TFunction, goal: GoalLike, locale: string) {
  return t(`goals.describe.${goal.type}`, {
    count: goal.target,
    hours: toHours(goal.target, locale),
    sport: goal.sport ? sportName(t, goal.sport) : '',
  });
}

/** The measured value in the goal's own unit. */
export function goalValue(
  t: TFunction,
  goal: Pick<GoalResult, 'type'>,
  value: number,
  locale: string,
) {
  if (goal.type === 'total_minutes')
    return t('training.stats.hoursShort', { value: toHours(value, locale) });
  if (goal.type === 'punctuality_pct') return `${value}%`;
  return String(value);
}
