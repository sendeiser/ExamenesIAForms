import { useState, useMemo } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { QuestionInput } from './QuestionInput';
import { SectionPage } from './SectionPage';
import type { Form } from '../../types/form';
import type { Question, Section } from '../../types/question';

interface FormViewProps {
  form: Form;
  questions: Question[];
  sections: Section[];
  onSubmit: (answers: Record<string, any>) => Promise<void>;
}

export function FormView({ form, questions, sections, onSubmit }: FormViewProps) {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

  const unassigned = useMemo(() => questions.filter((q) => !q.sectionId), [questions]);
  const sectionQuestions = useMemo(() => {
    const map: Record<string, Question[]> = {};
    sections.forEach((s) => { map[s.id] = questions.filter((q) => q.sectionId === s.id); });
    return map;
  }, [questions, sections]);

  const hasSections = sections.length > 0;
  const totalPages = hasSections ? sections.length : 1;
  const currentSection = hasSections ? sections[currentSectionIndex] : null;
  const currentQuestions = hasSections ? (sectionQuestions[currentSection?.id ?? ''] ?? []) : unassigned;

  function setAnswer(questionId: string, value: any) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleSubmit() {
    setSaving(true);
    await onSubmit(answers);
    setSaving(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <Card className="p-8 text-center max-w-lg mx-auto">
        <div className="text-4xl mb-4">&#127881;</div>
        <h2 className="text-xl font-semibold mb-2">{form.settings.confirmationMessage}</h2>
        <p className="text-gray-500">Tu respuesta ha sido registrada.</p>
      </Card>
    );
  }

  // No sections: single page mode
  if (!hasSections) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Card className="p-8">
          <h1 className="text-2xl font-bold text-gray-900">{form.title}</h1>
          {form.description && <p className="text-gray-500 mt-2">{form.description}</p>}
        </Card>
        {questions.map((q) => (
          <Card key={q.id} className="p-6">
            <label className="block mb-3">
              <span className="text-sm font-medium text-gray-900">{q.title}</span>
              {q.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <QuestionInput question={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
          </Card>
        ))}
        <div className="flex justify-end">
          <Button onClick={handleSubmit} loading={saving} disabled={saving}>Enviar</Button>
        </div>
      </div>
    );
  }

  // Sections: multi-page mode
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {form.theme.showProgressBar && (
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${((currentSectionIndex + 1) / totalPages) * 100}%`,
              backgroundColor: 'var(--form-primary, #6366f1)',
            }}
          />
        </div>
      )}
      <Card className="p-8" style={{ backgroundColor: 'var(--form-bg, #ffffff)' }}>
        <h1 className="text-2xl font-bold text-gray-900">{form.title}</h1>
        {form.description && <p className="text-gray-500 mt-2">{form.description}</p>}
      </Card>

      {currentSection && (
        <SectionPage
          section={currentSection}
          questions={currentQuestions}
          answers={answers}
          onAnswer={setAnswer}
          isFirst={currentSectionIndex === 0}
          isLast={currentSectionIndex === totalPages - 1}
          onNext={() => setCurrentSectionIndex((i) => Math.min(i + 1, totalPages - 1))}
          onPrev={() => setCurrentSectionIndex((i) => Math.max(i - 1, 0))}
          onSubmit={handleSubmit}
          saving={saving}
        />
      )}
    </div>
  );
}
