import { useEffect, useId, useRef, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import {
  ChevronLeft,
  ChevronRight,
  Contrast,
  FlipHorizontal,
  RotateCcw,
  RotateCw,
  ScanLine,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

export type PhotoEnhancePreset = 'original' | 'pencil' | 'scanner' | 'sharpen';

interface ProcedurePhotoViewerModalProps {
  open: boolean;
  onClose: () => void;
  photos: string[];
  initialIndex?: number;
  title?: string;
  zIndexClass?: string;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.5;

const PRESET_OPTIONS: Array<{
  id: PhotoEnhancePreset;
  label: string;
  title: string;
  icon: typeof Sparkles;
}> = [
  {
    id: 'original',
    label: 'Original',
    title: 'Imagen original sin filtros',
    icon: Sparkles,
  },
  {
    id: 'pencil',
    label: 'Realzar lápiz / tinta',
    title: 'Aclara el papel y oscurece trazos débiles',
    icon: Contrast,
  },
  {
    id: 'scanner',
    label: 'Escáner B/N',
    title: 'Alto contraste en blanco y negro eliminando sombras',
    icon: ScanLine,
  },
  {
    id: 'sharpen',
    label: 'Nitidez extra',
    title: 'Enfoca números, exponentes y signos pequeños',
    icon: Sparkles,
  },
];

export function ProcedurePhotoViewerModal({
  open,
  onClose,
  photos,
  initialIndex = 0,
  title = 'Foto del procedimiento',
  zIndexClass = 'z-[60]',
}: ProcedurePhotoViewerModalProps) {
  const rawUid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const softFilterId = `proc-soft-${rawUid}`;
  const strongFilterId = `proc-strong-${rawUid}`;

  const [activeIndex, setActiveIndex] = useState(0);
  const [preset, setPreset] = useState<PhotoEnhancePreset>('original');
  const [rotation, setRotation] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    const safeIdx = Math.max(0, Math.min(Math.max(0, photos.length - 1), initialIndex));
    setActiveIndex(safeIdx);
    setPreset('original');
    setRotation(0);
    setFlipX(false);
    setZoom(MIN_ZOOM);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
  }, [open, initialIndex, photos.length]);

  useEffect(() => {
    if (!open) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.35 : -0.35;
      setZoom((prev) => {
        const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number((prev + delta).toFixed(2))));
        if (next <= MIN_ZOOM) {
          setPan({ x: 0, y: 0 });
        }
        return next;
      });
    }

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [open]);

  useEffect(() => {
    if (!open || photos.length <= 1) return;
    function handleArrows(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') {
        switchPhoto(activeIndex - 1);
      } else if (e.key === 'ArrowRight') {
        switchPhoto(activeIndex + 1);
      }
    }
    document.addEventListener('keydown', handleArrows);
    return () => document.removeEventListener('keydown', handleArrows);
  }, [open, activeIndex, photos.length]);

  function switchPhoto(nextIdx: number) {
    if (photos.length <= 1) return;
    const wrapped = ((nextIdx % photos.length) + photos.length) % photos.length;
    setActiveIndex(wrapped);
    setZoom(MIN_ZOOM);
    setPan({ x: 0, y: 0 });
  }

  function applyZoom(targetZoom: number) {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(targetZoom.toFixed(2))));
    setZoom(clamped);
    if (clamped <= MIN_ZOOM) {
      setPan({ x: 0, y: 0 });
    }
  }

  function handleResetAll() {
    setPreset('original');
    setRotation(0);
    setFlipX(false);
    setZoom(MIN_ZOOM);
    setPan({ x: 0, y: 0 });
  }

  function clampPan(nx: number, ny: number, currentZoom: number) {
    const el = viewportRef.current;
    if (!el || currentZoom <= MIN_ZOOM) return { x: 0, y: 0 };
    const maxX = Math.max(120, el.clientWidth * (currentZoom - 1) * 0.65);
    const maxY = Math.max(120, el.clientHeight * (currentZoom - 1) * 0.65);
    return {
      x: Math.max(-maxX, Math.min(maxX, nx)),
      y: Math.max(-maxY, Math.min(maxY, ny)),
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (zoom <= MIN_ZOOM || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: pan.x,
      originY: pan.y,
    };
    setIsDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPan(clampPan(dragRef.current.originX + dx, dragRef.current.originY + dy, zoom));
  }

  function handlePointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    if (e.currentTarget.hasPointerCapture(dragRef.current.pointerId)) {
      e.currentTarget.releasePointerCapture(dragRef.current.pointerId);
    }
    dragRef.current = null;
    setIsDragging(false);
  }

  function handleDoubleClick() {
    if (zoom > 1.05) {
      applyZoom(MIN_ZOOM);
    } else {
      applyZoom(2.5);
    }
  }

  function getImageFilterCss(): string | undefined {
    switch (preset) {
      case 'pencil':
        return `contrast(1.45) brightness(1.07) saturate(1.08) url(#${softFilterId})`;
      case 'scanner':
        return `grayscale(1) contrast(1.85) brightness(1.14) url(#${strongFilterId})`;
      case 'sharpen':
        return `contrast(1.2) brightness(1.02) url(#${strongFilterId})`;
      default:
        return undefined;
    }
  }

  const activeSrc = photos[activeIndex] ?? '';
  const hasAnyTransform =
    preset !== 'original' || rotation !== 0 || flipX || zoom > MIN_ZOOM;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={photos.length > 1 ? `${title} (${activeIndex + 1} de ${photos.length})` : title}
      size="xl"
      zIndexClass={zIndexClass}
    >
      {/* Filtros SVG de convolución para realce y nitidez instantánea */}
      <svg className="sr-only" width="0" height="0" aria-hidden="true">
        <defs>
          <filter id={softFilterId} colorInterpolationFilters="sRGB">
            <feConvolveMatrix
              order="3"
              preserveAlpha="true"
              kernelMatrix="0 -0.5 0 -0.5 3 -0.5 0 -0.5 0"
            />
          </filter>
          <filter id={strongFilterId} colorInterpolationFilters="sRGB">
            <feConvolveMatrix
              order="3"
              preserveAlpha="true"
              kernelMatrix="0 -1 0 -1 5 -1 0 -1 0"
            />
          </filter>
        </defs>
      </svg>

      <div className="space-y-3">
        {/* Barra de mejora visual + orientación + zoom */}
        <div className="rounded-xl border border-sand-300 bg-sand-50/90 p-2.5 flex flex-wrap items-center justify-between gap-2">
          {/* Presets de mejora */}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Mejoras visuales">
            {PRESET_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = preset === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  title={opt.title}
                  onClick={() => setPreset(opt.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-white border border-sand-300 text-ink-light hover:bg-sand-100 hover:text-ink'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Orientación y Zoom */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="inline-flex items-center rounded-lg border border-sand-300 bg-white overflow-hidden">
              <button
                type="button"
                title="Girar 90° a la izquierda"
                onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                className="p-1.5 text-ink-light hover:bg-sand-100 hover:text-ink transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Girar 90° a la derecha"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-1.5 border-l border-sand-200 text-ink-light hover:bg-sand-100 hover:text-ink transition-colors"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Voltear horizontalmente (corregir espejo de webcam)"
                onClick={() => setFlipX((f) => !f)}
                className={`p-1.5 border-l border-sand-200 transition-colors ${
                  flipX
                    ? 'bg-brand-50 text-brand-700 font-semibold'
                    : 'text-ink-light hover:bg-sand-100 hover:text-ink'
                }`}
              >
                <FlipHorizontal className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="inline-flex items-center rounded-lg border border-sand-300 bg-white overflow-hidden">
              <button
                type="button"
                title="Alejar zoom"
                disabled={zoom <= MIN_ZOOM}
                onClick={() => applyZoom(zoom - ZOOM_STEP)}
                className="p-1.5 text-ink-light hover:bg-sand-100 hover:text-ink disabled:opacity-40 transition-colors"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="px-2 text-xs font-mono font-bold text-ink min-w-[48px] text-center border-x border-sand-200">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                title="Acercar zoom"
                disabled={zoom >= MAX_ZOOM}
                onClick={() => applyZoom(zoom + ZOOM_STEP)}
                className="p-1.5 text-ink-light hover:bg-sand-100 hover:text-ink disabled:opacity-40 transition-colors"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>

            {hasAnyTransform && (
              <button
                type="button"
                onClick={handleResetAll}
                className="inline-flex items-center gap-1 rounded-lg border border-sand-300 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-subtle hover:bg-sand-100 hover:text-ink transition-colors"
                title="Restablecer zoom, rotación y filtros"
              >
                Restablecer
              </button>
            )}
          </div>
        </div>

        {/* Área del visor con zoom y arrastre */}
        <div
          ref={viewportRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onDoubleClick={handleDoubleClick}
          className={`relative w-full h-[58vh] min-h-[300px] overflow-hidden rounded-xl border border-sand-300 bg-neutral-900 flex items-center justify-center select-none ${
            zoom > MIN_ZOOM ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'
          }`}
          style={{ touchAction: zoom > MIN_ZOOM ? 'none' : 'pan-y' }}
        >
          {activeSrc && (
            <img
              src={activeSrc}
              alt={title}
              draggable={false}
              className={`max-w-full max-h-full object-contain pointer-events-none ${
                isDragging ? '' : 'transition-transform duration-150 ease-out'
              }`}
              style={{
                filter: getImageFilterCss(),
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg) scaleX(${flipX ? -1 : 1})`,
              }}
            />
          )}

          {photos.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Foto anterior"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  switchPhoto(activeIndex - 1);
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/65 hover:bg-black/85 text-white p-2 shadow transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Foto siguiente"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  switchPhoto(activeIndex + 1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/65 hover:bg-black/85 text-white p-2 shadow transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          <span className="pointer-events-none absolute bottom-2.5 left-1/2 -translate-x-1/2 rounded-full bg-black/60 backdrop-blur-sm px-3 py-1 text-[11px] text-white/90 whitespace-nowrap">
            {zoom > MIN_ZOOM
              ? 'Arrastra para recorrer la hoja · Doble clic para restablecer'
              : 'Rueda del mouse o doble clic para ampliar hasta 500%'}
          </span>
        </div>

        {/* Miniaturas si hay varias fotos + Cerrar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {photos.length > 1 ? (
            <div className="flex items-center gap-2 overflow-x-auto py-0.5">
              {photos.map((pSrc, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => switchPhoto(idx)}
                  className={`relative h-12 w-16 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                    idx === activeIndex
                      ? 'border-brand-600 ring-2 ring-brand-600/25'
                      : 'border-sand-300 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={pSrc}
                    alt={`Miniatura ${idx + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute bottom-0.5 right-1 rounded bg-black/65 px-1 text-[10px] font-mono text-white">
                    {idx + 1}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div />
          )}

          <Button type="button" variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
