import type { Form, FormVersion } from '../types/form';
import type { Question, Section } from '../types/question';
import type { FormResponse } from '../types/response';

export const ORIGINAL_VERSION_ID = 'original';
export const DEFAULT_ORIGINAL_LABEL = 'Tema 1 (Original)';

const ASSIGNED_VERSION_STORAGE_KEY = (formId: string) => `exam_assigned_version_${formId}`;

export function normalizeVersionId(versionId?: string | null): string {
  return versionId || ORIGINAL_VERSION_ID;
}

export function getFormVersions(
  form: Pick<Form, 'versions'> | null | undefined
): FormVersion[] {
  const raw = form?.versions;
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ id: ORIGINAL_VERSION_ID, label: DEFAULT_ORIGINAL_LABEL }];
  }

  const hasOriginal = raw.some((v) => v.id === ORIGINAL_VERSION_ID);
  if (hasOriginal) {
    return raw;
  }

  return [{ id: ORIGINAL_VERSION_ID, label: DEFAULT_ORIGINAL_LABEL }, ...raw];
}

export function hasMultipleVersions(
  form: Pick<Form, 'versions'> | null | undefined
): boolean {
  return getFormVersions(form).length > 1;
}

export function filterQuestionsByVersion(
  allQuestions: Question[],
  versionId?: string | null
): Question[] {
  const target = normalizeVersionId(versionId);
  return allQuestions
    .filter((q) => normalizeVersionId(q.versionId) === target)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function filterSectionsByVersion(
  allSections: Section[],
  versionId?: string | null
): Section[] {
  const target = normalizeVersionId(versionId);
  return allSections
    .filter((s) => normalizeVersionId(s.versionId) === target)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function getVersionLabel(
  form: Pick<Form, 'versions'> | null | undefined,
  versionId?: string | null,
  fallbackLabel?: string | null
): string {
  const target = normalizeVersionId(versionId);
  const found = getFormVersions(form).find((v) => v.id === target);
  if (found) return found.label;
  if (fallbackLabel?.trim()) return fallbackLabel.trim();
  return DEFAULT_ORIGINAL_LABEL;
}

export function getQuestionsForResponse(
  allQuestions: Question[],
  response: Pick<FormResponse, 'versionId' | 'answers'>
): Question[] {
  if (response.versionId) {
    const matched = filterQuestionsByVersion(allQuestions, response.versionId);
    if (matched.length > 0) return matched;
  }

  // Fallback para respuestas legadas o versiones renombradas: detectar qué versión coincide más con las respuestas
  const answeredIds = Object.keys(response.answers ?? {});
  if (answeredIds.length > 0) {
    const byVersion = new Map<string, Question[]>();
    for (const q of allQuestions) {
      const vid = normalizeVersionId(q.versionId);
      const list = byVersion.get(vid) ?? [];
      list.push(q);
      byVersion.set(vid, list);
    }

    let bestVersionQuestions: Question[] | null = null;
    let bestHits = 0;

    for (const list of byVersion.values()) {
      const hits = list.reduce((acc, q) => (q.id in (response.answers ?? {}) ? acc + 1 : acc), 0);
      if (hits > bestHits) {
        bestHits = hits;
        bestVersionQuestions = list;
      }
    }

    if (bestVersionQuestions && bestHits > 0) {
      return [...bestVersionQuestions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
  }

  return filterQuestionsByVersion(allQuestions, ORIGINAL_VERSION_ID);
}

export function pickAssignedVersionForStudent(
  form: Pick<Form, 'id' | 'versions'>,
  explicitVersionParam?: string | null
): FormVersion {
  const versions = getFormVersions(form);
  if (versions.length <= 1) {
    return versions[0];
  }

  const trimmed = explicitVersionParam?.trim();
  if (trimmed) {
    const byId = versions.find((v) => v.id === trimmed);
    if (byId) return byId;

    if (/^\d+$/.test(trimmed)) {
      const oneBased = Number(trimmed);
      if (oneBased >= 1 && oneBased <= versions.length) {
        return versions[oneBased - 1];
      }
    }

    const lowered = trimmed.toLowerCase();
    const byLabel = versions.find((v) => v.label.trim().toLowerCase() === lowered);
    if (byLabel) return byLabel;
  }

  try {
    const storedId = localStorage.getItem(ASSIGNED_VERSION_STORAGE_KEY(form.id));
    if (storedId) {
      const existing = versions.find((v) => v.id === storedId);
      if (existing) return existing;
    }
  } catch {
    // Continuar con asignación aleatoria si localStorage está bloqueado
  }

  const chosen = versions[Math.floor(Math.random() * versions.length)];
  try {
    localStorage.setItem(ASSIGNED_VERSION_STORAGE_KEY(form.id), chosen.id);
  } catch {
    // Ignorar error de almacenamiento
  }
  return chosen;
}

export function getVersionDirectCode(
  baseShortCode: string | undefined,
  versions: FormVersion[],
  versionId: string
): string {
  if (!baseShortCode) return '';
  const idx = versions.findIndex((v) => v.id === versionId);
  if (idx < 0) return baseShortCode;
  return `${baseShortCode}-${idx + 1}`;
}
