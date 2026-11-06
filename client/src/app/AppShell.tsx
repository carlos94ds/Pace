import { Activity, Settings, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';
import { Logo } from '../components/Logo';

interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
}

// Only pages that actually exist are listed; each phase adds its own entries.
const NAV: NavItem[] = [
  { to: '/', labelKey: 'nav.overview', icon: Activity },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings },
];

export function AppShell() {
  const { t } = useTranslation();

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-border bg-surface md:flex md:flex-col md:gap-8 md:px-4 md:py-6">
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
      </aside>

      <header className="sticky top-0 z-10 flex h-14 items-center border-b border-border bg-surface/90 px-4 backdrop-blur md:hidden">
        <Logo />
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-24 sm:px-6 md:px-10 md:py-10">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-2 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label={t('nav.main')}
      >
        {NAV.map(({ to, labelKey, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-xs font-medium ${isActive ? 'text-accent' : 'text-muted'}`
            }
          >
            <Icon className="size-5" aria-hidden="true" />
            {t(labelKey)}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
