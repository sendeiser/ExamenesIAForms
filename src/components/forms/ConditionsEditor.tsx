import { useEditorStore } from '../../store/editorStore';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Toggle } from '../ui/Toggle';
import type { Question } from '../../types/question';

interface ConditionsEditorProps {
  question: Question;
}

export function ConditionsEditor({ question }: ConditionsEditorProps) {
  const questions = useEditorStore((s) => s.questions);
  const updateQuestion = useEditorStore((s) => s.updateQuestion);
  const condition = question.conditions;
  const enabled = condition?.enabled ?? false;

  const priorQuestions = questions.filter((q) => q.order < question.order && q.id !== question.id);

  function toggle(enabled: boolean) {
    if (enabled) {
      const first = priorQuestions[0];
      updateQuestion(question.id, {
        conditions: {
          enabled: true,
          questionId: first?.id ?? null,
          operator: 'equals',
          value: '',
        },
      });
    } else {
      updateQuestion(question.id, { conditions: null });
    }
  }

  function update(field: string, value: any) {
    if (!condition) return;
    updateQuestion(question.id, {
      conditions: { ...condition, [field]: value },
    });
  }

  const targetQuestion = priorQuestions.find((q) => q.id === condition?.questionId);
  const targetOptions = targetQuestion?.options ?? [];

  return (
    <div className="space-y-3 pt-3 border-t">
      <Toggle
        label="Condición"
        checked={enabled}
        onChange={toggle}
      />

      {enabled && condition && (
        <div className="space-y-2 pl-6 border-l-2 border-indigo-200">
          <p className="text-xs text-gray-500">Mostrar esta pregunta si:</p>

          <Select
            value={condition.questionId ?? ''}
            onChange={(e) => update('questionId', e.target.value)}
            options={priorQuestions.map((q) => ({ value: q.id, label: q.title }))}
          />

          <Select
            value={condition.operator}
            onChange={(e) => update('operator', e.target.value)}
            options={[
              { value: 'equals', label: 'es igual a' },
              { value: 'notEquals', label: 'no es igual a' },
              { value: 'contains', label: 'contiene' },
            ]}
          />

          {targetOptions.length > 0 ? (
            <Select
              value={condition.value}
              onChange={(e) => update('value', e.target.value)}
              options={targetOptions.map((o) => ({ value: o, label: o }))}
            />
          ) : (
            <Input
              value={condition.value}
              onChange={(e) => update('value', e.target.value)}
              placeholder="Valor"
            />
          )}

          <Button variant="ghost" onClick={() => toggle(false)} className="text-red-500 text-xs">
            Quitar condición
          </Button>
        </div>
      )}
    </div>
  );
}
