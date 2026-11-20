import { useEffect, useRef, useState } from 'react';
import { Camera, Upload, Trash2, ZoomIn, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { ProcedurePhotoViewerModal } from '../ui/ProcedurePhotoViewerModal';
import { Button } from '../ui/Button';

export const MAX_PROCEDURE_PHOTOS = 3;

interface ProcedurePhotoUploaderProps {
  photos: string[];
  onChange: (nextPhotos: string[]) => void;
  missingHighlight?: boolean;
}

export async function compressImageFile(
  blob: Blob,
  maxDim = 1200,
  quality = 0.72
): Promise<string> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
      el.src = objectUrl;
    });

    const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo inicializar el procesador de imagen.');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function ProcedurePhotoUploader({
  photos,
  onChange,
  missingHighlight = false,
}: ProcedurePhotoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [zoomPhoto, setZoomPhoto] = useState<number | null>(null);

  const remainingSlots = Math.max(0, MAX_PROCEDURE_PHOTOS - photos.length);

  function stopCameraStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  async function startCamera(mode: 'environment' | 'user') {
    stopCameraStream();
    setCameraError('');
    if (typeof navigator === 'undefined' || typeof navigator.mediaDevices?.getUserMedia !== 'function') {
      setCameraError('Tu navegador no permite abrir la cámara web directamente. Usa el selector nativo o sube una imagen.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setCameraError(
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Permiso de cámara denegado. Habilítalo o usa "Subir imagen".'
          : 'No se encontró una cámara disponible. Puedes usar el selector nativo o subir una imagen.'
      );
    }
  }

  useEffect(() => {
    if (!cameraOpen) {
      stopCameraStream();
      return;
    }
    startCamera(facingMode);
    return () => {
      stopCameraStream();
    };
  }, [cameraOpen, facingMode]);

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError('');
    setProcessing(true);

    try {
      const selected = Array.from(fileList).slice(0, remainingSlots);
      const compressed: string[] = [];
      for (const file of selected) {
        if (!file.type.startsWith('image/')) continue;
        const dataUrl = await compressImageFile(file);
        compressed.push(dataUrl);
      }
      if (compressed.length === 0) {
        setError('Selecciona archivos de imagen válidos.');
        return;
      }
      onChange([...photos, ...compressed].slice(0, MAX_PROCEDURE_PHOTOS));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la foto.');
    } finally {
      setProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (captureInputRef.current) captureInputRef.current.value = '';
    }
  }

  function handleOpenCamera() {
    setError('');
    if (typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function') {
      setCameraOpen(true);
    } else {
      captureInputRef.current?.click();
    }
  }

  function handleCaptureFrame() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const maxDim = 1200;
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
    onChange([...photos, dataUrl].slice(0, MAX_PROCEDURE_PHOTOS));
    setCameraOpen(false);
  }

  function removePhoto(index: number) {
    onChange(photos.filter((_, i) => i !== index));
  }

  const borderColor = missingHighlight && photos.length === 0
    ? '#dc2626'
    : 'color-mix(in srgb, var(--form-primary, #1B3B6F) 28%, #D6D1C5)';

  return (
    <div
      className="mt-4 rounded-lg border p-3.5 space-y-3 transition-colors"
      style={{
        borderColor,
        borderRadius: 'var(--form-radius, 0.5rem)',
        backgroundColor: 'color-mix(in srgb, var(--form-primary, #1B3B6F) 4%, var(--form-card-bg, #ffffff))',
        color: 'var(--form-text, #1C1917)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Camera className="h-4 w-4 shrink-0" style={{ color: 'var(--form-primary, #1B3B6F)' }} />
          <div>
            <p className="text-xs font-semibold leading-tight">
              Foto del procedimiento <span className="text-red-500">*</span>
            </p>
            <p className="text-[11px] opacity-75">
              Adjunta evidencia de tu desarrollo (obligatorio, máx. {MAX_PROCEDURE_PHOTOS} fotos)
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            photos.length > 0
              ? 'bg-green-100 text-green-800'
              : missingHighlight
                ? 'bg-red-100 text-red-700'
                : 'bg-amber-100 text-amber-800'
          }`}
        >
          {photos.length > 0 ? (
            <>
              <CheckCircle2 className="h-3 w-3" />
              {photos.length}/{MAX_PROCEDURE_PHOTOS} foto{photos.length === 1 ? '' : 's'}
            </>
          ) : (
            <>
              <AlertCircle className="h-3 w-3" />
              Requerida
            </>
          )}
        </span>
      </div>

      {/* Hidden inputs */}
      <input
        ref={captureInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleFilesSelected(e.target.files)}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleFilesSelected(e.target.files)}
        className="hidden"
      />

      {remainingSlots > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleOpenCamera}
            disabled={processing}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              backgroundColor: 'var(--form-primary, #1B3B6F)',
              borderRadius: 'var(--form-radius, 0.5rem)',
            }}
          >
            {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            Sacar foto
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={processing}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-85 disabled:opacity-50"
            style={{
              borderColor: 'color-mix(in srgb, var(--form-primary, #1B3B6F) 32%, #D6D1C5)',
              backgroundColor: 'var(--form-card-bg, #ffffff)',
              color: 'var(--form-text, #1C1917)',
              borderRadius: 'var(--form-radius, 0.5rem)',
            }}
          >
            <Upload className="h-3.5 w-3.5" />
            Subir imagen
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          {photos.map((src, idx) => (
            <div
              key={idx}
              className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-black/15 bg-black/5"
            >
              <img
                src={src}
                alt={`Procedimiento ${idx + 1}`}
                onClick={() => setZoomPhoto(idx)}
                className="h-full w-full object-cover cursor-pointer"
              />
              <button
                type="button"
                onClick={() => setZoomPhoto(idx)}
                title="Ampliar foto"
                className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 p-1 text-white opacity-90 hover:bg-black/80 transition-opacity"
              >
                <ZoomIn className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => removePhoto(idx)}
                title="Quitar foto"
                className="absolute top-1.5 right-1.5 rounded-full bg-red-600/90 p-1 text-white hover:bg-red-700 shadow-sm"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Webcam modal */}
      <Modal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        title="Fotografiar procedimiento"
        size="md"
      >
        <div className="space-y-4">
          {cameraError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-2">
              <p>{cameraError}</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setCameraOpen(false);
                  captureInputRef.current?.click();
                }}
              >
                Abrir cámara del sistema / archivos
              </Button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-sand-300 bg-black aspect-[4/3] flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
              >
                <RefreshCw className="h-4 w-4" />
                Cambiar cámara
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCameraOpen(false);
                  fileInputRef.current?.click();
                }}
              >
                <Upload className="h-4 w-4" />
                Subir archivo
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={() => setCameraOpen(false)}>
                Cancelar
              </Button>
              {!cameraError && (
                <Button type="button" onClick={handleCaptureFrame}>
                  <Camera className="h-4 w-4" />
                  Capturar foto
                </Button>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Enhanced zoom viewer modal */}
      <ProcedurePhotoViewerModal
        open={zoomPhoto !== null}
        onClose={() => setZoomPhoto(null)}
        photos={photos}
        initialIndex={zoomPhoto ?? 0}
        title="Evidencia del procedimiento"
      />
    </div>
  );
}
