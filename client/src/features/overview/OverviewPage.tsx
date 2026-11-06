import type { HealthResponse } from '@pace/shared';
import { useQuery } from '@tanstack/react-query';
import { Check, Circle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../app/PageHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { StatusDot } from '../../components/StatusDot';
import { fetchHealth } from '../../lib/api';
import { useCurrentUser } from '../auth/session';

const PHASES = [1, 2, 3, 4, 5, 6, 7] as const;
const CURRENT_PHASE = 2;

export function OverviewPage() {
  const { t, i18n } = useTranslation();
  const me = useCurrentUser();
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => fetchHealth<HealthResponse>(),
    refetchInterval: 30_000,
  });

  const apiUp = health.isSuccess;
  const dbUp = health.data?.database === 'up';

  const rows = [
    {
      label: t('status.api'),
      tone: health.isPending ? 'muted' : apiUp ? 'success' : 'danger',
      value: health.isPending
        ? t('status.checking')
        : apiUp
          ? t('status.online')
          : t('status.offline'),
    },
    {
      label: t('status.database'),
      tone: health.isPending ? 'muted' : dbUp ? 'success' : 'danger',
      value: health.isPending
        ? t('status.checking')
        : dbUp
          ? t('status.online')
          : t('status.offline'),
    },
  ] as const;

  return (
    <>
      <PageHeader
        title={t('status.greeting', { name: me.profile.firstName })}
        subtitle={t('status.subtitle')}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card
          title={t('status.systemTitle')}
          actions={
            <Button
              variant="ghost"
              onClick={() => void health.refetch()}
              disabled={health.isFetching}
              aria-label={t('status.refresh')}
            >
              <RefreshCw
                className={`size-4 ${health.isFetching ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
            </Button>
          }
        >
          <dl className="divide-y divide-border">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between py-3 first:pt-0">
                <dt className="text-sm text-muted">{row.label}</dt>
                <dd className="flex items-center gap-2 text-sm font-medium">
                  <StatusDot tone={row.tone} />
                  {row.value}
                </dd>
              </div>
            ))}
            {health.data && (
              <div className="flex items-center justify-between py-3 last:pb-0">
                <dt className="text-sm text-muted">{t('status.lastChecked')}</dt>
                <dd className="tabular text-sm font-medium">
                  {new Date(health.data.time).toLocaleTimeString(i18n.language)}
                  <span className="ml-2 text-muted">· {health.data.version}</span>
                </dd>
              </div>
            )}
          </dl>
        </Card>

        <Card title={t('status.roadmapTitle')}>
          <ol className="space-y-3">
            {PHASES.map((phase) => {
              const done = phase < CURRENT_PHASE;
              const current = phase === CURRENT_PHASE;
              return (
                <li key={phase} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
                      done || current ? 'bg-accent text-on-accent' : 'bg-surface-2 text-muted'
                    }`}
                  >
                    {done ? (
                      <Check className="size-3" aria-hidden="true" />
                    ) : (
                      <Circle
                        className={`size-2 ${current ? 'fill-current' : ''}`}
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  <span
                    className={`text-sm ${current ? 'font-semibold' : done ? '' : 'text-muted'}`}
                  >
                    {t('status.phase', { number: phase })} – {t(`status.phases.${phase}`)}
                    {current && (
                      <span className="ml-2 text-xs font-medium text-accent">
                        {t('status.inProgress')}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>
    </>
  );
}
