import { useEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Native <dialog>: focus trapping, Escape to close and the backdrop come for free. */
export function Dialog({ open, title, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={title}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-6 text-text backdrop:bg-black/50"
    >
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </dialog>
  );
}
