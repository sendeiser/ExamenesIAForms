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
