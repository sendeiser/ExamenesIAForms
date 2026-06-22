import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { FormResponse } from '../types/response';

export function useResponses(formId: string) {
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchResponses() {
    const q = query(collection(db, 'forms', formId, 'responses'), orderBy('submittedAt', 'desc'));
    const snap = await getDocs(q);
    setResponses(snap.docs.map((d) => ({ id: d.id, ...d.data(), submittedAt: d.data().submittedAt?.toDate() } as FormResponse)));
    setLoading(false);
  }

  async function submitResponse(answers: Record<string, any>, email?: string | null) {
    await addDoc(collection(db, 'forms', formId, 'responses'), {
      respondentEmail: email || null,
      answers,
      submittedAt: Timestamp.now(),
    });
  }

  useEffect(() => { fetchResponses(); }, [formId]);

  return { responses, loading, submitResponse, refetch: fetchResponses };
}
