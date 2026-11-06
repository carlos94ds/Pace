import type { AppNotification } from '@pace/shared';
import type { TFunction } from 'i18next';
import { formatDay } from '../training/format';

/** The notification's sentence in the reader's own language. */
export function notificationText(t: TFunction, n: AppNotification, lang: string) {
  const p = n.params;
  switch (n.key) {
    case 'friendAchievement':
      return t('notifications.text.friendAchievement', {
        firstName: p.firstName,
        achievement: t(`achievements.codes.${p.code}.title`),
      });
    case 'reaction':
      return t(
        `notifications.text.reaction_${p.targetType === 'achievement' ? 'achievement' : 'session'}`,
        {
          firstName: p.firstName,
          reaction: t(`social.reactions.${p.type}`),
        },
      );
    case 'weeklyReport':
    case 'goalsAchieved':
      return t(`notifications.text.${n.key}`, {
        ...p,
        week:
          typeof p.weekStart === 'string'
            ? formatDay(p.weekStart, lang, { day: 'numeric', month: 'long' })
            : '',
      });
    default:
      return t(`notifications.text.${n.key}`, {
        ...p,
        defaultValue: t('notifications.text.unknown'),
      });
  }
}

/** "5 min ago", "yesterday", "3 days ago" … */
export function timeAgo(iso: string, lang: string, now = Date.now()) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 7],
    ['week', 4.35],
    ['month', 12],
    ['year', Infinity],
  ];
  let value = seconds;
  for (const [unit, size] of steps) {
    if (Math.abs(value) < size) return rtf.format(Math.round(value), unit);
    value /= size;
  }
  return '';
}
