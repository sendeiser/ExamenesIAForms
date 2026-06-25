import { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Copy, Check, Download } from 'lucide-react';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  formId: string;
  formTitle: string;
}

export function ShareModal({ open, onClose, formId, formTitle }: ShareModalProps) {
  const link = `${window.location.origin}/view/${formId}`;
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    <Modal open={open} onClose={onClose} title="Compartir examen" size="sm">
      <div className="space-y-6">
        <div className="flex justify-center">
          <div className="bg-white p-4 rounded-xl border shadow-sm">
            <QRCodeCanvas
              id="qr-canvas"
              value={link}
              size={300}
              level="M"
              includeMargin
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Link del examen</label>
          <div className="flex gap-2">
            <Input value={link} readOnly className="flex-1 text-xs font-mono" />
            <Button variant="secondary" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="flex justify-center">
          <Button variant="secondary" onClick={handleDownload}>
            <Download className="h-4 w-4" />
            Descargar QR
          </Button>
        </div>
      </div>
    </Modal>
  );
}
