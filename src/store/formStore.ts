import { create } from 'zustand';
import { collection, query, where, orderBy, addDoc, deleteDoc, getDocs, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Form } from '../types/form';

interface FormStore {
  forms: Form[];
  loading: boolean;
  fetchForms: (ownerId: string) => Promise<void>;
  createForm: (ownerId: string, title: string) => Promise<string>;
  deleteForm: (formId: string) => Promise<void>;
  togglePublish: (formId: string, published: boolean) => Promise<void>;
}

const defaultTheme = {
  primaryColor: '#6366f1',
  backgroundColor: '#ffffff',
  fontFamily: 'inherit',
  showProgressBar: false,
};

const defaultSettings = {
  collectEmail: false,
  requireLogin: false,
  limitResponses: null,
  confirmationMessage: '¡Respuesta registrada!',
  isQuiz: false,
  securityEnabled: false,
  maxViolations: 3,
  fullscreen: true,
  disableCopy: true,
  preventTabSwitch: true,
};

export const useFormStore = create<FormStore>((set) => ({
  forms: [],
  loading: false,

  fetchForms: async (ownerId) => {
    set({ loading: true });
    const q = query(collection(db, 'forms'), where('ownerId', '==', ownerId), orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);
    const forms = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Form));
    set({ forms, loading: false });
  },

  createForm: async (ownerId, title) => {
    const now = Timestamp.now();
    const docRef = await addDoc(collection(db, 'forms'), {
      ownerId,
      title,
      description: '',
      settings: defaultSettings,
      theme: defaultTheme,
      published: false,
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  },

  deleteForm: async (formId) => {
    await deleteDoc(doc(db, 'forms', formId));
    set((s) => ({ forms: s.forms.filter((f) => f.id !== formId) }));
  },

  togglePublish: async (formId, published) => {
    await updateDoc(doc(db, 'forms', formId), { published, updatedAt: Timestamp.now() });
    set((s) => ({
      forms: s.forms.map((f) => (f.id === formId ? { ...f, published } : f)),
    }));
  },
}));
