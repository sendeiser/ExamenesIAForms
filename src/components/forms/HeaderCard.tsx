import { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { ImageSearchModal } from './ImageSearchModal';
import { ImagePlus, X, Link as LinkIcon } from 'lucide-react';

const FONT_OPTIONS = [
  { value: 'Inter, system-ui, sans-serif', label: 'Inter' },
  { value: 'system-ui, sans-serif', label: 'System UI' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Helvetica, Arial, sans-serif', label: 'Helvetica' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: "'Times New Roman', serif", label: 'Times New Roman' },
  { value: 'Palatino Linotype, Book Antiqua, Palatino, serif', label: 'Palatino' },
  { value: "'Courier New', monospace", label: 'Courier New' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: "'Trebuchet MS', sans-serif", label: 'Trebuchet MS' },
  { value: "'Lucida Sans', 'Lucida Grande', sans-serif", label: 'Lucida Sans' },
  { value: 'Tahoma, sans-serif', label: 'Tahoma' },
  { value: "'Segoe UI', sans-serif", label: 'Segoe UI' },
  { value: 'Impact, sans-serif', label: 'Impact' },
  { value: "'Comic Sans MS', cursive", label: 'Comic Sans' },
  { value: 'cursive', label: 'Cursiva genérica' },
  { value: 'fantasy', label: 'Fantasy genérica' },
];

const FONT_SIZE_OPTIONS = [
  { value: 'sm', label: 'Pequeño' },
  { value: 'md', label: 'Mediano' },
  { value: 'lg', label: 'Grande' },
  { value: 'xl', label: 'Extra grande' },
];

const FONT_SIZE_MAP: Record<string, { title: string; desc: string }> = {
  sm: { title: '1.125rem', desc: '0.75rem' },
  md: { title: '1.5rem', desc: '0.875rem' },
  lg: { title: '2rem', desc: '1rem' },
  xl: { title: '2.5rem', desc: '1.125rem' },
};

export function HeaderCard() {
  const form = useEditorStore((s) => s.form);
  const updateForm = useEditorStore((s) => s.updateForm);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  if (!form) return null;

  const theme = form.theme ?? {};
  const bgColor = theme.headerBgColor || theme.primaryColor || '#6366f1';
  const hasImage = !!theme.headerImageUrl;
  const textColor = theme.headerTextColor || '#ffffff';
  const fontFamily = theme.headerFontFamily || 'Inter, system-ui, sans-serif';
  const fontSizeKey = theme.headerFontSize ?? 'md';
  const fontSize = FONT_SIZE_MAP[fontSizeKey] ?? FONT_SIZE_MAP.md;

  return (
    <>
      <div
        className="relative overflow-hidden rounded-xl p-6 border"
        style={{
          backgroundColor: bgColor,
          backgroundImage: hasImage ? `url(${theme.headerImageUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {hasImage && (
          <div className="absolute inset-0" style={{ backgroundColor: bgColor, opacity: 0.55 }} />
        )}

        <div className="relative z-10 space-y-3" style={{ fontFamily }}>
          <Input
            value={form.title}
            onChange={(e) => updateForm({ title: e.target.value })}
            className="text-xl font-bold border-0 px-0 bg-transparent focus:ring-0"
            style={{ color: textColor, fontSize: fontSize.title }}
            placeholder="Título del examen"
          />
          <Input
            value={form.description}
            onChange={(e) => updateForm({ description: e.target.value })}
            className="text-sm border-0 px-0 bg-transparent focus:ring-0"
            style={{ color: textColor, fontSize: fontSize.desc }}
            placeholder="Descripción del examen (opcional)"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-1">
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500">Fondo:</label>
          <input
            type="color"
            value={bgColor}
            onChange={(e) => updateForm({ theme: { ...form.theme, headerBgColor: e.target.value } })}
            className="w-8 h-8 rounded cursor-pointer border"
          />
        </div>

        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500">Texto:</label>
          <input
            type="color"
            value={textColor}
            onChange={(e) => updateForm({ theme: { ...form.theme, headerTextColor: e.target.value } })}
            className="w-8 h-8 rounded cursor-pointer border"
          />
        </div>

        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500">Fuente:</label>
          <Select
            value={fontFamily}
            onChange={(e) => updateForm({ theme: { ...form.theme, headerFontFamily: e.target.value } })}
            options={FONT_OPTIONS}
            className="text-xs h-8 min-w-[120px]"
          />
        </div>

        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500">Tamaño:</label>
          <Select
            value={fontSizeKey}
            onChange={(e) => updateForm({ theme: { ...form.theme, headerFontSize: e.target.value as 'sm' | 'md' | 'lg' | 'xl' } })}
            options={FONT_SIZE_OPTIONS}
            className="text-xs h-8"
          />
        </div>

        {hasImage ? (
          <button
            onClick={() => updateForm({ theme: { ...form.theme, headerImageUrl: null } })}
            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Quitar imagen
          </button>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setImageModalOpen(true)} className="text-xs">
              <ImagePlus className="h-3 w-3" /> Imagen
            </Button>
            <div className="flex gap-1 w-full sm:w-auto">
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="URL de imagen..."
                className="text-xs h-8 flex-1 sm:w-40"
              />
              <Button
                variant="ghost"
                onClick={() => {
                  if (urlInput.trim()) {
                    updateForm({ theme: { ...form.theme, headerImageUrl: urlInput.trim() } });
                    setUrlInput('');
                  }
                }}
                disabled={!urlInput.trim()}
                className="text-xs"
              >
                <LinkIcon className="h-3 w-3" />
              </Button>
            </div>
          </>
        )}
      </div>

      <ImageSearchModal
        open={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        onSelect={(url) => {
          updateForm({ theme: { ...form.theme, headerImageUrl: url } });
          setImageModalOpen(false);
        }}
      />
    </>
  );
}
