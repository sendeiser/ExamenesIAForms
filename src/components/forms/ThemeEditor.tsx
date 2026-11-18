import { useState } from 'react';
import { Palette, ChevronDown, ChevronUp, Check, RotateCcw, Type, SlidersHorizontal } from 'lucide-react';
import { Card } from '../ui/Card';
import { Toggle } from '../ui/Toggle';
import { useEditorStore } from '../../store/editorStore';
import {
  EXAM_THEME_VARIANTS,
  detectMatchingPresetId,
  isDarkColor,
  getAutoContrastText,
  ensureReadableTextColor,
  type ExamThemeVariant,
} from '../../lib/examThemes';
import type { FormTheme } from '../../types/form';

const FONT_OPTIONS = [
  { label: 'Plus Jakarta Sans (Editorial)', value: "'Plus Jakarta Sans', system-ui, sans-serif" },
  { label: 'Bricolage Grotesque (Display)', value: "'Bricolage Grotesque', sans-serif" },
  { label: 'Georgia Serif (Cátedra)', value: "Georgia, 'Times New Roman', serif" },
  { label: 'JetBrains Mono (STEM)', value: "'JetBrains Mono', monospace" },
  { label: 'Sans del sistema', value: 'system-ui, sans-serif' },
];

const HEADER_SIZE_OPTIONS: Array<{ label: string; value: NonNullable<FormTheme['headerFontSize']> }> = [
  { label: 'Pequeño', value: 'sm' },
  { label: 'Normal', value: 'md' },
  { label: 'Grande', value: 'lg' },
  { label: 'XL', value: 'xl' },
];

const BORDER_RADIUS_OPTIONS: Array<{ label: string; value: NonNullable<FormTheme['borderRadius']>; px: string }> = [
  { label: 'Recto', value: 'none', px: '0px' },
  { label: 'Suave', value: 'sm', px: '4px' },
  { label: 'Medio', value: 'md', px: '8px' },
  { label: 'Amplio', value: 'lg', px: '12px' },
  { label: 'Cápsula', value: 'xl', px: '16px' },
];

const CARD_STYLE_OPTIONS: Array<{ label: string; value: NonNullable<FormTheme['cardStyle']> }> = [
  { label: 'Elevada', value: 'shadow' },
  { label: 'Con borde', value: 'bordered' },
  { label: 'Plana', value: 'flat' },
];

const RADIUS_PREVIEW_MAP: Record<string, string> = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
};

const HEADER_TITLE_SIZE_PREVIEW: Record<string, string> = {
  sm: '12px',
  md: '14px',
  lg: '16px',
  xl: '18px',
};

interface ColorSwatchFieldProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  action?: { label: string; onClick: () => void };
}

function ColorSwatchField({ label, value, onChange, action }: ColorSwatchFieldProps) {
  return (
    <label className="flex flex-col gap-1.5 rounded-lg border border-sand-200 bg-sand-50/60 p-2.5 cursor-pointer hover:border-sand-300 transition-colors">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-semibold text-ink-light">{label}</span>
        {action && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              action.onClick();
            }}
            className="text-[10px] font-medium text-brand-700 hover:text-brand-800 underline underline-offset-2"
          >
            {action.label}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 shrink-0 rounded border border-sand-300 bg-transparent p-0.5 cursor-pointer"
        />
        <span className="text-[11px] font-mono uppercase text-ink-muted truncate">{value}</span>
      </div>
    </label>
  );
}

interface ThemeVariantCardProps {
  variant: ExamThemeVariant;
  active: boolean;
  onSelect: () => void;
}

function ThemeVariantCard({ variant, active, onSelect }: ThemeVariantCardProps) {
  const { theme } = variant;
  const radius = RADIUS_PREVIEW_MAP[theme.borderRadius] ?? '10px';
  const cardBorder =
    theme.cardStyle === 'bordered'
      ? `1px solid ${isDarkColor(theme.cardBackgroundColor) ? 'rgba(148,163,184,0.3)' : 'rgba(28,25,23,0.16)'}`
      : '1px solid transparent';
  const cardShadow = theme.cardStyle === 'shadow' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none';

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`group relative flex flex-col text-left rounded-xl border p-2.5 transition-all ${
        active
          ? 'border-brand-600 bg-brand-50/40 ring-2 ring-brand-600/20 shadow-paper-md'
          : 'border-sand-300 bg-white hover:border-brand-300 hover:shadow-paper'
      }`}
    >
      {active && (
        <span
          className="absolute right-2 top-2 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm"
          aria-label="Tema activo"
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}

      {/* Miniature interactive specimen */}
      <div
        className="w-full overflow-hidden rounded-lg p-2.5 space-y-2 border border-black/5"
        style={{ backgroundColor: theme.backgroundColor }}
      >
        <div
          className="px-2.5 py-2 flex items-center justify-between gap-1.5"
          style={{
            backgroundColor: theme.headerBgColor,
            color: theme.headerTextColor,
            borderRadius: radius,
            fontFamily: theme.headerFontFamily,
          }}
        >
          <div className="min-w-0">
            <div className="text-[11px] font-bold leading-tight truncate">Evaluación Parcial</div>
            <div className="text-[9px] opacity-80 truncate">Unidad Académica</div>
          </div>
          <span
            className="h-2 w-2 rounded-full shrink-0 opacity-90"
            style={{ backgroundColor: theme.headerTextColor }}
          />
        </div>

        <div
          className="px-2.5 py-2 space-y-1.5"
          style={{
            backgroundColor: theme.cardBackgroundColor,
            color: theme.textColor,
            borderRadius: radius,
            border: cardBorder,
            boxShadow: cardShadow,
            fontFamily: theme.fontFamily,
          }}
        >
          <div className="text-[10px] font-semibold leading-snug truncate">1. Seleccione la opción correcta</div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0 border-2"
                style={{
                  borderColor: theme.primaryColor,
                  backgroundColor: theme.primaryColor,
                }}
              />
              <span className="h-1.5 w-16 rounded-full opacity-35" style={{ backgroundColor: theme.textColor }} />
            </div>
            <span
              className="px-1.5 py-0.5 text-[8px] font-semibold text-white shrink-0"
              style={{ backgroundColor: theme.primaryColor, borderRadius: radius }}
            >
              Enviar
            </span>
          </div>
        </div>
      </div>

      {/* Metadata footer */}
      <div className="mt-2.5 flex-1 flex flex-col justify-between gap-1.5 px-0.5">
        <div>
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-xs font-bold text-ink truncate">{variant.name}</span>
          </div>
          <span className="inline-block mt-0.5 rounded-md bg-sand-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-light">
            {variant.badge}
          </span>
          <p className="mt-1 text-[11px] text-ink-subtle leading-snug line-clamp-2">{variant.subtitle}</p>
        </div>

        <div className="pt-1.5 border-t border-sand-200/80 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-ink-subtle truncate">
            <Type className="h-3 w-3 shrink-0" />
            {variant.fontTag}
          </span>
          <div className="flex items-center gap-1 shrink-0" aria-hidden="true">
            {[theme.headerBgColor, theme.cardBackgroundColor, theme.primaryColor].map((dot, idx) => (
              <span
                key={idx}
                className="h-3 w-3 rounded-full border border-black/15"
                style={{ backgroundColor: dot }}
              />
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}

export function ThemeEditor() {
  const { form, updateForm } = useEditorStore();
  const [expanded, setExpanded] = useState(false);

  if (!form) return null;

  const theme: FormTheme = form.theme ?? {};
  const primary = theme.primaryColor ?? '#1B3B6F';
  const bg = theme.backgroundColor ?? '#F7F5F0';
  const cardBg = theme.cardBackgroundColor ?? (isDarkColor(bg) ? '#1E293B' : '#FFFFFF');
  const textColor = theme.textColor ?? getAutoContrastText(cardBg, '#F8FAFC', '#1C1917');
  const headerBg = theme.headerBgColor ?? primary;
  const headerText = ensureReadableTextColor(headerBg, theme.headerTextColor);
  const bodyFont = theme.fontFamily ?? "'Plus Jakarta Sans', system-ui, sans-serif";
  const headerFont = theme.headerFontFamily ?? "'Bricolage Grotesque', sans-serif";
  const headerSize = theme.headerFontSize ?? 'lg';
  const radiusKey = theme.borderRadius ?? 'lg';
  const cardStyle = theme.cardStyle ?? 'shadow';

  const activePresetId = detectMatchingPresetId(theme);
  const activePreset = EXAM_THEME_VARIANTS.find((v) => v.id === activePresetId);

  function updateTheme(patch: Partial<FormTheme>, clearPreset = true) {
    const next: FormTheme = { ...theme, ...patch };
    if (clearPreset) {
      delete next.presetId;
    }
    updateForm({ theme: next });
  }

  function applyVariant(variant: ExamThemeVariant) {
    updateForm({
      theme: {
        ...theme,
        presetId: variant.id,
        ...variant.theme,
      },
    });
  }

  function handleHeaderBgChange(nextHeaderBg: string) {
    const nextHeaderText = ensureReadableTextColor(nextHeaderBg, theme.headerTextColor);
    updateTheme({ headerBgColor: nextHeaderBg, headerTextColor: nextHeaderText });
  }

  function handleCardBgChange(nextCardBg: string) {
    const nextText =
      !theme.textColor || isDarkColor(nextCardBg) === isDarkColor(theme.textColor)
        ? getAutoContrastText(nextCardBg, '#F8FAFC', '#1C1917')
        : theme.textColor;
    updateTheme({ cardBackgroundColor: nextCardBg, textColor: nextText });
  }

  const previewRadius = RADIUS_PREVIEW_MAP[radiusKey] ?? '12px';

  return (
    <Card className="p-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        className="flex items-center justify-between gap-3 cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sand-300 shadow-paper"
            style={{ backgroundColor: headerBg, color: headerText }}
          >
            <Palette className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display text-sm font-bold text-ink">Tema del examen</span>
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 border border-brand-200/70">
                {activePreset?.name ?? 'Personalizado'}
              </span>
            </div>
            <p className="text-xs text-ink-subtle truncate">
              {EXAM_THEME_VARIANTS.length} variantes curadas con contraste garantizado en título y preguntas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden sm:flex items-center gap-1" aria-hidden="true">
            {[headerBg, primary, cardBg, bg].map((dot, idx) => (
              <span
                key={idx}
                className="h-4 w-4 rounded-full border border-black/15 shadow-sm"
                style={{ backgroundColor: dot }}
              />
            ))}
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-ink-light" /> : <ChevronDown className="h-4 w-4 text-ink-light" />}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-sand-200 space-y-5">
          {/* Curated 6-variant gallery */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-sm font-bold text-ink">Galería de temas curados</h3>
                <p className="text-xs text-ink-subtle">
                  Cada variante coordina encabezado, tarjetas, tipografía y legibilidad automática.
                </p>
              </div>
              {activePresetId !== 'atelier' && (
                <button
                  type="button"
                  onClick={() => applyVariant(EXAM_THEME_VARIANTS[0])}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sand-300 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-light hover:bg-sand-50 hover:text-ink transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restablecer Atelier
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {EXAM_THEME_VARIANTS.map((variant) => (
                <ThemeVariantCard
                  key={variant.id}
                  variant={variant}
                  active={activePresetId === variant.id}
                  onSelect={() => applyVariant(variant)}
                />
              ))}
            </div>
          </div>

          {/* Fine-tuning + live mini preview */}
          <div className="pt-4 border-t border-sand-200 grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Fine controls */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-brand-700" />
                <h3 className="font-display text-sm font-bold text-ink">Personalización detallada</h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <ColorSwatchField
                  label="Color primario"
                  value={primary}
                  onChange={(v) => updateTheme({ primaryColor: v })}
                />
                <ColorSwatchField
                  label="Fondo página"
                  value={bg}
                  onChange={(v) => updateTheme({ backgroundColor: v })}
                />
                <ColorSwatchField
                  label="Fondo tarjetas"
                  value={cardBg}
                  onChange={handleCardBgChange}
                />
                <ColorSwatchField
                  label="Fondo banner"
                  value={headerBg}
                  onChange={handleHeaderBgChange}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ColorSwatchField
                  label="Color texto encabezado"
                  value={headerText}
                  onChange={(v) => updateTheme({ headerTextColor: v })}
                  action={{
                    label: 'Auto contraste',
                    onClick: () => updateTheme({ headerTextColor: getAutoContrastText(headerBg) }),
                  }}
                />

                <div className="flex flex-col gap-1.5 rounded-lg border border-sand-200 bg-sand-50/60 p-2.5">
                  <span className="text-[11px] font-semibold text-ink-light">Tamaño título del encabezado</span>
                  <div className="grid grid-cols-4 gap-1">
                    {HEADER_SIZE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateTheme({ headerFontSize: opt.value })}
                        className={`rounded-md py-1 text-[11px] font-medium transition-colors ${
                          headerSize === opt.value
                            ? 'bg-brand-600 text-white'
                            : 'bg-white text-ink-light border border-sand-300 hover:bg-sand-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-ink-light">Tipografía del encabezado</span>
                  <select
                    value={headerFont}
                    onChange={(e) => updateTheme({ headerFontFamily: e.target.value })}
                    className="rounded-lg border border-sand-300 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-brand-600 focus:outline-none"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-ink-light">Tipografía del examen</span>
                  <select
                    value={bodyFont}
                    onChange={(e) => updateTheme({ fontFamily: e.target.value })}
                    className="rounded-lg border border-sand-300 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-brand-600 focus:outline-none"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="block text-xs font-semibold text-ink-light mb-1.5">Bordes de tarjetas</span>
                  <div className="flex flex-wrap gap-1.5">
                    {BORDER_RADIUS_OPTIONS.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => updateTheme({ borderRadius: r.value })}
                        className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                          radiusKey === r.value
                            ? 'bg-brand-600 border-brand-600 text-white'
                            : 'bg-white border-sand-300 text-ink-light hover:bg-sand-50'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-semibold text-ink-light mb-1.5">Estilo de tarjetas</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {CARD_STYLE_OPTIONS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => updateTheme({ cardStyle: c.value })}
                        className={`rounded-md border py-1 text-[11px] font-medium transition-colors ${
                          cardStyle === c.value
                            ? 'bg-brand-600 border-brand-600 text-white'
                            : 'bg-white border-sand-300 text-ink-light hover:bg-sand-50'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-1">
                <Toggle
                  label="Mostrar barra de progreso durante el examen"
                  checked={!!theme.showProgressBar}
                  onChange={(checked) => updateTheme({ showProgressBar: checked }, false)}
                />
              </div>
            </div>

            {/* Live mini-preview */}
            <div className="lg:col-span-5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-light">Vista en vivo del estilo</span>
                <span className="text-[11px] font-mono text-ink-subtle">
                  {isDarkColor(cardBg) ? 'Superficie oscura' : 'Superficie clara'}
                </span>
              </div>

              <div
                className="flex-1 rounded-xl border border-sand-300 p-4 space-y-3 transition-colors"
                style={{ backgroundColor: bg, fontFamily: bodyFont }}
              >
                {theme.showProgressBar && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10">
                    <div className="h-full w-2/3 rounded-full" style={{ backgroundColor: primary }} />
                  </div>
                )}

                <div
                  className="p-3.5 transition-all"
                  style={{
                    backgroundColor: headerBg,
                    color: headerText,
                    borderRadius: previewRadius,
                    fontFamily: headerFont,
                  }}
                >
                  <div
                    className="font-bold leading-snug truncate"
                    style={{ fontSize: HEADER_TITLE_SIZE_PREVIEW[headerSize] ?? '16px' }}
                  >
                    {form.title?.trim() || 'Examen Parcial de Muestra'}
                  </div>
                  <div className="text-[11px] opacity-85 mt-0.5 truncate">
                    {form.description?.trim() || 'Instrucciones generales y criterios de evaluación'}
                  </div>
                </div>

                <div
                  className="p-3.5 space-y-2.5 transition-all"
                  style={{
                    backgroundColor: cardBg,
                    color: textColor,
                    borderRadius: previewRadius,
                    border:
                      cardStyle === 'bordered'
                        ? `1px solid ${isDarkColor(cardBg) ? 'rgba(148,163,184,0.35)' : 'rgba(28,25,23,0.16)'}`
                        : '1px solid transparent',
                    boxShadow: cardStyle === 'shadow' ? '0 2px 10px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  <div className="text-xs font-semibold">1. ¿Cuál es el resultado de la integral definida?</div>
                  <div className="space-y-1.5">
                    <div
                      className="flex items-center gap-2 border px-2.5 py-1.5 text-xs"
                      style={{
                        borderRadius: previewRadius,
                        borderColor: primary,
                        backgroundColor: `color-mix(in srgb, ${primary} 12%, ${cardBg})`,
                      }}
                    >
                      <span
                        className="h-3 w-3 rounded-full border-2 shrink-0"
                        style={{ borderColor: primary, backgroundColor: primary }}
                      />
                      <span>A) Solución principal</span>
                    </div>
                    <div
                      className="flex items-center gap-2 border px-2.5 py-1.5 text-xs opacity-80"
                      style={{
                        borderRadius: previewRadius,
                        borderColor: `color-mix(in srgb, ${primary} 25%, #D6D1C5)`,
                      }}
                    >
                      <span className="h-3 w-3 rounded-full border border-current opacity-50 shrink-0" />
                      <span>B) Alternativa secundaria</span>
                    </div>
                  </div>
                  <div className="pt-1 flex justify-end">
                    <span
                      className="px-3 py-1 text-[11px] font-semibold text-white shadow-sm"
                      style={{ backgroundColor: primary, borderRadius: previewRadius }}
                    >
                      Enviar respuestas
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
