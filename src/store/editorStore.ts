import { create } from 'zustand';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Form } from '../types/form';
import type { Question, Section, QuestionType } from '../types/question';

interface EditorStore {
  form: Form | null;
  questions: Question[];
  sections: Section[];
  loading: boolean;
  loadForm: (formId: string) => Promise<void>;
  updateForm: (updates: Partial<Form>) => Promise<void>;
  addQuestion: (type: QuestionType) => Promise<void>;
  updateQuestion: (questionId: string, updates: Partial<Question>) => Promise<void>;
  removeQuestion: (questionId: string) => Promise<void>;
  reorderQuestions: (questions: Question[]) => Promise<void>;
  loadQuestions: (formId: string) => Promise<void>;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  form: null,
  questions: [],
  sections: [],
  loading: false,

  loadForm: async (formId) => {
    set({ loading: true });
    const snap = await getDoc(doc(db, 'forms', formId));
    if (snap.exists()) {
      const data = snap.data();
      set({
        form: { id: snap.id, ...data, createdAt: data.createdAt?.toDate(), updatedAt: data.updatedAt?.toDate() } as Form,
      });
    }
    await get().loadQuestions(formId);
    set({ loading: false });
  },

  loadQuestions: async (formId) => {
    const q = query(collection(db, 'forms', formId, 'questions'), orderBy('order', 'asc'));
    const snap = await getDocs(q);
    const questions = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Question));
    set({ questions });
  },

  updateForm: async (updates) => {
    const { form } = get();
    if (!form) return;
    await updateDoc(doc(db, 'forms', form.id), { ...updates, updatedAt: Timestamp.now() });
    set({ form: { ...form, ...updates } });
  },

  addQuestion: async (type) => {
    const { form, questions } = get();
    if (!form) return;
    const newQuestion = {
      formId: form.id,
      type,
      title: type === 'multipleChoice' ? 'Opción múltiple' : 'Nueva pregunta',
      description: '',
      required: false,
      order: questions.length,
      options: type === 'multipleChoice' || type === 'checkbox' || type === 'dropdown' ? ['Opción 1'] : [],
      settings: {},
      conditions: null,
      sectionId: null,
    };
    const docRef = await addDoc(collection(db, 'forms', form.id, 'questions'), newQuestion);
    set({ questions: [...questions, { id: docRef.id, ...newQuestion } as Question] });
  },

  updateQuestion: async (questionId, updates) => {
    const { form } = get();
    if (!form) return;
    await updateDoc(doc(db, 'forms', form.id, 'questions', questionId), updates);
    set((s) => ({
      questions: s.questions.map((q) => (q.id === questionId ? { ...q, ...updates } : q)),
    }));
  },

  removeQuestion: async (questionId) => {
    const { form } = get();
    if (!form) return;
    await deleteDoc(doc(db, 'forms', form.id, 'questions', questionId));
    set((s) => ({
      questions: s.questions.filter((q) => q.id !== questionId),
    }));
  },

  reorderQuestions: async (questions) => {
    const { form } = get();
    if (!form) return;
    const batch = writeBatch(db);
    questions.forEach((q, i) => {
      batch.update(doc(db, 'forms', form.id, 'questions', q.id), { order: i });
    });
    await batch.commit();
    set({ questions });
  },
}));
