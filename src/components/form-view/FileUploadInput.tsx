import { useRef } from 'react';
import { useFileUpload } from '../../lib/useFileUpload';
import { Button } from '../ui/Button';
import { Upload, File, X, Loader2 } from 'lucide-react';

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

interface FileUploadInputProps {
  questionId: string;
  value: string | null;
  onChange: (url: string | null) => void;
}

export function FileUploadInput({ questionId, value, onChange }: FileUploadInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { progress, uploading, error, upload, reset } = useFileUpload();

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('Tipo de archivo no permitido. Usa PDF, imágenes o documentos de Word.');
      return;
    }

    if (file.size > MAX_SIZE) {
      alert('El archivo es demasiado grande. Máximo 10 MB.');
      return;
    }

    try {
      const path = `uploads/${questionId}/${Date.now()}_${file.name}`;
      const url = await upload(file, path);
      onChange(url);
    } catch {
      // Error handled by hook
    }
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
        <File className="h-4 w-4 text-gray-500" />
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline truncate flex-1">
          Ver archivo subido
        </a>
        <button onClick={() => { onChange(null); reset(); }} className="text-gray-400 hover:text-red-500">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        onChange={handleFileSelected}
        className="hidden"
      />
      <Button
        variant="secondary"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {uploading ? `Subiendo... ${progress}%` : 'Subir archivo'}
      </Button>
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  );
}
