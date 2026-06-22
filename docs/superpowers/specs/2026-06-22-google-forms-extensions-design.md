# Google Forms Clone — Extension Features Design

> Design document for 6 extension features: Sections, Conditional Logic, Quiz Mode, File Upload, Theme Editor, AI Generation.

**Architecture:** All features extend the existing React + Firebase codebase. New UI components in `src/components/`, new or extended stores, new API route/utility for AI.

---

## 1. Sections (Multi-page Forms)

### Data Model (already in Firestore schema)
Sections stored as `/forms/{formId}/sections/{sectionId}`:
- `id`, `formId`, `title`, `description`, `order`

Questions have `sectionId: string | null`. Questions without a section belong to a default section.

### Editor UI
- **Section divider** rendered between groups of questions in `FormEditor`
- Each section shows:
  - A **card header** with editable title + description
  - **Add question here** button at bottom
  - **Drag handle** to reorder sections
- New button **"Agregar sección"** in `QuestionToolbar`
- "Unassigned" questions shown at the top before any section

### Public View UI
- Sections rendered as **pages** with "Siguiente" / "Anterior" navigation
- **Progress bar** at top (configurable via form theme)
- Section title + description shown at top of each page
- Validation per-section: can't advance if required questions are unanswered

### Store Changes
- `editorStore` gains `addSection()`, `updateSection()`, `removeSection()`, `moveQuestionToSection()`
- `sections` loaded alongside questions from Firestore

---

## 2. Conditional Logic

### Data Model (already in Firestore schema)
Questions have `conditions: { enabled, questionId, operator, value } | null`

Operators: `equals`, `notEquals`, `contains`

### Editor UI
- **"Agregar condición"** toggle at bottom of each `QuestionCard`
- When enabled, shows:
  - Select: "Si la pregunta..." (dropdown of all prior questions)
  - Select: "...es igual a / no es igual a / contiene"
  - Input: valor a comparar
- Conditions reference only **questions that appear before** the current one

### Public View UI
- On answer change, evaluate all dependent questions
- Show/hide questions with smooth transition
- Required validation is skipped for hidden questions

### Store Changes
- No new store needed. The `updateQuestion` method already handles `conditions`.

---

## 3. Quiz Mode

### Data Model
Form settings gains: `isQuiz: boolean`
Questions gain `quizSettings: { correctAnswer: string | string[] | null, points: number }`

### Editor UI
- Toggle **"Modo examen"** in form settings (already in schema)
- When enabled, each question shows additional fields:
  - **"Respuesta correcta"** — select/input depending on question type
  - **"Puntos"** — number input (default: 1)
- For `multipleChoice`/`checkbox`/`dropdown`: select from existing options
- For `text`/`paragraph`: text input for correct answer
- For `linearScale`: pick the correct number

### Public View UI
- After submission, show quiz result page instead of simple confirmation:
  - Score: `X / Y` puntos
  - Per-question: correct/incorrect indicator, correct answer shown
  - Timer (optional future feature)

### Backend Logic
- `calculateScore(answers, questions)` utility:
  - Compares each answer to `quizSettings.correctAnswer`
  - Returns `{ score, total, results: { questionId: { correct, correctAnswer, points } } }`
- Called client-side after form submission when `isQuiz` is true

---

## 4. File Upload to Firebase Storage

### Data Flow
1. User uploads file via `fileUpload` question in public form view
2. File uploaded to `gs://examenes-form.appspot.com/uploads/{formId}/{responseId}/{fileName}`
3. Firebase Storage returns download URL
4. URL stored in response answers
5. Responses page shows download links

### Editor UI
- `FileUploadQuestion` gains settings:
  - Accepted file types (e.g., `.pdf,.jpg,.png`)
  - Max file size (MB)

### Public View UI
- File input with drag-and-drop zone
- Upload progress bar
- Preview for images
- Upload happens **before** form submission, URL stored in answers state

### Store Changes
- New hook: `useFileUpload()` — handles upload, progress tracking, cancel

---

## 5. Theme Editor

### Data Model (already in Firestore schema)
Form theme: `{ primaryColor, backgroundColor, fontFamily, showProgressBar }`

### Editor UI
- **Panel lateral** o modal en `FormBuilderPage`
- Color pickers for `primaryColor` and `backgroundColor`
- Font selector (dropdown: system fonts + Google Fonts subset)
- Toggle: `showProgressBar`
- Preview panel showing a sample question with current theme applied

### Public View UI
- CSS custom properties applied to form container:
  ```css
  --form-primary: {form.theme.primaryColor}
  --form-bg: {form.theme.backgroundColor}
  ```
- Tailwind classes swapped dynamically based on theme values

---

## 6. AI Exam Generation

### Approach
Use **Google Gemini API** (free tier: 60 requests/min, no credit card required).

### Flow
1. User clicks **"Generar con IA"** in form builder
2. Modal appears with form:
   - Tema (texto, ej: "Ecuaciones de segundo grado")
   - Cantidad de preguntas (número)
   - Tipo de preguntas (multiselect: multipleChoice, checkbox, text)
   - Idioma (español por defecto)
3. Backend (client-side) calls Gemini API with structured prompt
4. Parses response JSON into question objects
5. Preview generated questions before adding
6. "Agregar al formulario" — calls `addQuestion` for each

### Prompt Engineering
```
Genera un examen sobre [TEMA] con [CANTIDAD] preguntas.
Formato JSON:
{
  "questions": [
    {
      "type": "multipleChoice",
      "title": "Pregunta",
      "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "correctAnswer": "Opción A",
      "points": 1
    }
  ]
}
Tipos disponibles: multipleChoice, checkbox, text
Idioma: [IDIOMA]
```

### Security
- API Key stored in `.env.local` as `VITE_GEMINI_API_KEY`
- No backend server needed — calls directly from client to Gemini API

---

## Implementation Order

1. Sections (2–3 days)
2. Conditional Logic (1–2 days)
3. Quiz Mode (2–3 days)
4. File Upload (1–2 days)
5. Theme Editor (1 day)
6. AI Generation (2–3 days)

Each feature is independent and can be built/tested separately.

---

## Spec Self-Review

- ✅ No placeholders or TODOs
- ✅ Internal consistency: data models match existing Firestore schema
- ✅ Scope: 6 features, each independently implementable
- ✅ No ambiguity: each section has clear UI + data + behavior description
- ✅ Architecture matches existing codebase patterns
