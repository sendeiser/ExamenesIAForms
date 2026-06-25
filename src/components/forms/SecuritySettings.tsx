import { useState } from 'react';
import { Card } from '../ui/Card';
import { Toggle } from '../ui/Toggle';
import { Input } from '../ui/Input';
import { useEditorStore } from '../../store/editorStore';
import { Shield } from 'lucide-react';

export function SecuritySettings() {
  const form = useEditorStore((s) => s.form);
  const updateForm = useEditorStore((s) => s.updateForm);
  const [expanded, setExpanded] = useState(false);

  if (!form) return null;

  const defaults = {
    securityEnabled: false,
    maxViolations: 3,
    fullscreen: true,
    disableCopy: true,
    preventTabSwitch: true,
  };
  const s = { ...defaults, ...(form.settings ?? {}) };

  function update(field: string, value: any) {
    updateForm({ settings: { ...s, [field]: value } });
  }

  return (
    <Card className="p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-sm font-medium text-gray-700"
      >
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Seguridad del examen
          {s.securityEnabled && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Activo</span>}
        </div>
        <span className="text-xs text-gray-400">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          <Toggle
            label="Activar modo seguro"
            checked={s.securityEnabled}
            onChange={(checked) => update('securityEnabled', checked)}
          />

          {s.securityEnabled && (
            <>
              <p className="text-xs text-gray-500 -mt-2">
                Evita que los alumnos salgan del examen, copien o cambien de pestaña
              </p>

              <div className="border-t pt-4 space-y-3">
                <p className="text-xs text-gray-500 font-medium">Restricciones</p>

                <div className="space-y-1">
                  <Toggle
                    label="Pantalla completa"
                    checked={s.fullscreen}
                    onChange={(checked) => update('fullscreen', checked)}
                  />
                  <p className="text-[11px] text-gray-400 ml-14">Forzar pantalla completa al iniciar el examen</p>
                </div>

                <div className="space-y-1">
                  <Toggle
                    label="Bloquear cambio de pestaña"
                    checked={s.preventTabSwitch}
                    onChange={(checked) => update('preventTabSwitch', checked)}
                  />
                  <p className="text-[11px] text-gray-400 ml-14">Detectar si el alumno cambia de ventana o pestaña</p>
                </div>

                <div className="space-y-1">
                  <Toggle
                    label="Bloquear copiar y pegar"
                    checked={s.disableCopy}
                    onChange={(checked) => update('disableCopy', checked)}
                  />
                  <p className="text-[11px] text-gray-400 ml-14">Deshabilitar Ctrl+C, Ctrl+V, menú contextual y selección de texto</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs text-gray-500">Máximo de infracciones antes de enviar automáticamente</label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={s.maxViolations}
                  onChange={(e) => update('maxViolations', Math.min(10, Math.max(1, Number(e.target.value))))}
                  className="w-24"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <strong>Importante:</strong> Si el alumno excede el máximo de infracciones, el examen se enviará
                automáticamente con las respuestas actuales. No se podrá recuperar.
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
