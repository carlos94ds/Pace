import { LANGUAGES, type Language } from '@pace/shared';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { Logo } from '../../components/Logo';
import { LANGUAGE_NAMES } from '../../i18n';

export function AuthLayout() {
  const { t, i18n } = useTranslation();
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10 sm:justify-center">
      <Logo className="mb-8" />
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <Outlet />
      </div>
      <label className="mt-6 flex items-center gap-2 text-sm text-muted">
        <span className="sr-only">{t('settings.language')}</span>
        <select
          value={i18n.resolvedLanguage}
          onChange={(e) => void i18n.changeLanguage(e.target.value as Language)}
          className="rounded-md bg-transparent py-1 focus-visible:outline-2 focus-visible:outline-accent"
        >
          {LANGUAGES.map((lng) => (
            <option key={lng} value={lng}>
              {LANGUAGE_NAMES[lng]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
    </div>
  );
}
