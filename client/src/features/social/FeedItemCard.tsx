import type { FeedItem, FriendSession, PublicUser, ReactionSummary } from '@pace/shared';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Avatar } from '../../components/Avatar';
import { sportName } from '../profile/sports';
import { formatDay, formatDuration } from '../training/format';
import { AchievementIcon, achievementTitle } from './Achievements';
import { Reactions } from './Reactions';

function relativeDay(iso: string, lang: string) {
  return formatDay(iso.slice(0, 10), lang, { day: 'numeric', month: 'short' });
}

/** A friend's session: date, sport and duration; the rest only if they shared it. */
export function FriendSessionBody({
  session,
  reactions,
}: {
  session: FriendSession;
  reactions: ReactionSummary;
}) {
  const { t, i18n } = useTranslation();
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-2 font-medium">
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: session.sport.color }}
            aria-hidden="true"
          />
          {sportName(t, session.sport)}
        </span>
        <span className="tabular inline-flex items-center gap-1 text-muted">
          <Clock className="size-3.5" aria-hidden="true" />
          {formatDuration(session.durationMinutes)}
        </span>
        <span className="text-muted">
          {formatDay(session.date, i18n.language, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </span>
      </div>
      {session.details && (
        <div className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
          <span className="tabular">
            {(
              [
                ['rating', session.details.rating],
                ['energy', session.details.energy],
                ['motivation', session.details.motivation],
                ['intensity', session.details.intensity],
              ] as const
            )
              .filter(([, value]) => value !== null)
              .map(([key, value]) => `${t(`training.short.${key}`)} ${value}`)
              .join(' · ')}
          </span>
          {session.details.reflection && (
            <p className="mt-1 text-sm text-text">“{session.details.reflection}”</p>
          )}
        </div>
      )}
      <div className="mt-3">
        <Reactions targetType="session" targetId={session.id} summary={reactions} />
      </div>
    </>
  );
}

function Header({ user, at, text }: { user: PublicUser; at: string; text: string }) {
  const { i18n } = useTranslation();
  return (
    <div className="mb-2 flex items-center gap-3">
      <Link to={`/u/${user.username}`} className="shrink-0">
        <Avatar url={user.avatarUrl} name={user.firstName} />
      </Link>
      <p className="min-w-0 flex-1 text-sm">
        <Link to={`/u/${user.username}`} className="font-medium hover:underline">
          {user.firstName}
        </Link>{' '}
        <span className="text-muted">{text}</span>
      </p>
      <time dateTime={at} className="shrink-0 text-xs text-muted">
        {relativeDay(at, i18n.language)}
      </time>
    </div>
  );
}

export function FeedItemCard({ item }: { item: FeedItem }) {
  const { t } = useTranslation();
  return (
    <article className="rounded-2xl border border-border bg-surface p-4">
      {item.kind === 'session' ? (
        <>
          <Header user={item.user} at={item.createdAt} text={t('social.feed.trained')} />
          <FriendSessionBody session={item} reactions={item.reactions} />
        </>
      ) : (
        <>
          <Header user={item.user} at={item.createdAt} text={t('social.feed.achieved')} />
          <div className="flex items-center gap-3">
            <AchievementIcon code={item.code} />
            <div>
              <p className="text-sm font-medium">{achievementTitle(t, item)}</p>
              <p className="text-xs text-muted">
                {t(`achievements.codes.${item.code}.description`)}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <Reactions targetType="achievement" targetId={item.id} summary={item.reactions} />
          </div>
        </>
      )}
    </article>
  );
}
