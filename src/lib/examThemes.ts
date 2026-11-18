import type { FormTheme } from '../types/form';

export interface ExamThemeVariant {
  id: string;
  name: string;
  subtitle: string;
  badge: string;
  fontTag: string;
  theme: {
    primaryColor: string;
    backgroundColor: string;
    cardBackgroundColor: string;
    textColor: string;
    headerBgColor: string;
    headerTextColor: string;
    fontFamily: string;
    headerFontFamily: string;
    headerFontSize: 'sm' | 'md' | 'lg' | 'xl';
    borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl';
    cardStyle: 'shadow' | 'bordered' | 'flat';
  };
}

function parseHexRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return [r, g, b];
  }
  return null;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** Devuelve true si el color hex tiene luminancia baja (fondo oscuro). */
export function isDarkColor(hex: string): boolean {
  const rgb = parseHexRgb(hex);
  if (!rgb) return false;
  return relativeLuminance(rgb) < 0.42;
}

/** Elige automáticamente texto claro u oscuro para contrastar sobre bgHex. */
export function getAutoContrastText(
  bgHex: string,
  lightText = '#FFFFFF',
  darkText = '#1C1917'
): string {
  return isDarkColor(bgHex) ? lightText : darkText;
}

/** Garantiza que el texto no comparta polaridad (claro/oscuro) con su fondo. */
export function ensureReadableTextColor(bgHex: string, preferredTextHex?: string): string {
  if (!preferredTextHex || !parseHexRgb(preferredTextHex)) {
    return getAutoContrastText(bgHex);
  }
  const bgDark = isDarkColor(bgHex);
  const textDark = isDarkColor(preferredTextHex);
  if (bgDark === textDark) {
    return getAutoContrastText(bgHex);
  }
  return preferredTextHex;
}

export const EXAM_THEME_VARIANTS: ExamThemeVariant[] = [
  {
    id: 'atelier',
    name: 'Atelier Académico',
    subtitle: 'Equilibrio editorial sobre papel marfil y cobalto',
    badge: 'Clásico Editorial',
    fontTag: 'Bricolage + Jakarta',
    theme: {
      primaryColor: '#1B3B6F',
      backgroundColor: '#F7F5F0',
      cardBackgroundColor: '#FFFFFF',
      textColor: '#1C1917',
      headerBgColor: '#1B3B6F',
      headerTextColor: '#FFFFFF',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      headerFontFamily: "'Bricolage Grotesque', sans-serif",
      headerFontSize: 'lg',
      borderRadius: 'lg',
      cardStyle: 'shadow',
    },
  },
  {
    id: 'catedra',
    name: 'Cátedra Clásica',
    subtitle: 'Estilo universitario tradicional con tipografía serif',
    badge: 'Serif Universitario',
    fontTag: 'Georgia Serif',
    theme: {
      primaryColor: '#14532D',
      backgroundColor: '#F4F1EA',
      cardBackgroundColor: '#FFFDF9',
      textColor: '#1C1917',
      headerBgColor: '#14532D',
      headerTextColor: '#FEFCE8',
      fontFamily: "Georgia, 'Times New Roman', serif",
      headerFontFamily: "Georgia, 'Times New Roman', serif",
      headerFontSize: 'lg',
      borderRadius: 'sm',
      cardStyle: 'bordered',
    },
  },
  {
    id: 'laboratorio',
    name: 'Laboratorio STEM',
    subtitle: 'Líneas técnicas de precisión para ciencias exactas',
    badge: 'Precisión Científica',
    fontTag: 'Mono + Jakarta',
    theme: {
      primaryColor: '#0369A1',
      backgroundColor: '#F0F4F8',
      cardBackgroundColor: '#FFFFFF',
      textColor: '#0F172A',
      headerBgColor: '#0F172A',
      headerTextColor: '#38BDF8',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      headerFontFamily: "'JetBrains Mono', monospace",
      headerFontSize: 'md',
      borderRadius: 'md',
      cardStyle: 'bordered',
    },
  },
  {
    id: 'botanica',
    name: 'Aula Botánica',
    subtitle: 'Tonos salvia serenos y tarjetas suavemente redondeadas',
    badge: 'Orgánico y Sereno',
    fontTag: 'Bricolage + Jakarta',
    theme: {
      primaryColor: '#0F766E',
      backgroundColor: '#EFF5F2',
      cardBackgroundColor: '#FFFFFF',
      textColor: '#132A26',
      headerBgColor: '#115E59',
      headerTextColor: '#F0FDFA',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      headerFontFamily: "'Bricolage Grotesque', sans-serif",
      headerFontSize: 'lg',
      borderRadius: 'xl',
      cardStyle: 'shadow',
    },
  },
  {
    id: 'terracota',
    name: 'Editorial Terracota',
    subtitle: 'Paleta cálida arcillosa ideal para humanidades y letras',
    badge: 'Humanidades y Letras',
    fontTag: 'Bricolage + Jakarta',
    theme: {
      primaryColor: '#C84B31',
      backgroundColor: '#FDF6F0',
      cardBackgroundColor: '#FFFFFF',
      textColor: '#271611',
      headerBgColor: '#7C2D12',
      headerTextColor: '#FFEDD5',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      headerFontFamily: "'Bricolage Grotesque', sans-serif",
      headerFontSize: 'lg',
      borderRadius: 'lg',
      cardStyle: 'shadow',
    },
  },
  {
    id: 'nocturno',
    name: 'Modo Nocturno Focus',
    subtitle: 'Superficie pizarra oscura diseñada para reducir fatiga visual',
    badge: 'Estudio Oscuro',
    fontTag: 'Bricolage + Jakarta',
    theme: {
      primaryColor: '#3B82F6',
      backgroundColor: '#0F172A',
      cardBackgroundColor: '#1E293B',
      textColor: '#F8FAFC',
      headerBgColor: '#1E293B',
      headerTextColor: '#60A5FA',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      headerFontFamily: "'Bricolage Grotesque', sans-serif",
      headerFontSize: 'lg',
      borderRadius: 'lg',
      cardStyle: 'bordered',
    },
  },
];

export function detectMatchingPresetId(theme?: Partial<FormTheme> | null): string | null {
  if (!theme) return 'atelier';
  if (theme.presetId && EXAM_THEME_VARIANTS.some((v) => v.id === theme.presetId)) {
    return theme.presetId;
  }
  const match = EXAM_THEME_VARIANTS.find(
    (v) =>
      v.theme.primaryColor.toLowerCase() === (theme.primaryColor ?? '').toLowerCase() &&
      v.theme.backgroundColor.toLowerCase() === (theme.backgroundColor ?? '').toLowerCase() &&
      v.theme.headerBgColor.toLowerCase() === (theme.headerBgColor ?? theme.primaryColor ?? '').toLowerCase()
  );
  return match?.id ?? null;
}
