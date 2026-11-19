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
import { scoreQuiz } from '../lib/quizScoring';
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
  const resultParam = params.get('result');

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
        await signInAnonymously(auth);
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
      setForm({
        id: formSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
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

  const initialAnswers = useMemo(() => {
    if (!isAuto) return undefined;
    const acc: Record<string, any> = {};
    questions.forEach((q) => {
      if (q.quizSettings?.correctAnswer !== null && q.quizSettings?.correctAnswer !== undefined) {
        acc[q.id] = q.quizSettings.correctAnswer;
      }
    });
    return acc;
  }, [isAuto, questions]);

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
          questions={questions}
          sections={sections}
          respondent={{ name: 'Test', email: '' }}
          onSubmit={async () => {}}
          initialAnswers={initialAnswers}
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
    const reviewScore = scoreQuiz(
      questions,
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
            questions={questions}
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

  if (!respondent) {
    return (
      <div className="min-h-screen bg-paper-grid py-12 px-4 flex items-center justify-center">
        <RespondentForm
          formTitle={form.title}
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
      <FormView
        form={form}
        questions={questions}
        sections={sections}
        respondent={respondent}
        onSubmit={async (answers, resp, procedurePhotos) => {
          const createdId = await submitResponse(answers, resp ?? respondent, procedurePhotos);
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
