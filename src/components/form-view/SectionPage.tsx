import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { QuestionInput } from './QuestionInput';
import { LatexRenderer } from '../ui/LatexRenderer';
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
  cardStyle?: string;
}

export function SectionPage({ section, questions, answers, onAnswer, isFirst, isLast, onNext, onPrev, onSubmit, saving, cardStyle }: SectionPageProps) {
  return (
    <div className="space-y-4">
      <Card className="p-6" data-style={cardStyle}>
        <h2 className="text-xl font-semibold">{section.title}</h2>
        {section.description && <p className="mt-1 opacity-70">{section.description}</p>}
      </Card>

      {questions.map((q) => (
        <Card key={q.id} className="p-6" data-style={cardStyle}>
          {q.settings?.imageUrl && (
            <img src={q.settings.imageUrl} alt="" className="w-full max-h-48 object-cover mb-3"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <label className="block mb-3">
            <span className="text-sm font-medium"><LatexRenderer text={q.title} /></span>
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
