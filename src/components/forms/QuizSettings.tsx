import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import type { Question } from '../../types/question';

interface QuizSettingsProps {
  question: Question;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
}

export function QuizSettings({ question, updateQuestion }: QuizSettingsProps) {
  const quizSettings = question.quizSettings ?? { correctAnswer: null, points: 1 };

  function update(field: string, value: any) {
    updateQuestion(question.id, {
      quizSettings: { ...quizSettings, [field]: value },
    });
  }

  return (
    <div className="space-y-3 pt-3 border-t">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Respuesta correcta</label>

          {(question.type === 'multipleChoice' || question.type === 'dropdown') && (
            <Select
              value={quizSettings.correctAnswer as string ?? ''}
              onChange={(e) => update('correctAnswer', e.target.value || null)}
              options={[
                { value: '', label: 'Sin respuesta' },
                ...question.options.map((o) => ({ value: o, label: o })),
              ]}
            />
          )}

          {question.type === 'checkbox' && (
            <div className="space-y-1">
              {question.options.map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={(quizSettings.correctAnswer as string[] ?? []).includes(opt)}
                    onChange={(e) => {
                      const current = (quizSettings.correctAnswer as string[]) ?? [];
                      const next = e.target.checked ? [...current, opt] : current.filter((v) => v !== opt);
                      update('correctAnswer', next.length > 0 ? next : null);
                    }}
                    className="rounded text-indigo-600"
                  />
                  {opt}
                </label>
              ))}
            </div>
          )}

          {(question.type === 'text' || question.type === 'paragraph') && (
            <Input
              value={quizSettings.correctAnswer as string ?? ''}
              onChange={(e) => update('correctAnswer', e.target.value || null)}
              placeholder="Respuesta exacta"
            />
          )}

          {question.type === 'linearScale' && (
            <Select
              value={String(quizSettings.correctAnswer ?? '')}
              onChange={(e) => update('correctAnswer', e.target.value ? Number(e.target.value) : null)}
              options={[
                { value: '', label: 'Sin respuesta' },
                ...Array.from({ length: (question.settings?.max ?? 5) - (question.settings?.min ?? 1) + 1 }, (_, i) => {
                  const n = (question.settings?.min ?? 1) + i;
                  return { value: String(n), label: String(n) };
                }),
              ]}
            />
          )}

          {question.type === 'date' && (
            <Input
              type="date"
              value={quizSettings.correctAnswer as string ?? ''}
              onChange={(e) => update('correctAnswer', e.target.value || null)}
            />
          )}

          {question.type === 'time' && (
            <Input
              type="time"
              value={quizSettings.correctAnswer as string ?? ''}
              onChange={(e) => update('correctAnswer', e.target.value || null)}
            />
          )}
        </div>

        <div className="w-20">
          <label className="block text-xs text-gray-500 mb-1">Puntos</label>
          <Input
            type="number"
            min={0}
            value={quizSettings.points}
            onChange={(e) => update('points', Math.max(0, Number(e.target.value)))}
          />
        </div>
      </div>
    </div>
  );
}
