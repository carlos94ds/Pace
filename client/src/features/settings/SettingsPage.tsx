import type { HealthResponse, Language, TextSize, Theme } from '@pace/shared';
import { LANGUAGES } from '@pace/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../app/PageHeader';
import { Card } from '../../components/Card';
import { SelectField } from '../../components/Field';
import { SegmentedControl } from '../../components/SegmentedControl';
import { LANGUAGE_NAMES } from '../../i18n';
import { fetchHealth } from '../../lib/api';
import { setTextSize, setTheme } from '../../lib/preferences';
import { useCurrentUser } from '../auth/session';
import { CustomSportsSection } from '../training/CustomSportsSection';
import { DeleteAccountDialog } from './DeleteAccountDialog';
import {
  AccountSection,
  DeleteAccountSection,
  NotificationsSection,
  PrivacySection,
  usePreferences,
} from './sections';

const SECTIONS = [
  'account',
  'sports',
  'privacy',
  'notifications',
  'appearance',
  'language',
  'about',
  'delete',
] as const;

export function SettingsPage() {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <PageHeader title={t('settings.title')} />
      <nav
        aria-label={t('settings.title')}
        className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {SECTIONS.map((id) => (
          <a
            key={id}
            href={`#${id}`}
            className="shrink-0 rounded-full border border-border px-3 py-1 text-sm text-muted hover:bg-surface-2 hover:text-text"
          >
            {t(`settings.nav.${id}`)}
          </a>
        ))}
      </nav>

      <div className="grid max-w-3xl gap-6 [&>*]:scroll-mt-20">
        <div id="account">
          <AccountSection />
        </div>
        <div id="sports">
          <CustomSportsSection />
        </div>
        <div id="privacy">
          <PrivacySection />
        </div>
        <div id="notifications">
          <NotificationsSection />
        </div>
        <div id="appearance">
          <AppearanceSection />
        </div>
        <div id="language">
          <LanguageSection />
        </div>
        <div id="about">
          <AboutSection />
        </div>
        <div id="delete">
          <DeleteAccountSection onDelete={() => setDeleting(true)} />
        </div>
      </div>
      <DeleteAccountDialog open={deleting} onClose={() => setDeleting(false)} />
    </>
  );
}

function AppearanceSection() {
  const { t } = useTranslation();
  const me = useCurrentUser();
  const save = usePreferences();

  return (
    <Card title={t('settings.appearance')} description={t('settings.appearanceHelp')}>
      <div className="grid gap-6">
        <SegmentedControl
          label={t('settings.appearance')}
          value={me.preferences.theme}
          options={[
            { value: 'light', label: t('settings.themes.light') },
            { value: 'dark', label: t('settings.themes.dark') },
            { value: 'system', label: t('settings.themes.system') },
          ]}
          onChange={(theme: Theme) => {
            setTheme(theme);
            save.mutate({ theme });
          }}
        />
        <div>
          <h3 className="mb-1 text-sm font-medium">{t('settings.textSize')}</h3>
          <p className="mb-3 text-sm text-muted">{t('settings.textSizeHelp')}</p>
          <SegmentedControl
            label={t('settings.textSize')}
            value={me.preferences.textSize}
            options={[
              { value: 'small', label: t('settings.textSizes.small') },
              { value: 'medium', label: t('settings.textSizes.medium') },
              { value: 'large', label: t('settings.textSizes.large') },
            ]}
            onChange={(textSize: TextSize) => {
              setTextSize(textSize);
              save.mutate({ textSize });
            }}
          />
        </div>
      </div>
    </Card>
  );
}

function LanguageSection() {
  const { t, i18n } = useTranslation();
  const me = useCurrentUser();
  const save = usePreferences();
  return (
    <Card title={t('settings.language')} description={t('settings.languageHelp')}>
      <div className="max-w-xs">
        <SelectField
          label={t('settings.language')}
          value={me.preferences.language}
          onChange={(e) => {
            const language = e.target.value as Language;
            void i18n.changeLanguage(language);
            save.mutate({ language });
          }}
        >
          {LANGUAGES.map((lng) => (
            <option key={lng} value={lng}>
              {LANGUAGE_NAMES[lng]}
            </option>
          ))}
        </SelectField>
      </div>
    </Card>
  );
}

function AboutSection() {
  const { t } = useTranslation();
  const health = useQuery({ queryKey: ['health'], queryFn: () => fetchHealth<HealthResponse>() });
  return (
    <Card title={t('settings.about.title')}>
      <div className="grid gap-3 text-sm text-muted">
        <p>{t('settings.about.text')}</p>
        <p>{t('settings.about.privacy')}</p>
        {health.data && (
          <p className="tabular text-xs">
            {t('settings.about.version')} {health.data.version}
          </p>
        )}
      </div>
    </Card>
  );
}
