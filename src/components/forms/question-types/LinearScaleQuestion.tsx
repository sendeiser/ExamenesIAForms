import { Input } from '../../ui/Input';
import type { Question } from '../../../types/question';

interface Props {
  question: Question;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
}

export function LinearScaleQuestion({ question, updateQuestion }: Props) {
  const settings = question.settings ?? {};
  const min = settings.min ?? 1;
  const max = settings.max ?? 5;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Min</label>
          <Input
            type="number"
            value={min}
            onChange={(e) => updateQuestion(question.id, { settings: { ...settings, min: Number(e.target.value) } })}
            className="w-20"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Max</label>
          <Input
            type="number"
            value={max}
            onChange={(e) => updateQuestion(question.id, { settings: { ...settings, max: Number(e.target.value) } })}
            className="w-20"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
          <div key={n} className="h-10 w-10 rounded-full border-2 border-gray-300 flex items-center justify-center text-sm text-gray-500">
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}
