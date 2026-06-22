export type QuestionType =
  | 'text'
  | 'paragraph'
  | 'multipleChoice'
  | 'checkbox'
  | 'dropdown'
  | 'linearScale'
  | 'date'
  | 'time'
  | 'fileUpload';

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
  accept?: string;
  maxSize?: number;
}

export interface Question {
  id: string;
  formId: string;
  type: QuestionType;
  title: string;
  description: string;
  required: boolean;
  order: number;
  options: string[];
  settings: QuestionSettings;
  conditions: QuestionCondition | null;
  sectionId: string | null;
}

export interface Section {
  id: string;
  formId: string;
  title: string;
  description: string;
  order: number;
}
