import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router';
import { setTextSize, setTheme } from '../../lib/preferences';
import { CurrentUserContext, useMe } from './session';

/** Only internal paths, so a crafted ?next= can't send users to another site. */
export function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

function FullScreenState({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-sm text-muted">
      {children}
    </div>
  );
}

export function RequireAuth() {
  const { data: me, isPending, isError, refetch } = useMe();
  const location = useLocation();
  const { t, i18n } = useTranslation();

  // The account's saved preferences win over this browser's.
  const prefs = me?.preferences;
  useEffect(() => {
    if (!prefs) return;
    setTheme(prefs.theme);
    setTextSize(prefs.textSize);
    if (i18n.resolvedLanguage !== prefs.language) void i18n.changeLanguage(prefs.language);
  }, [prefs, i18n]);

  if (isPending) return <FullScreenState />;
  if (isError) {
    return (
      <FullScreenState>
        {t('errors.api.network_error')}
        <button className="font-medium text-accent" onClick={() => void refetch()}>
          {t('common.retry')}
        </button>
      </FullScreenState>
    );
  }
  if (!me) {
    const next = location.pathname + location.search;
    return (
      <Navigate to={next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`} replace />
    );
  }
  return (
    <CurrentUserContext value={me}>
      <Outlet />
    </CurrentUserContext>
  );
}

/**
 * Login and registration pages. Once a session exists (including right after logging in),
 * this is the single place that decides where to go next.
 */
export function PublicOnly() {
  const { data: me, isPending } = useMe();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  if (isPending) return <FullScreenState />;
  if (me) {
    // New accounts start by completing their profile.
    const target = pathname === '/register' ? '/profile' : safeNext(params.get('next'));
    return <Navigate to={target} replace />;
  }
  return <Outlet />;
}
