export function toDateSafe(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'object') {
    const obj = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof obj.toDate === 'function') {
      const converted = obj.toDate();
      return converted instanceof Date && !Number.isNaN(converted.getTime()) ? converted : null;
    }
    const secs = typeof obj.seconds === 'number' ? obj.seconds : obj._seconds;
    if (typeof secs === 'number' && Number.isFinite(secs)) {
      const d = new Date(secs * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  if (typeof value === 'number' || typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

export function formatExamDateTime(value: unknown): string {
  const date = toDateSafe(value);
  if (!date) return 'Sin fecha';

  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
