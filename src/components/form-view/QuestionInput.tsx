import { useRef } from 'react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { LatexRenderer } from '../ui/LatexRenderer';
import { MathToolbar, useMathInsert } from '../ui/MathToolbar';

export function QuestionInput({ question, value, onChange }: { question: any; value: any; onChange: (v: any) => void }) {
  const textRef = useRef<HTMLInputElement>(null);
  const paraRef = useRef<HTMLTextAreaElement>(null);
  const insertText = useMathInsert(textRef, value ?? '', onChange);
  const insertPara = useMathInsert(paraRef, value ?? '', onChange);

  switch (question.type) {
    case 'text':
      return (
        <div className="space-y-1">
          <MathToolbar onInsert={insertText} />
          <Input ref={textRef} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="Tu respuesta" />
        </div>
      );
    case 'paragraph':
      return (
        <div className="space-y-1">
          <MathToolbar onInsert={insertPara} />
          <textarea
            ref={paraRef}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            rows={3}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Tu respuesta"
          />
        </div>
      );
    case 'multipleChoice':
      return (
        <div className="space-y-2">
          {question.options.map((opt: string, i: number) => (
            <label key={i} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-brand-50 transition-colors">
              <input
                type="radio"
                name={question.id}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm"><LatexRenderer text={opt} /></span>
            </label>
          ))}
        </div>
      );
    case 'checkbox':
      return (
        <div className="space-y-2">
          {question.options.map((opt: string, i: number) => (
            <label key={i} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-brand-50 transition-colors">
              <input
                type="checkbox"
                value={opt}
                checked={(value ?? []).includes(opt)}
                onChange={(e) => {
                  const current = value ?? [];
                  onChange(e.target.checked ? [...current, opt] : current.filter((v: string) => v !== opt));
                }}
                className="rounded text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm"><LatexRenderer text={opt} /></span>
            </label>
          ))}
        </div>
      );
    case 'dropdown':
      return (
        <Select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          options={[
            { value: '', label: 'Seleccionar' },
            ...question.options.map((opt: string) => ({
              value: opt,
              label: opt.replace(/\$|\\[\(\)\[\]]/g, ''),
            })),
          ]}
        />
      );
    case 'linearScale': {
      const min = question.settings?.min ?? 1;
      const max = question.settings?.max ?? 5;
      return (
        <div className="flex items-center gap-4 flex-wrap">
          {question.settings?.minLabel && <span className="text-sm text-ink-subtle"><LatexRenderer text={question.settings.minLabel} /></span>}
          <div className="flex gap-2 flex-wrap justify-center">
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n: number) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className={`h-10 w-10 rounded-full border-2 flex items-center justify-center text-sm transition-all ${
                  value === n
                    ? 'bg-brand-600 text-white border-brand-600 scale-110'
                    : 'border-gray-300 text-ink-light hover:border-brand-400 hover:text-brand-600'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {question.settings?.maxLabel && <span className="text-sm text-ink-subtle"><LatexRenderer text={question.settings.maxLabel} /></span>}
        </div>
      );
    }
    case 'date':
      return <Input type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'time':
      return <Input type="time" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
    default:
      return null;
  }
}
