import type { TrainingSession } from '@pace/shared';
import { Clock, Lock, MapPin, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { sportName } from '../profile/sports';
import { formatDay, formatDuration } from './format';

interface SessionCardProps {
  session: TrainingSession;
  onSelect: (session: TrainingSession) => void;
  showDate?: boolean;
}

export function SessionCard({ session, onSelect, showDate }: SessionCardProps) {
  const { t, i18n } = useTranslation();
  const late = session.punctuality === 'late';
  return (
    <button
      type="button"
      onClick={() => onSelect(session)}
      className="group flex w-full gap-3 rounded-xl border border-border bg-surface p-3 text-left transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
    >
      <span
        className="w-1 shrink-0 self-stretch rounded-full"
        style={{ backgroundColor: session.sport.color }}
        aria-hidden="true"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="font-medium">{sportName(t, session.sport)}</span>
          {showDate && (
            <span className="text-xs text-muted">
              {formatDay(session.date, i18n.language, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="tabular inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden="true" />
            {formatDuration(session.durationMinutes)}
          </span>
          {session.gym && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{session.gym.name}</span>
            </span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${
              late ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'
            }`}
          >
            {t(`training.punctuality.${session.punctuality}`)}
          </span>
        </span>
        <span className="tabular flex flex-wrap gap-x-3 text-xs text-muted">
          <span>
            {t('training.short.motivation')} <b className="text-text">{session.motivation}</b>
          </span>
          <span>
            {t('training.short.rating')} <b className="text-text">{session.rating}</b>
          </span>
          <span>
            {t('training.short.intensity')} <b className="text-text">{session.intensity}</b>
          </span>
          <span
            className="ml-auto inline-flex items-center gap-1"
            title={
              session.shareDetails ? t('training.sharedWithFriends') : t('training.privateDetails')
            }
          >
            {session.shareDetails ? (
              <Users className="size-3.5" aria-hidden="true" />
            ) : (
              <Lock className="size-3.5" aria-hidden="true" />
            )}
            <span className="sr-only">
              {session.shareDetails
                ? t('training.sharedWithFriends')
                : t('training.privateDetails')}
            </span>
          </span>
        </span>
        {session.reflection && (
          <span className="line-clamp-2 text-sm text-muted">“{session.reflection}”</span>
        )}
      </span>
    </button>
  );
}
