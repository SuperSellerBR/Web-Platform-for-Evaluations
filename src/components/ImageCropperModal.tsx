import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ImageCropperModalProps {
  file: File;
  aspectRatio?: number;
  targetWidth?: number;
  targetHeight?: number;
  circle?: boolean;
  onCancel: () => void;
  onCrop: (file: File) => void;
}

export function ImageCropperModal({
  file,
  aspectRatio = 1,
  targetWidth = 512,
  targetHeight = 512,
  circle = false,
  onCancel,
  onCrop,
}: ImageCropperModalProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(50);
  const [offsetY, setOffsetY] = useState(50);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const portalRootRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  if (typeof document !== 'undefined' && !portalRootRef.current) {
    portalRootRef.current = document.createElement('div');
  }
  const clampValue = (value: number, min: number, max: number) => Math.min(Math.max(min, value), max);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setError('');
    };
    img.onerror = () => {
      setError('Não foi possível abrir a imagem');
    };
    img.src = url;
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const cropRect = useMemo(() => {
    if (!image) return null;
    const imgW = image.width;
    const imgH = image.height;

    let cropWidth = imgW;
    let cropHeight = imgH;
    const currentRatio = imgW / imgH;
    if (currentRatio > aspectRatio) {
      cropHeight = imgH;
      cropWidth = cropHeight * aspectRatio;
    } else {
      cropWidth = imgW;
      cropHeight = cropWidth / aspectRatio;
    }

    const zoomedWidth = cropWidth / scale;
    const zoomedHeight = cropHeight / scale;
    const maxOffsetX = Math.max(0, imgW - zoomedWidth);
    const maxOffsetY = Math.max(0, imgH - zoomedHeight);
    const clampedX = Math.min(Math.max(0, offsetX), maxOffsetX);
    const clampedY = Math.min(Math.max(0, offsetY), maxOffsetY);

    return {
      x: clampedX,
      y: clampedY,
      width: zoomedWidth,
      height: zoomedHeight,
      maxOffsetX,
      maxOffsetY,
    };
  }, [image, scale, offsetX, offsetY, aspectRatio]);

  useEffect(() => {
    if (!cropRect) return;
    setOffsetX((prev) => clampValue(prev, 0, cropRect.maxOffsetX));
    setOffsetY((prev) => clampValue(prev, 0, cropRect.maxOffsetY));
  }, [cropRect?.maxOffsetX, cropRect?.maxOffsetY]);

  useEffect(() => {
    if (!image || !canvasRef.current || !cropRect) return;
    const canvas = canvasRef.current;
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, cropRect.x, cropRect.y, cropRect.width, cropRect.height, 0, 0, canvas.width, canvas.height);
    if (circle) {
      ctx.globalCompositeOperation = 'destination-in';
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }, [image, cropRect, circle, targetWidth, targetHeight]);

  useEffect(() => {
    const root = portalRootRef.current;
    if (!root) return;
    document.body.appendChild(root);
    return () => {
      if (document.body.contains(root)) {
        document.body.removeChild(root);
      }
    };
  }, []);

  const handleCrop = () => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) {
        setError('Não foi possível gerar a imagem');
        return;
      }
      const cropped = new File([blob], file.name.replace(/\.[^.]+$/, '') + '.png', { type: 'image/png' });
      onCrop(cropped);
    }, 'image/png');
  };

  const overlayStyle: CSSProperties = { zIndex: 1400 };
  const modalContent = (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4" style={overlayStyle}>
      <div
        className="bg-card text-card-foreground border border-border rounded-xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
        style={{ width: 'min(640px, calc(100% - 2rem))' }}
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="font-semibold text-foreground">Ajustar enquadramento</p>
          <button
            type="button"
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cancelar"
          >
            Fechar
          </button>
        </div>
        <div className="p-4 space-y-4 overflow-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
              <div className="relative w-full rounded-lg border border-border bg-muted/30 overflow-hidden">
                <canvas
                  ref={canvasRef}
                  className="w-full h-auto max-h-[55vh]"
                  style={{ aspectRatio: `${targetWidth} / ${targetHeight}` }}
                />
                <div
                  className={`absolute inset-0 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                  onPointerDown={(event) => {
                    if (!cropRect) return;
                    event.preventDefault();
                    dragStartRef.current = {
                      clientX: event.clientX,
                      clientY: event.clientY,
                      offsetX,
                      offsetY,
                    };
                    setIsDragging(true);
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={(event) => {
                    if (!isDragging || !dragStartRef.current || !cropRect) return;
                    const deltaX = event.clientX - dragStartRef.current.clientX;
                    const deltaY = event.clientY - dragStartRef.current.clientY;
                    const nextX = dragStartRef.current.offsetX - deltaX;
                    const nextY = dragStartRef.current.offsetY - deltaY;
                    if (cropRect.maxOffsetX >= 0) {
                      setOffsetX(clampValue(nextX, 0, cropRect.maxOffsetX));
                    }
                    if (cropRect.maxOffsetY >= 0) {
                      setOffsetY(clampValue(nextY, 0, cropRect.maxOffsetY));
                    }
                  }}
                  onPointerUp={(event) => {
                    if (!isDragging) return;
                    setIsDragging(false);
                    dragStartRef.current = null;
                    event.currentTarget.releasePointerCapture?.(event.pointerId);
                  }}
                  onPointerCancel={(event) => {
                    if (!isDragging) return;
                    setIsDragging(false);
                    dragStartRef.current = null;
                    event.currentTarget.releasePointerCapture?.(event.pointerId);
                  }}
                >
                  <span className="sr-only">Arraste a imagem para reposicioná-la</span>
                </div>
              </div>
              <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                <div>
                  <label className="text-sm text-muted-foreground">Zoom</label>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={scale}
                    onChange={(e) => setScale(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Arraste a imagem para ajustar a posição horizontal e vertical dentro do quadro, os controles serão aplicados automaticamente.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCrop}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );

  if (!portalRootRef.current) {
    return modalContent;
  }

  return createPortal(modalContent, portalRootRef.current);
}
