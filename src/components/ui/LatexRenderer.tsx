import { useEffect, useMemo, useState } from 'react';

interface LatexRendererProps {
  text: string;
}

type KatexModule = { renderToString: (expr: string, opts: { displayMode: boolean; throwOnError: boolean }) => string };

export function LatexRenderer({ text }: LatexRendererProps) {
  const [katex, setKatex] = useState<KatexModule | null>(null);

  useEffect(() => {
    import('katex').then((mod) => setKatex(mod.default as unknown as KatexModule));
  }, []);

  const html = useMemo(() => {
    if (!text || !katex) return text;

    let result = text;

    result = result.replace(/\\\[(.+?)\\\]/gs, (_, expr) => {
      try {
        return katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false });
      } catch {
        return expr;
      }
    });

    result = result.replace(/\$\$(.+?)\$\$/gs, (_, expr) => {
      try {
        return katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false });
      } catch {
        return expr;
      }
    });

    result = result.replace(/\\\((.+?)\\\)/g, (_, expr) => {
      try {
        return katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false });
      } catch {
        return expr;
      }
    });

    result = result.replace(/\$(.+?)\$/g, (_, expr) => {
      try {
        return katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false });
      } catch {
        return expr;
      }
    });

    if (result !== text) {
      return result;
    }

    return text;
  }, [text, katex]);

  if (html !== text) {
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return <>{text}</>;
}
