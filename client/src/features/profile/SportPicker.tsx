import type { Sport } from '@pace/shared';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { sportName } from './sports';

interface SportPickerProps {
  value: string[];
  onChange: (ids: string[]) => void;
}

export function SportPicker({ value, onChange }: SportPickerProps) {
  const { t } = useTranslation();
  const sports = useQuery({ queryKey: ['sports'], queryFn: () => api<Sport[]>('/sports') });
  const selected = new Set(value);

  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{t('profile.sports')}</legend>
      <div className="flex flex-wrap gap-2">
        {sports.data
          ?.map((sport) => ({ ...sport, label: sportName(t, sport) }))
          .sort((a, b) => a.label.localeCompare(b.label))
          .map((sport) => {
            const on = selected.has(sport.id);
            return (
              <button
                key={sport.id}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  onChange(on ? value.filter((id) => id !== sport.id) : [...value, sport.id])
                }
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors duration-150 ${
                  on
                    ? 'border-accent bg-accent-soft text-text'
                    : 'border-border text-muted hover:text-text'
                }`}
              >
                {on ? (
                  <Check className="size-3.5 text-accent" aria-hidden="true" />
                ) : (
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: sport.color }}
                    aria-hidden="true"
                  />
                )}
                {sport.label}
              </button>
            );
          })}
      </div>
    </fieldset>
  );
}
