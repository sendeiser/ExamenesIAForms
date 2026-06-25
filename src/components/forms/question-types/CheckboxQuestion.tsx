import { useRef, useState } from 'react';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { LatexRenderer } from '../../ui/LatexRenderer';
import { MathToolbar, useMathInsert } from '../../ui/MathToolbar';
import { Plus, X, Square } from 'lucide-react';
import type { Question } from '../../../types/question';

interface Props {
  question: Question;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
}

export function CheckboxQuestion({ question, updateQuestion }: Props) {
  const options = question.options ?? [];
  const [focusedIdx, setFocusedIdx] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function updateOption(index: number, value: string) {
    const updated = [...options];
    updated[index] = value;
    updateQuestion(question.id, { options: updated });
  }

  function addOption() {
    updateQuestion(question.id, { options: [...options, `Opción ${options.length + 1}`] });
  }

  function removeOption(index: number) {
    if (options.length <= 1) return;
    updateQuestion(question.id, { options: options.filter((_, i) => i !== index) });
  }

  const insert = useMathInsert(
    { current: inputRefs.current[focusedIdx] ?? null },
    options[focusedIdx] ?? '',
    (val) => updateOption(focusedIdx, val),
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
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              onFocus={() => setFocusedIdx(i)}
              className="flex-1"
            />
            <Button variant="ghost" onClick={() => removeOption(i)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="ml-6 text-xs text-gray-400 mt-0.5">
            <LatexRenderer text={opt} />
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
