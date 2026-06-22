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
  loadSections: (formId: string) => Promise<void>;
  addSection: () => Promise<void>;
  updateSection: (sectionId: string, updates: Partial<Section>) => Promise<void>;
  removeSection: (sectionId: string) => Promise<void>;
  moveQuestionToSection: (questionId: string, sectionId: string | null) => Promise<void>;
  reorderSections: (sections: Section[]) => Promise<void>;
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
    await get().loadSections(formId);
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

  loadSections: async (formId) => {
    const q = query(collection(db, 'forms', formId, 'sections'), orderBy('order', 'asc'));
    const snap = await getDocs(q);
    const sections = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Section));
    set({ sections });
  },

  addSection: async () => {
    const { form, sections } = get();
    if (!form) return;
    const newSection = {
      formId: form.id,
      title: `Sección ${sections.length + 1}`,
      description: '',
      order: sections.length,
    };
    const docRef = await addDoc(collection(db, 'forms', form.id, 'sections'), newSection);
    set({ sections: [...sections, { id: docRef.id, ...newSection }] });
  },

  updateSection: async (sectionId, updates) => {
    const { form } = get();
    if (!form) return;
    await updateDoc(doc(db, 'forms', form.id, 'sections', sectionId), updates);
    set((s) => ({ sections: s.sections.map((sec) => (sec.id === sectionId ? { ...sec, ...updates } : sec)) }));
  },

  removeSection: async (sectionId) => {
    const { form } = get();
    if (!form) return;
    const { questions } = get();
    const batch = writeBatch(db);
    questions.filter((q) => q.sectionId === sectionId).forEach((q) => {
      batch.update(doc(db, 'forms', form.id, 'questions', q.id), { sectionId: null });
    });
    batch.delete(doc(db, 'forms', form.id, 'sections', sectionId));
    await batch.commit();
    set((s) => ({
      sections: s.sections.filter((sec) => sec.id !== sectionId),
      questions: s.questions.map((q) => (q.sectionId === sectionId ? { ...q, sectionId: null } : q)),
    }));
  },

  moveQuestionToSection: async (questionId, sectionId) => {
    const { form } = get();
    if (!form) return;
    await updateDoc(doc(db, 'forms', form.id, 'questions', questionId), { sectionId });
    set((s) => ({ questions: s.questions.map((q) => (q.id === questionId ? { ...q, sectionId } : q)) }));
  },

  reorderSections: async (sections) => {
    const { form } = get();
    if (!form) return;
    const batch = writeBatch(db);
    sections.forEach((sec, i) => {
      batch.update(doc(db, 'forms', form.id, 'sections', sec.id), { order: i });
    });
    await batch.commit();
    set({ sections });
  },
}));
