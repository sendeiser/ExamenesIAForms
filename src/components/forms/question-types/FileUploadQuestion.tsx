import { Upload } from 'lucide-react';

export function FileUploadQuestion() {
  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-400 text-sm">
      <Upload className="h-8 w-8 mx-auto mb-2" />
      Haz clic para subir un archivo
    </div>
  );
}
