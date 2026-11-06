import type { Sport } from '@pace/shared';
import { useTranslation } from 'react-i18next';
import { sportName } from '../profile/sports';
import { toHours } from './format';

/** Hours per sport as labelled bars; the sport's name always sits next to its colour. */
export function SportDistribution({
  items,
}: {
  items: { sport: Sport; sessions: number; minutes: number }[];
}) {
  const { t, i18n } = useTranslation();
  const max = Math.max(1, ...items.map((s) => s.minutes));
  return (
    <ul className="flex flex-col gap-3">
      {items.map(({ sport, minutes, sessions }) => (
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
              className="h-full rounded-full transition-[width] duration-300"
              style={{ width: `${(minutes / max) * 100}%`, backgroundColor: sport.color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
