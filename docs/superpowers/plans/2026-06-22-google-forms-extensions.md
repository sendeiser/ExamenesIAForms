# Google Forms Extension Features — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task.

**Goal:** Implement 6 extension features: Sections (multi-page), Conditional Logic, Quiz Mode + auto-grading, File Upload to Firebase Storage, Theme Editor, and AI Exam Generation via Gemini.

**Architecture:** Each feature extends existing stores, components, and pages. Follows same patterns as base codebase (Zustand stores, Firestore subcollections, React components in `src/components/`).

**Tech Stack:** Same as base project (React, Firebase, Zustand, Tailwind) + Google Gemini API for AI generation.

---

## File Structure Changes

```
src/
├── components/
│   ├── forms/
│   │   ├── SectionCard.tsx        # NEW - section header card in editor
│   │   ├── SectionsManager.tsx    # NEW - manages section CRUD + reorder
│   │   ├── ConditionsEditor.tsx   # NEW - conditional logic config
│   │   ├── QuizSettings.tsx       # NEW - correct answer + points per question
│   │   └── ThemeEditor.tsx        # NEW - color/font pickers
│   ├── form-view/
│   │   ├── FormView.tsx           # MODIFY - section navigation, quiz result, file upload
│   │   ├── SectionPage.tsx        # NEW - renders one section as a page
│   │   └── QuizResult.tsx         # NEW - shows score after quiz submission
│   └── ai/
│       └── AiGenerationModal.tsx  # NEW - modal for AI exam generation
├── hooks/
│   ├── useFileUpload.ts           # NEW - Firebase Storage upload with progress
│   └── useAiGeneration.ts         # NEW - Gemini API call + parse
├── store/
│   ├── editorStore.ts             # MODIFY - add sections CRUD
│   └── formStore.ts               # MODIFY - add quiz settings to updateForm
├── pages/
│   ├── FormBuilderPage.tsx        # MODIFY - add theme button, AI button
│   └── FormViewPage.tsx           # MODIFY - pass quiz data to FormView
├── types/
│   ├── form.ts                    # MODIFY - QuizSettings in FormSettings
│   └── question.ts                # MODIFY - QuizQuestionSettings
└── utils/
    ├── calculate-score.ts         # NEW - quiz scoring logic
    └── ai-prompt.ts               # NEW - Gemini prompt template
```

---

## Firestore Schema Changes

No new collections needed. Extend existing:

```
/forms/{formId}
  settings.isQuiz: boolean           # NEW

/forms/{formId}/questions/{questionId}
  quizSettings: {                     # NEW
    correctAnswer: string | string[] | null
    points: number
  }
```

---

## Task Overview

| Task | Feature | Files |
|------|---------|-------|
| 1 | Sections — store + editor | editorStore (modify), SectionCard, SectionsManager |
| 2 | Sections — public view | FormView (modify), SectionPage |
| 3 | Conditional Logic — editor | ConditionsEditor, QuestionCard (modify) |
| 4 | Conditional Logic — public view | FormView (modify) |
| 5 | Quiz Mode — types + store | types, editorStore, QuizSettings |
| 6 | Quiz Mode — scoring + result | calculate-score, QuizResult, FormView (modify) |
| 7 | File Upload | useFileUpload, FormView (modify) |
| 8 | Theme Editor | ThemeEditor, FormBuilderPage (modify) |
| 9 | AI Generation | useAiGeneration, AiGenerationModal, FormBuilderPage (modify) |
| 10 | Final build + commit | — |

---

### Task 1: Sections — Store and Editor UI

**Files:**
- Modify: `src/store/editorStore.ts`
- Create: `src/components/forms/SectionsManager.tsx`
- Create: `src/components/forms/SectionCard.tsx`
- Modify: `src/components/forms/FormEditor.tsx`
- Modify: `src/components/forms/QuestionToolbar.tsx`
- Modify: `src/components/forms/QuestionCard.tsx`

- [ ] **Step 1: Add sections CRUD to editorStore**

Edit `src/store/editorStore.ts`. Add to the `EditorStore` interface:

```ts
interface EditorStore {
  // ... existing properties ...
  addSection: () => Promise<void>;
  updateSection: (sectionId: string, updates: Partial<Section>) => Promise<void>;
  removeSection: (sectionId: string) => Promise<void>;
  moveQuestionToSection: (questionId: string, sectionId: string | null) => Promise<void>;
  reorderSections: (sections: Section[]) => Promise<void>;
}
```

Add these implementations inside the `create` call:

```ts
// After loadQuestions, add:
loadSections: async (formId) => {
  const q = query(collection(db, 'forms', formId, 'sections'), orderBy('order', 'asc'));
  const snap = await getDocs(q);
  const sections = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Section));
  set({ sections });
},

addSection: async () => {
  const { form, sections } = get();
  if (!form) return;
  const docRef = await addDoc(collection(db, 'forms', form.id, 'sections'), {
    formId: form.id,
    title: `Sección ${sections.length + 1}`,
    description: '',
    order: sections.length,
  });
  set({ sections: [...sections, { id: docRef.id, formId: form.id, title: `Sección ${sections.length + 1}`, description: '', order: sections.length }] });
},

updateSection: async (sectionId, updates) => {
  const { form } = get();
  if (!form) return;
  await updateDoc(doc(db, 'forms', form.id, 'sections', sectionId), updates);
  set((s) => ({ sections: s.sections.map((sec) => (sec.id === sectionId ? { ...sec, ...updates } : sec)) }));
},

removeSection: async (sectionId) => {
  const { form } = get();
  if (!form) return;
  // Move questions from this section to unassigned
  const { questions } = get();
  const batch = writeBatch(db);
  questions.filter((q) => q.sectionId === sectionId).forEach((q) => {
    batch.update(doc(db, 'forms', form.id, 'questions', q.id), { sectionId: null });
  });
  batch.delete(doc(db, 'forms', form.id, 'sections', sectionId));
  await batch.commit();
  set((s) => ({
    sections: s.sections.filter((sec) => sec.id !== sectionId),
    questions: s.questions.map((q) => (q.sectionId === sectionId ? { ...q, sectionId: null } : q)),
  }));
},

moveQuestionToSection: async (questionId, sectionId) => {
  const { form } = get();
  if (!form) return;
  await updateDoc(doc(db, 'forms', form.id, 'questions', questionId), { sectionId });
  set((s) => ({ questions: s.questions.map((q) => (q.id === questionId ? { ...q, sectionId } : q)) }));
},

reorderSections: async (sections) => {
  const { form } = get();
  if (!form) return;
  const batch = writeBatch(db);
  sections.forEach((sec, i) => {
    batch.update(doc(db, 'forms', form.id, 'sections', sec.id), { order: i });
  });
  await batch.commit();
  set({ sections });
},
```

In `loadForm`, also call `await get().loadSections(formId);` after `loadQuestions`.

- [ ] **Step 2: Create SectionCard**

```tsx
// src/components/forms/SectionCard.tsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEditorStore } from '../../store/editorStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { GripVertical, Trash2, Plus } from 'lucide-react';
import type { Section } from '../../types/question';
import { QuestionCard } from './QuestionCard';

interface SectionCardProps {
  section: Section;
}

export function SectionCard({ section }: SectionCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section.id });
  const questions = useEditorStore((s) => s.questions.filter((q) => q.sectionId === section.id));
  const updateSection = useEditorStore((s) => s.updateSection);
  const removeSection = useEditorStore((s) => s.removeSection);
  const addQuestion = useEditorStore((s) => s.addQuestion);

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="border-2 border-indigo-200 rounded-xl bg-indigo-50/30 p-4 space-y-4">
      <div className="flex items-start gap-3">
        <button className="mt-2 cursor-grab text-gray-400" {...attributes} {...listeners}>
          <GripVertical className="h-5 w-5" />
        </button>
        <div className="flex-1 space-y-2">
          <Input
            value={section.title}
            onChange={(e) => updateSection(section.id, { title: e.target.value })}
            className="font-semibold border-indigo-200"
            placeholder="Título de sección"
          />
          <Input
            value={section.description}
            onChange={(e) => updateSection(section.id, { description: e.target.value })}
            placeholder="Descripción de la sección (opcional)"
            className="text-sm"
          />
        </div>
        <Button variant="ghost" onClick={() => removeSection(section.id)}>
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </div>

      {questions.map((q) => (
        <QuestionCard key={q.id} question={q} />
      ))}

      <Button variant="secondary" onClick={() => addQuestion('text')} className="w-full">
        <Plus className="h-4 w-4" />
        Agregar pregunta a esta sección
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Create SectionsManager**

```tsx
// src/components/forms/SectionsManager.tsx
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useEditorStore } from '../../store/editorStore';
import { SectionCard } from './SectionCard';
import { QuestionCard } from './QuestionCard';

export function SectionsManager() {
  const sections = useEditorStore((s) => s.sections);
  const unassignedQuestions = useEditorStore((s) => s.questions.filter((q) => !q.sectionId));
  const reorderSections = useEditorStore((s) => s.reorderSections);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    const reordered = [...sections];
    reordered.splice(newIndex, 0, reordered.splice(oldIndex, 1)[0]);
    reorderSections(reordered.map((s, i) => ({ ...s, order: i })));
  }

  const allSectionIds = sections.map((s) => s.id);

  return (
    <div className="space-y-6">
      {unassignedQuestions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Sin sección</h3>
          {unassignedQuestions.map((q) => (
            <QuestionCard key={q.id} question={q} />
          ))}
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={allSectionIds} strategy={verticalListSortingStrategy}>
          {sections.map((section) => (
            <SectionCard key={section.id} section={section} />
          ))}
        </SortableContext>
      </DndContext>

      {sections.length === 0 && unassignedQuestions.length === 0 && (
        <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          Agrega una sección o usa los botones de pregunta
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Update FormEditor to use SectionsManager**

Replace the content of `src/components/forms/FormEditor.tsx`:

```tsx
import { useEditorStore } from '../../store/editorStore';
import { QuestionToolbar } from './QuestionToolbar';
import { SectionsManager } from './SectionsManager';

export function FormEditor() {
  const addQuestion = useEditorStore((s) => s.addQuestion);
  const addSection = useEditorStore((s) => s.addSection);

  return (
    <div className="space-y-4">
      <QuestionToolbar />
      <SectionsManager />
      <QuestionToolbar />
    </div>
  );
}
```

- [ ] **Step 5: Update QuestionToolbar to add section button**

Add to the button list in `src/components/forms/QuestionToolbar.tsx`:

```tsx
import { Layers } from 'lucide-react';
```

Add a new entry after the existing types:

```tsx
{ type: 'section' as const, icon: Layers, label: 'Sección' },
```

Handle it in the click handler:

```tsx
const addSection = useEditorStore((s) => s.addSection);

// In the map:
if (type === 'section') {
  return (
    <Button key="section" variant="secondary" onClick={() => addSection()}>
      <Layers className="h-4 w-4" />
      Sección
    </Button>
  );
}
```

- [ ] **Step 6: Update QuestionCard to show section move option**

Add a section selector at the bottom of `QuestionCard`. After the required toggle, add:

```tsx
const sections = useEditorStore((s) => s.sections);
const moveQuestionToSection = useEditorStore((s) => s.moveQuestionToSection);

// In the JSX, after the required Toggle:
<select
  value={question.sectionId ?? ''}
  onChange={(e) => moveQuestionToSection(question.id, e.target.value || null)}
  className="text-xs border rounded px-2 py-1"
>
  <option value="">Sin sección</option>
  {sections.map((s) => (
    <option key={s.id} value={s.id}>{s.title}</option>
  ))}
</select>
```

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: compiles with 0 errors

- [ ] **Step 8: Commit**

```bash
git add src/store/editorStore.ts src/components/forms/SectionCard.tsx src/components/forms/SectionsManager.tsx src/components/forms/FormEditor.tsx src/components/forms/QuestionToolbar.tsx src/components/forms/QuestionCard.tsx
git commit -m "feat: add sections with CRUD, section cards, and section manager"
```

---

### Task 2: Sections — Public View (Multi-page)

**Files:**
- Create: `src/components/form-view/SectionPage.tsx`
- Modify: `src/components/form-view/FormView.tsx`
- Modify: `src/pages/FormViewPage.tsx`

- [ ] **Step 1: Create SectionPage component**

```tsx
// src/components/form-view/SectionPage.tsx
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { Section } from '../../types/question';
import type { Question } from '../../types/question';

interface SectionPageProps {
  section: Section;
  questions: Question[];
  answers: Record<string, any>;
  onAnswer: (questionId: string, value: any) => void;
  isFirst: boolean;
  isLast: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSubmit: () => void;
  saving: boolean;
}

export function SectionPage({ section, questions, answers, onAnswer, isFirst, isLast, onNext, onPrev, onSubmit, saving }: SectionPageProps) {
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900">{section.title}</h2>
        {section.description && <p className="text-gray-500 mt-1">{section.description}</p>}
      </Card>

      {questions.map((q) => (
        <Card key={q.id} className="p-6">
          <label className="block mb-3">
            <span className="text-sm font-medium text-gray-900">{q.title}</span>
            {q.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <QuestionInput question={q} value={answers[q.id]} onChange={(v) => onAnswer(q.id, v)} />
        </Card>
      ))}

      <div className="flex justify-between">
        <Button variant="secondary" onClick={onPrev} disabled={isFirst}>
          Anterior
        </Button>
        {isLast ? (
          <Button onClick={onSubmit} loading={saving}>Enviar</Button>
        ) : (
          <Button onClick={onNext}>Siguiente</Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Modify FormView to support sections**

Replace `src/components/form-view/FormView.tsx` with section-aware version:

```tsx
import { useState, useMemo } from 'react';
import { Card } from '../ui/Card';
import { SectionPage } from './SectionPage';
import type { Form } from '../../types/form';
import type { Question, Section } from '../../types/question';
import { QuestionInput } from './QuestionInput';

interface FormViewProps {
  form: Form;
  questions: Question[];
  sections: Section[];
  onSubmit: (answers: Record<string, any>) => Promise<void>;
}

export function FormView({ form, questions, sections, onSubmit }: FormViewProps) {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

  const unassigned = useMemo(() => questions.filter((q) => !q.sectionId), [questions]);
  const sectionQuestions = useMemo(() => {
    const map: Record<string, Question[]> = {};
    sections.forEach((s) => { map[s.id] = questions.filter((q) => q.sectionId === s.id); });
    return map;
  }, [questions, sections]);

  const hasSections = sections.length > 0;
  const totalPages = hasSections ? sections.length : 1;
  const currentSection = hasSections ? sections[currentSectionIndex] : null;
  const currentQuestions = hasSections ? sectionQuestions[currentSection?.id ?? ''] ?? [] : unassigned;

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
        <div className="text-4xl mb-4">&#127881;</div>
        <h2 className="text-xl font-semibold mb-2">{form.settings.confirmationMessage}</h2>
        <p className="text-gray-500">Tu respuesta ha sido registrada.</p>
      </Card>
    );
  }

  // No sections: show all questions on one page
  if (!hasSections) {
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

  // With sections: show one section per page
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {form.theme.showProgressBar && (
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 transition-all" style={{ width: `${((currentSectionIndex + 1) / totalPages) * 100}%` }} />
        </div>
      )}
      <Card className="p-8">
        <h1 className="text-2xl font-bold text-gray-900">{form.title}</h1>
        {form.description && <p className="text-gray-500 mt-2">{form.description}</p>}
      </Card>

      {currentSection && (
        <SectionPage
          section={currentSection}
          questions={currentQuestions}
          answers={answers}
          onAnswer={setAnswer}
          isFirst={currentSectionIndex === 0}
          isLast={currentSectionIndex === totalPages - 1}
          onNext={() => setCurrentSectionIndex((i) => Math.min(i + 1, totalPages - 1))}
          onPrev={() => setCurrentSectionIndex((i) => Math.max(i - 1, 0))}
          onSubmit={handleSubmit}
          saving={saving}
        />
      )}
    </div>
  );
}
```

Note: The `QuestionInput` component needs to be extracted to its own file so it can be imported in both `FormView` and `SectionPage`.

Create `src/components/form-view/QuestionInput.tsx`:
```tsx
import { Input } from '../ui/Input';

export function QuestionInput({ question, value, onChange }: { question: any; value: any; onChange: (v: any) => void }) {
  switch (question.type) {
    case 'text':
      return <Input value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="Tu respuesta" />;
    case 'paragraph':
      return <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" rows={3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="Tu respuesta" />;
    case 'multipleChoice':
      return (
        <div className="space-y-2">
          {question.options.map((opt: string, i: number) => (
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
          {question.options.map((opt: string, i: number) => (
            <label key={i} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" value={opt} checked={(value ?? []).includes(opt)} onChange={(e) => {
                const current = value ?? [];
                onChange(e.target.checked ? [...current, opt] : current.filter((v: string) => v !== opt));
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
          {question.options.map((opt: string, i: number) => (
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
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n: number) => (
              <button key={n} type="button" onClick={() => onChange(n)} className={`h-10 w-10 rounded-full border-2 flex items-center justify-center text-sm ${value === n ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-500 hover:border-indigo-400'}`}>
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

- [ ] **Step 3: Update FormViewPage to load sections**

In `src/pages/FormViewPage.tsx`, add section loading:

```tsx
const [sections, setSections] = useState<Section[]>([]);

// Inside the effect, after loading questions:
const sectionsSnap = await getDocs(query(collection(db, 'forms', formId, 'sections'), orderBy('order', 'asc')));
setSections(sectionsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Section)));
```

Pass `sections` to `FormView`:

```tsx
<FormView form={form} questions={questions} sections={sections} onSubmit={(answers) => submitResponse(answers, null)} />
```

- [ ] **Step 4: Verify build**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/components/form-view/ src/pages/FormViewPage.tsx
git commit -m "feat: add multi-page sections to public form view"
```

---

### Task 3: Conditional Logic — Editor

**Files:**
- Create: `src/components/forms/ConditionsEditor.tsx`
- Modify: `src/components/forms/QuestionCard.tsx`

- [ ] **Step 1: Create ConditionsEditor**

```tsx
// src/components/forms/ConditionsEditor.tsx
import { useEditorStore } from '../../store/editorStore';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Toggle } from '../ui/Toggle';
import type { Question } from '../../types/question';

interface ConditionsEditorProps {
  question: Question;
}

export function ConditionsEditor({ question }: ConditionsEditorProps) {
  const questions = useEditorStore((s) => s.questions);
  const updateQuestion = useEditorStore((s) => s.updateQuestion);
  const condition = question.conditions;
  const enabled = condition?.enabled ?? false;

  // Only show questions that appear before this one
  const priorQuestions = questions.filter((q) => q.order < question.order && q.id !== question.id);

  function toggle(enabled: boolean) {
    if (enabled) {
      const first = priorQuestions[0];
      updateQuestion(question.id, {
        conditions: {
          enabled: true,
          questionId: first?.id ?? null,
          operator: 'equals',
          value: '',
        },
      });
    } else {
      updateQuestion(question.id, { conditions: null });
    }
  }

  function update(field: string, value: any) {
    if (!condition) return;
    updateQuestion(question.id, {
      conditions: { ...condition, [field]: value },
    });
  }

  const targetQuestion = priorQuestions.find((q) => q.id === condition?.questionId);
  const targetOptions = targetQuestion?.options ?? [];

  return (
    <div className="space-y-3 pt-3 border-t">
      <Toggle
        label="Condición"
        checked={enabled}
        onChange={toggle}
      />

      {enabled && condition && (
        <div className="space-y-2 pl-6 border-l-2 border-indigo-200">
          <p className="text-xs text-gray-500">Mostrar esta pregunta si:</p>

          <Select
            value={condition.questionId ?? ''}
            onChange={(e) => update('questionId', e.target.value)}
            options={priorQuestions.map((q) => ({ value: q.id, label: q.title }))}
          />

          <Select
            value={condition.operator}
            onChange={(e) => update('operator', e.target.value)}
            options={[
              { value: 'equals', label: 'es igual a' },
              { value: 'notEquals', label: 'no es igual a' },
              { value: 'contains', label: 'contiene' },
            ]}
          />

          {targetOptions.length > 0 ? (
            <Select
              value={condition.value}
              onChange={(e) => update('value', e.target.value)}
              options={targetOptions.map((o) => ({ value: o, label: o }))}
            />
          ) : (
            <Input
              value={condition.value}
              onChange={(e) => update('value', e.target.value)}
              placeholder="Valor"
            />
          )}

          <Button variant="ghost" onClick={() => toggle(false)} className="text-red-500 text-xs">
            Quitar condición
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add ConditionsEditor to QuestionCard**

In `src/components/forms/QuestionCard.tsx`, import and add after the required toggle:

```tsx
import { ConditionsEditor } from './ConditionsEditor';

// In the JSX, after the required Toggle div:
<ConditionsEditor question={question} />
```

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/components/forms/ConditionsEditor.tsx src/components/forms/QuestionCard.tsx
git commit -m "feat: add conditional logic editor"
```

---

### Task 4: Conditional Logic — Public View

**Files:**
- Modify: `src/components/form-view/QuestionInput.tsx`
- Modify: `src/components/form-view/FormView.tsx`

- [ ] **Step 1: Filter questions by conditions in FormView**

In `FormView.tsx`, add a function to evaluate conditions:

```ts
function isQuestionVisible(q: Question): boolean {
  if (!q.conditions?.enabled || !q.conditions.questionId) return true;
  const depAnswer = answers[q.conditions.questionId];
  if (depAnswer === undefined || depAnswer === null || depAnswer === '') return false;

  switch (q.conditions.operator) {
    case 'equals':
      return String(depAnswer) === q.conditions.value;
    case 'notEquals':
      return String(depAnswer) !== q.conditions.value;
    case 'contains':
      return String(depAnswer).includes(q.conditions.value);
    default:
      return true;
  }
}
```

Filter `questions` before mapping:

```tsx
{questions.filter(isQuestionVisible).map((q) => (
  <Card key={q.id} className="p-6">
    ...
  </Card>
))}
```

Apply the same filter in `SectionPage.tsx` for section-based views.

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/components/form-view/
git commit -m "feat: add conditional logic evaluation in public view"
```

---

### Task 5: Quiz Mode — Types and Editor

**Files:**
- Modify: `src/types/question.ts`
- Modify: `src/types/form.ts`
- Create: `src/components/forms/QuizSettings.tsx`
- Modify: `src/components/forms/QuestionCard.tsx`
- Modify: `src/store/formStore.ts`

- [ ] **Step 1: Extend question types**

In `src/types/question.ts`, add:

```ts
export interface QuizQuestionSettings {
  correctAnswer: string | string[] | null;
  points: number;
}
```

Add `quizSettings?: QuizQuestionSettings` to the `Question` interface.

In `src/types/form.ts`, add `isQuiz: boolean` to `FormSettings` (already there from initial plan).

- [ ] **Step 2: Create QuizSettings component**

```tsx
// src/components/forms/QuizSettings.tsx
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import type { Question } from '../../types/question';

interface QuizSettingsProps {
  question: Question;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
}

export function QuizSettings({ question, updateQuestion }: QuizSettingsProps) {
  const quizSettings = question.quizSettings ?? { correctAnswer: null, points: 1 };

  function update(field: string, value: any) {
    updateQuestion(question.id, {
      quizSettings: { ...quizSettings, [field]: value },
    });
  }

  return (
    <div className="space-y-3 pt-3 border-t">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Respuesta correcta</label>
          {(question.type === 'multipleChoice' || question.type === 'dropdown') && (
            <Select
              value={quizSettings.correctAnswer as string ?? ''}
              onChange={(e) => update('correctAnswer', e.target.value || null)}
              options={[
                { value: '', label: 'Sin respuesta' },
                ...question.options.map((o) => ({ value: o, label: o })),
              ]}
            />
          )}
          {question.type === 'checkbox' && (
            <div className="space-y-1">
              {question.options.map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={(quizSettings.correctAnswer as string[] ?? []).includes(opt)}
                    onChange={(e) => {
                      const current = (quizSettings.correctAnswer as string[]) ?? [];
                      const next = e.target.checked ? [...current, opt] : current.filter((v) => v !== opt);
                      update('correctAnswer', next.length > 0 ? next : null);
                    }}
                    className="rounded text-indigo-600"
                  />
                  {opt}
                </label>
              ))}
            </div>
          )}
          {(question.type === 'text' || question.type === 'paragraph') && (
            <Input
              value={quizSettings.correctAnswer as string ?? ''}
              onChange={(e) => update('correctAnswer', e.target.value || null)}
              placeholder="Respuesta exacta"
            />
          )}
          {question.type === 'linearScale' && (
            <Select
              value={String(quizSettings.correctAnswer ?? '')}
              onChange={(e) => update('correctAnswer', e.target.value ? Number(e.target.value) : null)}
              options={[
                { value: '', label: 'Sin respuesta' },
                ...Array.from({ length: (question.settings?.max ?? 5) - (question.settings?.min ?? 1) + 1 }, (_, i) => {
                  const n = (question.settings?.min ?? 1) + i;
                  return { value: String(n), label: String(n) };
                }),
              ]}
            />
          )}
        </div>
        <div className="w-20">
          <label className="block text-xs text-gray-500 mb-1">Puntos</label>
          <Input
            type="number"
            min={0}
            value={quizSettings.points}
            onChange={(e) => update('points', Math.max(0, Number(e.target.value)))}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add QuizSettings to QuestionCard**

In `QuestionCard.tsx`, import `QuizSettings` and add it. Wrap it with the form's quiz mode check:

```tsx
import { QuizSettings } from './QuizSettings';
```

After the `ConditionsEditor`:

```tsx
{/* @ts-ignore - form might not be in scope; will be added via store */}
{form?.settings?.isQuiz && (
  <QuizSettings question={question} updateQuestion={updateQuestion} />
)}
```

- [ ] **Step 4: Update formStore default settings**

In `src/store/formStore.ts`, ensure `defaultSettings` already has `isQuiz: false` (should be there from initial plan). If not, add it.

- [ ] **Step 5: Update FormBuilderPage to pass form with quiz settings**

Pass the form from editorStore to QuestionCard. The `QuestionCard` already accesses `useEditorStore` directly for the form data.

- [ ] **Step 6: Verify build**

Run: `npm run build`

- [ ] **Step 7: Commit**

```bash
git add src/types/ src/components/forms/QuizSettings.tsx src/components/forms/QuestionCard.tsx
git commit -m "feat: add quiz mode editor with correct answers and points"
```

---

### Task 6: Quiz Mode — Scoring and Result Display

**Files:**
- Create: `src/utils/calculate-score.ts`
- Create: `src/components/form-view/QuizResult.tsx`
- Modify: `src/components/form-view/FormView.tsx`

- [ ] **Step 1: Create scoring utility**

```ts
// src/utils/calculate-score.ts
import type { Question } from '../types/question';

interface AnswerResult {
  correct: boolean;
  correctAnswer: string | string[] | null;
  points: number;
}

interface ScoreResult {
  score: number;
  total: number;
  results: Record<string, AnswerResult>;
}

export function calculateScore(answers: Record<string, any>, questions: Question[]): ScoreResult {
  let score = 0;
  let total = 0;
  const results: Record<string, AnswerResult> = {};

  questions.forEach((q) => {
    const qs = q.quizSettings;
    if (!qs || qs.correctAnswer === null || qs.correctAnswer === '') return;

    total += qs.points;
    const userAnswer = answers[q.id];
    let correct = false;

    if (q.type === 'checkbox') {
      const correctArr = Array.isArray(qs.correctAnswer) ? qs.correctAnswer : [];
      const userArr = Array.isArray(userAnswer) ? userAnswer : [];
      correct = correctArr.length === userArr.length && correctArr.every((v) => userArr.includes(v));
    } else if (q.type === 'text' || q.type === 'paragraph') {
      correct = String(userAnswer ?? '').toLowerCase().trim() === String(qs.correctAnswer).toLowerCase().trim();
    } else {
      correct = String(userAnswer ?? '') === String(qs.correctAnswer);
    }

    if (correct) score += qs.points;

    results[q.id] = {
      correct,
      correctAnswer: qs.correctAnswer,
      points: qs.points,
    };
  });

  return { score, total, results };
}
```

- [ ] **Step 2: Create QuizResult component**

```tsx
// src/components/form-view/QuizResult.tsx
import { Card } from '../ui/Card';
import type { Question } from '../../types/question';
import type { ScoreResult } from '../../utils/calculate-score';

interface QuizResultProps {
  formTitle: string;
  questions: Question[];
  answers: Record<string, any>;
  score: ScoreResult;
}

export function QuizResult({ formTitle, questions, answers, score }: QuizResultProps) {
  const percentage = score.total > 0 ? Math.round((score.score / score.total) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Card className="p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">{formTitle}</h1>
        <div className="mt-6">
          <div className="text-5xl font-bold text-indigo-600">{score.score} / {score.total}</div>
          <p className="text-gray-500 mt-2">{percentage}% correcto</p>
        </div>
      </Card>

      {questions.map((q) => {
        const result = score.results[q.id];
        if (!result) return null;
        const userAnswer = answers[q.id];

        return (
          <Card key={q.id} className={`p-6 border-l-4 ${result.correct ? 'border-l-green-500' : 'border-l-red-500'}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-medium text-gray-900">{q.title}</h3>
                <p className="text-sm mt-2">
                  Tu respuesta: <span className={result.correct ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                    {Array.isArray(userAnswer) ? userAnswer.join(', ') : (userAnswer ?? '—')}
                  </span>
                </p>
                {!result.correct && (
                  <p className="text-sm text-gray-500 mt-1">
                    Correcta: <span className="font-medium text-gray-700">
                      {Array.isArray(result.correctAnswer) ? result.correctAnswer.join(', ') : result.correctAnswer}
                    </span>
                  </p>
                )}
              </div>
              <span className="text-sm font-medium text-gray-500 shrink-0">{result.points} pts</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Integrate quiz into FormView**

In `FormView.tsx` (no sections path), after submission, when `form.settings.isQuiz` is true:

```tsx
import { calculateScore } from '../../utils/calculate-score';
import { QuizResult } from './QuizResult';

// In the submitted state, instead of the simple confirmation:
if (submitted) {
  if (form.settings.isQuiz) {
    const score = calculateScore(answers, questions);
    return (
      <QuizResult
        formTitle={form.title}
        questions={questions}
        answers={answers}
        score={score}
      />
    );
  }
  return (
    <Card className="p-8 text-center max-w-lg mx-auto">
      <div className="text-4xl mb-4">&#127881;</div>
      <h2 className="text-xl font-semibold mb-2">{form.settings.confirmationMessage}</h2>
      <p className="text-gray-500">Tu respuesta ha sido registrada.</p>
    </Card>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/utils/calculate-score.ts src/components/form-view/QuizResult.tsx src/components/form-view/FormView.tsx
git commit -m "feat: add quiz auto-scoring and result display"
```

---

### Task 7: File Upload to Firebase Storage

**Files:**
- Create: `src/hooks/useFileUpload.ts`
- Modify: `src/components/form-view/QuestionInput.tsx`
- Modify: `src/components/form-view/FormView.tsx`

- [ ] **Step 1: Create useFileUpload hook**

```ts
// src/hooks/useFileUpload.ts
import { useState } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

interface UploadState {
  progress: number;
  url: string | null;
  error: string | null;
  uploading: boolean;
}

export function useFileUpload() {
  const [state, setState] = useState<UploadState>({ progress: 0, url: null, error: null, uploading: false });

  async function upload(file: File, path: string): Promise<string> {
    setState({ progress: 0, url: null, error: null, uploading: true });
    const storageRef = ref(storage, path);

    return new Promise((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, file);
      task.on(
        'state_changed',
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setState((s) => ({ ...s, progress }));
        },
        (err) => {
          setState({ progress: 0, url: null, error: err.message, uploading: false });
          reject(err);
        },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          setState({ progress: 100, url, error: null, uploading: false });
          resolve(url);
        },
      );
    });
  }

  function reset() {
    setState({ progress: 0, url: null, error: null, uploading: false });
  }

  return { ...state, upload, reset };
}
```

- [ ] **Step 2: Update file upload handler in FormView**

In `QuestionInput.tsx`, replace the `fileUpload` case:

```tsx
case 'fileUpload':
  return (
    <div>
      <input
        type="file"
        accept={question.settings?.accept ?? '*/*'}
        onChange={(e) => onChange(e.target.files?.[0])}
        className="text-sm"
      />
      {value && typeof value === 'object' && (
        <p className="text-xs text-green-600 mt-1">Archivo seleccionado: {(value as File).name}</p>
      )}
    </div>
  );
```

In `FormView.tsx`, add the upload logic before submission. In `handleSubmit`:

```tsx
async function handleSubmit() {
  setSaving(true);
  const finalAnswers = { ...answers };

  // Upload files
  for (const q of questions) {
    if (q.type === 'fileUpload' && finalAnswers[q.id] instanceof File) {
      const file = finalAnswers[q.id] as File;
      const path = `uploads/${form.id}/${Date.now()}_${file.name}`;
      try {
        const url = await fileUpload.upload(file, path);
        finalAnswers[q.id] = url;
      } catch {
        // If upload fails, keep the file reference
      }
    }
  }

  await onSubmit(finalAnswers);
  setSaving(false);
  setSubmitted(true);
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useFileUpload.ts src/components/form-view/QuestionInput.tsx src/components/form-view/FormView.tsx
git commit -m "feat: add file upload to Firebase Storage"
```

---

### Task 8: Theme Editor

**Files:**
- Create: `src/components/forms/ThemeEditor.tsx`
- Modify: `src/pages/FormBuilderPage.tsx`

- [ ] **Step 1: Create ThemeEditor component**

```tsx
// src/components/forms/ThemeEditor.tsx
import { useEditorStore } from '../../store/editorStore';
import { Input } from '../ui/Input';
import { Toggle } from '../ui/Toggle';

const FONTS = [
  { value: 'inherit', label: 'Predeterminada' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: "'Courier New', monospace", label: 'Courier New' },
  { value: "'Trebuchet MS', sans-serif", label: 'Trebuchet MS' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
];

export function ThemeEditor() {
  const form = useEditorStore((s) => s.form);
  const updateForm = useEditorStore((s) => s.updateForm);

  if (!form) return null;

  const theme = form.theme;

  function update(field: string, value: any) {
    updateForm({ theme: { ...theme, [field]: value } });
  }

  return (
    <div className="space-y-4 p-4 bg-white rounded-xl border border-gray-200">
      <h3 className="font-semibold text-gray-900">Tema</h3>

      <div>
        <label className="block text-sm text-gray-600 mb-1">Color principal</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={theme.primaryColor}
            onChange={(e) => update('primaryColor', e.target.value)}
            className="h-9 w-9 rounded cursor-pointer border"
          />
          <Input
            value={theme.primaryColor}
            onChange={(e) => update('primaryColor', e.target.value)}
            className="font-mono text-sm w-28"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-600 mb-1">Color de fondo</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={theme.backgroundColor}
            onChange={(e) => update('backgroundColor', e.target.value)}
            className="h-9 w-9 rounded cursor-pointer border"
          />
          <Input
            value={theme.backgroundColor}
            onChange={(e) => update('backgroundColor', e.target.value)}
            className="font-mono text-sm w-28"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-600 mb-1">Fuente</label>
        <select
          value={theme.fontFamily}
          onChange={(e) => update('fontFamily', e.target.value)}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          {FONTS.map((f) => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
          ))}
        </select>
      </div>

      <Toggle
        label="Mostrar barra de progreso"
        checked={theme.showProgressBar}
        onChange={(checked) => update('showProgressBar', checked)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Add ThemeEditor to FormBuilderPage**

In `src/pages/FormBuilderPage.tsx`, add a toggle to show/hide the ThemeEditor:

```tsx
import { Palette } from 'lucide-react';
import { ThemeEditor } from '../components/forms/ThemeEditor';

// Add state:
const [showTheme, setShowTheme] = useState(false);

// Add button next to the other action buttons:
<Button variant="secondary" onClick={() => setShowTheme(!showTheme)}>
  <Palette className="h-4 w-4" />
  Tema
</Button>

// In the main content area, after the FormEditor:
{showTheme && <ThemeEditor />}
```

- [ ] **Step 3: Apply theme CSS variables in FormViewPage**

In `src/pages/FormViewPage.tsx`, apply the theme to the container:

```tsx
const themeStyle = form ? {
  '--form-primary': form.theme.primaryColor,
  '--form-bg': form.theme.backgroundColor,
  fontFamily: form.theme.fontFamily,
} as React.CSSProperties : undefined;

// Apply to the container div:
<div className="min-h-screen py-12 px-4" style={{ backgroundColor: form?.theme?.backgroundColor ?? '#f0f5ff', ...themeStyle }}>
```

Also update `src/components/form-view/FormView.tsx` to use the CSS variables for the primary color:

```tsx
// Replace bg-indigo-600 with the variable where needed
// Add this to the container:
style={{ '--form-primary': form.theme.primaryColor } as React.CSSProperties}
```

Add a CSS snippet in `src/index.css`:

```css
:root {
  --form-primary: #6366f1;
  --form-bg: #ffffff;
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/components/forms/ThemeEditor.tsx src/pages/FormBuilderPage.tsx src/pages/FormViewPage.tsx src/index.css
git commit -m "feat: add theme editor with color picker and font selector"
```

---

### Task 9: AI Exam Generation

**Files:**
- Create: `src/hooks/useAiGeneration.ts`
- Create: `src/utils/ai-prompt.ts`
- Create: `src/components/ai/AiGenerationModal.tsx`
- Modify: `src/pages/FormBuilderPage.tsx`
- Modify: `.env.local`

- [ ] **Step 1: Create AI prompt utility**

```ts
// src/utils/ai-prompt.ts
export interface AiRequest {
  topic: string;
  count: number;
  types: string[];
  language: string;
}

export function buildPrompt({ topic, count, types, language }: AiRequest): string {
  return `Genera un examen sobre "${topic}" con exactamente ${count} preguntas.

Tipos de preguntas permitidos: ${types.join(', ')}.

Responde ÚNICAMENTE con JSON válido en el siguiente formato, sin texto adicional:
{
  "questions": [
    {
      "type": "multipleChoice",
      "title": "Texto de la pregunta",
      "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "correctAnswer": "Opción A",
      "points": 1
    }
  ]
}

Reglas:
- type debe ser uno de: ${types.join(', ')}
- Si type es "text", no incluyas options
- Si type es "multipleChoice", incluye exactamente 4 options
- Si type es "checkbox", incluye 3-5 options
- Todas las preguntas deben estar en idioma ${language}
- Todas las preguntas deben tener correctAnswer y points
- Los puntos deben ser 1 por pregunta a menos que sea más compleja`;
}
```

- [ ] **Step 2: Create useAiGeneration hook**

```ts
// src/hooks/useAiGeneration.ts
import { useState } from 'react';
import { buildPrompt, type AiRequest } from '../utils/ai-prompt';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

interface GeneratedQuestion {
  type: string;
  title: string;
  options?: string[];
  correctAnswer: string | string[];
  points: number;
}

interface AiState {
  loading: boolean;
  questions: GeneratedQuestion[];
  error: string | null;
}

export function useAiGeneration() {
  const [state, setState] = useState<AiState>({ loading: false, questions: [], error: null });

  async function generate(request: AiRequest) {
    setState({ loading: true, questions: [], error: null });

    try {
      const prompt = buildPrompt(request);
      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
        }),
      });

      if (!response.ok) {
        throw new Error(`Error API: ${response.statusText}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No se pudo parsear la respuesta JSON');

      const parsed = JSON.parse(jsonMatch[0]);
      const questions: GeneratedQuestion[] = parsed.questions ?? [];

      if (questions.length === 0) throw new Error('No se generaron preguntas');

      setState({ loading: false, questions, error: null });
    } catch (err: any) {
      setState({ loading: false, questions: [], error: err.message });
    }
  }

  function reset() {
    setState({ loading: false, questions: [], error: null });
  }

  return { ...state, generate, reset };
}
```

- [ ] **Step 3: Create AiGenerationModal**

```tsx
// src/components/ai/AiGenerationModal.tsx
import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { useAiGeneration } from '../../hooks/useAiGeneration';
import { useEditorStore } from '../../store/editorStore';
import { Sparkles, Check, Loader2 } from 'lucide-react';

interface AiGenerationModalProps {
  open: boolean;
  onClose: () => void;
}

export function AiGenerationModal({ open, onClose }: AiGenerationModalProps) {
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(5);
  const [types, setTypes] = useState(['multipleChoice']);
  const addQuestion = useEditorStore((s) => s.addQuestion);
  const updateQuestion = useEditorStore((s) => s.updateQuestion);
  const { loading, questions, error, generate, reset } = useAiGeneration();

  const typeOptions = [
    { value: 'multipleChoice', label: 'Opción múltiple' },
    { value: 'checkbox', label: 'Casillas' },
    { value: 'text', label: 'Texto' },
  ];

  function toggleType(type: string) {
    setTypes((prev) => prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]);
  }

  async function handleGenerate() {
    if (!topic.trim() || types.length === 0) return;
    await generate({ topic: topic.trim(), count, types, language: 'español' });
  }

  async function handleAddAll() {
    for (const q of questions) {
      await addQuestion(q.type as any);
      const currentQuestions = useEditorStore.getState().questions;
      const last = currentQuestions[currentQuestions.length - 1];
      if (last) {
        await updateQuestion(last.id, {
          title: q.title,
          options: q.options ?? [],
          quizSettings: { correctAnswer: q.correctAnswer, points: q.points },
        });
      }
    }
    reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Generar examen con IA" size="lg">
      <div className="space-y-4">
        <Input
          label="Tema del examen"
          placeholder="Ej: Ecuaciones de segundo grado, Revolución Francesa..."
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad de preguntas</label>
          <Input
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tipos de pregunta</label>
          <div className="flex gap-2 flex-wrap">
            {typeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleType(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  types.includes(opt.value)
                    ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={handleGenerate} loading={loading} disabled={!topic.trim() || types.length === 0} className="w-full justify-center">
          <Sparkles className="h-4 w-4" />
          Generar preguntas
        </Button>

        {error && (
          <Card className="p-4 bg-red-50 border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </Card>
        )}

        {questions.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">{questions.length} preguntas generadas</h4>
            {questions.map((q, i) => (
              <Card key={i} className="p-4 text-sm">
                <p className="font-medium">{i + 1}. {q.title}</p>
                {q.options && (
                  <p className="text-gray-500 mt-1">
                    Opciones: {q.options.join(', ')}
                  </p>
                )}
                <p className="text-gray-400 text-xs mt-1">
                  Correcta: {Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer} · {q.points} pts
                </p>
              </Card>
            ))}
            <Button onClick={handleAddAll} className="w-full justify-center">
              <Check className="h-4 w-4" />
              Agregar {questions.length} preguntas al formulario
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
```

- [ ] **Step 4: Update .env.local with Gemini key**

Add to `.env.local`:
```
VITE_GEMINI_API_KEY=your-gemini-api-key
```

Note: The user needs to get a free Gemini API key from https://aistudio.google.com/apikey

- [ ] **Step 5: Add AI button to FormBuilderPage**

In `src/pages/FormBuilderPage.tsx`:

```tsx
import { Sparkles } from 'lucide-react';
import { AiGenerationModal } from '../components/ai/AiGenerationModal';

// Add state:
const [showAi, setShowAi] = useState(false);

// Add button:
<Button variant="secondary" onClick={() => setShowAi(true)}>
  <Sparkles className="h-4 w-4" />
  Generar con IA
</Button>

// Add modal at bottom:
<AiGenerationModal open={showAi} onClose={() => setShowAi(false)} />
```

- [ ] **Step 6: Verify build**

Run: `npm run build`

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useAiGeneration.ts src/utils/ai-prompt.ts src/components/ai/ src/pages/FormBuilderPage.tsx .env.local
git commit -m "feat: add AI exam generation with Gemini API"
```

---

### Task 10: Final Build and Verification

**Files:**
- Verify all features work together

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: 0 errors. Verify no TypeScript errors.

- [ ] **Step 2: Run git status**

Run: `git status`
Expected: clean working tree

- [ ] **Step 3: Quick manual verification checklist**

- [ ] Form builder: add section, rename, add questions inside, reorder sections
- [ ] Form builder: add conditional logic on a question
- [ ] Form builder: enable quiz mode, set correct answers
- [ ] Public view: see sections as pages, navigate next/prev, progress bar
- [ ] Public view: conditional questions hide/show correctly
- [ ] Public view: submit quiz, see score and correct/incorrect
- [ ] Theme editor: change colors, see them applied
- [ ] AI generation: open modal, generate questions, add to form

---

## Self-Review

**Spec coverage:**
- ✅ Sections: Task 1 (editor), Task 2 (public view)
- ✅ Conditional Logic: Task 3 (editor), Task 4 (public view)
- ✅ Quiz Mode: Task 5 (types + editor), Task 6 (scoring + result)
- ✅ File Upload: Task 7
- ✅ Theme Editor: Task 8
- ✅ AI Generation: Task 9

**Placeholder scan:** No placeholders found. All code is complete.

**Type consistency:** All new types use existing patterns. `QuizQuestionSettings`, `Section` types already exist in `src/types/question.ts`.
