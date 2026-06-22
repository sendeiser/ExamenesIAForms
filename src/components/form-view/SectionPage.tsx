import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { QuestionInput } from './QuestionInput';
import type { Section } from '../../types/question';
import type { Question } from '../../types/question';

interface SectionPageProps {
  section: Section;
  questions: Question[];
  answers: Record<string, any>;
  onAnswer: (questionId: string, value: any) => void;
  isFirst: boolean;
  isLast: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSubmit: () => void;
  saving: boolean;
}

export function SectionPage({ section, questions, answers, onAnswer, isFirst, isLast, onNext, onPrev, onSubmit, saving }: SectionPageProps) {
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900">{section.title}</h2>
        {section.description && <p className="text-gray-500 mt-1">{section.description}</p>}
      </Card>

      {questions.map((q) => (
        <Card key={q.id} className="p-6">
          <label className="block mb-3">
            <span className="text-sm font-medium text-gray-900">{q.title}</span>
            {q.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <QuestionInput question={q} value={answers[q.id]} onChange={(v) => onAnswer(q.id, v)} />
        </Card>
      ))}

      <div className="flex justify-between">
        <Button variant="secondary" onClick={onPrev} disabled={isFirst}>
          Anterior
        </Button>
        {isLast ? (
          <Button onClick={onSubmit} loading={saving} disabled={saving}>Enviar</Button>
        ) : (
          <Button onClick={onNext}>Siguiente</Button>
        )}
      </div>
    </div>
  );
}
