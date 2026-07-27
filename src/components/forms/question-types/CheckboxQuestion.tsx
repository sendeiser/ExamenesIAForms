import { useRef, useState } from 'react';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { LatexRenderer } from '../../ui/LatexRenderer';
import { MathToolbar, useMathInsert } from '../../ui/MathToolbar';
import { Plus, X, Square, ImagePlus, X as XIcon } from 'lucide-react';
import type { Question, OptionItem } from '../../../types/question';
import { toOptionItem, cleanQuizSettingsOnOptionRemove } from '../../../types/question';

interface Props {
  question: Question;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
}

export function CheckboxQuestion({ question, updateQuestion }: Props) {
  const options = (question.options ?? []).map(toOptionItem);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function setOptions(next: OptionItem[]) {
    updateQuestion(question.id, { options: next });
  }

  function updateLabel(index: number, value: string) {
    const updated = [...options];
    updated[index] = { ...updated[index], label: value };
    setOptions(updated);
  }

  function setImage(index: number, imageUrl: string) {
    const updated = [...options];
    updated[index] = { ...updated[index], imageUrl };
    setOptions(updated);
  }

  function removeImage(index: number) {
    const updated = [...options];
    const { imageUrl: _, ...rest } = updated[index];
    updated[index] = rest;
    setOptions(updated);
  }

  function addOption() {
    setOptions([...options, { label: `Opción ${options.length + 1}` }]);
  }

  function removeOption(index: number) {
    if (options.length <= 1) return;
    const removedLabel = options[index].label;
    const nextOptions = options.filter((_, i) => i !== index);
    const qs = cleanQuizSettingsOnOptionRemove(question.quizSettings, removedLabel);
    updateQuestion(question.id, { options: nextOptions, ...(qs ? { quizSettings: qs } : {}) });
  }

  const insert = useMathInsert(
    { current: inputRefs.current[focusedIdx] ?? null },
    options[focusedIdx]?.label ?? '',
    (val) => updateLabel(focusedIdx, val),
  );

  return (
    <div className="space-y-2">
      <MathToolbar onInsert={insert} />
      {options.map((opt, i) => (
        <div key={i}>
          <div className="flex items-center gap-2">
            <Square className="h-4 w-4 text-gray-400 shrink-0" />
            <Input
              ref={(el) => { inputRefs.current[i] = el; }}
              value={opt.label}
              onChange={(e) => updateLabel(i, e.target.value)}
              onFocus={() => setFocusedIdx(i)}
              className="flex-1"
            />
            <Button variant="ghost" onClick={() => {
              const url = prompt('URL de la imagen:');
              if (url?.trim()) setImage(i, url.trim());
            }} className="p-1">
              <ImagePlus className="h-4 w-4 text-gray-400" />
            </Button>
            <Button variant="ghost" onClick={() => removeOption(i)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {opt.imageUrl && (
            <div className="relative group ml-6 mt-1 inline-block">
              <img src={opt.imageUrl} alt="" className="max-h-24 rounded border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <button onClick={() => removeImage(i)} className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow opacity-0 group-hover:opacity-100 transition-opacity">
                <XIcon className="h-3 w-3 text-red-500" />
              </button>
            </div>
          )}
          <div className="ml-6 text-xs text-gray-400 mt-0.5">
            <LatexRenderer text={opt.label} />
          </div>
        </div>
      ))}
      <Button variant="ghost" onClick={addOption}>
        <Plus className="h-4 w-4" />
        Agregar opción
      </Button>
    </div>
  );
}