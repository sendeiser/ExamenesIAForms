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
import { toDateSafe } from '../lib/dateUtils';
import {
  ORIGINAL_VERSION_ID,
  filterQuestionsByVersion,
  filterSectionsByVersion,
  getFormVersions,
  normalizeVersionId,
} from '../lib/examVersions';
import type { Form } from '../types/form';
import type { Question, Section, QuestionType } from '../types/question';

interface EditorStore {
  form: Form | null;
  allQuestions: Question[];
  allSections: Section[];
  activeVersionId: string;
  questions: Question[];
  sections: Section[];
  loading: boolean;
  loadForm: (formId: string, preferredVersionId?: string) => Promise<void>;
  setActiveVersion: (versionId: string) => void;
  renameVersion: (versionId: string, newLabel: string) => Promise<void>;
  deleteVersion: (versionId: string) => Promise<void>;
  updateForm: (updates: Partial<Form>) => Promise<void>;
  addQuestion: (type: QuestionType, initialUpdates?: Partial<Question>) => Promise<void>;
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

const touchTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearPendingTouch(formId: string) {
  const existing = touchTimers.get(formId);
  if (existing) {
    clearTimeout(existing);
    touchTimers.delete(formId);
  }
}

export const useEditorStore = create<EditorStore>((set, get) => {
  const touchFormUpdatedAt = (formId: string, immediate = true) => {
    const nowDate = new Date();
    set((s) => (s.form && s.form.id === formId ? { form: { ...s.form, updatedAt: nowDate } } : s));

    clearPendingTouch(formId);

    const persist = () => {
      touchTimers.delete(formId);
      void updateDoc(doc(db, 'forms', formId), { updatedAt: Timestamp.now() }).catch((err) => {
        console.error('Error updating updatedAt:', err);
      });
    };

    if (immediate) {
      persist();
    } else {
      touchTimers.set(formId, setTimeout(persist, 600));
    }
  };

  return {
  form: null,
  allQuestions: [],
  allSections: [],
  activeVersionId: ORIGINAL_VERSION_ID,
  questions: [],
  sections: [],
  loading: false,

  loadForm: async (formId, preferredVersionId) => {
    set({ loading: true });
    const prevFormId = get().form?.id;
    const prevActiveVersionId = get().activeVersionId;

    const snap = await getDoc(doc(db, 'forms', formId));
    let loadedForm: Form | null = null;
    if (snap.exists()) {
      const data = snap.data();
      const createdAt = toDateSafe(data.createdAt) ?? new Date();
      const updatedAt = toDateSafe(data.updatedAt) ?? createdAt;
      loadedForm = {
        id: snap.id,
        ...data,
        createdAt,
        updatedAt,
      } as Form;
    }

    const availableVersions = getFormVersions(loadedForm);
    const candidateVersion =
      preferredVersionId ?? (prevFormId === formId ? prevActiveVersionId : ORIGINAL_VERSION_ID);
    const resolvedActiveVersionId = availableVersions.some((v) => v.id === candidateVersion)
      ? candidateVersion
      : ORIGINAL_VERSION_ID;

    set({ form: loadedForm, activeVersionId: resolvedActiveVersionId });
    await get().loadQuestions(formId);
    await get().loadSections(formId);
    set({ loading: false });
  },

  setActiveVersion: (versionId) => {
    const { allQuestions, allSections } = get();
    set({
      activeVersionId: versionId,
      questions: filterQuestionsByVersion(allQuestions, versionId),
      sections: filterSectionsByVersion(allSections, versionId),
    });
  },

  renameVersion: async (versionId, newLabel) => {
    const { form } = get();
    if (!form) return;
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    const nextVersions = getFormVersions(form).map((v) =>
      v.id === versionId ? { ...v, label: trimmed } : v
    );
    await get().updateForm({ versions: nextVersions });
  },

  deleteVersion: async (versionId) => {
    const { form, allQuestions, allSections, activeVersionId } = get();
    if (!form || versionId === ORIGINAL_VERSION_ID) return;

    const qsToDelete = allQuestions.filter((q) => normalizeVersionId(q.versionId) === versionId);
    const secsToDelete = allSections.filter((s) => normalizeVersionId(s.versionId) === versionId);

    await Promise.all([
      ...qsToDelete.map((q) => deleteDoc(doc(db, 'forms', form.id, 'questions', q.id))),
      ...secsToDelete.map((s) => deleteDoc(doc(db, 'forms', form.id, 'sections', s.id))),
    ]);

    const nextVersions = getFormVersions(form).filter((v) => v.id !== versionId);
    const nextAllQuestions = allQuestions.filter((q) => normalizeVersionId(q.versionId) !== versionId);
    const nextAllSections = allSections.filter((s) => normalizeVersionId(s.versionId) !== versionId);
    const nextActiveId = activeVersionId === versionId ? ORIGINAL_VERSION_ID : activeVersionId;

    clearPendingTouch(form.id);
    const now = Timestamp.now();
    await updateDoc(doc(db, 'forms', form.id), {
      versions: JSON.parse(JSON.stringify(nextVersions)),
      updatedAt: now,
    });

    set((s) => ({
      form: s.form ? { ...s.form, versions: nextVersions, updatedAt: now.toDate() } : null,
      allQuestions: nextAllQuestions,
      allSections: nextAllSections,
      activeVersionId: nextActiveId,
      questions: filterQuestionsByVersion(nextAllQuestions, nextActiveId),
      sections: filterSectionsByVersion(nextAllSections, nextActiveId),
    }));
  },

  loadQuestions: async (formId) => {
    const q = query(collection(db, 'forms', formId, 'questions'), orderBy('order', 'asc'));
    const snap = await getDocs(q);
    const allQuestions = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Question));
    const activeVersionId = get().activeVersionId;
    set({
      allQuestions,
      questions: filterQuestionsByVersion(allQuestions, activeVersionId),
    });
  },

  updateForm: async (updates) => {
    const { form } = get();
    if (!form) return;
    clearPendingTouch(form.id);
    const now = Timestamp.now();
    set({ form: { ...form, ...updates, updatedAt: now.toDate() } });
    const clean = JSON.parse(JSON.stringify(updates));
    await updateDoc(doc(db, 'forms', form.id), { ...clean, updatedAt: now });
  },

  addQuestion: async (type, initialUpdates) => {
    const { form, questions, allQuestions, activeVersionId } = get();
    if (!form) return;
    const defaultTitle =
      initialUpdates?.title ?? (type === 'multipleChoice' ? 'Opción múltiple' : 'Nueva pregunta');
    const newQuestion = {
      formId: form.id,
      versionId: activeVersionId,
      type,
      title: defaultTitle,
      description: initialUpdates?.description ?? '',
      required: initialUpdates?.required ?? false,
      order: initialUpdates?.order ?? questions.length,
      options:
        initialUpdates?.options ??
        (type === 'multipleChoice' || type === 'checkbox' || type === 'dropdown'
          ? [{ label: 'Opción 1' }]
          : []),
      settings: initialUpdates?.settings ?? {},
      conditions: initialUpdates?.conditions ?? null,
      sectionId: initialUpdates?.sectionId ?? null,
      ...(initialUpdates?.quizSettings ? { quizSettings: initialUpdates.quizSettings } : {}),
    };
    const cleanNewQuestion = JSON.parse(JSON.stringify(newQuestion));
    const docRef = await addDoc(collection(db, 'forms', form.id, 'questions'), cleanNewQuestion);
    const created = { id: docRef.id, ...cleanNewQuestion } as Question;
    const nextAllQuestions = [...allQuestions, created];
    set({
      allQuestions: nextAllQuestions,
      questions: filterQuestionsByVersion(nextAllQuestions, activeVersionId),
    });
    touchFormUpdatedAt(form.id, true);
  },

  updateQuestion: async (questionId, updates) => {
    const { form, activeVersionId } = get();
    if (!form) return;
    set((s) => {
      const nextAllQuestions = s.allQuestions.map((q) =>
        q.id === questionId ? { ...q, ...updates } : q
      );
      return {
        allQuestions: nextAllQuestions,
        questions: filterQuestionsByVersion(nextAllQuestions, activeVersionId),
      };
    });
    try {
      await updateDoc(
        doc(db, 'forms', form.id, 'questions', questionId),
        JSON.parse(JSON.stringify(updates))
      );
      touchFormUpdatedAt(form.id, false);
    } catch (e: any) {
      console.error('Error saving question:', e);
    }
  },

  removeQuestion: async (questionId) => {
    const { form, activeVersionId } = get();
    if (!form) return;
    await deleteDoc(doc(db, 'forms', form.id, 'questions', questionId));
    set((s) => {
      const nextAllQuestions = s.allQuestions.filter((q) => q.id !== questionId);
      return {
        allQuestions: nextAllQuestions,
        questions: filterQuestionsByVersion(nextAllQuestions, activeVersionId),
      };
    });
    touchFormUpdatedAt(form.id, true);
  },

  reorderQuestions: async (reorderedQuestions) => {
    const { form, allQuestions, activeVersionId } = get();
    if (!form) return;
    const orderMap = new Map(reorderedQuestions.map((q, i) => [q.id, i]));
    const batch = writeBatch(db);
    reorderedQuestions.forEach((q, i) => {
      batch.update(doc(db, 'forms', form.id, 'questions', q.id), { order: i });
    });
    await batch.commit();
    const nextAllQuestions = allQuestions.map((q) =>
      orderMap.has(q.id) ? { ...q, order: orderMap.get(q.id)! } : q
    );
    set({
      allQuestions: nextAllQuestions,
      questions: filterQuestionsByVersion(nextAllQuestions, activeVersionId),
    });
    touchFormUpdatedAt(form.id, true);
  },

  loadSections: async (formId) => {
    const q = query(collection(db, 'forms', formId, 'sections'), orderBy('order', 'asc'));
    const snap = await getDocs(q);
    const allSections = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Section));
    const activeVersionId = get().activeVersionId;
    set({
      allSections,
      sections: filterSectionsByVersion(allSections, activeVersionId),
    });
  },

  addSection: async () => {
    const { form, sections, allSections, activeVersionId } = get();
    if (!form) return;
    const newSection = {
      formId: form.id,
      versionId: activeVersionId,
      title: `Sección ${sections.length + 1}`,
      description: '',
      order: sections.length,
    };
    const docRef = await addDoc(collection(db, 'forms', form.id, 'sections'), newSection);
    const created = { id: docRef.id, ...newSection } as Section;
    const nextAllSections = [...allSections, created];
    set({
      allSections: nextAllSections,
      sections: filterSectionsByVersion(nextAllSections, activeVersionId),
    });
    touchFormUpdatedAt(form.id, true);
  },

  updateSection: async (sectionId, updates) => {
    const { form, activeVersionId } = get();
    if (!form) return;
    set((s) => {
      const nextAllSections = s.allSections.map((sec) =>
        sec.id === sectionId ? { ...sec, ...updates } : sec
      );
      return {
        allSections: nextAllSections,
        sections: filterSectionsByVersion(nextAllSections, activeVersionId),
      };
    });
    await updateDoc(doc(db, 'forms', form.id, 'sections', sectionId), updates);
    touchFormUpdatedAt(form.id, false);
  },

  removeSection: async (sectionId) => {
    const { form, allQuestions, activeVersionId } = get();
    if (!form) return;
    const batch = writeBatch(db);
    allQuestions
      .filter((q) => q.sectionId === sectionId)
      .forEach((q) => {
        batch.update(doc(db, 'forms', form.id, 'questions', q.id), { sectionId: null });
      });
    batch.delete(doc(db, 'forms', form.id, 'sections', sectionId));
    await batch.commit();
    set((s) => {
      const nextAllSections = s.allSections.filter((sec) => sec.id !== sectionId);
      const nextAllQuestions = s.allQuestions.map((q) =>
        q.sectionId === sectionId ? { ...q, sectionId: null } : q
      );
      return {
        allSections: nextAllSections,
        allQuestions: nextAllQuestions,
        sections: filterSectionsByVersion(nextAllSections, activeVersionId),
        questions: filterQuestionsByVersion(nextAllQuestions, activeVersionId),
      };
    });
    touchFormUpdatedAt(form.id, true);
  },

  moveQuestionToSection: async (questionId, sectionId) => {
    const { form, activeVersionId } = get();
    if (!form) return;
    await updateDoc(doc(db, 'forms', form.id, 'questions', questionId), { sectionId });
    set((s) => {
      const nextAllQuestions = s.allQuestions.map((q) =>
        q.id === questionId ? { ...q, sectionId } : q
      );
      return {
        allQuestions: nextAllQuestions,
        questions: filterQuestionsByVersion(nextAllQuestions, activeVersionId),
      };
    });
    touchFormUpdatedAt(form.id, true);
  },

  reorderSections: async (reorderedSections) => {
    const { form, allSections, activeVersionId } = get();
    if (!form) return;
    const orderMap = new Map(reorderedSections.map((sec, i) => [sec.id, i]));
    const batch = writeBatch(db);
    reorderedSections.forEach((sec, i) => {
      batch.update(doc(db, 'forms', form.id, 'sections', sec.id), { order: i });
    });
    await batch.commit();
    const nextAllSections = allSections.map((sec) =>
      orderMap.has(sec.id) ? { ...sec, order: orderMap.get(sec.id)! } : sec
    );
    set({
      allSections: nextAllSections,
      sections: filterSectionsByVersion(nextAllSections, activeVersionId),
    });
    touchFormUpdatedAt(form.id, true);
  },
  };
});
