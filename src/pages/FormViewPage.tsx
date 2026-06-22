import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, getDocs, query, orderBy, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useResponses } from '../hooks/useResponses';
import { FormView } from '../components/form-view/FormView';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import type { Form } from '../types/form';
import type { Question, Section } from '../types/question';

export default function FormViewPage() {
  const { formId } = useParams<{ formId: string }>();
  const [form, setForm] = useState<Form | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const { submitResponse } = useResponses(formId!);

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

  if (loading) return <LoadingSpinner />;
  if (!form) return <div className="text-center py-12 text-gray-500">Formulario no encontrado</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white py-12 px-4">
      <FormView form={form} questions={questions} sections={sections} onSubmit={(answers) => submitResponse(answers, null)} />
    </div>
  );
}
