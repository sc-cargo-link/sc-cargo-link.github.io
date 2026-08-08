import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ScanRegion } from "@/types/contracts";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

interface ScreenshotPanViewerProps {
  src: string;
  alt: string;
  className?: string;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  /** Normalized region (0–1) to center on first load. */
  focusRegion?: ScanRegion;
}

function measureCoverSize(
  containerW: number,
  containerH: number,
  naturalW: number,
  naturalH: number,
  zoom: number
) {
  if (containerW <= 0 || containerH <= 0 || naturalW <= 0 || naturalH <= 0) {
    return { imgW: 0, imgH: 0, maxX: 0, maxY: 0 };
  }

  const cover = Math.max(containerW / naturalW, containerH / naturalH);
  const imgW = naturalW * cover * zoom;
  const imgH = naturalH * cover * zoom;

  return {
    imgW,
    imgH,
    maxX: Math.max(0, (imgW - containerW) / 2),
    maxY: Math.max(0, (imgH - containerH) / 2),
  };
}

/** Center region horizontally; align region top with the container top. */
function offsetForRegionTopAlign(
  region: ScanRegion,
  imgW: number,
  imgH: number,
  containerH: number,
  maxX: number,
  maxY: number
) {
  const cx = region.x + region.width / 2;
  // Image center is at container center; region top is at (region.y - 0.5) * imgH from image center.
  // Container top is -containerH/2 from container center → solve for offset.y.
  const rawX = -(cx - 0.5) * imgW;
  const rawY = -containerH / 2 - (region.y - 0.5) * imgH;
  return {
    x: Math.min(maxX, Math.max(-maxX, rawX)),
    y: Math.min(maxY, Math.max(-maxY, rawY)),
  };
}

export function ScreenshotPanViewer({
  src,
  alt,
  className,
  zoom,
  onZoomChange,
  focusRegion,
}: ScreenshotPanViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const offsetRef = useRef(offset);
  const pendingFocusRef = useRef(true);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  offsetRef.current = offset;

  const readNaturalSize = useCallback((img: HTMLImageElement | null) => {
    if (!img?.naturalWidth || !img.naturalHeight) return;
    setNatural({ w: img.naturalWidth, h: img.naturalHeight });
  }, []);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setContainerSize({ w: rect.width, h: rect.height });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    pendingFocusRef.current = true;
    setOffset({ x: 0, y: 0 });
    offsetRef.current = { x: 0, y: 0 };
    readNaturalSize(imgRef.current);
  }, [src, readNaturalSize]);

  const clampOffset = useCallback(
    (x: number, y: number, nextZoom = zoom) => {
      const { maxX, maxY } = measureCoverSize(
        containerSize.w,
        containerSize.h,
        natural.w,
        natural.h,
        nextZoom
      );
      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
      };
    },
    [zoom, containerSize.w, containerSize.h, natural.w, natural.h]
  );

  // Initial focus: pan so primary-objective top aligns with the frame (keep saved zoom).
  useEffect(() => {
    if (!pendingFocusRef.current || !focusRegion) return;
    if (natural.w <= 0 || natural.h <= 0 || containerSize.w <= 0 || containerSize.h <= 0) return;

    const { imgW, imgH, maxX, maxY } = measureCoverSize(
      containerSize.w,
      containerSize.h,
      natural.w,
      natural.h,
      zoom
    );
    const next = offsetForRegionTopAlign(
      focusRegion,
      imgW,
      imgH,
      containerSize.h,
      maxX,
      maxY
    );
    offsetRef.current = next;
    setOffset(next);
    pendingFocusRef.current = false;
  }, [
    focusRegion,
    natural.w,
    natural.h,
    containerSize.w,
    containerSize.h,
    zoom,
  ]);

  useEffect(() => {
    if (pendingFocusRef.current) return;
    setOffset((prev) => {
      const next = clampOffset(prev.x, prev.y, zoom);
      offsetRef.current = next;
      return next;
    });
  }, [zoom, clampOffset]);

  const { imgW, imgH } = measureCoverSize(
    containerSize.w,
    containerSize.h,
    natural.w,
    natural.h,
    zoom
  );

  const adjustZoom = (delta: number) => {
    pendingFocusRef.current = false;
    const next = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, Number((zoom + delta).toFixed(2)))
    );
    onZoomChange(next);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    pendingFocusRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: offsetRef.current.x,
      originY: offsetRef.current.y,
    };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const next = clampOffset(
      drag.originX + (e.clientX - drag.startX),
      drag.originY + (e.clientY - drag.startY)
    );
    offsetRef.current = next;
    setOffset(next);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative touch-none select-none overflow-hidden rounded-md border border-border/70 bg-black/40",
        dragging ? "cursor-grabbing" : "cursor-grab",
        className
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={() => {
        dragRef.current = null;
        setDragging(false);
      }}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        onLoad={(e) => readNaturalSize(e.currentTarget)}
        className="pointer-events-none absolute left-1/2 top-1/2 max-w-none will-change-transform"
        style={{
          width: imgW > 0 ? imgW : "100%",
          height: imgH > 0 ? imgH : "auto",
          transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
        }}
      />

      <div className="absolute right-1.5 top-1.5 z-10 flex gap-1">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="h-7 w-7 bg-background/85 shadow-sm backdrop-blur-sm hover:bg-background"
          disabled={zoom >= MAX_ZOOM}
          aria-label="Zoom in"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            adjustZoom(ZOOM_STEP);
          }}
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="h-7 w-7 bg-background/85 shadow-sm backdrop-blur-sm hover:bg-background"
          disabled={zoom <= MIN_ZOOM}
          aria-label="Zoom out"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            adjustZoom(-ZOOM_STEP);
          }}
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
