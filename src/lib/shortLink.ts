import { signInAnonymously } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type { Form } from '../types/form';

// Alfabeto sin caracteres ambiguos (0/O, 1/I/L) para dictar en pizarrón o escribir en netbooks
const SHORT_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateShortCode(length = 5): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += SHORT_CODE_ALPHABET[Math.floor(Math.random() * SHORT_CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeShortCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 12);
}

async function mirrorShortLinkDoc(code: string, formId: string) {
  try {
    await setDoc(doc(db, 'shortLinks', code), {
      formId,
      updatedAt: Timestamp.now(),
    });
  } catch {
    // Opcional si las reglas de Firestore aún no incluyen la colección shortLinks
  }
}

export async function ensureFormShortCode(form: Pick<Form, 'id' | 'shortCode'>): Promise<string> {
  if (form.shortCode && normalizeShortCode(form.shortCode).length >= 3) {
    return normalizeShortCode(form.shortCode);
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateShortCode(5);
    const snap = await getDocs(query(collection(db, 'forms'), where('shortCode', '==', candidate)));
    if (snap.empty) {
      await updateDoc(doc(db, 'forms', form.id), {
        shortCode: candidate,
        updatedAt: Timestamp.now(),
      });
      await mirrorShortLinkDoc(candidate, form.id);
      return candidate;
    }
  }

  const fallback = generateShortCode(6);
  await updateDoc(doc(db, 'forms', form.id), {
    shortCode: fallback,
    updatedAt: Timestamp.now(),
  });
  await mirrorShortLinkDoc(fallback, form.id);
  return fallback;
}

export async function updateFormShortCode(formId: string, rawCode: string): Promise<string> {
  const normalized = normalizeShortCode(rawCode);
  if (normalized.length < 3) {
    throw new Error('El código corto debe tener al menos 3 letras o números.');
  }

  const existing = await getDocs(
    query(collection(db, 'forms'), where('shortCode', '==', normalized))
  );
  const conflict = existing.docs.find((d) => d.id !== formId);
  if (conflict) {
    throw new Error(`El código "${normalized}" ya está siendo usado por otro examen.`);
  }

  await updateDoc(doc(db, 'forms', formId), {
    shortCode: normalized,
    updatedAt: Timestamp.now(),
  });
  await mirrorShortLinkDoc(normalized, formId);
  return normalized;
}

export interface ResolvedShortCode {
  formId: string;
  versionParam?: string;
}

async function lookupExactFormId(trimmed: string, normalized: string): Promise<string | null> {
  if (normalized) {
    try {
      const snap = await getDocs(
        query(collection(db, 'forms'), where('shortCode', '==', normalized))
      );
      if (!snap.empty) {
        return snap.docs[0].id;
      }
    } catch {
      // Si la consulta por colección falla por reglas, probar con shortLinks o ID directo
    }

    try {
      const linkSnap = await getDoc(doc(db, 'shortLinks', normalized));
      if (linkSnap.exists()) {
        const fid = linkSnap.data()?.formId;
        if (typeof fid === 'string' && fid) return fid;
      }
    } catch {
      // Ignorar si no existe o no hay permiso en shortLinks
    }
  }

  // Fallback por ID directo del examen (por si el alumno pegó o escribió el ID)
  try {
    const directSnap = await getDoc(doc(db, 'forms', trimmed));
    if (directSnap.exists()) {
      return directSnap.id;
    }
  } catch {
    // Ignorar
  }

  return null;
}

export async function resolveShortCodeTarget(rawCode: string): Promise<ResolvedShortCode | null> {
  const trimmed = rawCode.trim();
  if (!trimmed) return null;

  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch {
      // Continuar por si las reglas permiten lectura pública
    }
  }

  const normalized = normalizeShortCode(trimmed);
  const directId = await lookupExactFormId(trimmed, normalized);
  if (directId) {
    return { formId: directId };
  }

  // Soportar sufijo de tema directo, ej: MATE1-2 o ABCDE-T3
  if (normalized) {
    const versionMatch = /^([A-Z0-9-]+?)-T?(\d+)$/.exec(normalized);
    if (versionMatch) {
      const [, baseCode, versionParam] = versionMatch;
      const baseFormId = await lookupExactFormId(baseCode, baseCode);
      if (baseFormId) {
        return { formId: baseFormId, versionParam };
      }
    }
  }

  return null;
}

export async function resolveFormIdByShortCode(rawCode: string): Promise<string | null> {
  const resolved = await resolveShortCodeTarget(rawCode);
  return resolved?.formId ?? null;
}

/**
 * Genera una URL corta externa mediante is.gd o TinyURL cuando la web está publicada.
 */
export async function shortenExternalUrl(url: string): Promise<string> {
  if (/^https?:\/\/(localhost|127\.0\.0\.1|10\.|192\.168\.)/i.test(url)) {
    throw new Error(
      'Los acortadores externos (is.gd / TinyURL) solo funcionan cuando la web está publicada en un dominio público. En pruebas locales usa el código corto de 5 caracteres.'
    );
  }

  try {
    const res = await fetch(
      `https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`
    );
    if (res.ok) {
      const data = await res.json();
      if (typeof data?.shorturl === 'string' && data.shorturl) {
        return data.shorturl;
      }
      if (typeof data?.errormessage === 'string' && data.errormessage) {
        throw new Error(data.errormessage);
      }
    }
  } catch (err) {
    // Fallback a TinyURL si is.gd falla o bloquea CORS
    try {
      const tinyRes = await fetch(
        `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`
      );
      if (tinyRes.ok) {
        const shortText = (await tinyRes.text()).trim();
        if (/^https?:\/\//i.test(shortText)) {
          return shortText;
        }
      }
    } catch {
      // Continuar al error descriptivo
    }
    if (err instanceof Error && err.message) {
      throw new Error(`No se pudo acortar el enlace externamente (${err.message}). Puedes usar el link corto /e/CODIGO o el código de ingreso.`);
    }
  }

  throw new Error('El servicio externo no respondió. Usa el código corto del examen para ingresar desde netbooks.');
}
