import { SCORES } from '@pace/shared';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

interface ScoreFieldProps {
  name: 'motivation' | 'rating' | 'intensity';
  value: number | null;
  error?: string;
  onChange: (value: number) => void;
}

/** A required choice on the 1–5 scale, with what the ends of the scale mean. */
export function ScoreField({ name, value, error, onChange }: ScoreFieldProps) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <fieldset aria-describedby={`${id}-scale`} aria-invalid={Boolean(error)}>
      <legend className="text-sm font-medium">{t(`training.fields.${name}`)}</legend>
      <p id={`${id}-scale`} className="mt-0.5 mb-1.5 text-xs text-muted">
        {t(`training.scales.${name}`)}
      </p>
      <div
        className={`grid grid-cols-5 gap-1 rounded-xl bg-surface-2 p-1 ${error ? 'ring-1 ring-danger' : ''}`}
      >
        {SCORES.map((score) => (
          <label
            key={score}
            className={`tabular cursor-pointer rounded-lg py-1.5 text-center text-sm font-medium transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
              value === score
                ? 'bg-accent-soft text-accent shadow-sm'
                : 'text-muted hover:text-text'
            }`}
          >
            <input
              type="radio"
              name={`${id}-${name}`}
              value={score}
              checked={value === score}
              onChange={() => onChange(score)}
              className="sr-only"
            />
            {score}
          </label>
        ))}
      </div>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </fieldset>
  );
}
