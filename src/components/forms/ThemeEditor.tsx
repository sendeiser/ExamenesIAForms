import { useState } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Toggle } from '../ui/Toggle';
import { Card } from '../ui/Card';
import { useEditorStore } from '../../store/editorStore';

const PRESETS = [
  { name: 'Defecto', primary: '#6366f1', bg: '#ffffff' },
  { name: 'Verde', primary: '#059669', bg: '#f0fdf4' },
  { name: 'Azul', primary: '#2563eb', bg: '#eff6ff' },
  { name: 'Naranja', primary: '#ea580c', bg: '#fff7ed' },
  { name: 'Violeta', primary: '#7c3aed', bg: '#f5f3ff' },
  { name: 'Oscuro', primary: '#818cf8', bg: '#1e1b4b' },
  { name: 'Rojo', primary: '#dc2626', bg: '#fef2f2' },
  { name: 'Rosa', primary: '#ec4899', bg: '#fdf2f8' },
];

const FONTS = [
  { value: 'Inter, system-ui, sans-serif', label: 'Inter (sans-serif)' },
  { value: 'system-ui, sans-serif', label: 'System UI' },
  { value: 'Arial, sans-serif', label: 'Arial (sans-serif)' },
  { value: 'Helvetica, Arial, sans-serif', label: 'Helvetica (sans-serif)' },
  { value: 'Georgia, serif', label: 'Georgia (serif)' },
  { value: "'Times New Roman', serif", label: 'Times New Roman (serif)' },
  { value: "'Palatino Linotype', 'Book Antiqua', Palatino, serif", label: 'Palatino (serif)' },
  { value: "'Courier New', monospace", label: 'Courier New (mono)' },
  { value: 'Verdana, sans-serif', label: 'Verdana (sans-serif)' },
  { value: "'Trebuchet MS', sans-serif", label: 'Trebuchet MS (sans-serif)' },
  { value: "'Lucida Sans', 'Lucida Grande', sans-serif", label: 'Lucida Sans (sans-serif)' },
  { value: 'Tahoma, sans-serif', label: 'Tahoma (sans-serif)' },
  { value: "'Segoe UI', sans-serif", label: 'Segoe UI (sans-serif)' },
  { value: "'Comic Sans MS', cursive", label: 'Comic Sans (cursive)' },
  { value: 'cursive', label: 'Cursiva genérica' },
  { value: 'fantasy', label: 'Fantasy genérica' },
];

const FONT_SIZE_OPTIONS = [
  { value: 'sm', label: 'Pequeño' },
  { value: 'md', label: 'Mediano' },
  { value: 'lg', label: 'Grande' },
  { value: 'xl', label: 'Extra grande' },
];

const BORDER_RADIUS = [
  { value: 'none', label: 'Ninguno' },
  { value: 'sm', label: 'Pequeño' },
  { value: 'md', label: 'Mediano' },
  { value: 'lg', label: 'Grande' },
  { value: 'xl', label: 'Extra grande' },
];

const CARD_STYLES = [
  { value: 'shadow', label: 'Sombra' },
  { value: 'bordered', label: 'Bordeado' },
  { value: 'flat', label: 'Plano' },
];

export function ThemeEditor() {
  const form = useEditorStore((s) => s.form);
  const updateForm = useEditorStore((s) => s.updateForm);
  const theme = form?.theme ?? { primaryColor: '#6366f1', backgroundColor: '#ffffff', fontFamily: 'Inter, system-ui, sans-serif', showProgressBar: true, borderRadius: 'lg', cardStyle: 'shadow' };
  const [expanded, setExpanded] = useState(false);

  function update(field: string, value: any) {
    if (!form) return;
    updateForm({
      theme: { ...form.theme, [field]: value },
    });
  }

  return (
    <Card className="p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-sm font-medium text-gray-700"
      >
        <div className="flex items-center gap-2">
          Personalizar tema
          <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: theme.primaryColor }} />
        </div>
        <span className="text-xs text-gray-400">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-2">Paletas rápidas</p>
            <div className="grid grid-cols-4 gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => {
                    if (!form) return;
                    updateForm({
                      theme: { ...form.theme, primaryColor: preset.primary, backgroundColor: preset.bg },
                    });
                  }}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${
                    theme.primaryColor === preset.primary && theme.backgroundColor === preset.bg
                      ? 'border-indigo-500 ring-1 ring-indigo-500'
                      : 'hover:border-gray-400'
                  }`}
                >
                  <div className="flex gap-0.5">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.primary }} />
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.bg }} />
                  </div>
                  <span className="text-[10px] text-gray-500">{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs text-gray-500">Color primario</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={theme.primaryColor}
                  onChange={(e) => update('primaryColor', e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border shrink-0"
                />
                <Input
                  value={theme.primaryColor}
                  onChange={(e) => update('primaryColor', e.target.value)}
                  className="font-mono text-xs flex-1"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-gray-500">Fondo</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={theme.backgroundColor}
                  onChange={(e) => update('backgroundColor', e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border shrink-0"
                />
                <Input
                  value={theme.backgroundColor}
                  onChange={(e) => update('backgroundColor', e.target.value)}
                  className="font-mono text-xs flex-1"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs text-gray-500">Fuente</label>
            <Select
              value={theme.fontFamily}
              onChange={(e) => update('fontFamily', e.target.value)}
              options={FONTS}
            />
          </div>

          <div className="border-t pt-4 space-y-3">
            <p className="text-xs text-gray-500 font-medium">Encabezado</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs text-gray-500">Fuente</label>
                <Select
                  value={theme.headerFontFamily ?? theme.fontFamily}
                  onChange={(e) => update('headerFontFamily', e.target.value)}
                  options={FONTS}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-gray-500">Tamaño</label>
                <Select
                  value={theme.headerFontSize ?? 'md'}
                  onChange={(e) => update('headerFontSize', e.target.value)}
                  options={FONT_SIZE_OPTIONS}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-gray-500">Color de texto</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={theme.headerTextColor ?? '#ffffff'}
                  onChange={(e) => update('headerTextColor', e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border shrink-0"
                />
                <Input
                  value={theme.headerTextColor ?? '#ffffff'}
                  onChange={(e) => update('headerTextColor', e.target.value)}
                  className="font-mono text-xs flex-1"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs text-gray-500">Bordes</label>
              <Select
                value={theme.borderRadius ?? 'lg'}
                onChange={(e) => update('borderRadius', e.target.value)}
                options={BORDER_RADIUS}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-gray-500">Estilo de tarjetas</label>
              <Select
                value={theme.cardStyle ?? 'shadow'}
                onChange={(e) => update('cardStyle', e.target.value)}
                options={CARD_STYLES}
              />
            </div>
          </div>

          <Toggle
            label="Mostrar barra de progreso"
            checked={theme.showProgressBar ?? true}
            onChange={(checked) => update('showProgressBar', checked)}
          />

          <div className="border-t pt-4">
            <p className="text-xs text-gray-500 mb-3">Vista previa</p>
            <div
              className="rounded-xl border p-4 space-y-3"
              style={{ backgroundColor: theme.backgroundColor, borderColor: theme.primaryColor }}
            >
              <h3 style={{ color: theme.primaryColor }} className="font-bold text-sm">Título del examen</h3>
              <button
                className="text-white text-xs px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: theme.primaryColor }}
              >
                Botón primario
              </button>
              <div className="flex items-center gap-2 text-xs" style={{ color: theme.primaryColor }}>
                <input type="radio" checked readOnly className="accent-indigo-600" style={{ accentColor: theme.primaryColor }} />
                Opción de ejemplo
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
