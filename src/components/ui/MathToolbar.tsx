import { useState } from 'react';
import { Sigma, FunctionSquare, ArrowUp, ArrowDown } from 'lucide-react';

interface MathToolbarProps {
  onInsert: (latex: string) => void;
}

type MathGroup = {
  name: string;
  items: { label: string; latex: string; title?: string }[];
};

const GROUPS: MathGroup[] = [
  {
    name: 'Estructuras',
    items: [
      { label: 'x²', latex: '^{2}', title: 'Cuadrado' },
      { label: 'xⁿ', latex: '^{n}', title: 'Superíndice' },
      { label: 'xₙ', latex: '_{n}', title: 'Subíndice' },
      { label: 'a/b', latex: '\\frac{a}{b}', title: 'Fracción' },
      { label: '√', latex: '\\sqrt{x}', title: 'Raíz cuadrada' },
      { label: '∛', latex: '\\sqrt[3]{x}', title: 'Raíz cúbica' },
      { label: '∫', latex: '\\int_{a}^{b}', title: 'Integral' },
      { label: 'Σ', latex: '\\sum_{n=1}^{N}', title: 'Sumatoria' },
      { label: 'lim', latex: '\\lim_{x \\to a}', title: 'Límite' },
    ],
  },
  {
    name: 'Griegas',
    items: [
      { label: 'α', latex: '\\alpha' },
      { label: 'β', latex: '\\beta' },
      { label: 'γ', latex: '\\gamma' },
      { label: 'δ', latex: '\\delta' },
      { label: 'θ', latex: '\\theta' },
      { label: 'λ', latex: '\\lambda' },
      { label: 'μ', latex: '\\mu' },
      { label: 'π', latex: '\\pi' },
      { label: 'ρ', latex: '\\rho' },
      { label: 'σ', latex: '\\sigma' },
      { label: 'φ', latex: '\\phi' },
      { label: 'ω', latex: '\\omega' },
      { label: 'Δ', latex: '\\Delta' },
      { label: 'Σ', latex: '\\Sigma' },
      { label: 'Ω', latex: '\\Omega' },
    ],
  },
  {
    name: 'Operadores',
    items: [
      { label: '±', latex: '\\pm' },
      { label: '×', latex: '\\times' },
      { label: '÷', latex: '\\div' },
      { label: '≈', latex: '\\approx' },
      { label: '≠', latex: '\\neq' },
      { label: '≤', latex: '\\leq' },
      { label: '≥', latex: '\\geq' },
      { label: '∞', latex: '\\infty' },
      { label: '∀', latex: '\\forall' },
      { label: '∃', latex: '\\exists' },
      { label: '→', latex: '\\rightarrow' },
      { label: '⇒', latex: '\\Rightarrow' },
      { label: '⇔', latex: '\\Leftrightarrow' },
      { label: '·', latex: '\\cdot' },
      { label: '∘', latex: '\\circ' },
    ],
  },
  {
    name: 'Conjuntos',
    items: [
      { label: '∈', latex: '\\in' },
      { label: '∉', latex: '\\notin' },
      { label: '⊂', latex: '\\subset' },
      { label: '⊆', latex: '\\subseteq' },
      { label: '∪', latex: '\\cup' },
      { label: '∩', latex: '\\cap' },
      { label: '∅', latex: '\\emptyset' },
      { label: 'ℕ', latex: '\\mathbb{N}' },
      { label: 'ℤ', latex: '\\mathbb{Z}' },
      { label: 'ℚ', latex: '\\mathbb{Q}' },
      { label: 'ℝ', latex: '\\mathbb{R}' },
      { label: 'ℂ', latex: '\\mathbb{C}' },
    ],
  },
];

const ALL_SYMBOLS = GROUPS.flatMap((g) => g.items);
const QUICK_SYMBOLS = ALL_SYMBOLS.slice(0, 24);

export function MathToolbar({ onInsert }: MathToolbarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
      >
        <Sigma className="h-3 w-3" />
        {open ? 'Ocultar herramientas matemáticas' : 'Herramientas matemáticas'}
      </button>

      {open && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-1.5">
          <div className="flex flex-wrap gap-0.5">
            {QUICK_SYMBOLS.map((sym, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onInsert(sym.latex)}
                title={sym.title ?? sym.label}
                className="h-7 min-w-[1.75rem] px-1 text-xs rounded hover:bg-indigo-100 hover:text-indigo-700 transition-colors font-mono flex items-center justify-center"
              >
                {sym.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function useMathInsert(
  ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
  value: string,
  onChange: (val: string) => void
) {
  return (latex: string) => {
    const el = ref.current;
    if (!el) {
      onChange(value + latex);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const newVal = before + latex + after;
    onChange(newVal);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + latex.length;
      el.setSelectionRange(pos, pos);
    });
  };
}
