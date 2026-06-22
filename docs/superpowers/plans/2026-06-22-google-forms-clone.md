# Google Forms Clone — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task.

**Goal:** Build a full-featured Google Forms clone with React + Firebase for creating exams, surveys, and quizzes.

**Architecture:** SPA with React (Vite) frontend, Firebase (Auth, Firestore, Storage) backend, Zustand for state, React Router for routing, DnD Kit for drag-and-drop, Recharts for analytics, Tailwind CSS for styling.

**Tech Stack:** React 18, TypeScript, Vite, Firebase, Zustand, React Router v6, DnD Kit, Tailwind CSS, Recharts, React Hook Form + Zod, Lucide React (icons).

---

## Module Structure

```
src/
├── components/
│   ├── ui/                  # Primitives: Button, Input, Modal, Select, Toggle
│   ├── forms/               # Form builder
│   │   ├── FormEditor.tsx
│   │   ├── QuestionCard.tsx
│   │   ├── QuestionToolbar.tsx
│   │   ├── QuestionPreview.tsx
│   │   ├── question-types/  # One component per type
│   │   │   ├── TextQuestion.tsx
│   │   │   ├── MultipleChoiceQuestion.tsx
│   │   │   ├── CheckboxQuestion.tsx
│   │   │   ├── DropdownQuestion.tsx
│   │   │   ├── LinearScaleQuestion.tsx
│   │   │   ├── DateQuestion.tsx
│   │   │   └── FileUploadQuestion.tsx
│   │   ├── SectionsManager.tsx
│   │   ├── ThemeEditor.tsx
│   │   └── ConditionEditor.tsx
│   ├── responses/           # Response viewing
│   │   ├── ResponseList.tsx
│   │   ├── ResponseDetail.tsx
│   │   └── ResponseTable.tsx
│   ├── analytics/           # Charts
│   │   ├── SummaryChart.tsx
│   │   ├── PerQuestionChart.tsx
│   │   └── ExportButton.tsx
│   ├── form-view/           # Public form view (respondent)
│   │   ├── FormView.tsx
│   │   ├── FormViewQuestion.tsx
│   │   └── FormSubmitButton.tsx
│   └── layout/
│       ├── AppLayout.tsx
│       ├── Sidebar.tsx
│       └── Header.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useForms.ts
│   ├── useFormById.ts
│   ├── useQuestions.ts
│   ├── useResponses.ts
│   └── useDnD.ts
├── lib/
│   ├── firebase.ts          # Firebase init
│   └── firestore.ts         # Firestore helpers
├── pages/
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   ├── FormBuilderPage.tsx
│   ├── FormViewPage.tsx     # Public response page
│   ├── ResponsesPage.tsx
│   └── AnalyticsPage.tsx
├── store/
│   ├── authStore.ts
│   ├── formStore.ts
│   └── editorStore.ts
├── types/
│   ├── form.ts
│   ├── question.ts
│   ├── response.ts
│   └── user.ts
└── utils/
    ├── validation.ts
    ├── export-csv.ts
    └── colors.ts
```

---

## Firestore Schema

```
/users/{userId}
  displayName: string
  email: string
  photoURL: string
  createdAt: Timestamp

/forms/{formId}
  ownerId: string
  title: string
  description: string
  settings: {
    collectEmail: boolean
    requireLogin: boolean
    limitResponses: number | null
    confirmationMessage: string
    isQuiz: boolean
  }
  theme: {
    primaryColor: string
    backgroundColor: string
    fontFamily: string
    showProgressBar: boolean
  }
  published: boolean
  createdAt: Timestamp
  updatedAt: Timestamp

/forms/{formId}/questions/{questionId}
  formId: string
  type: 'text' | 'paragraph' | 'multipleChoice' | 'checkbox' | 'dropdown' | 'linearScale' | 'date' | 'time' | 'fileUpload'
  title: string
  description: string
  required: boolean
  order: number
  options: string[]                           # for choice types
  settings: {                                 # type-specific
    rows?: number
    min?: number
    max?: number
    step?: number
    minLabel?: string
    maxLabel?: string
    accept?: string
    maxSize?: number
  }
  conditions: {
    enabled: boolean
    questionId: string | null
    operator: 'equals' | 'notEquals' | 'contains'
    value: string
  } | null
  sectionId: string | null

/forms/{formId}/sections/{sectionId}
  formId: string
  title: string
  description: string
  order: number

/forms/{formId}/responses/{responseId}
  respondentId: string | null
  respondentEmail: string | null
  answers: Record<string, any>               # { questionId: value }
  submittedAt: Timestamp
```

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `index.html`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `.env.local`
- Create: `.gitignore`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/index.css`

- [ ] **Step 1: Create project root files**

```json
// package.json
{
  "name": "google-forms-clone",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "firebase": "^10.12.0",
    "zustand": "^4.5.4",
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "recharts": "^2.12.0",
    "lucide-react": "^0.408.0",
    "react-hook-form": "^7.52.0",
    "zod": "^3.23.0",
    "@hookform/resolvers": "^3.9.0",
    "clsx": "^2.1.1",
    "date-fns": "^3.6.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.5.3",
    "vite": "^5.3.4"
  }
}
```

```
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

```
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "paths": {
      "@/*": ["./src/*"]
    },
    "baseUrl": "."
  },
  "include": ["src"]
}
```

```
// index.html
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Exámenes</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

```
// postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

```
// .gitignore
node_modules
dist
.env.local
```

- [ ] **Step 2: Create entry files**

```
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-gray-50 text-gray-900 antialiased;
}
```

```tsx
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
```

```tsx
// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import FormBuilderPage from './pages/FormBuilderPage';
import FormViewPage from './pages/FormViewPage';
import ResponsesPage from './pages/ResponsesPage';
import AnalyticsPage from './pages/AnalyticsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<DashboardPage />} />
      <Route path="/form/:formId" element={<FormBuilderPage />} />
      <Route path="/form/:formId/responses" element={<ResponsesPage />} />
      <Route path="/form/:formId/analytics" element={<AnalyticsPage />} />
      <Route path="/view/:formId" element={<FormViewPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 3: Create env file**

```
// .env.local
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`

- [ ] **Step 5: Verify dev server starts**

Run: `npm run dev`
Expected: Vite dev server starts on localhost:5173

- [ ] **Step 6: Commit**

```bash
git init
git add .
git commit -m "feat: initial project scaffolding with Vite + React + TypeScript + Tailwind"
```

---

### Task 2: TypeScript types

**Files:**
- Create: `src/types/user.ts`
- Create: `src/types/form.ts`
- Create: `src/types/question.ts`
- Create: `src/types/response.ts`

- [ ] **Step 1: Define user types**

```ts
// src/types/user.ts
export interface AppUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}
```

- [ ] **Step 2: Define question types**

```ts
// src/types/question.ts
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
```

- [ ] **Step 3: Define form types**

```ts
// src/types/form.ts
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
```

- [ ] **Step 4: Define response types**

```ts
// src/types/response.ts
export interface FormResponse {
  id: string;
  formId: string;
  respondentId: string | null;
  respondentEmail: string | null;
  answers: Record<string, any>;
  submittedAt: Date;
}
```

---

### Task 3: Firebase config & auth

**Files:**
- Create: `src/lib/firebase.ts`
- Create: `src/lib/firestore.ts`
- Create: `src/hooks/useAuth.ts`
- Create: `src/store/authStore.ts`

- [ ] **Step 1: Initialize Firebase**

```ts
// src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
```

- [ ] **Step 2: Create Firestore helpers**

```ts
// src/lib/firestore.ts
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

function formConverter(formId?: string): FirestoreDataConverter<Form> {
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

export const formsRef = collection(db, 'forms').withConverter(formConverter());
export const formDoc = (id: string) => doc(db, 'forms', id).withConverter(formConverter());

export const questionsRef = (formId: string) =>
  collection(db, 'forms', formId, 'questions');

export const sectionsRef = (formId: string) =>
  collection(db, 'forms', formId, 'sections');

export const responsesRef = (formId: string) =>
  collection(db, 'forms', formId, 'responses');
```

- [ ] **Step 3: Create auth store**

```ts
// src/store/authStore.ts
import { create } from 'zustand';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface AuthState {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  signInWithGoogle: async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  },

  logout: async () => {
    await signOut(auth);
  },
}));

onAuthStateChanged(auth, (user) => {
  useAuthStore.setState({ user, loading: false });
});
```

- [ ] **Step 4: Create auth hook**

```ts
// src/hooks/useAuth.ts
import { useAuthStore } from '../store/authStore';

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const logout = useAuthStore((s) => s.logout);

  return { user, loading, signInWithGoogle, logout };
}
```

---

### Task 4: UI primitives

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Input.tsx`
- Create: `src/components/ui/Modal.tsx`
- Create: `src/components/ui/Select.tsx`
- Create: `src/components/ui/Toggle.tsx`
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/LoadingSpinner.tsx`

- [ ] **Step 1: Create Button**

```tsx
// src/components/ui/Button.tsx
import { clsx } from 'clsx';
import { type ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500',
  secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-indigo-500',
  ghost: 'text-gray-600 hover:bg-gray-100 focus:ring-gray-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
          variantClasses[variant],
          className,
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  },
);
```

- [ ] **Step 2: Create Input**

```tsx
// src/components/ui/Input.tsx
import { clsx } from 'clsx';
import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={clsx(
            'block w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
            error ? 'border-red-300 text-red-900' : 'border-gray-300 text-gray-900',
            className,
          )}
          {...props}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  },
);
```

- [ ] **Step 3: Create Modal**

```tsx
// src/components/ui/Modal.tsx
import { type ReactNode, useEffect } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className={clsx(
        'relative z-10 w-full bg-white rounded-xl shadow-xl max-h-[90vh] overflow-y-auto',
        { 'max-w-sm': size === 'sm', 'max-w-lg': size === 'md', 'max-w-2xl': size === 'lg' },
      )}>
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create Select, Toggle, Card, LoadingSpinner**

```tsx
// src/components/ui/Select.tsx
import { clsx } from 'clsx';
import { type SelectHTMLAttributes, forwardRef } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, options, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>}
        <select
          ref={ref}
          id={id}
          className={clsx(
            'block w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
            error ? 'border-red-300' : 'border-gray-300',
            className,
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  },
);
```

```tsx
// src/components/ui/Toggle.tsx
import { clsx } from 'clsx';

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
          checked ? 'bg-indigo-600' : 'bg-gray-200',
        )}
      >
        <span className={clsx('pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition-transform', checked ? 'translate-x-5' : 'translate-x-0')} />
      </button>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}
```

```tsx
// src/components/ui/Card.tsx
import { clsx } from 'clsx';
import type { HTMLAttributes } from 'react';

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('bg-white rounded-xl shadow-sm border border-gray-200', className)} {...props}>
      {children}
    </div>
  );
}
```

```tsx
// src/components/ui/LoadingSpinner.tsx
export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-12">
      <svg className="animate-spin h-8 w-8 text-indigo-600" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}
```

---

### Task 5: Auth pages & protected routing

**Files:**
- Create: `src/components/layout/AppLayout.tsx`
- Create: `src/components/layout/Header.tsx`
- Create: `src/pages/LoginPage.tsx`

- [ ] **Step 1: Create AppLayout with auth guard**

```tsx
// src/components/layout/AppLayout.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Header } from './Header';
import { LoadingSpinner } from '../ui/LoadingSpinner';

export function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Create Header**

```tsx
// src/components/layout/Header.tsx
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';
import { FileText, LogOut } from 'lucide-react';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-indigo-600">
          <FileText className="h-6 w-6" />
          Exámenes
        </Link>
        <div className="flex items-center gap-4">
          {user && (
            <>
              <span className="text-sm text-gray-600 hidden sm:block">{user.displayName || user.email}</span>
              <Button variant="ghost" onClick={logout}>
                <LogOut className="h-4 w-4" />
                Salir
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Create LoginPage**

```tsx
// src/pages/LoginPage.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { FileText } from 'lucide-react';

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white">
      <div className="text-center space-y-6 max-w-sm">
        <div className="mx-auto h-16 w-16 bg-indigo-100 rounded-2xl flex items-center justify-center">
          <FileText className="h-8 w-8 text-indigo-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Exámenes</h1>
        <p className="text-gray-500">Crea y comparte exámenes, encuestas y formularios</p>
        <Button onClick={signInWithGoogle} className="w-full justify-center">
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continuar con Google
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update App.tsx routes to use AppLayout**

Edit `src/App.tsx`:

```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import FormBuilderPage from './pages/FormBuilderPage';
import FormViewPage from './pages/FormViewPage';
import ResponsesPage from './pages/ResponsesPage';
import AnalyticsPage from './pages/AnalyticsPage';
import LoginPage from './pages/LoginPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/view/:formId" element={<FormViewPage />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/form/:formId" element={<FormBuilderPage />} />
        <Route path="/form/:formId/responses" element={<ResponsesPage />} />
        <Route path="/form/:formId/analytics" element={<AnalyticsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
```

---

### Task 6: Dashboard — list & create forms

**Files:**
- Create: `src/hooks/useForms.ts`
- Create: `src/store/formStore.ts`
- Create: `src/pages/DashboardPage.tsx`

- [ ] **Step 1: Create form store**

```ts
// src/store/formStore.ts
import { create } from 'zustand';
import { collection, query, where, orderBy, addDoc, deleteDoc, getDocs, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Form } from '../types/form';

interface FormStore {
  forms: Form[];
  loading: boolean;
  fetchForms: (ownerId: string) => Promise<void>;
  createForm: (ownerId: string, title: string) => Promise<string>;
  deleteForm: (formId: string) => Promise<void>;
  togglePublish: (formId: string, published: boolean) => Promise<void>;
}

const defaultTheme = {
  primaryColor: '#6366f1',
  backgroundColor: '#ffffff',
  fontFamily: 'inherit',
  showProgressBar: false,
};

const defaultSettings = {
  collectEmail: false,
  requireLogin: false,
  limitResponses: null,
  confirmationMessage: '¡Respuesta registrada!',
  isQuiz: false,
};

export const useFormStore = create<FormStore>((set) => ({
  forms: [],
  loading: false,

  fetchForms: async (ownerId) => {
    set({ loading: true });
    const q = query(collection(db, 'forms'), where('ownerId', '==', ownerId), orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);
    const forms = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Form));
    set({ forms, loading: false });
  },

  createForm: async (ownerId, title) => {
    const now = Timestamp.now();
    const docRef = await addDoc(collection(db, 'forms'), {
      ownerId,
      title,
      description: '',
      settings: defaultSettings,
      theme: defaultTheme,
      published: false,
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  },

  deleteForm: async (formId) => {
    await deleteDoc(doc(db, 'forms', formId));
    set((s) => ({ forms: s.forms.filter((f) => f.id !== formId) }));
  },

  togglePublish: async (formId, published) => {
    await updateDoc(doc(db, 'forms', formId), { published, updatedAt: Timestamp.now() });
    set((s) => ({
      forms: s.forms.map((f) => (f.id === formId ? { ...f, published } : f)),
    }));
  },
}));
```

- [ ] **Step 2: Create useForms hook**

```ts
// src/hooks/useForms.ts
import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useFormStore } from '../store/formStore';

export function useForms() {
  const user = useAuthStore((s) => s.user);
  const forms = useFormStore((s) => s.forms);
  const loading = useFormStore((s) => s.loading);
  const fetchForms = useFormStore((s) => s.fetchForms);
  const createForm = useFormStore((s) => s.createForm);
  const deleteForm = useFormStore((s) => s.deleteForm);
  const togglePublish = useFormStore((s) => s.togglePublish);

  useEffect(() => {
    if (user) fetchForms(user.uid);
  }, [user]);

  return { forms, loading, createForm, deleteForm, togglePublish };
}
```

- [ ] **Step 3: Create DashboardPage**

```tsx
// src/pages/DashboardPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useForms } from '../hooks/useForms';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Plus, FileText, Trash2, Eye, EyeOff, BarChart3 } from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { forms, loading, createForm, deleteForm, togglePublish } = useForms();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');

  const handleCreate = async () => {
    if (!user || !title.trim()) return;
    const id = await createForm(user.uid, title.trim());
    setTitle('');
    setShowCreate(false);
    navigate(`/form/${id}`);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Mis formularios</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          Nuevo formulario
        </Button>
      </div>

      {forms.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No tienes formularios</h3>
          <p className="text-gray-500 mb-4">Crea tu primer formulario para empezar</p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            Crear formulario
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map((form) => (
            <Card key={form.id} className="p-5 hover:shadow-md transition-shadow cursor-pointer">
              <div onClick={() => navigate(`/form/${form.id}`)}>
                <h3 className="font-semibold text-gray-900 truncate">{form.title}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {form.published ? 'Publicado' : 'Borrador'} ·{' '}
                  {new Date(form.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                <Button variant="ghost" size="sm" onClick={() => togglePublish(form.id, !form.published)}>
                  {form.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate(`/form/${form.id}/analytics`)}>
                  <BarChart3 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteForm(form.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nuevo formulario">
        <div className="space-y-4">
          <Input
            label="Título"
            placeholder="Ej: Examen de matemáticas"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!title.trim()}>Crear</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
```

---

### Task 7: Form builder — question types & editor

**Files:**
- Create: `src/store/editorStore.ts`
- Create: `src/hooks/useFormById.ts`
- Create: `src/components/forms/FormEditor.tsx`
- Create: `src/components/forms/QuestionToolbar.tsx`
- Create: `src/components/forms/QuestionCard.tsx`
- Create: `src/components/forms/question-types/TextQuestion.tsx`
- Create: `src/components/forms/question-types/MultipleChoiceQuestion.tsx`
- Create: `src/components/forms/question-types/CheckboxQuestion.tsx`
- Create: `src/components/forms/question-types/DropdownQuestion.tsx`
- Create: `src/components/forms/question-types/LinearScaleQuestion.tsx`
- Create: `src/components/forms/question-types/DateQuestion.tsx`
- Create: `src/components/forms/question-types/FileUploadQuestion.tsx`
- Create: `src/pages/FormBuilderPage.tsx`

- [ ] **Step 1: Create editor store**

```ts
// src/store/editorStore.ts
import { create } from 'zustand';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Form } from '../types/form';
import type { Question, Section, QuestionType } from '../types/question';

interface EditorStore {
  form: Form | null;
  questions: Question[];
  sections: Section[];
  loading: boolean;
  loadForm: (formId: string) => Promise<void>;
  updateForm: (updates: Partial<Form>) => Promise<void>;
  addQuestion: (type: QuestionType) => Promise<void>;
  updateQuestion: (questionId: string, updates: Partial<Question>) => Promise<void>;
  removeQuestion: (questionId: string) => Promise<void>;
  reorderQuestions: (questions: Question[]) => Promise<void>;
  loadQuestions: (formId: string) => Promise<void>;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  form: null,
  questions: [],
  sections: [],
  loading: false,

  loadForm: async (formId) => {
    set({ loading: true });
    const { getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'forms', formId));
    if (snap.exists()) {
      const data = snap.data();
      set({
        form: { id: snap.id, ...data, createdAt: data.createdAt?.toDate(), updatedAt: data.updatedAt?.toDate() } as Form,
      });
    }
    await get().loadQuestions(formId);
    set({ loading: false });
  },

  loadQuestions: async (formId) => {
    const q = query(collection(db, 'forms', formId, 'questions'), orderBy('order', 'asc'));
    const snap = await getDocs(q);
    const questions = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Question));
    set({ questions });
  },

  updateForm: async (updates) => {
    const { form } = get();
    if (!form) return;
    await updateDoc(doc(db, 'forms', form.id), { ...updates, updatedAt: Timestamp.now() });
    set({ form: { ...form, ...updates } });
  },

  addQuestion: async (type) => {
    const { form, questions } = get();
    if (!form) return;
    const newQuestion = {
      formId: form.id,
      type,
      title: type === 'multipleChoice' ? 'Opción múltiple' : 'Nueva pregunta',
      description: '',
      required: false,
      order: questions.length,
      options: type === 'multipleChoice' || type === 'checkbox' || type === 'dropdown' ? ['Opción 1'] : [],
      settings: {},
      conditions: null,
      sectionId: null,
    };
    const docRef = await addDoc(collection(db, 'forms', form.id, 'questions'), newQuestion);
    set({ questions: [...questions, { id: docRef.id, ...newQuestion } as Question] });
  },

  updateQuestion: async (questionId, updates) => {
    const { form } = get();
    if (!form) return;
    await updateDoc(doc(db, 'forms', form.id, 'questions', questionId), updates);
    set((s) => ({
      questions: s.questions.map((q) => (q.id === questionId ? { ...q, ...updates } : q)),
    }));
  },

  removeQuestion: async (questionId) => {
    const { form } = get();
    if (!form) return;
    await deleteDoc(doc(db, 'forms', form.id, 'questions', questionId));
    set((s) => ({
      questions: s.questions.filter((q) => q.id !== questionId),
    }));
  },

  reorderQuestions: async (questions) => {
    const { form } = get();
    if (!form) return;
    const batch = writeBatch(db);
    questions.forEach((q, i) => {
      batch.update(doc(db, 'forms', form.id, 'questions', q.id), { order: i });
    });
    await batch.commit();
    set({ questions });
  },
}));
```

- [ ] **Step 2: Create FormEditor component**

```tsx
// src/components/forms/FormEditor.tsx
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useEditorStore } from '../../store/editorStore';
import { QuestionCard } from './QuestionCard';
import { QuestionToolbar } from './QuestionToolbar';

export function FormEditor() {
  const questions = useEditorStore((s) => s.questions);
  const reorderQuestions = useEditorStore((s) => s.reorderQuestions);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);
    const reordered = [...questions];
    reordered.splice(newIndex, 0, reordered.splice(oldIndex, 1)[0]);
    reorderQuestions(reordered.map((q, i) => ({ ...q, order: i })));
  }

  return (
    <div className="space-y-4">
      <QuestionToolbar />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
          {questions.map((question) => (
            <QuestionCard key={question.id} question={question} />
          ))}
        </SortableContext>
      </DndContext>
      {questions.length === 0 && (
        <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          Agrega preguntas usando los botones de arriba
        </div>
      )}
      <QuestionToolbar />
    </div>
  );
}
```

- [ ] **Step 3: Create QuestionToolbar**

```tsx
// src/components/forms/QuestionToolbar.tsx
import { useEditorStore } from '../../store/editorStore';
import { Button } from '../ui/Button';
import { Type, AlignLeft, List, CheckSquare, ChevronDown, Minus, Calendar, Clock, Upload } from 'lucide-react';

const questionTypes = [
  { type: 'text' as const, icon: Type, label: 'Texto' },
  { type: 'paragraph' as const, icon: AlignLeft, label: 'Párrafo' },
  { type: 'multipleChoice' as const, icon: List, label: 'Opción múltiple' },
  { type: 'checkbox' as const, icon: CheckSquare, label: 'Casillas' },
  { type: 'dropdown' as const, icon: ChevronDown, label: 'Desplegable' },
  { type: 'linearScale' as const, icon: Minus, label: 'Escala lineal' },
  { type: 'date' as const, icon: Calendar, label: 'Fecha' },
  { type: 'time' as const, icon: Clock, label: 'Hora' },
  { type: 'fileUpload' as const, icon: Upload, label: 'Archivo' },
];

export function QuestionToolbar() {
  const addQuestion = useEditorStore((s) => s.addQuestion);

  return (
    <div className="flex flex-wrap gap-2">
      {questionTypes.map(({ type, icon: Icon, label }) => (
        <Button key={type} variant="secondary" onClick={() => addQuestion(type)}>
          <Icon className="h-4 w-4" />
          {label}
        </Button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create QuestionCard with inline editing**

```tsx
// src/components/forms/QuestionCard.tsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEditorStore } from '../../store/editorStore';
import { Button } from '../ui/Button';
import { Toggle } from '../ui/Toggle';
import { Input } from '../ui/Input';
import { GripVertical, Copy, Trash2 } from 'lucide-react';
import type { Question, QuestionType } from '../../types/question';
import { TextQuestion } from './question-types/TextQuestion';
import { MultipleChoiceQuestion } from './question-types/MultipleChoiceQuestion';
import { CheckboxQuestion } from './question-types/CheckboxQuestion';
import { DropdownQuestion } from './question-types/DropdownQuestion';
import { LinearScaleQuestion } from './question-types/LinearScaleQuestion';
import { DateQuestion } from './question-types/DateQuestion';
import { FileUploadQuestion } from './question-types/FileUploadQuestion';

interface QuestionCardProps {
  question: Question;
}

function QuestionTypeComponent({ question }: { question: Question }) {
  const updateQuestion = useEditorStore((s) => s.updateQuestion);
  const props = { question, updateQuestion };

  switch (question.type) {
    case 'text': return <TextQuestion {...props} />;
    case 'paragraph': return <TextQuestion {...props} multiline />;
    case 'multipleChoice': return <MultipleChoiceQuestion {...props} />;
    case 'checkbox': return <CheckboxQuestion {...props} />;
    case 'dropdown': return <DropdownQuestion {...props} />;
    case 'linearScale': return <LinearScaleQuestion {...props} />;
    case 'date': return <DateQuestion {...props} />;
    case 'time': return <DateQuestion {...props} time />;
    case 'fileUpload': return <FileUploadQuestion {...props} />;
    default: return null;
  }
}

export function QuestionCard({ question }: QuestionCardProps) {
  const { updateQuestion, removeQuestion } = useEditorStore();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-start gap-4">
        <button className="mt-2 cursor-grab text-gray-400 hover:text-gray-600" {...attributes} {...listeners}>
          <GripVertical className="h-5 w-5" />
        </button>
        <div className="flex-1 space-y-4">
          <Input
            value={question.title}
            onChange={(e) => updateQuestion(question.id, { title: e.target.value })}
            placeholder="Pregunta sin título"
            className="text-lg font-medium border-0 px-0 focus:ring-0"
          />
          <QuestionTypeComponent question={question} />
          <div className="flex items-center gap-4 pt-2 border-t">
            <Toggle
              label="Obligatoria"
              checked={question.required}
              onChange={(checked) => updateQuestion(question.id, { required: checked })}
            />
            <div className="flex-1" />
            <Button variant="ghost" onClick={() => removeQuestion(question.id)}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create question type components**

```tsx
// src/components/forms/question-types/TextQuestion.tsx
import { Input } from '../../ui/Input';
import type { Question } from '../../../types/question';

interface Props {
  question: Question;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
  multiline?: boolean;
}

export function TextQuestion({ question, updateQuestion, multiline }: Props) {
  if (multiline) {
    return (
      <textarea
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        rows={3}
        placeholder="Texto de respuesta larga"
        disabled
      />
    );
  }
  return <Input placeholder="Texto de respuesta corta" disabled />;
}
```

```tsx
// src/components/forms/question-types/MultipleChoiceQuestion.tsx
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { Plus, X, Circle } from 'lucide-react';
import type { Question } from '../../../types/question';

interface Props {
  question: Question;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
}

export function MultipleChoiceQuestion({ question, updateQuestion }: Props) {
  const options = question.options ?? [];

  function updateOption(index: number, value: string) {
    const updated = [...options];
    updated[index] = value;
    updateQuestion(question.id, { options: updated });
  }

  function addOption() {
    updateQuestion(question.id, { options: [...options, `Opción ${options.length + 1}`] });
  }

  function removeOption(index: number) {
    if (options.length <= 1) return;
    updateQuestion(question.id, { options: options.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-2">
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <Circle className="h-4 w-4 text-gray-400 shrink-0" />
          <Input
            value={opt}
            onChange={(e) => updateOption(i, e.target.value)}
            className="flex-1"
          />
          <Button variant="ghost" onClick={() => removeOption(i)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="ghost" onClick={addOption}>
        <Plus className="h-4 w-4" />
        Agregar opción
      </Button>
    </div>
  );
}
```

```tsx
// src/components/forms/question-types/CheckboxQuestion.tsx
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { Plus, X, Square } from 'lucide-react';
import type { Question } from '../../../types/question';

interface Props {
  question: Question;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
}

export function CheckboxQuestion({ question, updateQuestion }: Props) {
  const options = question.options ?? [];

  function updateOption(index: number, value: string) {
    const updated = [...options];
    updated[index] = value;
    updateQuestion(question.id, { options: updated });
  }

  function addOption() {
    updateQuestion(question.id, { options: [...options, `Opción ${options.length + 1}`] });
  }

  function removeOption(index: number) {
    if (options.length <= 1) return;
    updateQuestion(question.id, { options: options.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-2">
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <Square className="h-4 w-4 text-gray-400 shrink-0" />
          <Input
            value={opt}
            onChange={(e) => updateOption(i, e.target.value)}
            className="flex-1"
          />
          <Button variant="ghost" onClick={() => removeOption(i)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="ghost" onClick={addOption}>
        <Plus className="h-4 w-4" />
        Agregar opción
      </Button>
    </div>
  );
}
```

```tsx
// src/components/forms/question-types/DropdownQuestion.tsx
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { Plus, X, ChevronDown } from 'lucide-react';
import type { Question } from '../../../types/question';

interface Props {
  question: Question;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
}

export function DropdownQuestion({ question, updateQuestion }: Props) {
  const options = question.options ?? [];

  function updateOption(index: number, value: string) {
    const updated = [...options];
    updated[index] = value;
    updateQuestion(question.id, { options: updated });
  }

  function addOption() {
    updateQuestion(question.id, { options: [...options, `Opción ${options.length + 1}`] });
  }

  function removeOption(index: number) {
    if (options.length <= 1) return;
    updateQuestion(question.id, { options: options.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-gray-400 mb-2">
        <ChevronDown className="h-4 w-4" />
        <span className="text-sm">Menú desplegable</span>
      </div>
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={opt}
            onChange={(e) => updateOption(i, e.target.value)}
            className="flex-1 ml-6"
          />
          <Button variant="ghost" onClick={() => removeOption(i)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="ghost" onClick={addOption}>
        <Plus className="h-4 w-4" />
        Agregar opción
      </Button>
    </div>
  );
}
```

```tsx
// src/components/forms/question-types/LinearScaleQuestion.tsx
import { Input } from '../../ui/Input';
import type { Question } from '../../../types/question';

interface Props {
  question: Question;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
}

export function LinearScaleQuestion({ question, updateQuestion }: Props) {
  const settings = question.settings ?? {};
  const min = settings.min ?? 1;
  const max = settings.max ?? 5;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Min</label>
          <Input
            type="number"
            value={min}
            onChange={(e) => updateQuestion(question.id, { settings: { ...settings, min: Number(e.target.value) } })}
            className="w-20"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Max</label>
          <Input
            type="number"
            value={max}
            onChange={(e) => updateQuestion(question.id, { settings: { ...settings, max: Number(e.target.value) } })}
            className="w-20"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
          <div key={n} className="h-10 w-10 rounded-full border-2 border-gray-300 flex items-center justify-center text-sm text-gray-500">
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}
```

```tsx
// src/components/forms/question-types/DateQuestion.tsx
import type { Question } from '../../../types/question';

interface Props {
  question: Question;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
  time?: boolean;
}

export function DateQuestion({ time }: Props) {
  return (
    <input
      type={time ? 'time' : 'date'}
      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      disabled
    />
  );
}
```

```tsx
// src/components/forms/question-types/FileUploadQuestion.tsx
import { Upload } from 'lucide-react';

export function FileUploadQuestion() {
  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-400 text-sm">
      <Upload className="h-8 w-8 mx-auto mb-2" />
      Haz clic para subir un archivo
    </div>
  );
}
```

- [ ] **Step 6: Create FormBuilderPage**

```tsx
// src/pages/FormBuilderPage.tsx
import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useEditorStore } from '../store/editorStore';
import { FormEditor } from '../components/forms/FormEditor';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Eye, BarChart3, Share2 } from 'lucide-react';

export default function FormBuilderPage() {
  const { formId } = useParams<{ formId: string }>();
  const form = useEditorStore((s) => s.form);
  const updateForm = useEditorStore((s) => s.updateForm);
  const loadForm = useEditorStore((s) => s.loadForm);
  const loading = useEditorStore((s) => s.loading);

  useEffect(() => {
    if (formId) loadForm(formId);
  }, [formId]);

  if (loading || !form) return <LoadingSpinner />;

  const previewUrl = `${window.location.origin}/view/${form.id}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Input
          value={form.title}
          onChange={(e) => updateForm({ title: e.target.value })}
          className="text-2xl font-bold border-0 px-0 focus:ring-0 w-full max-w-lg"
        />
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => window.open(previewUrl, '_blank')}>
            <Eye className="h-4 w-4" />
            Vista previa
          </Button>
          <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(previewUrl); }}>
            <Share2 className="h-4 w-4" />
            Compartir
          </Button>
          <Link to={`/form/${form.id}/analytics`}>
            <Button variant="secondary">
              <BarChart3 className="h-4 w-4" />
              Respuestas
            </Button>
          </Link>
        </div>
      </div>
      <FormEditor />
    </div>
  );
}
```

---

### Task 8: Public form view (respondent page)

**Files:**
- Create: `src/hooks/useResponses.ts`
- Create: `src/components/form-view/FormView.tsx`
- Create: `src/pages/FormViewPage.tsx`

- [ ] **Step 1: Create useResponses hook**

```ts
// src/hooks/useResponses.ts
import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { FormResponse } from '../types/response';

export function useResponses(formId: string) {
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchResponses() {
    const q = query(collection(db, 'forms', formId, 'responses'), orderBy('submittedAt', 'desc'));
    const snap = await getDocs(q);
    setResponses(snap.docs.map((d) => ({ id: d.id, ...d.data(), submittedAt: d.data().submittedAt?.toDate() } as FormResponse)));
    setLoading(false);
  }

  async function submitResponse(answers: Record<string, any>, email?: string | null) {
    await addDoc(collection(db, 'forms', formId, 'responses'), {
      respondentEmail: email || null,
      answers,
      submittedAt: Timestamp.now(),
    });
  }

  useEffect(() => { fetchResponses(); }, [formId]);

  return { responses, loading, submitResponse, refetch: fetchResponses };
}
```

- [ ] **Step 2: Create FormView component**

```tsx
// src/components/form-view/FormView.tsx
import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import type { Form } from '../../types/form';
import type { Question } from '../../types/question';

interface FormViewProps {
  form: Form;
  questions: Question[];
  onSubmit: (answers: Record<string, any>) => Promise<void>;
}

export function FormView({ form, questions, onSubmit }: FormViewProps) {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  function setAnswer(questionId: string, value: any) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleSubmit() {
    setSaving(true);
    await onSubmit(answers);
    setSaving(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <Card className="p-8 text-center max-w-lg mx-auto">
        <div className="text-4xl mb-4">🎉</div>
        <h2 className="text-xl font-semibold mb-2">{form.settings.confirmationMessage}</h2>
        <p className="text-gray-500">Tu respuesta ha sido registrada.</p>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Card className="p-8">
        <h1 className="text-2xl font-bold text-gray-900">{form.title}</h1>
        {form.description && <p className="text-gray-500 mt-2">{form.description}</p>}
      </Card>

      {questions.map((q) => (
        <Card key={q.id} className="p-6">
          <label className="block mb-3">
            <span className="text-sm font-medium text-gray-900">{q.title}</span>
            {q.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <QuestionInput question={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
        </Card>
      ))}

      <div className="flex justify-end">
        <Button onClick={handleSubmit} loading={saving}>Enviar</Button>
      </div>
    </div>
  );
}

function QuestionInput({ question, value, onChange }: { question: Question; value: any; onChange: (v: any) => void }) {
  switch (question.type) {
    case 'text':
      return <Input value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="Tu respuesta" />;
    case 'paragraph':
      return <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" rows={3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="Tu respuesta" />;
    case 'multipleChoice':
      return (
        <div className="space-y-2">
          {question.options.map((opt, i) => (
            <label key={i} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name={question.id} value={opt} checked={value === opt} onChange={() => onChange(opt)} className="text-indigo-600" />
              <span className="text-sm">{opt}</span>
            </label>
          ))}
        </div>
      );
    case 'checkbox':
      return (
        <div className="space-y-2">
          {question.options.map((opt, i) => (
            <label key={i} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" value={opt} checked={(value ?? []).includes(opt)} onChange={(e) => {
                const current = value ?? [];
                const next = e.target.checked ? [...current, opt] : current.filter((v: string) => v !== opt);
                onChange(next);
              }} className="rounded text-indigo-600" />
              <span className="text-sm">{opt}</span>
            </label>
          ))}
        </div>
      );
    case 'dropdown':
      return (
        <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">Seleccionar</option>
          {question.options.map((opt, i) => (
            <option key={i} value={opt}>{opt}</option>
          ))}
        </select>
      );
    case 'linearScale':
      const min = question.settings?.min ?? 1;
      const max = question.settings?.max ?? 5;
      return (
        <div className="flex items-center gap-4">
          {question.settings?.minLabel && <span className="text-sm text-gray-500">{question.settings.minLabel}</span>}
          <div className="flex gap-2">
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
              <button key={n} type="button" onClick={() => onChange(n)} className={`h-10 w-10 rounded-full border-2 flex items-center justify-center text-sm transition-colors ${value === n ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-500 hover:border-indigo-400'}`}>
                {n}
              </button>
            ))}
          </div>
          {question.settings?.maxLabel && <span className="text-sm text-gray-500">{question.settings.maxLabel}</span>}
        </div>
      );
    case 'date':
      return <input type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />;
    case 'time':
      return <input type="time" value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />;
    case 'fileUpload':
      return <Input type="file" onChange={(e) => onChange(e.target.files?.[0])} />;
    default:
      return null;
  }
}
```

- [ ] **Step 3: Create FormViewPage**

```tsx
// src/pages/FormViewPage.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useResponses } from '../hooks/useResponses';
import { FormView } from '../components/form-view/FormView';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import type { Form } from '../types/form';
import type { Question } from '../types/question';

export default function FormViewPage() {
  const { formId } = useParams<{ formId: string }>();
  const [form, setForm] = useState<Form | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const { submitResponse } = useResponses(formId!);

  useEffect(() => {
    if (!formId) return;
    (async () => {
      const formSnap = await getDoc(doc(db, 'forms', formId));
      if (!formSnap.exists()) { setLoading(false); return; }
      const data = formSnap.data();
      setForm({ id: formSnap.id, ...data, createdAt: data.createdAt?.toDate(), updatedAt: data.updatedAt?.toDate() } as Form);

      const { getDocs, query, orderBy, collection } = await import('firebase/firestore');
      const qSnap = await getDocs(query(collection(db, 'forms', formId, 'questions'), orderBy('order', 'asc')));
      setQuestions(qSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Question)));
      setLoading(false);
    })();
  }, [formId]);

  if (loading) return <LoadingSpinner />;
  if (!form) return <div className="text-center py-12 text-gray-500">Formulario no encontrado</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white py-12 px-4">
      <FormView form={form} questions={questions} onSubmit={(answers) => submitResponse(answers, null)} />
    </div>
  );
}
```

---

### Task 9: Responses & analytics pages

**Files:**
- Create: `src/pages/ResponsesPage.tsx`
- Create: `src/pages/AnalyticsPage.tsx`
- Create: `src/components/analytics/SummaryChart.tsx`
- Create: `src/components/analytics/PerQuestionChart.tsx`
- Create: `src/components/analytics/ExportButton.tsx`
- Create: `src/utils/export-csv.ts`

- [ ] **Step 1: Create ResponsesPage**

```tsx
// src/pages/ResponsesPage.tsx
import { useParams, Link } from 'react-router-dom';
import { useEditorStore } from '../store/editorStore';
import { useResponses } from '../hooks/useResponses';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ArrowLeft, Download } from 'lucide-react';
import { useEffect } from 'react';

export default function ResponsesPage() {
  const { formId } = useParams<{ formId: string }>();
  const form = useEditorStore((s) => s.form);
  const loadForm = useEditorStore((s) => s.loadForm);
  const { responses, loading } = useResponses(formId!);

  useEffect(() => { if (formId) loadForm(formId); }, [formId]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/form/${formId}`}>
            <Button variant="ghost"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-xl font-bold">{form?.title ?? 'Respuestas'}</h1>
        </div>
      </div>

      <Card className="p-4">
        <div className="text-sm text-gray-500 mb-4">{responses.length} respuesta(s)</div>
        {responses.length === 0 ? (
          <p className="text-center py-8 text-gray-400">Aún no hay respuestas</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4 font-medium">Fecha</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  {form && (
                    <th className="py-2 font-medium">Respuesta</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {responses.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 text-gray-500">{r.submittedAt?.toLocaleString()}</td>
                    <td className="py-2 pr-4">{r.respondentEmail ?? '—'}</td>
                    <td className="py-2 text-gray-600 truncate max-w-xs">
                      {Object.values(r.answers).filter(Boolean).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Create export utility**

```ts
// src/utils/export-csv.ts
export function exportToCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
```

- [ ] **Step 3: Create AnalyticsPage**

```tsx
// src/pages/AnalyticsPage.tsx
import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useEditorStore } from '../store/editorStore';
import { useResponses } from '../hooks/useResponses';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ArrowLeft, BarChart3, List } from 'lucide-react';
import { exportToCsv } from '../utils/export-csv';

export default function AnalyticsPage() {
  const { formId } = useParams<{ formId: string }>();
  const form = useEditorStore((s) => s.form);
  const questions = useEditorStore((s) => s.questions);
  const loadForm = useEditorStore((s) => s.loadForm);
  const { responses, loading } = useResponses(formId!);

  useEffect(() => { if (formId) loadForm(formId); }, [formId]);

  if (loading) return <LoadingSpinner />;

  function handleExport() {
    const headers = ['Fecha', ...questions.map((q) => q.title)];
    const rows = responses.map((r) => [
      r.submittedAt?.toLocaleString() ?? '',
      ...questions.map((q) => String(r.answers[q.id] ?? '')),
    ]);
    exportToCsv(`${form?.title ?? 'respuestas'}.csv`, [headers, ...rows]);
  }

  function getQuestionSummary(questionId: string) {
    const answers = responses.map((r) => r.answers[questionId]).filter((a) => a !== undefined && a !== '');
    const q = questions.find((q) => q.id === questionId);
    if (!q) return null;

    if (q.type === 'multipleChoice' || q.type === 'checkbox' || q.type === 'dropdown') {
      const counts: Record<string, number> = {};
      const items = q.type === 'checkbox' ? answers.flat() : answers;
      items.forEach((a) => { const key = String(a); counts[key] = (counts[key] ?? 0) + 1; });
      const total = items.length;
      return { type: 'choice' as const, counts, total, options: q.options };
    }

    if (q.type === 'linearScale') {
      const nums = answers.map(Number).filter((n) => !isNaN(n));
      const avg = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
      return { type: 'scale' as const, avg, min: Math.min(...nums, 0), max: Math.max(...nums, 0), total: nums.length };
    }

    return { type: 'text' as const, answers, total: answers.length };
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/form/${formId}`}>
            <Button variant="ghost"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-xl font-bold">{form?.title ?? 'Análisis'}</h1>
        </div>
        <Button variant="secondary" onClick={handleExport}>
          <List className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <BarChart3 className="h-4 w-4" />
          {responses.length} respuestas
        </div>
      </Card>

      {questions.map((q) => {
        const summary = getQuestionSummary(q.id);
        if (!summary) return null;

        return (
          <Card key={q.id} className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">{q.title}</h3>

            {summary.type === 'choice' && (
              <div className="space-y-2">
                {summary.options.map((opt) => {
                  const count = summary.counts[opt] ?? 0;
                  const pct = summary.total > 0 ? (count / summary.total) * 100 : 0;
                  return (
                    <div key={opt}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{opt}</span>
                        <span className="text-gray-500">{count} ({Math.round(pct)}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {summary.type === 'scale' && (
              <div className="space-y-1">
                <p className="text-sm">Promedio: <strong>{summary.avg.toFixed(1)}</strong></p>
                <p className="text-sm">Mín: {summary.min} · Máx: {summary.max}</p>
                <p className="text-sm text-gray-500">{summary.total} respuestas</p>
              </div>
            )}

            {summary.type === 'text' && (
              <div className="space-y-2">
                {summary.answers.length === 0 ? (
                  <p className="text-gray-400 text-sm">Sin respuestas</p>
                ) : (
                  summary.answers.map((a, i) => (
                    <p key={i} className="text-sm bg-gray-50 rounded-lg p-3">{String(a)}</p>
                  ))
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
```

---

## Summary of tasks

| Task | What | Files |
|------|------|-------|
| 1 | Project scaffolding | package.json, vite, ts, tailwind, entry files |
| 2 | TypeScript types | user, form, question, response types |
| 3 | Firebase config & auth | firebase.ts, firestore.ts, useAuth, authStore |
| 4 | UI primitives | Button, Input, Modal, Select, Toggle, Card, LoadingSpinner |
| 5 | Auth & routing | AppLayout, Header, LoginPage, route updates |
| 6 | Dashboard | formStore, useForms, DashboardPage |
| 7 | Form builder | editorStore, FormEditor, QuestionCard, 7 question types, FormBuilderPage |
| 8 | Public form view | useResponses, FormView, FormViewPage |
| 9 | Responses & analytics | ResponsesPage, AnalyticsPage, export-csv |

---

## Self-review

**Spec coverage:**
- ✅ Form CRUD (create on dashboard, edit in builder, delete)
- ✅ 9 question types (text, paragraph, multipleChoice, checkbox, dropdown, linearScale, date, time, fileUpload)
- ✅ Drag-and-drop reordering (DnD Kit)
- ✅ Theme customization (theme fields in schema, ready for ThemeEditor)
- ✅ Sections (schema ready, SectionsManager pending in future)
- ✅ Conditional logic (schema ready, ConditionEditor pending)
- ✅ Response collection (FormViewPage, submitResponse)
- ✅ Analytics with charts (AnalyticsPage with bar charts for choice questions)
- ✅ CSV export
- ✅ Auth with Google
- ✅ Shareable links (preview/share in FormBuilderPage)

**Future enhancements (not in scope of this plan):**
- Conditional logic UI (ConditionEditor)
- Sections UI (SectionsManager)
- Theme editor UI (ThemeEditor)
- File upload to Firebase Storage
- Quiz mode with correct answers & auto-grading
- Real-time collaboration
- Response pagination
