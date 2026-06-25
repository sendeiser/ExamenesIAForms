import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Search, Link, ExternalLink, Loader2 } from 'lucide-react';

interface WikiImage {
  pageid: number;
  title: string;
  thumburl: string;
  url: string;
  descriptionurl: string;
}

interface ImageSearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

export function ImageSearchModal({ open, onClose, onSelect }: ImageSearchModalProps) {
  const [query, setQuery] = useState('');
  const [images, setImages] = useState<WikiImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [urlValue, setUrlValue] = useState('');
  const [tab, setTab] = useState<'search' | 'url'>('search');

  useEffect(() => {
    if (open) {
      setQuery('');
      setImages([]);
      setError('');
      setUrlValue('');
      setTab('search');
    }
  }, [open]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');

    try {
      const resp = await fetch(
        `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=24&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json&origin=*`
      );
      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      const data = await resp.json();
      const pages = data.query?.pages;
      if (!pages) {
        setError('Sin resultados. Intenta con otro término.');
        return;
      }
      const results: WikiImage[] = Object.values(pages).map((p: any) => ({
        pageid: p.pageid,
        title: p.title.replace(/^File:/, ''),
        thumburl: p.imageinfo?.[0]?.thumburl ?? '',
        url: p.imageinfo?.[0]?.url ?? '',
        descriptionurl: p.imageinfo?.[0]?.descriptionurl ?? '',
      })).filter((r) => r.thumburl);
      setImages(results);
      if (!results.length) setError('Sin resultados. Intenta con otro término.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al buscar imágenes');
    } finally {
      setLoading(false);
    }
  }, [query]);

  function openGoogleImages() {
    window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query || '')}`, '_blank');
  }

  return (
    <Modal open={open} onClose={onClose} title="Agregar imagen" size="lg">
      <div className="space-y-4">
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setTab('search')}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'search' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Buscar imágenes
          </button>
          <button
            onClick={() => setTab('url')}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'url' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Pegar URL
          </button>
        </div>

        {tab === 'search' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar imágenes..."
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={loading || !query.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            <div className="flex justify-between items-center">
              <p className="text-xs text-gray-400">Resultados de Wikimedia Commons</p>
              <Button variant="ghost" onClick={openGoogleImages}>
                <ExternalLink className="h-3 w-3" />
                Abrir Google Images
              </Button>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            {images.length > 0 && (
              <div className="grid grid-cols-4 gap-2 max-h-72 overflow-y-auto">
                {images.map((img) => (
                  <button
                    key={img.pageid}
                    onClick={() => onSelect(img.url)}
                    className="relative group rounded-lg overflow-hidden border hover:border-brand-500 transition-colors"
                  >
                    <img
                      src={img.thumburl}
                      alt={img.title}
                      className="w-full h-24 object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  </button>
                ))}
              </div>
            )}

            {!loading && images.length === 0 && query && !error && (
              <p className="text-sm text-gray-400 text-center">Sin resultados.</p>
            )}
          </div>
        )}

        {tab === 'url' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                placeholder="https://ejemplo.com/imagen.jpg"
              />
              <Button onClick={() => { if (urlValue.trim()) onSelect(urlValue.trim()); }} disabled={!urlValue.trim()}>
                Agregar
              </Button>
            </div>
            {urlValue && (
              <div className="rounded-lg overflow-hidden border max-w-xs">
                <img src={urlValue} alt="" className="w-full h-40 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            )}
            <p className="text-xs text-gray-400">
              Pega cualquier URL de imagen. Puedes buscar imágenes en Google Images abriendo la pestaña "Buscar imágenes" y usando el botón "Abrir Google Images".
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
