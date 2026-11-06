import { CircleAlert, CircleCheck } from 'lucide-react';
import type { ReactNode } from 'react';

export function Alert({
  tone = 'danger',
  children,
}: {
  tone?: 'danger' | 'success';
  children: ReactNode;
}) {
  const Icon = tone === 'danger' ? CircleAlert : CircleCheck;
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${
        tone === 'danger' ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'
      }`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
