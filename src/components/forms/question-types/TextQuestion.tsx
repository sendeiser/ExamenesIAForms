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
