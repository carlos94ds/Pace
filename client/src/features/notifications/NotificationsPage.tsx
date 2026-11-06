import type { AppNotification, NotificationType } from '@pace/shared';
import {
  Award,
  Bell,
  FileText,
  Flame,
  Heart,
  Settings,
  Target,
  UserCheck,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { PageHeader } from '../../app/PageHeader';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { useMarkRead, useNotifications } from './queries';
import { notificationText, timeAgo } from './text';

const ICONS: Record<NotificationType, LucideIcon> = {
  friend_request: UserPlus,
  friend_accepted: UserCheck,
  friend_achievement: Award,
  reaction: Heart,
  weekly_report: FileText,
  streak_milestone: Flame,
  goal_achieved: Target,
};

export function NotificationsPage() {
  const { t } = useTranslation();
  const list = useNotifications();
  const markRead = useMarkRead();
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const unread = list.data?.pages[0]?.unread ?? 0;

  return (
    <>
      <PageHeader
        title={t('notifications.title')}
        subtitle={t('notifications.subtitle')}
        actions={
          <>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={!unread || markRead.isPending}
                onClick={() => markRead.mutate(undefined)}
              >
                {t('notifications.markAllRead')}
              </Button>
              <Link
                to="/settings#notifications"
                className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-text"
                aria-label={t('notifications.settings')}
                title={t('notifications.settings')}
              >
                <Settings className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </>
        }
      />
      {list.isError && <p className="text-sm text-danger">{t('errors.api.unknown_error')}</p>}
      {list.isSuccess && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <Bell className="mx-auto mb-3 size-6 text-muted" aria-hidden="true" />
          <p className="font-medium">{t('notifications.empty')}</p>
          <p className="mt-1 text-sm text-muted">{t('notifications.emptyHint')}</p>
        </div>
      )}
      <ul className="flex max-w-3xl flex-col gap-2">
        {items.map((n) => (
          <NotificationRow key={n.id} n={n} />
        ))}
      </ul>
      {list.hasNextPage && (
        <div className="mt-4 flex max-w-3xl justify-center">
          <Button
            variant="secondary"
            disabled={list.isFetchingNextPage}
            onClick={() => void list.fetchNextPage()}
          >
            {t('training.history.loadMore')}
          </Button>
        </div>
      )}
    </>
  );
}

function NotificationRow({ n }: { n: AppNotification }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const markRead = useMarkRead();
  const Icon = ICONS[n.type] ?? Bell;
  const unread = !n.readAt;

  const open = () => {
    if (unread) markRead.mutate([n.id]);
    if (n.link) void navigate(n.link);
  };

  return (
    <li>
      <button
        type="button"
        onClick={open}
        className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent ${
          unread ? 'border-accent/30 bg-accent-soft/40' : 'border-border bg-surface'
        }`}
      >
        {n.actor ? (
          <Avatar url={n.actor.avatarUrl} name={n.actor.firstName} />
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
            <Icon className="size-4" aria-hidden="true" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className={`block text-sm ${unread ? 'font-medium' : ''}`}>
            {notificationText(t, n, i18n.language)}
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            <time dateTime={n.createdAt}>{timeAgo(n.createdAt, i18n.language)}</time>
          </span>
        </span>
        {unread && (
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent">
            <span className="sr-only">{t('notifications.unread')}</span>
          </span>
        )}
      </button>
    </li>
  );
}
