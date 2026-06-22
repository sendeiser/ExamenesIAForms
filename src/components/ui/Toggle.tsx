import { clsx } from 'clsx';

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
          checked ? 'bg-indigo-600' : 'bg-gray-200',
        )}
      >
        <span className={clsx('pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition-transform', checked ? 'translate-x-5' : 'translate-x-0')} />
      </button>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}
