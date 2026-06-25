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
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  cardStyle?: 'shadow' | 'bordered' | 'flat';
  headerBgColor?: string;
  headerImageUrl?: string | null;
  headerFontFamily?: string;
  headerTextColor?: string;
  headerFontSize?: 'sm' | 'md' | 'lg' | 'xl';
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
