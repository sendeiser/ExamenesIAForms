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
        <div className="text-4xl mb-4">&#127881;</div>
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
