import { useId } from 'react';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
}

/** A row of mutually exclusive options; native radios keep it keyboard- and screen-reader-friendly. */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  const name = useId();
  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      <div className="inline-flex flex-wrap gap-1 rounded-xl bg-surface-2 p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className={`cursor-pointer rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
              option.value === value
                ? 'bg-accent-soft text-accent shadow-sm'
                : 'text-muted hover:text-text'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
