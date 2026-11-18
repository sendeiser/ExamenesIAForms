import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { QuestionInput } from './QuestionInput';
import { QuestionTableView } from './QuestionTableView';
import { ProcedurePhotoUploader } from './ProcedurePhotoUploader';
import { SectionPage } from './SectionPage';
import { FormHeader } from './FormHeader';
import { QuizResult } from './QuizResult';
import { SecurityBanner } from './SecurityBanner';
import { LatexRenderer } from '../ui/LatexRenderer';
import { useExamSecurity } from '../../hooks/useExamSecurity';
import { scoreQuiz } from '../../lib/quizScoring';
import { isDarkColor, getAutoContrastText } from '../../lib/examThemes';
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

function resolveThemeColors(form: Form) {
  const theme = form.theme ?? {};
  const primary = theme.primaryColor ?? '#1B3B6F';
  const bg = theme.backgroundColor ?? '#F7F5F0';
  const cardBg = theme.cardBackgroundColor ?? (isDarkColor(bg) ? '#1E293B' : '#FFFFFF');
  const textColor = theme.textColor ?? getAutoContrastText(cardBg);
  const font = theme.fontFamily ?? "'Plus Jakarta Sans', system-ui, sans-serif";
  const radius = RADIUS_MAP[theme.borderRadius ?? ''] ?? '0.75rem';
  return { primary, bg, cardBg, textColor, font, radius };
}

function buildThemeVars(form: Form): React.CSSProperties {
  const { primary, bg, cardBg, textColor, font, radius } = resolveThemeColors(form);
  return {
    '--form-primary': primary,
    '--form-bg': bg,
    '--form-card-bg': cardBg,
    '--form-font': font,
    '--form-text': textColor,
    '--form-radius': radius,
    color: textColor,
  } as React.CSSProperties;
}

function useGlobalTheme(form: Form, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const { primary, bg, cardBg, textColor, font, radius } = resolveThemeColors(form);
    const root = document.documentElement;
    const prev: [string, string][] = [];

    function setVar(name: string, value: string) {
      const old = root.style.getPropertyValue(name);
      prev.push([name, old]);
      root.style.setProperty(name, value);
    }

    setVar('--form-primary', primary);
    setVar('--form-bg', bg);
    setVar('--form-card-bg', cardBg);
    setVar('--form-font', font);
    setVar('--form-text', textColor);
    setVar('--form-radius', radius);

    return () => {
      prev.forEach(([name, val]) => {
        if (val) root.style.setProperty(name, val);
        else root.style.removeProperty(name);
      });
    };
  }, [
    enabled,
    form.theme?.primaryColor,
    form.theme?.backgroundColor,
    form.theme?.cardBackgroundColor,
    form.theme?.textColor,
    form.theme?.fontFamily,
    form.theme?.borderRadius,
  ]);
}

interface FormViewProps {
  form: Form;
  questions: Question[];
  sections: Section[];
  respondent?: RespondentInfo;
  onSubmit: (
    answers: Record<string, any>,
    respondent?: RespondentInfo,
    procedurePhotos?: Record<string, string[]>
  ) => Promise<void>;
  initialAnswers?: Record<string, any>;
  autoSubmit?: boolean;
  previewMode?: boolean;
}

export function FormView({
  form,
  questions,
  sections,
  respondent,
  onSubmit,
  initialAnswers,
  autoSubmit,
  previewMode = false,
}: FormViewProps) {
  useGlobalTheme(form, !previewMode);
  const scopedThemeStyle = useMemo(() => (previewMode ? buildThemeVars(form) : undefined), [previewMode, form]);
  const [answers, setAnswers] = useState<Record<string, any>>(initialAnswers ?? {});
  const [procedurePhotos, setProcedurePhotos] = useState<Record<string, string[]>>({});
  const [showPhotoValidationError, setShowPhotoValidationError] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [quizScore, setQuizScore] = useState<QuizScore | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [violations, setViolations] = useState(0);

  const hasSecurityConfigured = Boolean(form.settings?.securityEnabled);
  const security = Boolean(hasSecurityConfigured && !previewMode);
  const securityConfig = useMemo(() => ({
    enabled: security,
    maxViolations: form.settings?.maxViolations ?? 3,
    fullscreen: form.settings?.fullscreen ?? true,
    disableCopy: form.settings?.disableCopy ?? true,
    preventTabSwitch: form.settings?.preventTabSwitch ?? true,
  }), [security, form.settings?.maxViolations, form.settings?.fullscreen, form.settings?.disableCopy, form.settings?.preventTabSwitch]);

  const handleSubmitRef = useRef<(...args: any[]) => Promise<void>>();

  const { start: startSecurity, stop: stopSecurity, started: securityStarted } = useExamSecurity({
    config: securityConfig,
    onViolation: (count) => setViolations(count),
    onMaxViolations: () => handleSubmitRef.current?.(true),
  });

  function getMissingPhotoQuestions(list: Question[]): Array<{ idx: number; question: Question }> {
    const missing: Array<{ idx: number; question: Question }> = [];
    list.forEach((q, idx) => {
      if (!isQuestionVisible(q)) return;
      if (q.settings?.requireProcedurePhoto && (procedurePhotos[q.id]?.length ?? 0) === 0) {
        missing.push({ idx: idx + 1, question: q });
      }
    });
    return missing;
  }

  const handleSubmit = useCallback(async (auto?: boolean) => {
    setError('');

    if (!auto) {
      const visibleList =
        sections.length > 0
          ? sections.flatMap((s) => questions.filter((q) => q.sectionId === s.id))
          : questions;
      const missing = getMissingPhotoQuestions(visibleList);
      if (missing.length > 0) {
        setShowPhotoValidationError(true);
        const firstSectionIdx =
          sections.length > 0
            ? sections.findIndex((s) => s.id === missing[0].question.sectionId)
            : -1;
        if (firstSectionIdx !== -1 && firstSectionIdx !== currentSectionIndex) {
          setCurrentSectionIndex(firstSectionIdx);
        }
        setError(
          `Debes adjuntar al menos una foto del procedimiento en la${missing.length === 1 ? '' : 's'} actividad${missing.length === 1 ? '' : 'es'} marcada${missing.length === 1 ? '' : 's'} antes de enviar.`
        );
        return;
      }
    }

    setSaving(true);
    try {
      await onSubmit(answers, respondent, procedurePhotos);
      setSubmitted(true);
      stopSecurity();
      if (form.settings?.isQuiz) {
        setQuizScore(scoreQuiz(questions, answers));
      }
    } catch (e: any) {
      console.error('Submit error:', e);
      const code = e?.code || e?.message || '';
      if (code.includes('permission-denied')) {
        setError('Error de permisos. El formulario no acepta más respuestas.');
      } else if (code.includes('unavailable') || code.includes('network')) {
        setError('Error de red. Revisa tu conexión e intenta de nuevo.');
      } else if (code.includes('invalid-argument')) {
        setError('Error en los datos. Intenta recargar la página.');
      } else {
        setError('Error al enviar. Revisa tu conexión e intenta de nuevo.');
      }
    } finally {
      setSaving(false);
    }
  }, [answers, procedurePhotos, respondent, onSubmit, form.settings?.isQuiz, questions, sections, currentSectionIndex, stopSecurity]);

  handleSubmitRef.current = handleSubmit;

  useEffect(() => {
    if (security && !securityStarted) {
      startSecurity();
    }
  }, [security, securityStarted, startSecurity]);

  useEffect(() => {
    if (!autoSubmit) return;
    const t = setTimeout(() => handleSubmitRef.current?.(true), 500);
    return () => clearTimeout(t);
  }, [autoSubmit]);

  const unassigned = useMemo(() => questions.filter((q) => !q.sectionId), [questions]);
  const sectionQuestions = useMemo(() => {
    const map: Record<string, Question[]> = {};
    sections.forEach((s) => { map[s.id] = questions.filter((q) => q.sectionId === s.id); });
    return map;
  }, [questions, sections]);

  const hasSections = sections.length > 0;
  const totalPages = hasSections ? sections.length : 1;
  const safeSectionIndex = Math.min(currentSectionIndex, Math.max(0, totalPages - 1));
  const currentSection = hasSections ? sections[safeSectionIndex] : null;
  const currentQuestions = hasSections ? (sectionQuestions[currentSection?.id ?? ''] ?? []) : unassigned;

  useEffect(() => {
    if (currentSectionIndex >= totalPages) {
      setCurrentSectionIndex(Math.max(0, totalPages - 1));
    }
  }, [totalPages, currentSectionIndex]);

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

  function setQuestionPhotos(questionId: string, photos: string[]) {
    setProcedurePhotos((prev) => ({ ...prev, [questionId]: photos }));
    setError('');
  }

  function handleNextSection() {
    setError('');
    const missing = getMissingPhotoQuestions(currentQuestions);
    if (missing.length > 0) {
      setShowPhotoValidationError(true);
      setError('Debes adjuntar al menos una foto del procedimiento en las actividades requeridas de esta sección antes de continuar.');
      return;
    }
    setCurrentSectionIndex((i) => Math.min(i + 1, totalPages - 1));
  }

  function resetPreview() {
    setAnswers(initialAnswers ?? {});
    setProcedurePhotos({});
    setShowPhotoValidationError(false);
    setSubmitted(false);
    setQuizScore(null);
    setError('');
    setCurrentSectionIndex(0);
  }

  if (submitted) {
    return (
      <div
        className={previewMode ? 'theme-page max-w-2xl mx-auto space-y-4 rounded-xl p-4 sm:p-6' : 'max-w-2xl mx-auto space-y-4'}
        style={previewMode ? { ...scopedThemeStyle, minHeight: 'auto' } : { color: 'var(--form-text, #1C1917)' }}
      >
        {form.settings?.isQuiz && quizScore ? (
          <QuizResult score={quizScore} gradeRounding={form.settings?.gradeRounding ?? 'quarter'} />
        ) : (
          <Card className="p-8 text-center max-w-lg mx-auto">
            <div className="text-4xl mb-4">&#127881;</div>
            <h2 className="text-xl font-semibold mb-2">{form.settings.confirmationMessage}</h2>
            <p className="text-gray-600">Tu respuesta ha sido registrada.</p>
          </Card>
        )}
        {previewMode && (
          <div className="flex justify-center pt-2">
            <Button variant="secondary" onClick={resetPreview}>
              Volver a probar vista previa
            </Button>
          </div>
        )}
      </div>
    );
  }

  const cardStyle = form.theme?.cardStyle ?? 'shadow';

  const content = (child: React.ReactNode) => (
    <div
      className={
        previewMode
          ? 'theme-page max-w-2xl mx-auto space-y-4 rounded-xl p-4 sm:p-6'
          : 'theme-page max-w-2xl mx-auto space-y-4 px-4 sm:px-0'
      }
      style={previewMode ? { ...scopedThemeStyle, minHeight: 'auto' } : { color: 'var(--form-text, #1C1917)' }}
    >
      {security && <SecurityBanner violations={violations} maxViolations={securityConfig.maxViolations} started={securityStarted} />}
      {previewMode && hasSecurityConfigured && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Modo seguro activo para los alumnos (en esta vista previa no bloquea pantalla ni pestañas).
        </div>
      )}
      <FormHeader title={form.title} description={form.description} theme={form.theme} />
      {child}
    </div>
  );

  // No sections: single page mode
  if (!hasSections) {
    const visibleQuestions = questions.filter(isQuestionVisible);
    return content(
      <>
        {previewMode && visibleQuestions.length === 0 && (
          <Card className="p-8 text-center text-sm text-gray-500" data-style={cardStyle}>
            Aún no hay preguntas en este examen. Agrégalas desde el editor para previsualizarlas aquí.
          </Card>
        )}
        {visibleQuestions.map((q) => (
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
            {q.settings?.table && (
              <div className="mb-3">
                <QuestionTableView
                  table={q.settings.table}
                  value={answers[q.id]}
                  onChange={(v) => setAnswer(q.id, v)}
                />
              </div>
            )}
            <QuestionInput question={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
            {q.settings?.requireProcedurePhoto && (
              <ProcedurePhotoUploader
                photos={procedurePhotos[q.id] ?? []}
                onChange={(next) => setQuestionPhotos(q.id, next)}
                missingHighlight={showPhotoValidationError}
              />
            )}
          </Card>
        ))}
        {error && <p className="text-sm text-red-600 text-center font-medium">{error}</p>}
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
            style={{ width: `${((safeSectionIndex + 1) / totalPages) * 100}%` }}
          />
        </div>
      )}

      {currentSection && (
        <SectionPage
          section={currentSection}
          questions={currentQuestions.filter(isQuestionVisible)}
          answers={answers}
          onAnswer={setAnswer}
          procedurePhotos={procedurePhotos}
          onProcedurePhotosChange={setQuestionPhotos}
          showPhotoValidationError={showPhotoValidationError}
          isFirst={safeSectionIndex === 0}
          isLast={safeSectionIndex === totalPages - 1}
          onNext={handleNextSection}
          onPrev={() => setCurrentSectionIndex((i) => Math.max(i - 1, 0))}
          onSubmit={() => handleSubmit()}
          saving={saving}
          error={error}
          cardStyle={cardStyle}
        />
      )}
    </>
  );
}
