type Tone = 'success' | 'warning' | 'danger' | 'muted';

const TONES: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  muted: 'bg-muted',
};

export function StatusDot({ tone }: { tone: Tone }) {
  return (
    <span
      className={`inline-block size-2 shrink-0 rounded-full ${TONES[tone]}`}
      aria-hidden="true"
    />
  );
}
