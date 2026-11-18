import { clsx } from 'clsx';
import { type SelectHTMLAttributes, forwardRef } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, options, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && <label htmlFor={id} className="block text-sm font-medium text-ink-muted">{label}</label>}
        <select
          ref={ref}
          id={id}
          className={clsx(
            'block w-full rounded-lg border bg-white px-3 py-2 text-sm text-ink shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-600',
            error ? 'border-red-300' : 'border-sand-400',
            className,
          )}
          aria-invalid={error ? true : undefined}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  },
);
