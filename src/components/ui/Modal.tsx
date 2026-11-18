import { type ReactNode, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  zIndexClass?: string;
}

export function Modal({ open, onClose, title, children, size = 'md', zIndexClass = 'z-50' }: ModalProps) {
  const titleId = `modal-title-${Math.random().toString(36).slice(2, 9)}`;
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = original;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const overlay = overlayRef.current;
    if (!overlay) return;
    const firstFocusable = overlay.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    firstFocusable?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={clsx('fixed inset-0 flex items-center justify-center', zIndexClass)}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="fixed inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={overlayRef}
        className={clsx(
          'relative z-10 w-full bg-white rounded-xl border border-sand-300 shadow-xl max-h-[90vh] overflow-y-auto mx-4',
          { 'max-w-sm': size === 'sm', 'max-w-lg': size === 'md', 'max-w-2xl': size === 'lg' },
        )}
      >
        <div className="flex items-center justify-between border-b border-sand-300 bg-sand-50/70 px-6 py-4">
          <h2 id={titleId} className="font-display text-lg font-bold text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-ink-subtle hover:bg-sand-200/70 hover:text-ink transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
