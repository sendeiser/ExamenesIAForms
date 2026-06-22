import { db } from './firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  type FirestoreDataConverter,
} from 'firebase/firestore';
import type { Form } from '../types/form';
import type { Question, Section } from '../types/question';
import type { FormResponse } from '../types/response';

function formConverter(): FirestoreDataConverter<Form> {
  return {
    toFirestore(form: Form) {
      const { id, ...data } = form;
      return { ...data, createdAt: Timestamp.fromDate(form.createdAt), updatedAt: Timestamp.fromDate(form.updatedAt) };
    },
    fromFirestore(snapshot, options) {
      const data = snapshot.data(options);
      return {
        id: snapshot.id,
        ...data,
        createdAt: data.createdAt?.toDate() ?? new Date(),
        updatedAt: data.updatedAt?.toDate() ?? new Date(),
      } as Form;
    },
  };
}

export const formsRef = collection(db, 'forms').withConverter(formConverter());
export const formDoc = (id: string) => doc(db, 'forms', id).withConverter(formConverter());

export const questionsRef = (formId: string) =>
  collection(db, 'forms', formId, 'questions');

export const sectionsRef = (formId: string) =>
  collection(db, 'forms', formId, 'sections');

export const responsesRef = (formId: string) =>
  collection(db, 'forms', formId, 'responses');
