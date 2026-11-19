import { useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useEditorStore } from '../../store/editorStore';
import {
  ensureFormShortCode,
  normalizeShortCode,
  shortenExternalUrl,
  updateFormShortCode,
} from '../../lib/shortLink';
import { Copy, Check, Download, KeyRound, Link2, Loader2, Pencil, Sparkles } from 'lucide-react';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  formId: string;
  formTitle: string;
}

export function ShareModal({ open, onClose, formId, formTitle }: ShareModalProps) {
  const form = useEditorStore((s) => s.form);
  const updateForm = useEditorStore((s) => s.updateForm);

  const [shortCode, setShortCode] = useState(form?.shortCode ?? '');
  const [loadingCode, setLoadingCode] = useState(false);
  const [editingCode, setEditingCode] = useState(false);
  const [draftCode, setDraftCode] = useState('');
  const [savingCode, setSavingCode] = useState(false);
  const [codeError, setCodeError] = useState('');

  const [copiedKey, setCopiedKey] = useState<'code' | 'short' | 'external' | 'full' | null>(null);
  const [externalShortUrl, setExternalShortUrl] = useState('');
  const [shorteningExternal, setShorteningExternal] = useState(false);
  const [externalError, setExternalError] = useState('');

  const fullLink = `${window.location.origin}/view/${formId}`;
  const shortLink = shortCode ? `${window.location.origin}/e/${shortCode}` : fullLink;

  useEffect(() => {
    if (!open || !formId) return;
    let active = true;

    setCodeError('');
    setExternalError('');
    setEditingCode(false);

    if (form?.shortCode) {
      const normalized = normalizeShortCode(form.shortCode);
      setShortCode(normalized);
      return;
    }

    setLoadingCode(true);
    ensureFormShortCode({ id: formId, shortCode: form?.shortCode })
      .then((code) => {
        if (!active) return;
        setShortCode(code);
        if (form && form.shortCode !== code) {
          updateForm({ shortCode: code });
        }
      })
      .catch(() => {
        if (!active) return;
      })
      .finally(() => {
        if (active) setLoadingCode(false);
      });

    return () => {
      active = false;
    };
  }, [open, formId, form?.shortCode]);

  async function copyText(text: string, key: 'code' | 'short' | 'external' | 'full') {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000);
  }

  async function handleSaveCustomCode(e: React.FormEvent) {
    e.preventDefault();
    setCodeError('');
    setSavingCode(true);
    try {
      const saved = await updateFormShortCode(formId, draftCode);
      setShortCode(saved);
      setEditingCode(false);
      setExternalShortUrl('');
      if (form) {
        updateForm({ shortCode: saved });
      }
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : 'No se pudo actualizar el código.');
    } finally {
      setSavingCode(false);
    }
  }

  async function handleGenerateExternalShort() {
    setExternalError('');
    setShorteningExternal(true);
    try {
      const targetUrl = shortCode ? shortLink : fullLink;
      const shortened = await shortenExternalUrl(targetUrl);
      setExternalShortUrl(shortened);
    } catch (err) {
      setExternalError(err instanceof Error ? err.message : 'No se pudo acortar el link externamente.');
    } finally {
      setShorteningExternal(false);
    }
  }

  function handleDownload() {
    const canvas = document.querySelector<HTMLCanvasElement>('#qr-canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.download = `${formTitle.replace(/\s+/g, '_')}_qr.png`;
    a.href = url;
    a.click();
  }

  return (
    <Modal open={open} onClose={onClose} title="Compartir examen" size="md">
      <div className="space-y-5">
        {/* Código corto para pizarrón / netbooks */}
        <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-800">
              <KeyRound className="h-3.5 w-3.5" />
              Código para netbooks / pizarrón
            </span>
            {!editingCode && shortCode && (
              <button
                type="button"
                onClick={() => {
                  setDraftCode(shortCode);
                  setCodeError('');
                  setEditingCode(true);
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
              >
                <Pencil className="h-3 w-3" />
                Personalizar
              </button>
            )}
          </div>

          {editingCode ? (
            <form onSubmit={handleSaveCustomCode} className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={draftCode}
                  onChange={(e) => setDraftCode(e.target.value.toUpperCase())}
                  placeholder="Ej: MATE1"
                  maxLength={12}
                  className="flex-1 font-mono uppercase tracking-widest font-bold text-center"
                />
                <Button type="submit" loading={savingCode} disabled={savingCode}>
                  Guardar código
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingCode(false);
                    setCodeError('');
                  }}
                >
                  Cancelar
                </Button>
              </div>
              {codeError && <p className="text-xs text-red-600">{codeError}</p>}
            </form>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-white border border-brand-200 px-3.5 py-2.5">
              {loadingCode ? (
                <span className="inline-flex items-center gap-2 text-xs text-ink-subtle">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generando código...
                </span>
              ) : (
                <span className="font-mono text-2xl font-bold tracking-[0.22em] text-brand-700 select-all">
                  {shortCode || '—'}
                </span>
              )}
              {shortCode && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => copyText(shortCode, 'code')}
                  className="shrink-0"
                >
                  {copiedKey === 'code' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  <span className="text-xs">Copiar código</span>
                </Button>
              )}
            </div>
          )}

          <p className="text-[11px] text-ink-light leading-relaxed">
            En otras PCs o netbooks, los alumnos pueden entrar a{' '}
            <span className="font-mono font-semibold text-ink">{window.location.origin}</span> y escribir este código.
          </p>
        </div>

        {/* QR centrado apuntando al link corto */}
        <div className="flex flex-col items-center gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-sand-300 shadow-sm">
            <QRCodeCanvas id="qr-canvas" value={shortLink} size={220} level="M" includeMargin />
          </div>
          <Button variant="secondary" onClick={handleDownload}>
            <Download className="h-4 w-4" />
            Descargar QR
          </Button>
        </div>

        {/* Link corto directo */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-ink-light uppercase tracking-wider">
            Link corto directo
          </label>
          <div className="flex gap-2">
            <Input value={shortLink} readOnly className="flex-1 text-xs font-mono" />
            <Button variant="secondary" onClick={() => copyText(shortLink, 'short')}>
              {copiedKey === 'short' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Acortador externo */}
        <div className="rounded-xl border border-sand-200 bg-sand-50/70 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
              <Sparkles className="h-3.5 w-3.5 text-brand-600" />
              Link acortado externo (para escribir rápido)
            </span>
            <Button
              type="button"
              variant="secondary"
              onClick={handleGenerateExternalShort}
              disabled={shorteningExternal}
              className="px-3 py-1.5 text-xs"
            >
              {shorteningExternal ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2 className="h-3.5 w-3.5 text-brand-600" />
              )}
              {shorteningExternal ? 'Acortando...' : 'Acortar link externo (is.gd)'}
            </Button>
          </div>

          {externalShortUrl && (
            <div className="flex gap-2">
              <Input value={externalShortUrl} readOnly className="flex-1 text-xs font-mono font-semibold text-brand-700" />
              <Button variant="secondary" onClick={() => copyText(externalShortUrl, 'external')}>
                {copiedKey === 'external' ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}

          {externalError && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">{externalError}</p>}

          <div className="pt-1 flex items-center justify-between gap-2 text-[11px] text-ink-subtle">
            <span className="truncate font-mono">Link largo: {fullLink}</span>
            <button
              type="button"
              onClick={() => copyText(fullLink, 'full')}
              className="shrink-0 text-brand-600 hover:underline font-medium"
            >
              {copiedKey === 'full' ? 'Copiado' : 'Copiar largo'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
