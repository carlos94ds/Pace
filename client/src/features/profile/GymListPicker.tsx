import { MAX_GYMS, type Gym } from '@pace/shared';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GymPicker } from './GymPicker';

interface GymListPickerProps {
  value: Gym[];
  onChange: (gyms: Gym[]) => void;
}

/** The gyms on a profile: remove any of them, or search and add another. */
export function GymListPicker({ value, onChange }: GymListPickerProps) {
  const { t } = useTranslation();
  const ids = value.map((g) => g.id);

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {value.map((gym) => (
            <li key={gym.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="text-sm">
                <div className="font-medium">{gym.name}</div>
                <div className="text-muted">{gym.city}</div>
              </div>
              <button
                type="button"
                onClick={() => onChange(value.filter((g) => g.id !== gym.id))}
                aria-label={t('profile.gym.remove', { name: gym.name })}
                className="rounded-lg p-2 text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {value.length < MAX_GYMS ? (
        <GymPicker
          value={null}
          exclude={ids}
          onChange={(gym) => gym && !ids.includes(gym.id) && onChange([...value, gym])}
        />
      ) : (
        <p className="text-xs text-muted">{t('profile.gym.max', { count: MAX_GYMS })}</p>
      )}
    </div>
  );
}
