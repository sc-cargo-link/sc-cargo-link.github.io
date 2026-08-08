import { useState } from "react";
import { ImageIcon } from "lucide-react";
import type { ScanRegion } from "@/types/contracts";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function RegionCropImage({
  src,
  region,
  className,
}: {
  src: string;
  region: ScanRegion;
  className?: string;
}) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const cropAspect = size
    ? (region.width * size.w) / (region.height * size.h)
    : region.width / Math.max(region.height, 0.001);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border border-border/80 bg-black/40",
        className
      )}
      style={{ aspectRatio: cropAspect }}
    >
      <img
        src={src}
        alt="Primary objective"
        draggable={false}
        onLoad={(e) =>
          setSize({
            w: e.currentTarget.naturalWidth,
            h: e.currentTarget.naturalHeight,
          })
        }
        className="absolute max-w-none"
        style={{
          width: `${100 / region.width}%`,
          height: `${100 / region.height}%`,
          left: `${(-region.x / region.width) * 100}%`,
          top: `${(-region.y / region.height) * 100}%`,
        }}
      />
    </div>
  );
}

export function ObjectivePreviewIcon({
  screenshot,
  region,
}: {
  screenshot?: string;
  region: ScanRegion;
}) {
  if (!screenshot) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Preview primary objective"
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-sm p-2">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Primary objective
        </p>
        <RegionCropImage src={screenshot} region={region} className="w-72 sm:w-80" />
      </TooltipContent>
    </Tooltip>
  );
}
