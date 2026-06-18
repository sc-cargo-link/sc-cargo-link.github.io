import { useCallback, useRef, useState } from "react";
import { ChevronDown, Crop, Upload } from "lucide-react";
import type { ScanRegion, ScanRegionKey, ScanRegions } from "@/types/contracts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const REGION_LABELS: Record<ScanRegionKey, string> = {
  name: "Name",
  objective: "Primary objective",
  reward: "Reward",
};

const REGION_COLORS: Record<ScanRegionKey, string> = {
  name: "border-sky-400 bg-sky-400/20",
  objective: "border-emerald-400 bg-emerald-400/20",
  reward: "border-amber-400 bg-amber-400/20",
};

interface ScanRegionSetupProps {
  calibrationImage: string | null;
  regions: ScanRegions;
  onRegionsChange: (regions: ScanRegions) => void;
  onCalibrationImageChange: (dataUrl: string) => void;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizeRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): ScanRegion {
  const x = clamp01(Math.min(x1, x2));
  const y = clamp01(Math.min(y1, y2));
  const width = clamp01(Math.max(x1, x2) - x);
  const height = clamp01(Math.max(y1, y2) - y);
  return {
    x,
    y,
    width: Math.max(width, 0.02),
    height: Math.max(height, 0.02),
  };
}

export function ScanRegionSetup({
  calibrationImage,
  regions,
  onRegionsChange,
  onCalibrationImageChange,
}: ScanRegionSetupProps) {
  const [open, setOpen] = useState(() => !calibrationImage);
  const [activeRegion, setActiveRegion] = useState<ScanRegionKey>("name");
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const getRelativePoint = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!calibrationImage) return;
    e.preventDefault();
    const point = getRelativePoint(e.clientX, e.clientY);
    if (!point) return;
    dragRef.current = { startX: point.x, startY: point.y };
    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    e.preventDefault();
    const point = getRelativePoint(e.clientX, e.clientY);
    if (!point) return;
    const next = normalizeRect(
      dragRef.current.startX,
      dragRef.current.startY,
      point.x,
      point.y
    );
    onRegionsChange({ ...regions, [activeRegion]: next });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current && containerRef.current?.hasPointerCapture(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
  };

  const handleCalibrationFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    onCalibrationImageChange(dataUrl);
    setOpen(true);
  };

  return (
    <div className="rounded-md border border-border">
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs font-medium"
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
              !open && "-rotate-90"
            )}
          />
          <Crop className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">Scan regions</span>
          {calibrationImage && !open && (
            <span className="truncate text-[10px] font-normal text-muted-foreground">
              — configured
            </span>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleCalibrationFile(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          variant="outline"
          size="sm"
          className="h-7 shrink-0 text-xs"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="mr-1 h-3 w-3" />
          {calibrationImage ? "Change sample" : "Upload sample"}
        </Button>
      </div>

      {open && (
        <div className="space-y-2 border-t border-border p-2">
          <div className="flex flex-wrap gap-1">
            {(Object.keys(REGION_LABELS) as ScanRegionKey[]).map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={activeRegion === key ? "default" : "outline"}
                className="h-7 text-[10px]"
                onClick={() => setActiveRegion(key)}
              >
                {REGION_LABELS[key]}
              </Button>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground">
            Draw a box on the sample screenshot for <strong>{REGION_LABELS[activeRegion]}</strong>.
            All uploads use these regions.
          </p>

          {calibrationImage ? (
            <div
              ref={containerRef}
              className="relative mx-auto w-[70%] cursor-crosshair touch-none select-none overflow-hidden rounded-md border border-border bg-black/40"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <img
                src={calibrationImage}
                alt="Scan calibration"
                className="pointer-events-none block h-auto w-full"
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
              />
              {(Object.keys(REGION_LABELS) as ScanRegionKey[]).map((key) => {
                const region = regions[key];
                return (
                  <div
                    key={key}
                    className={cn(
                      "pointer-events-none absolute border-2",
                      REGION_COLORS[key],
                      key === activeRegion && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                    )}
                    style={{
                      left: `${region.x * 100}%`,
                      top: `${region.y * 100}%`,
                      width: `${region.width * 100}%`,
                      height: `${region.height * 100}%`,
                    }}
                  >
                    <span className="absolute left-0 top-0 bg-background/80 px-1 text-[9px] font-medium">
                      {REGION_LABELS[key]}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-32 w-full items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
              Upload a sample contract screenshot to set scan boxes
            </div>
          )}
        </div>
      )}
    </div>
  );
}
