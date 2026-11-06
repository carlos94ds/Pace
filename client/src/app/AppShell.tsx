import {
  CalendarDays,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Settings,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Logo } from '../components/Logo';
import { useCurrentUser, useLogout } from '../features/auth/session';

interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  /** Left out of the phone's bottom bar (reachable from the header or another page there). */
  desktopOnly?: boolean;
}

// Only pages that actually exist are listed; each phase adds its own entries.
const NAV: NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/calendar', labelKey: 'nav.calendar', icon: CalendarDays },
  { to: '/history', labelKey: 'nav.history', icon: History, desktopOnly: true },
  { to: '/reports', labelKey: 'nav.reports', icon: FileText },
  { to: '/friends', labelKey: 'nav.friends', icon: Users },
  { to: '/profile', labelKey: 'nav.profile', icon: UserRound },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings, desktopOnly: true },
];

export function AppShell() {
  const { t } = useTranslation();
  const me = useCurrentUser();
  const navigate = useNavigate();
  const logout = useLogout();

  const signOut = () =>
    logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) });

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-border bg-surface md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:gap-8 md:px-4 md:py-6">
        <Logo className="px-2" />
        <nav className="flex flex-col gap-1" aria-label={t('nav.main')}>
          {NAV.map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-accent-soft text-accent'
                    : 'text-muted hover:bg-surface-2 hover:text-text'
                }`
              }
            >
              <Icon className="size-4" aria-hidden="true" />
              {t(labelKey)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 border-t border-border px-2 pt-4">
          <Link to="/profile" className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar url={me.profile.avatarUrl} name={me.profile.firstName} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{me.profile.firstName}</span>
              <span className="block truncate text-xs text-muted">@{me.profile.username}</span>
            </span>
          </Link>
          <button
            onClick={signOut}
            disabled={logout.isPending}
            className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text"
            aria-label={t('nav.logout')}
            title={t('nav.logout')}
          >
            <LogOut className="size-4" aria-hidden="true" />
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur md:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `rounded-lg p-2 ${isActive ? 'text-accent' : 'text-muted hover:text-text'}`
            }
            aria-label={t('nav.settings')}
          >
            <Settings className="size-5" aria-hidden="true" />
          </NavLink>
          <button
            onClick={signOut}
            disabled={logout.isPending}
            className="rounded-lg p-2 text-muted hover:text-text"
            aria-label={t('nav.logout')}
          >
            <LogOut className="size-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-24 sm:px-6 md:px-10 md:py-10">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label={t('nav.main')}
      >
        {NAV.filter((item) => !item.desktopOnly).map(({ to, labelKey, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex min-w-0 flex-col items-center gap-1 px-0.5 py-2.5 text-[11px] font-medium ${isActive ? 'text-accent' : 'text-muted'}`
            }
          >
            <Icon className="size-5" aria-hidden="true" />
            <span className="max-w-full truncate">{t(labelKey)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
