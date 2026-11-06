import { createGymSchema, type Gym } from '@pace/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';
import { TextField } from '../../components/Field';
import { api } from '../../lib/api';
import { fieldMessage, formMessage, validate, type FieldErrors } from '../../lib/forms';

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

interface GymPickerProps {
  value: Gym | null;
  onChange: (gym: Gym | null) => void;
}

/** Search the shared gym list, or add a gym that isn't in it yet. */
export function GymPicker({ value, onChange }: GymPickerProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [newGym, setNewGym] = useState({ name: '', city: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const q = useDebounced(query.trim(), 250);

  const results = useQuery({
    queryKey: ['gyms', q],
    queryFn: () => api<Gym[]>(`/gyms?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
  });

  async function addGym() {
    const { data, errors } = validate(createGymSchema, newGym);
    setErrors(errors ?? {});
    if (!data) return;
    try {
      onChange(await api<Gym>('/gyms', { method: 'POST', body: data }));
      setAdding(false);
      setQuery('');
    } catch (err) {
      setFormError(formMessage(t, err));
    }
  }

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
        <div className="text-sm">
          <div className="font-medium">{value.name}</div>
          <div className="text-muted">{value.city}</div>
        </div>
        <Button variant="ghost" onClick={() => onChange(null)}>
          {t('profile.gym.change')}
        </Button>
      </div>
    );
  }

  if (adding) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
        <TextField
          label={t('profile.gym.name')}
          value={newGym.name}
          onChange={(e) => setNewGym({ ...newGym, name: e.target.value })}
          error={fieldMessage(t, 'gymName', errors.name)}
        />
        <TextField
          label={t('profile.gym.city')}
          value={newGym.city}
          onChange={(e) => setNewGym({ ...newGym, city: e.target.value })}
          error={fieldMessage(t, 'city', errors.city)}
        />
        {formError && <p className="text-xs text-danger">{formError}</p>}
        <div className="flex gap-2">
          <Button onClick={() => void addGym()}>{t('profile.gym.add')}</Button>
          <Button variant="ghost" onClick={() => setAdding(false)}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <TextField
        label={t('profile.gym.search')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('profile.gym.searchPlaceholder')}
      />
      {q.length >= 2 && results.data && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {results.data.map((gym) => (
            <li key={gym.id}>
              <button
                type="button"
                onClick={() => onChange(gym)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-surface-2"
              >
                <span className="font-medium">{gym.name}</span>
                <span className="text-muted"> · {gym.city}</span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => {
                setNewGym({ name: query.trim(), city: '' });
                setAdding(true);
              }}
              className="w-full px-3 py-2 text-left text-sm font-medium text-accent hover:bg-surface-2"
            >
              {t('profile.gym.addNew', { name: query.trim() })}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
