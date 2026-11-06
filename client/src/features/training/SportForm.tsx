import { SPORT_COLORS, sportInputSchema, type Sport, type SportInput } from '@pace/shared';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';
import { TextField } from '../../components/Field';
import {
  apiFieldErrors,
  fieldMessage,
  formMessage,
  validate,
  type FieldErrors,
} from '../../lib/forms';
import { useSaveSport } from './queries';

interface SportFormProps {
  sport?: Sport;
  onSaved: (sport: Sport) => void;
  onCancel: () => void;
}

/** Create or edit one of the user's own sports. */
export function SportForm({ sport, onSaved, onCancel }: SportFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<SportInput>({
    name: sport?.name ?? '',
    color: (sport?.color as SportInput['color'] | undefined) ?? SPORT_COLORS[5],
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const save = useSaveSport();

  function submit() {
    const { data, errors } = validate(sportInputSchema, values);
    setErrors(errors ?? {});
    if (!data) return;
    save.mutate(
      { id: sport?.id, input: data },
      { onSuccess: onSaved, onError: (err) => setErrors(apiFieldErrors(err)) },
    );
  }

  const otherError = save.error && !Object.keys(apiFieldErrors(save.error)).length;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <TextField
        label={t('training.sports.name')}
        value={values.name}
        maxLength={50}
        autoFocus
        onChange={(e) => setValues({ ...values, name: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
        error={fieldMessage(t, 'sportName', errors.name)}
      />
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">{t('training.sports.color')}</legend>
        <div className="flex flex-wrap gap-2">
          {SPORT_COLORS.map((color) => (
            <label
              key={color}
              className="relative flex size-8 cursor-pointer items-center justify-center rounded-full has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
              style={{ backgroundColor: color }}
            >
              <input
                type="radio"
                name="sport-color"
                value={color}
                checked={values.color === color}
                onChange={() => setValues({ ...values, color })}
                className="sr-only"
                aria-label={color}
              />
              {values.color === color && <Check className="size-4 text-white" aria-hidden="true" />}
            </label>
          ))}
        </div>
      </fieldset>
      {otherError && <p className="text-xs text-danger">{formMessage(t, save.error)}</p>}
      <div className="flex gap-2">
        <Button onClick={submit} disabled={save.isPending}>
          {sport ? t('common.save') : t('training.sports.add')}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}
