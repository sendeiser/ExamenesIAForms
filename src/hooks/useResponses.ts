import { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, Timestamp, deleteDoc, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { FormResponse, RespondentInfo } from '../types/response';

export function useResponses(formId: string) {
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'forms', formId, 'responses'), orderBy('submittedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setResponses(snap.docs.map((d) => ({ id: d.id, ...d.data(), submittedAt: d.data().submittedAt?.toDate() } as FormResponse)));
      setLoading(false);
    });
    return unsub;
  }, [formId]);

  async function submitResponse(answers: Record<string, any>, respondent?: RespondentInfo | null) {
    await addDoc(collection(db, 'forms', formId, 'responses'), {
      respondentId: null,
      respondentEmail: respondent?.email ?? null,
      respondent: respondent ?? null,
      answers,
      submittedAt: Timestamp.now(),
    });
  }

  async function deleteResponse(responseId: string) {
    await deleteDoc(doc(db, 'forms', formId, 'responses', responseId));
  }

  async function updateResponse(responseId: string, updates: { answers?: Record<string, any>; respondent?: RespondentInfo }) {
    await updateDoc(doc(db, 'forms', formId, 'responses', responseId), updates);
  }

  return { responses, loading, submitResponse, deleteResponse, updateResponse };
}
