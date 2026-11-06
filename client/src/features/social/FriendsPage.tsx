import { Search, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { PageHeader } from '../../app/PageHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { TextField } from '../../components/Field';
import { toHours } from '../training/format';
import { FeedItemCard } from './FeedItemCard';
import { useFeed, useFriendRequests, useFriends, useSuggestions, useUserSearch } from './queries';
import { UserRow } from './UserRow';

const TABS = ['activity', 'friends', 'requests', 'find'] as const;
type Tab = (typeof TABS)[number];

export function FriendsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab') as Tab | null;
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : 'activity';
  const requests = useFriendRequests();
  const incoming = requests.data?.incoming.length ?? 0;

  return (
    <>
      <PageHeader title={t('social.title')} subtitle={t('social.subtitle')} />
      <div
        role="tablist"
        aria-label={t('social.title')}
        className="mb-6 flex gap-1 overflow-x-auto border-b border-border"
      >
        {TABS.map((id) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setParams({ tab: id }, { replace: true })}
            className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-150 ${
              tab === id
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            {t(`social.tabs.${id}`)}
            {id === 'requests' && incoming > 0 && (
              <span className="tabular rounded-full bg-accent px-1.5 text-[11px] font-semibold text-on-accent">
                {incoming}
              </span>
            )}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="max-w-3xl">
        {tab === 'activity' && <ActivityTab onFind={() => setParams({ tab: 'find' })} />}
        {tab === 'friends' && <FriendsTab onFind={() => setParams({ tab: 'find' })} />}
        {tab === 'requests' && <RequestsTab />}
        {tab === 'find' && <FindTab />}
      </div>
    </>
  );
}

function Empty({ title, text, onFind }: { title: string; text: string; onFind?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
      <Users className="mx-auto mb-3 size-6 text-muted" aria-hidden="true" />
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted">{text}</p>
      {onFind && (
        <Button variant="secondary" className="mt-4" onClick={onFind}>
          <Search className="size-4" aria-hidden="true" />
          {t('social.findFriends')}
        </Button>
      )}
    </div>
  );
}

function ActivityTab({ onFind }: { onFind: () => void }) {
  const { t } = useTranslation();
  const feed = useFeed();
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];
  if (feed.isError) return <p className="text-sm text-danger">{t('errors.api.unknown_error')}</p>;
  if (feed.isSuccess && items.length === 0)
    return (
      <Empty title={t('social.feed.empty')} text={t('social.feed.emptyHint')} onFind={onFind} />
    );
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <FeedItemCard key={`${item.kind}-${item.id}`} item={item} />
      ))}
      {feed.hasNextPage && (
        <Button
          variant="secondary"
          className="self-center"
          disabled={feed.isFetchingNextPage}
          onClick={() => void feed.fetchNextPage()}
        >
          {t('training.history.loadMore')}
        </Button>
      )}
    </div>
  );
}

function FriendsTab({ onFind }: { onFind: () => void }) {
  const { t, i18n } = useTranslation();
  const friends = useFriends();
  if (friends.isSuccess && friends.data.length === 0)
    return <Empty title={t('social.noFriends')} text={t('social.noFriendsHint')} onFind={onFind} />;
  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-surface px-4">
      {friends.data?.map((f) => (
        <UserRow
          key={f.id}
          user={f}
          actions={false}
          detail={
            f.weekMinutes !== null
              ? t('social.weekHours', { value: toHours(f.weekMinutes, i18n.language) })
              : undefined
          }
        />
      ))}
    </ul>
  );
}

function RequestsTab() {
  const { t } = useTranslation();
  const requests = useFriendRequests();
  const data = requests.data;
  if (data && !data.incoming.length && !data.outgoing.length)
    return <Empty title={t('social.noRequests')} text={t('social.noRequestsHint')} />;
  return (
    <div className="flex flex-col gap-6">
      {data && data.incoming.length > 0 && (
        <Card title={t('social.incoming')}>
          <ul className="-my-3 divide-y divide-border">
            {data.incoming.map((u) => (
              <UserRow key={u.id} user={u} />
            ))}
          </ul>
        </Card>
      )}
      {data && data.outgoing.length > 0 && (
        <Card title={t('social.outgoing')}>
          <ul className="-my-3 divide-y divide-border">
            {data.outgoing.map((u) => (
              <UserRow key={u.id} user={u} detail={t('social.relation.outgoing')} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function useDebounced(value: string, ms = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

function FindTab() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim());
  const results = useUserSearch(q);
  const suggestions = useSuggestions();

  return (
    <div className="flex flex-col gap-6">
      <TextField
        label={t('social.search')}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('social.searchPlaceholder')}
        hint={t('social.searchHint')}
      />
      {q.length >= 2 && results.data && (
        <Card title={t('social.results')}>
          {results.data.length === 0 ? (
            <p className="text-sm text-muted">{t('social.noResults')}</p>
          ) : (
            <ul className="-my-3 divide-y divide-border">
              {results.data.map((u) => (
                <UserRow key={u.id} user={u} />
              ))}
            </ul>
          )}
        </Card>
      )}
      <Card title={t('social.suggestions')} description={t('social.suggestionsHelp')}>
        {suggestions.data?.length === 0 ? (
          <p className="text-sm text-muted">{t('social.noSuggestions')}</p>
        ) : (
          <ul className="-my-3 divide-y divide-border">
            {suggestions.data?.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                detail={
                  u.mutualFriends > 0
                    ? t('social.mutualFriends', { count: u.mutualFriends })
                    : undefined
                }
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
