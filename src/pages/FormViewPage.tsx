import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, getDocs, query, orderBy, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useResponses } from '../hooks/useResponses';
import { FormView } from '../components/form-view/FormView';
import { RespondentForm } from '../components/form-view/RespondentForm';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import type { Form } from '../types/form';
import type { Question, Section } from '../types/question';
import type { RespondentInfo } from '../types/response';

export default function FormViewPage() {
  const { formId } = useParams<{ formId: string }>();
  const [form, setForm] = useState<Form | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondent, setRespondent] = useState<RespondentInfo | null>(null);
  const { submitResponse } = useResponses(formId!);

  const params = new URLSearchParams(window.location.search);
  const isAuto = params.has('auto');

  useEffect(() => {
    if (!formId) return;
    (async () => {
      const formSnap = await getDoc(doc(db, 'forms', formId));
      if (!formSnap.exists()) { setLoading(false); return; }
      const data = formSnap.data();
      setForm({ id: formSnap.id, ...data, createdAt: data.createdAt?.toDate(), updatedAt: data.updatedAt?.toDate() } as Form);

      const qSnap = await getDocs(query(collection(db, 'forms', formId, 'questions'), orderBy('order', 'asc')));
      setQuestions(qSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Question)));

      const sectionsSnap = await getDocs(query(collection(db, 'forms', formId, 'sections'), orderBy('order', 'asc')));
      setSections(sectionsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Section)));

      setLoading(false);
    })();
  }, [formId]);

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

  if (loading) return <LoadingSpinner />;
  if (!form) return <div className="text-center py-12 text-gray-600">Formulario no encontrado</div>;

  if (isAuto) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white py-12 px-4">
        <FormView
          form={form}
          questions={questions}
          sections={sections}
          respondent={{ name: 'Test', email: '' }}
          onSubmit={async () => {}}
          initialAnswers={initialAnswers}
        />
      </div>
    );
  }

  if (!respondent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white py-12 px-4">
        <RespondentForm formTitle={form.title} onStart={setRespondent} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white py-12 px-4">
      <FormView form={form} questions={questions} sections={sections} respondent={respondent} onSubmit={(answers) => submitResponse(answers, respondent)} />
    </div>
  );
}
