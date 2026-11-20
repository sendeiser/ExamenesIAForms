import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  zIndexClass?: string;
}

const openModalStack: symbol[] = [];
let savedBodyOverflow: string | null = null;

function lockBodyScroll(id: symbol) {
  if (openModalStack.includes(id)) return;
  if (openModalStack.length === 0) {
    const current = document.body.style.overflow;
    savedBodyOverflow = current === 'hidden' ? '' : current;
    document.body.style.overflow = 'hidden';
  }
  openModalStack.push(id);
}

function unlockBodyScroll(id: symbol) {
  const idx = openModalStack.indexOf(id);
  if (idx !== -1) {
    openModalStack.splice(idx, 1);
  }
  if (openModalStack.length === 0) {
    if (savedBodyOverflow) {
      document.body.style.overflow = savedBodyOverflow;
    } else {
      document.body.style.removeProperty('overflow');
    }
    savedBodyOverflow = null;
  }
}

export function Modal({ open, onClose, title, children, size = 'md', zIndexClass = 'z-50' }: ModalProps) {
  const titleId = useId();
  const [modalId] = useState(() => Symbol('modal'));
  const overlayRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    lockBodyScroll(modalId);

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && openModalStack[openModalStack.length - 1] === modalId) {
        onCloseRef.current();
      }
    }
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      unlockBodyScroll(modalId);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, modalId]);

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
          {
            'max-w-sm': size === 'sm',
            'max-w-lg': size === 'md',
            'max-w-2xl': size === 'lg',
            'max-w-4xl': size === 'xl',
          },
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
