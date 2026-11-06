import { LANGUAGES, type Language, type TextSize, type Theme } from '@pace/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../app/PageHeader';
import { Card } from '../../components/Card';
import { SegmentedControl } from '../../components/SegmentedControl';
import { LANGUAGE_NAMES } from '../../i18n';
import { getTextSize, getTheme, setTextSize, setTheme } from '../../lib/preferences';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const [theme, setThemeState] = useState<Theme>(getTheme);
  const [textSize, setTextSizeState] = useState<TextSize>(getTextSize);

  const themeOptions = [
    { value: 'light', label: t('settings.themes.light') },
    { value: 'dark', label: t('settings.themes.dark') },
    { value: 'system', label: t('settings.themes.system') },
  ] as const;

  const textSizeOptions = [
    { value: 'small', label: t('settings.textSizes.small') },
    { value: 'medium', label: t('settings.textSizes.medium') },
    { value: 'large', label: t('settings.textSizes.large') },
  ] as const;

  return (
    <>
      <PageHeader title={t('settings.title')} subtitle={t('settings.deviceNote')} />

      <div className="grid max-w-3xl gap-6">
        <Card title={t('settings.appearance')} description={t('settings.appearanceHelp')}>
          <SegmentedControl
            label={t('settings.appearance')}
            value={theme}
            options={themeOptions}
            onChange={(value) => {
              setTheme(value);
              setThemeState(value);
            }}
          />
        </Card>

        <Card title={t('settings.textSize')} description={t('settings.textSizeHelp')}>
          <SegmentedControl
            label={t('settings.textSize')}
            value={textSize}
            options={textSizeOptions}
            onChange={(value) => {
              setTextSize(value);
              setTextSizeState(value);
            }}
          />
        </Card>

        <Card title={t('settings.language')} description={t('settings.languageHelp')}>
          <label className="sr-only" htmlFor="language">
            {t('settings.language')}
          </label>
          <select
            id="language"
            value={i18n.resolvedLanguage}
            onChange={(e) => void i18n.changeLanguage(e.target.value as Language)}
            className="h-10 w-full max-w-xs rounded-lg border border-border bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-accent"
          >
            {LANGUAGES.map((lng) => (
              <option key={lng} value={lng}>
                {LANGUAGE_NAMES[lng]}
              </option>
            ))}
          </select>
        </Card>
      </div>
    </>
  );
}
