export interface FormSettings {
  collectEmail: boolean;
  requireLogin: boolean;
  limitResponses: number | null;
  confirmationMessage: string;
  isQuiz: boolean;
}

export interface FormTheme {
  primaryColor: string;
  backgroundColor: string;
  fontFamily: string;
  showProgressBar: boolean;
}

export interface Form {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  settings: FormSettings;
  theme: FormTheme;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}
