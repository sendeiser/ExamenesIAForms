import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { QuestionInput } from './QuestionInput';
import { SectionPage } from './SectionPage';
import { FormHeader } from './FormHeader';
import { QuizResult } from './QuizResult';
import { SecurityBanner } from './SecurityBanner';
import { LatexRenderer } from '../ui/LatexRenderer';
import { useExamSecurity } from '../../hooks/useExamSecurity';
import { scoreQuiz } from '../../lib/quizScoring';
import type { Form } from '../../types/form';
import type { Question, Section } from '../../types/question';
import type { RespondentInfo } from '../../types/response';
import type { QuizScore } from '../../lib/quizScoring';

const RADIUS_MAP: Record<string, string> = {
  none: '0',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
};

function useGlobalTheme(form: Form) {
  useEffect(() => {
    const theme = form.theme ?? {};
    const root = document.documentElement;
    const prev: [string, string][] = [];

    function setVar(name: string, value: string) {
      const old = root.style.getPropertyValue(name);
      prev.push([name, old]);
      root.style.setProperty(name, value);
    }

    setVar('--form-primary', theme.primaryColor ?? '#6366f1');
    setVar('--form-bg', theme.backgroundColor ?? '#ffffff');
    setVar('--form-font', theme.fontFamily ?? 'Inter, system-ui, sans-serif');
    setVar('--form-text', '#111827');

    const radius = RADIUS_MAP[theme.borderRadius ?? ''] ?? '0.75rem';
    setVar('--form-radius', radius);

    return () => {
      prev.forEach(([name, val]) => {
        if (val) root.style.setProperty(name, val);
        else root.style.removeProperty(name);
      });
    };
  }, [form.theme?.primaryColor, form.theme?.backgroundColor, form.theme?.fontFamily, form.theme?.borderRadius]);
}

interface FormViewProps {
  form: Form;
  questions: Question[];
  sections: Section[];
  respondent?: RespondentInfo;
  onSubmit: (answers: Record<string, any>, respondent?: RespondentInfo) => Promise<void>;
}

export function FormView({ form, questions, sections, respondent, onSubmit }: FormViewProps) {
  useGlobalTheme(form);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quizScore, setQuizScore] = useState<QuizScore | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [violations, setViolations] = useState(0);

  const security = form.settings?.securityEnabled;
  const securityConfig = useMemo(() => ({
    enabled: security,
    maxViolations: form.settings?.maxViolations ?? 3,
    fullscreen: form.settings?.fullscreen ?? true,
    disableCopy: form.settings?.disableCopy ?? true,
    preventTabSwitch: form.settings?.preventTabSwitch ?? true,
  }), [security, form.settings?.maxViolations, form.settings?.fullscreen, form.settings?.disableCopy, form.settings?.preventTabSwitch]);

  const handleSubmit = useCallback(async (auto?: boolean) => {
    setSaving(true);
    try {
      await onSubmit(answers, respondent);
      setSubmitted(true);
      if (form.settings?.isQuiz) {
        setQuizScore(scoreQuiz(questions, answers));
      }
    } catch {
      //
    } finally {
      setSaving(false);
    }
  }, [answers, respondent, onSubmit, form.settings?.isQuiz, questions]);

  const { start: startSecurity, started: securityStarted } = useExamSecurity({
    config: securityConfig,
    onViolation: (count) => setViolations(count),
    onMaxViolations: () => handleSubmit(true),
  });

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

  function isQuestionVisible(q: Question): boolean {
    if (!q.conditions?.enabled || !q.conditions.questionId) return true;
    const depAnswer = answers[q.conditions.questionId];
    if (depAnswer === undefined || depAnswer === null || depAnswer === '') return false;

    switch (q.conditions.operator) {
      case 'equals':
        return String(depAnswer) === q.conditions.value;
      case 'notEquals':
        return String(depAnswer) !== q.conditions.value;
      case 'contains':
        return String(depAnswer).includes(q.conditions.value);
      default:
        return true;
    }
  }

  function setAnswer(questionId: string, value: any) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto">
        {form.settings?.isQuiz && quizScore ? (
          <QuizResult score={quizScore} />
        ) : (
          <Card className="p-8 text-center max-w-lg mx-auto">
            <div className="text-4xl mb-4">&#127881;</div>
            <h2 className="text-xl font-semibold mb-2">{form.settings.confirmationMessage}</h2>
            <p className="text-gray-600">Tu respuesta ha sido registrada.</p>
          </Card>
        )}
      </div>
    );
  }

  const cardStyle = form.theme?.cardStyle ?? 'shadow';

  const content = (child: React.ReactNode) => (
    <div className="theme-page max-w-2xl mx-auto space-y-4 px-4 sm:px-0">
      {security && <SecurityBanner violations={violations} maxViolations={securityConfig.maxViolations} onStart={security ? startSecurity : undefined} started={securityStarted} />}
      <FormHeader title={form.title} description={form.description} theme={form.theme} />
      {child}
    </div>
  );

  // No sections: single page mode
  if (!hasSections) {
    return content(
      <>
        {questions.filter(isQuestionVisible).map((q) => (
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
            <QuestionInput question={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
          </Card>
        ))}
        <div className="flex justify-end">
          <Button onClick={() => handleSubmit()} loading={saving} disabled={saving}>Enviar</Button>
        </div>
      </>
    );
  }

  // Sections: multi-page mode
  return content(
    <>
      {form.theme.showProgressBar && (
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="progress-bar h-full transition-all duration-300"
            style={{ width: `${((currentSectionIndex + 1) / totalPages) * 100}%` }}
          />
        </div>
      )}

      {currentSection && (
        <SectionPage
          section={currentSection}
          questions={currentQuestions.filter(isQuestionVisible)}
          answers={answers}
          onAnswer={setAnswer}
          isFirst={currentSectionIndex === 0}
          isLast={currentSectionIndex === totalPages - 1}
          onNext={() => setCurrentSectionIndex((i) => Math.min(i + 1, totalPages - 1))}
          onPrev={() => setCurrentSectionIndex((i) => Math.max(i - 1, 0))}
          onSubmit={() => handleSubmit()}
          saving={saving}
          cardStyle={cardStyle}
        />
      )}
    </>
  );
}
