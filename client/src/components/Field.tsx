import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

const CONTROL =
  'w-full rounded-lg border bg-surface px-3 text-sm transition-colors duration-150 placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent disabled:opacity-60';

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  children: (props: {
    id: string;
    className: string;
    'aria-invalid': boolean;
    'aria-describedby'?: string;
  }) => ReactNode;
}

/** Label, control, and a hint or error message wired up for screen readers. */
export function Field({ label, error, hint, children }: FieldProps) {
  const id = useId();
  const describedBy = error || hint ? `${id}-help` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children({
        id,
        className: `${CONTROL} ${error ? 'border-danger' : 'border-border'}`,
        'aria-invalid': Boolean(error),
        'aria-describedby': describedBy,
      })}
      {(error || hint) && (
        <p id={describedBy} className={`text-xs ${error ? 'text-danger' : 'text-muted'}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

type Shared = { label: string; error?: string; hint?: string };

export function TextField({
  label,
  error,
  hint,
  className = '',
  ...props
}: Shared & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(control) => (
        <input {...props} {...control} className={`${control.className} h-10 ${className}`} />
      )}
    </Field>
  );
}

export function TextArea({
  label,
  error,
  hint,
  ...props
}: Shared & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(control) => (
        <textarea rows={3} {...props} {...control} className={`${control.className} py-2`} />
      )}
    </Field>
  );
}

export function SelectField({
  label,
  error,
  hint,
  children,
  ...props
}: Shared & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(control) => (
        <select {...props} {...control} className={`${control.className} h-10`}>
          {children}
        </select>
      )}
    </Field>
  );
}
