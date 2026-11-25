import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { signInAnonymously } from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  collection,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useResponses } from '../hooks/useResponses';
import { FormView } from '../components/form-view/FormView';
import { FormHeader } from '../components/form-view/FormHeader';
import { QuizResult } from '../components/form-view/QuizResult';
import { RespondentForm } from '../components/form-view/RespondentForm';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { toDateSafe } from '../lib/dateUtils';
import { scoreQuiz } from '../lib/quizScoring';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Eye,
  Loader2,
  Lock,
  Search,
} from 'lucide-react';
import {
  DEFAULT_ORIGINAL_LABEL,
  ORIGINAL_VERSION_ID,
  filterQuestionsByVersion,
  filterSectionsByVersion,
  getQuestionsForResponse,
  hasMultipleVersions,
  pickAssignedVersionForStudent,
} from '../lib/examVersions';
import { isDarkColor, getAutoContrastText } from '../lib/examThemes';
import type { Form } from '../types/form';
import type { Question, Section } from '../types/question';
import type { FormResponse, RespondentInfo } from '../types/response';

const LAST_RESPONSE_KEY = (formId: string) => `exam_last_response_${formId}`;

export default function FormViewPage() {
  const { formId } = useParams<{ formId: string }>();
  const [form, setForm] = useState<Form | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [respondent, setRespondent] = useState<RespondentInfo | null>(null);

  const params = new URLSearchParams(window.location.search);
  const isAuto = params.has('auto');
  const isPreview = params.get('preview') === 'true';
  const resultParam = params.get('result');
  const versionParam = params.get('v');

  const [savedResponseId, setSavedResponseId] = useState<string | null>(() => {
    if (!formId) return null;
    try {
      return localStorage.getItem(LAST_RESPONSE_KEY(formId));
    } catch {
      return null;
    }
  });
  const [reviewResponseId, setReviewResponseId] = useState<string | null>(resultParam);
  const [reviewResponse, setReviewResponse] = useState<FormResponse | null>(null);
  const [reviewLoading, setReviewLoading] = useState(Boolean(resultParam));
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [draftLookupQuery, setDraftLookupQuery] = useState('');

  const { submitResponse } = useResponses(formId!);

  useEffect(() => {
    if (!formId) return;
    setReviewResponseId(resultParam);
    setReviewResponse(null);
    setLookupError('');
    try {
      setSavedResponseId(localStorage.getItem(LAST_RESPONSE_KEY(formId)));
    } catch {
      setSavedResponseId(null);
    }

    (async () => {
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
      } catch {
        setAuthError(
          'Error de configuración. El administrador debe habilitar "Autenticación anónima" en Firebase Console > Authentication > Sign-in method, ' +
            'y actualizar las reglas de Firestore para permitir escritura a usuarios autenticados.'
        );
      }

      const formSnap = await getDoc(doc(db, 'forms', formId));
      if (!formSnap.exists()) {
        setLoading(false);
        return;
      }
      const data = formSnap.data();
      const createdAt = toDateSafe(data.createdAt) ?? new Date();
      const updatedAt = toDateSafe(data.updatedAt) ?? createdAt;
      setForm({
        id: formSnap.id,
        ...data,
        createdAt,
        updatedAt,
      } as Form);

      const qSnap = await getDocs(
        query(collection(db, 'forms', formId, 'questions'), orderBy('order', 'asc'))
      );
      setQuestions(qSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Question)));

      const sectionsSnap = await getDocs(
        query(collection(db, 'forms', formId, 'sections'), orderBy('order', 'asc'))
      );
      setSections(sectionsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Section)));

      setLoading(false);
    })();
  }, [formId, resultParam]);

  // Escucha en vivo de la respuesta que está revisando el alumno (actualiza nota y validación al instante)
  useEffect(() => {
    if (!formId || !reviewResponseId) {
      setReviewResponse(null);
      setReviewLoading(false);
      return;
    }

    setReviewLoading(true);
    const unsub = onSnapshot(
      doc(db, 'forms', formId, 'responses', reviewResponseId),
      (snap) => {
        if (!snap.exists()) {
          setReviewResponse(null);
          setReviewResponseId(null);
          if (savedResponseId === reviewResponseId) {
            try {
              localStorage.removeItem(LAST_RESPONSE_KEY(formId));
            } catch {}
            setSavedResponseId(null);
          }
          setLookupError('No encontramos esa entrega (puede haber sido eliminada).');
          setReviewLoading(false);
          return;
        }
        const d = snap.data();
        setReviewResponse({
          id: snap.id,
          formId,
          ...d,
          submittedAt: d.submittedAt?.toDate() ?? new Date(),
        } as FormResponse);
        setReviewLoading(false);
      },
      () => {
        setLookupError('No se pudo cargar tu examen entregado.');
        setReviewLoading(false);
      }
    );

    return unsub;
  }, [formId, reviewResponseId, savedResponseId]);

  const multiVersion = hasMultipleVersions(form);
  const assignedVersion = useMemo(() => {
    if (!form) return { id: ORIGINAL_VERSION_ID, label: DEFAULT_ORIGINAL_LABEL };
    return pickAssignedVersionForStudent(form, versionParam);
  }, [form, versionParam]);

  const activeQuestions = useMemo(
    () => filterQuestionsByVersion(questions, assignedVersion.id),
    [questions, assignedVersion.id]
  );

  const activeSections = useMemo(
    () => filterSectionsByVersion(sections, assignedVersion.id),
    [sections, assignedVersion.id]
  );

  const initialAnswers = useMemo(() => {
    if (!isAuto) return undefined;
    const acc: Record<string, any> = {};
    activeQuestions.forEach((q) => {
      if (q.quizSettings?.correctAnswer !== null && q.quizSettings?.correctAnswer !== undefined) {
        acc[q.id] = q.quizSettings.correctAnswer;
      }
    });
    return acc;
  }, [isAuto, activeQuestions]);

  async function handleLookupResult(queryText: string) {
    if (!formId) return;
    setLookupLoading(true);
    setLookupError('');
    try {
      const normalized = queryText.trim().toLowerCase();
      if (!normalized) {
        setLookupError('Ingresa tu correo electrónico o nombre y apellido.');
        return;
      }

      const snap = await getDocs(
        query(collection(db, 'forms', formId, 'responses'), orderBy('submittedAt', 'desc'))
      );
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        submittedAt: d.data().submittedAt?.toDate() ?? new Date(),
      } as FormResponse));

      const matchByEmail = list.find(
        (r) => (r.respondent?.email ?? r.respondentEmail ?? '').trim().toLowerCase() === normalized
      );
      const matchByExactName =
        matchByEmail ??
        list.find((r) => (r.respondent?.name ?? '').trim().toLowerCase() === normalized);
      const matchByPartial =
        matchByExactName ??
        list.find((r) => {
          if (normalized.length < 3) return false;
          const name = (r.respondent?.name ?? '').trim().toLowerCase();
          const email = (r.respondent?.email ?? r.respondentEmail ?? '').trim().toLowerCase();
          return name.includes(normalized) || email.includes(normalized);
        });

      if (!matchByPartial) {
        setLookupError('No encontramos ninguna entrega con ese correo o nombre en este examen.');
        return;
      }

      try {
        localStorage.setItem(LAST_RESPONSE_KEY(formId), matchByPartial.id);
      } catch {}
      setSavedResponseId(matchByPartial.id);
      setReviewResponseId(matchByPartial.id);
    } catch {
      setLookupError('No se pudo consultar tu resultado en este momento. Intenta de nuevo.');
    } finally {
      setLookupLoading(false);
    }
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-paper-grid py-12 px-4 flex items-start justify-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-lg text-center space-y-3">
          <p className="text-red-700 text-sm">{authError}</p>
        </div>
      </div>
    );
  }

  if (loading || (reviewResponseId && reviewLoading)) return <LoadingSpinner />;
  if (!form) return <div className="text-center py-12 text-ink-subtle">Formulario no encontrado</div>;

  if (isAuto) {
    return (
      <div className="min-h-screen bg-paper-grid py-10 px-4">
        <FormView
          form={form}
          questions={activeQuestions}
          sections={activeSections}
          respondent={{ name: 'Test', email: '' }}
          onSubmit={async () => {}}
          initialAnswers={initialAnswers}
          versionLabel={multiVersion ? assignedVersion.label : undefined}
          autoSubmit
        />
      </div>
    );
  }

  if (reviewResponse) {
    const theme = form.theme ?? {};
    const bg = theme.backgroundColor ?? '#F7F5F0';
    const cardBg = theme.cardBackgroundColor ?? (isDarkColor(bg) ? '#1E293B' : '#FFFFFF');
    const textColor = theme.textColor ?? getAutoContrastText(cardBg);
    const reviewQuestions = getQuestionsForResponse(questions, reviewResponse);
    const reviewScore = scoreQuiz(
      reviewQuestions,
      reviewResponse.answers,
      reviewResponse.procedureValidations
    );

    return (
      <div
        className="min-h-screen py-10 px-4"
        style={{
          backgroundColor: bg,
          color: textColor,
          fontFamily: theme.fontFamily ?? "'Plus Jakarta Sans', system-ui, sans-serif",
        }}
      >
        <div className="max-w-2xl mx-auto space-y-4">
          <FormHeader title={form.title} description={form.description} theme={form.theme} />
          <QuizResult
            score={reviewScore}
            gradeRounding={form.settings?.gradeRounding ?? 'quarter'}
            questions={reviewQuestions}
            response={reviewResponse}
            isQuiz={Boolean(form.settings?.isQuiz)}
            onBack={() => {
              setReviewResponseId(null);
              setReviewResponse(null);
            }}
          />
        </div>
      </div>
    );
  }

  if (!form.published && !isAuto && !isPreview && !reviewResponse) {
    return (
      <div className="min-h-screen bg-paper-grid py-12 px-4 flex items-center justify-center">
        <Card className="p-8 w-full max-w-md mx-auto animate-editorial-in space-y-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-mono uppercase tracking-wider">
              <Lock className="h-3.5 w-3.5" />
              Borrador · No habilitado
            </div>
            <h1 className="font-display text-2xl font-bold text-ink leading-tight">
              {form.title}
            </h1>
            <p className="text-sm text-ink-subtle leading-relaxed">
              Este examen todavía no está publicado o fue cerrado por el docente. Cuando el docente lo publique, podrás ingresar con este mismo enlace o código.
            </p>
          </div>

          <div className="pt-4 border-t border-sand-200 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink">
              <Award className="h-4 w-4 text-brand-600" />
              <span>¿Ya rendiste este examen? Consulta tu nota</span>
            </div>

            {savedResponseId && (
              <div className="rounded-xl border border-green-200 bg-green-50/70 p-3.5 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-green-800">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span>Ya entregaste este examen desde este dispositivo</span>
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    setLookupError('');
                    setReviewResponseId(savedResponseId);
                  }}
                  className="w-full justify-center !bg-green-600 hover:!bg-green-700"
                >
                  Ver mi examen entregado / nota
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!draftLookupQuery.trim()) return;
                void handleLookupResult(draftLookupQuery);
              }}
              className="space-y-3"
            >
              <Input
                label="Buscar por correo electrónico o nombre"
                placeholder="Ej: alumno@institucion.edu o María Torres"
                value={draftLookupQuery}
                onChange={(e) => setDraftLookupQuery(e.target.value)}
              />
              {lookupError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {lookupError}
                </p>
              )}
              <Button
                type="submit"
                variant={savedResponseId ? 'secondary' : 'primary'}
                disabled={lookupLoading || !draftLookupQuery.trim()}
                className="w-full justify-center py-2.5"
              >
                {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {lookupLoading ? 'Buscando entrega...' : 'Ver mi nota y examen'}
              </Button>
            </form>
          </div>
        </Card>
      </div>
    );
  }

  if (!respondent) {
    return (
      <div className="min-h-screen bg-paper-grid py-12 px-4 flex flex-col items-center justify-center gap-4">
        {!form.published && isPreview && (
          <div className="w-full max-w-md rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 flex items-center gap-2 shadow-sm">
            <Eye className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              <strong>Vista previa docente:</strong> este examen está en borrador y aún no es visible para alumnos.
            </span>
          </div>
        )}
        <RespondentForm
          formTitle={multiVersion ? `${form.title} — ${assignedVersion.label}` : form.title}
          hasSavedResult={Boolean(savedResponseId)}
          onViewSavedResult={
            savedResponseId
              ? () => {
                  setLookupError('');
                  setReviewResponseId(savedResponseId);
                }
              : undefined
          }
          onLookupResult={handleLookupResult}
          lookupLoading={lookupLoading}
          lookupError={lookupError}
          onStart={(data) => {
            try {
              document.documentElement.requestFullscreen();
            } catch {}
            setRespondent(data);
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper-grid py-10 px-4">
      {!form.published && isPreview && (
        <div className="max-w-3xl mx-auto mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 flex items-center gap-2 shadow-sm">
          <Eye className="h-4 w-4 text-amber-600 shrink-0" />
          <span>
            <strong>Vista previa docente:</strong> este examen está en borrador y aún no es visible para alumnos.
          </span>
        </div>
      )}
      <FormView
        form={form}
        questions={activeQuestions}
        sections={activeSections}
        respondent={respondent}
        versionLabel={multiVersion ? assignedVersion.label : undefined}
        onSubmit={async (answers, resp, procedurePhotos) => {
          const createdId = await submitResponse(
            answers,
            resp ?? respondent,
            procedurePhotos,
            multiVersion
              ? { versionId: assignedVersion.id, versionLabel: assignedVersion.label }
              : { versionId: ORIGINAL_VERSION_ID, versionLabel: DEFAULT_ORIGINAL_LABEL }
          );
          if (createdId && formId) {
            try {
              localStorage.setItem(LAST_RESPONSE_KEY(formId), createdId);
            } catch {}
            setSavedResponseId(createdId);
          }
        }}
      />
    </div>
  );
}
