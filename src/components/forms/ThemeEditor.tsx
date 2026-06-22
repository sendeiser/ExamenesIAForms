import { useState } from 'react';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { useEditorStore } from '../../store/editorStore';

const PRESETS = [
  { name: 'Defecto', primary: '#6366f1', bg: '#ffffff' },
  { name: 'Verde', primary: '#059669', bg: '#f0fdf4' },
  { name: 'Azul', primary: '#2563eb', bg: '#eff6ff' },
  { name: 'Naranja', primary: '#ea580c', bg: '#fff7ed' },
  { name: 'Violeta', primary: '#7c3aed', bg: '#f5f3ff' },
  { name: 'Oscuro', primary: '#818cf8', bg: '#1e1b4b' },
];

export function ThemeEditor() {
  const form = useEditorStore((s) => s.form);
  const updateForm = useEditorStore((s) => s.updateForm);
  const theme = form?.theme ?? { primaryColor: '#6366f1', backgroundColor: '#ffffff' };
  const [expanded, setExpanded] = useState(false);

  function update(field: keyof typeof theme, value: string) {
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
        Personalizar tema
        <span className="text-xs text-gray-400">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-6 gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => {
                  update('primaryColor', preset.primary);
                  update('backgroundColor', preset.bg);
                }}
                className="flex flex-col items-center gap-1 p-2 rounded-lg border hover:border-indigo-400 transition-colors"
              >
                <div className="flex gap-0.5">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.primary }} />
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.bg }} />
                </div>
                <span className="text-[10px] text-gray-500">{preset.name}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-4">
            <div className="flex-1 space-y-1">
              <label className="block text-xs text-gray-500">Color primario</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={theme.primaryColor}
                  onChange={(e) => update('primaryColor', e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border"
                />
                <Input
                  value={theme.primaryColor}
                  onChange={(e) => update('primaryColor', e.target.value)}
                  className="font-mono text-xs flex-1"
                />
              </div>
            </div>
            <div className="flex-1 space-y-1">
              <label className="block text-xs text-gray-500">Fondo</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={theme.backgroundColor}
                  onChange={(e) => update('backgroundColor', e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border"
                />
                <Input
                  value={theme.backgroundColor}
                  onChange={(e) => update('backgroundColor', e.target.value)}
                  className="font-mono text-xs flex-1"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
