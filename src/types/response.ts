export interface FormResponse {
  id: string;
  formId: string;
  respondentId: string | null;
  respondentEmail: string | null;
  answers: Record<string, any>;
  submittedAt: Date;
}
