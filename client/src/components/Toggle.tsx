import { useId } from 'react';

interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

export function Toggle({ label, description, checked, disabled, onChange }: ToggleProps) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 ${
          checked ? 'bg-accent' : 'bg-border'
        }`}
      >
        <span
          className={`inline-block size-5 rounded-full bg-white shadow transition-transform duration-150 ${
            checked ? 'translate-x-[1.125rem]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
