import type { UserCard } from '@pace/shared';
import { Check, UserPlus, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { formMessage } from '../../lib/forms';
import { useFriendAction } from './queries';

/** A user with the action that fits the relationship: add, accept/decline, or cancel. */
export function UserRow({
  user,
  detail,
  actions = true,
}: {
  user: UserCard;
  detail?: ReactNode;
  actions?: boolean;
}) {
  const { t } = useTranslation();
  const action = useFriendAction();
  const run = (kind: 'request' | 'accept' | 'decline' | 'cancel') =>
    action.mutate({ kind, userId: user.id, requestId: user.requestId });

  return (
    <li className="flex items-center gap-3 py-3">
      <Link to={`/u/${user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar url={user.avatarUrl} name={user.firstName} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{user.firstName}</span>
          <span className="block truncate text-xs text-muted">
            @{user.username}
            {detail && <> · {detail}</>}
          </span>
        </span>
      </Link>
      {actions && (
        <div className="flex shrink-0 items-center gap-1.5">
          {user.relation === 'none' && (
            <Button variant="secondary" disabled={action.isPending} onClick={() => run('request')}>
              <UserPlus className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t('social.actions.add')}</span>
              <span className="sr-only sm:hidden">{t('social.actions.add')}</span>
            </Button>
          )}
          {user.relation === 'incoming' && (
            <>
              <Button disabled={action.isPending} onClick={() => run('accept')}>
                <Check className="size-4" aria-hidden="true" />
                {t('social.actions.accept')}
              </Button>
              <Button
                variant="ghost"
                disabled={action.isPending}
                onClick={() => run('decline')}
                aria-label={t('social.actions.decline')}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </>
          )}
          {user.relation === 'outgoing' && (
            <Button variant="ghost" disabled={action.isPending} onClick={() => run('cancel')}>
              {t('social.actions.cancel')}
            </Button>
          )}
          {user.relation === 'friends' && (
            <span className="text-xs font-medium text-muted">{t('social.relation.friends')}</span>
          )}
        </div>
      )}
      {action.error && (
        <span className="sr-only" role="alert">
          {formMessage(t, action.error)}
        </span>
      )}
    </li>
  );
}
