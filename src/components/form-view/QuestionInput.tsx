import { useRef, type CSSProperties } from 'react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { LatexRenderer } from '../ui/LatexRenderer';
import { MathToolbar, useMathInsert } from '../ui/MathToolbar';
import { toOptionItem } from '../../types/question';

function normalizeOpt(opt: any) {
  const item = toOptionItem(opt);
  return item;
}

function getOptionRowStyle(active: boolean): CSSProperties {
  return active
    ? {
        backgroundColor: 'color-mix(in srgb, var(--form-primary, #1B3B6F) 12%, var(--form-card-bg, #ffffff))',
        borderColor: 'var(--form-primary, #1B3B6F)',
        color: 'var(--form-text, #1C1917)',
        borderRadius: 'var(--form-radius, 0.5rem)',
      }
    : {
        backgroundColor: 'var(--form-card-bg, #ffffff)',
        borderColor: 'color-mix(in srgb, var(--form-primary, #1B3B6F) 22%, #D6D1C5)',
        color: 'var(--form-text, #1C1917)',
        borderRadius: 'var(--form-radius, 0.5rem)',
      };
}

export function QuestionInput({ question, value, onChange }: { question: any; value: any; onChange: (v: any) => void }) {
  const textRef = useRef<HTMLInputElement>(null);
  const paraRef = useRef<HTMLTextAreaElement>(null);
  const insertText = useMathInsert(textRef, value ?? '', onChange);
  const insertPara = useMathInsert(paraRef, value ?? '', onChange);

  switch (question.type) {
    case 'text':
      if ((question.settings?.table?.editableCells?.length ?? 0) > 0) {
        return null;
      }
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
        <div className="space-y-2.5">
          {(question.options ?? []).map((opt: any, i: number) => {
            const item = normalizeOpt(opt);
            const selected = value === item.label;
            return (
              <label
                key={i}
                style={getOptionRowStyle(selected)}
                className={`flex items-center gap-3 cursor-pointer px-3.5 py-2.5 border transition-all ${
                  selected ? 'shadow-sm' : 'hover:opacity-95'
                }`}
              >
                <input
                  type="radio"
                  name={question.id}
                  value={item.label}
                  checked={selected}
                  onChange={() => onChange(item.label)}
                  className="shrink-0"
                  style={{ accentColor: 'var(--form-primary, #1B3B6F)' }}
                />
                {item.imageUrl && (
                  <img src={item.imageUrl} alt="" className="h-9 w-9 object-cover rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )}
                <span className="text-sm" style={{ color: 'var(--form-text, #1C1917)' }}><LatexRenderer text={item.label} /></span>
              </label>
            );
          })}
        </div>
      );
    case 'checkbox':
      return (
        <div className="space-y-2.5">
          {(question.options ?? []).map((opt: any, i: number) => {
            const item = normalizeOpt(opt);
            const current = Array.isArray(value) ? value : [];
            const checked = current.includes(item.label);
            return (
              <label
                key={`${item.label}-${i}`}
                style={getOptionRowStyle(checked)}
                className={`flex items-center gap-3 cursor-pointer px-3.5 py-2.5 border transition-all ${
                  checked ? 'shadow-sm' : 'hover:opacity-95'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    onChange(e.target.checked ? [...current, item.label] : current.filter((v: string) => v !== item.label));
                  }}
                  className="rounded shrink-0"
                  style={{ accentColor: 'var(--form-primary, #1B3B6F)' }}
                />
                {item.imageUrl && (
                  <img src={item.imageUrl} alt="" className="h-9 w-9 object-cover rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )}
                <span className="text-sm" style={{ color: 'var(--form-text, #1C1917)' }}><LatexRenderer text={item.label} /></span>
              </label>
            );
          })}
        </div>
      );
    case 'dropdown':
      return (
        <Select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          options={[
            { value: '', label: 'Seleccionar' },
            ...(question.options ?? []).map((opt: any) => {
              const item = normalizeOpt(opt);
              return {
                value: item.label,
                label: item.label.replace(/\$|\\[\(\)\[\]]/g, ''),
              };
            }),
          ]}
        />
      );
    case 'linearScale': {
      const min = question.settings?.min ?? 1;
      const max = question.settings?.max ?? 5;
      return (
        <div className="flex items-center gap-4 flex-wrap">
          {question.settings?.minLabel && (
            <span className="text-sm opacity-80" style={{ color: 'var(--form-text, #1C1917)' }}>
              <LatexRenderer text={question.settings.minLabel} />
            </span>
          )}
          <div className="flex gap-2 flex-wrap justify-center">
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n: number) => {
              const active = value === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChange(n)}
                  style={
                    active
                      ? {
                          backgroundColor: 'var(--form-primary, #1B3B6F)',
                          borderColor: 'var(--form-primary, #1B3B6F)',
                          color: '#ffffff',
                        }
                      : {
                          backgroundColor: 'var(--form-card-bg, #ffffff)',
                          borderColor: 'color-mix(in srgb, var(--form-primary, #1B3B6F) 28%, #D6D1C5)',
                          color: 'var(--form-text, #1C1917)',
                        }
                  }
                  className={`h-10 w-10 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-all ${
                    active ? 'scale-110 shadow-sm' : 'hover:opacity-90'
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
          {question.settings?.maxLabel && (
            <span className="text-sm opacity-80" style={{ color: 'var(--form-text, #1C1917)' }}>
              <LatexRenderer text={question.settings.maxLabel} />
            </span>
          )}
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
