export interface RespondentInfo {
  name: string;
  email: string;
}

export type ProcedureValidationStatus = 'validated' | 'rejected';

export interface FormResponse {
  id: string;
  formId: string;
  respondentId: string | null;
  respondentEmail: string | null;
  respondent?: RespondentInfo;
  answers: Record<string, any>;
  procedurePhotos?: Record<string, string[]>;
  procedureValidations?: Record<string, ProcedureValidationStatus>;
  scoreOverride?: number | null;
  gradeOverride?: number | null;
  submittedAt: Date;
}
