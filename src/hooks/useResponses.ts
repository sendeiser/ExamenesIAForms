import { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, Timestamp, deleteDoc, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { FormResponse, ProcedureValidationStatus, RespondentInfo } from '../types/response';

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

  async function submitResponse(
    answers: Record<string, any>,
    respondent?: RespondentInfo | null,
    procedurePhotos?: Record<string, string[]>
  ): Promise<string> {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(answers)) {
      if (v !== undefined) clean[k] = v;
    }

    const cleanPhotos: Record<string, string[]> = {};
    if (procedurePhotos) {
      for (const [qId, list] of Object.entries(procedurePhotos)) {
        if (Array.isArray(list) && list.length > 0) {
          cleanPhotos[qId] = list.filter((item) => typeof item === 'string' && item.length > 0);
        }
      }
    }

    const docRef = await addDoc(collection(db, 'forms', formId, 'responses'), {
      respondentId: null,
      respondentEmail: respondent?.email ?? null,
      respondent: respondent ?? null,
      answers: clean,
      ...(Object.keys(cleanPhotos).length > 0 ? { procedurePhotos: cleanPhotos } : {}),
      submittedAt: Timestamp.now(),
    });
    return docRef.id;
  }

  async function deleteResponse(responseId: string) {
    await deleteDoc(doc(db, 'forms', formId, 'responses', responseId));
  }

  async function updateResponse(
    responseId: string,
    updates: {
      answers?: Record<string, any>;
      respondent?: RespondentInfo;
      procedurePhotos?: Record<string, string[]>;
      procedureValidations?: Record<string, ProcedureValidationStatus>;
      scoreOverride?: number | null;
      gradeOverride?: number | null;
    }
  ) {
    await updateDoc(doc(db, 'forms', formId, 'responses', responseId), JSON.parse(JSON.stringify(updates)));
  }

  return { responses, loading, submitResponse, deleteResponse, updateResponse };
}
