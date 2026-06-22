import { Input } from '../ui/Input';
import { FileUploadInput } from './FileUploadInput';

export function QuestionInput({ question, value, onChange }: { question: any; value: any; onChange: (v: any) => void }) {
  switch (question.type) {
    case 'text':
      return <Input value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="Tu respuesta" />;
    case 'paragraph':
      return (
        <textarea
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          rows={3}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Tu respuesta"
        />
      );
    case 'multipleChoice':
      return (
        <div className="space-y-2">
          {question.options.map((opt: string, i: number) => (
            <label key={i} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={question.id}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="text-indigo-600"
              />
              <span className="text-sm">{opt}</span>
            </label>
          ))}
        </div>
      );
    case 'checkbox':
      return (
        <div className="space-y-2">
          {question.options.map((opt: string, i: number) => (
            <label key={i} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                value={opt}
                checked={(value ?? []).includes(opt)}
                onChange={(e) => {
                  const current = value ?? [];
                  onChange(e.target.checked ? [...current, opt] : current.filter((v: string) => v !== opt));
                }}
                className="rounded text-indigo-600"
              />
              <span className="text-sm">{opt}</span>
            </label>
          ))}
        </div>
      );
    case 'dropdown':
      return (
        <select
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Seleccionar</option>
          {question.options.map((opt: string, i: number) => (
            <option key={i} value={opt}>{opt}</option>
          ))}
        </select>
      );
    case 'linearScale': {
      const min = question.settings?.min ?? 1;
      const max = question.settings?.max ?? 5;
      return (
        <div className="flex items-center gap-4">
          {question.settings?.minLabel && <span className="text-sm text-gray-500">{question.settings.minLabel}</span>}
          <div className="flex gap-2">
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n: number) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className={`h-10 w-10 rounded-full border-2 flex items-center justify-center text-sm transition-colors ${
                  value === n
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-gray-300 text-gray-500 hover:border-indigo-400'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {question.settings?.maxLabel && <span className="text-sm text-gray-500">{question.settings.maxLabel}</span>}
        </div>
      );
    }
    case 'date':
      return (
        <input
          type="date"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      );
    case 'time':
      return (
        <input
          type="time"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      );
    case 'fileUpload':
      return (
        <FileUploadInput
          questionId={question.id}
          value={value as string | null}
          onChange={(url) => onChange(url)}
        />
      );
    default:
      return null;
  }
}
