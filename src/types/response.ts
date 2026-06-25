export interface RespondentInfo {
  name: string;
  email: string;
}

export interface FormResponse {
  id: string;
  formId: string;
  respondentId: string | null;
  respondentEmail: string | null;
  respondent?: RespondentInfo;
  answers: Record<string, any>;
  submittedAt: Date;
}
