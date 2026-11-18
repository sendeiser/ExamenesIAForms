import { clsx } from 'clsx';
import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, style, ...props }, ref) => {
    const hasCustomBg = Boolean(className && /\bbg-/.test(className));
    const hasCustomText = Boolean(
      style?.color ||
        (className && /\btext-(?!xs\b|sm\b|base\b|lg\b|xl\b|2xl\b|3xl\b|left\b|center\b|right\b)/.test(className))
    );

    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-ink-muted">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          style={style}
          className={clsx(
            'block w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-ink-light/70 focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-600',
            !hasCustomBg && 'bg-white',
            error ? 'border-red-300 text-red-900' : clsx('border-sand-400', !hasCustomText && 'text-ink'),
            className,
          )}
          {...props}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  },
);
