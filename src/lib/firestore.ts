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

function questionConverter(): FirestoreDataConverter<Question> {
  return {
    toFirestore(question: Question) {
      const { id, ...data } = question;
      return data;
    },
    fromFirestore(snapshot, options) {
      const data = snapshot.data(options);
      return { id: snapshot.id, ...data } as Question;
    },
  };
}

function sectionConverter(): FirestoreDataConverter<Section> {
  return {
    toFirestore(section: Section) {
      const { id, ...data } = section;
      return data;
    },
    fromFirestore(snapshot, options) {
      const data = snapshot.data(options);
      return { id: snapshot.id, ...data } as Section;
    },
  };
}

function responseConverter(): FirestoreDataConverter<FormResponse> {
  return {
    toFirestore(response: FormResponse) {
      const { id, ...data } = response;
      return { ...data, submittedAt: Timestamp.fromDate(response.submittedAt) };
    },
    fromFirestore(snapshot, options) {
      const data = snapshot.data(options);
      return { id: snapshot.id, ...data, submittedAt: data.submittedAt?.toDate() ?? new Date() } as FormResponse;
    },
  };
}

export const formsRef = collection(db, 'forms').withConverter(formConverter());
export const formDocRef = (id: string) => doc(db, 'forms', id).withConverter(formConverter());

export const questionsRef = (formId: string) =>
  collection(db, 'forms', formId, 'questions').withConverter(questionConverter());

export const sectionsRef = (formId: string) =>
  collection(db, 'forms', formId, 'sections').withConverter(sectionConverter());

export const responsesRef = (formId: string) =>
  collection(db, 'forms', formId, 'responses').withConverter(responseConverter());
