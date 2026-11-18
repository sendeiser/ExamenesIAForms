import type { FormTheme } from '../../types/form';
import { ensureReadableTextColor } from '../../lib/examThemes';

interface FormHeaderProps {
  title: string;
  description?: string;
  theme: FormTheme;
}

const FONT_SIZE_MAP: Record<string, { title: string; desc: string }> = {
  sm: { title: '1.125rem', desc: '0.75rem' },
  md: { title: '1.5rem', desc: '0.875rem' },
  lg: { title: '2rem', desc: '1rem' },
  xl: { title: '2.5rem', desc: '1.125rem' },
};

export function FormHeader({ title, description, theme }: FormHeaderProps) {
  const hasImage = !!theme.headerImageUrl;
  const bgColor = theme.headerBgColor || theme.primaryColor || '#1B3B6F';
  const textColor = ensureReadableTextColor(bgColor, theme.headerTextColor);
  const fontSize = FONT_SIZE_MAP[theme.headerFontSize ?? ''] ?? FONT_SIZE_MAP.md;
  const fontFamily = theme.headerFontFamily || theme.fontFamily || "'Bricolage Grotesque', sans-serif";

  return (
    <div
      className="relative overflow-hidden rounded-xl p-8"
      style={{
        backgroundColor: bgColor,
        backgroundImage: hasImage ? `url(${theme.headerImageUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {hasImage && (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: bgColor,
            opacity: 0.55,
          }}
        />
      )}
      <div className="relative z-10" style={{ fontFamily }}>
        <h1 className="font-bold leading-tight" style={{ color: textColor, fontSize: fontSize.title }}>
          {title}
        </h1>
        {description && (
          <p className="mt-2 leading-relaxed" style={{ color: textColor, fontSize: fontSize.desc, opacity: 0.9 }}>
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
