export type QuestionType =
  | 'text'
  | 'paragraph'
  | 'multipleChoice'
  | 'checkbox'
  | 'dropdown'
  | 'linearScale'
  | 'date'
  | 'time';

export interface OptionItem {
  label: string;
  imageUrl?: string;
}

export function toOptionItem(opt: string | OptionItem): OptionItem {
  return typeof opt === 'string' ? { label: opt } : opt;
}

export function cleanQuizSettingsOnOptionRemove(
  quizSettings: QuizQuestionSettings | undefined | null,
  removedLabel: string
): QuizQuestionSettings | undefined {
  if (!quizSettings) return undefined;
  const ca = quizSettings.correctAnswer;
  const next = Array.isArray(ca) ? ca.filter((v) => v !== removedLabel) : ca;
  return { ...quizSettings, correctAnswer: Array.isArray(next) && next.length > 0 ? next : null };
}

export interface QuestionCondition {
  enabled: boolean;
  questionId: string | null;
  operator: 'equals' | 'notEquals' | 'contains';
  value: string;
}

export interface QuestionSettings {
  rows?: number;
  min?: number;
  max?: number;
  step?: number;
  minLabel?: string;
  maxLabel?: string;
  imageUrl?: string;
}

export interface QuizQuestionSettings {
  correctAnswer: string | string[] | null;
  points: number;
}

export interface Question {
  id: string;
  formId: string;
  type: QuestionType;
  title: string;
  description: string;
  required: boolean;
  order: number;
  options: OptionItem[];
  settings: QuestionSettings;
  conditions: QuestionCondition | null;
  sectionId: string | null;
  quizSettings?: QuizQuestionSettings;
}

export interface Section {
  id: string;
  formId: string;
  title: string;
  description: string;
  order: number;
}
