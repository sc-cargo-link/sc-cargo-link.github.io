import { POIMap } from "@/components/map/POIMap";

export function MapPage() {
  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col gap-2">
      <div className="shrink-0">
        <h1 className="text-lg font-semibold">Map</h1>
        <p className="text-xs text-muted-foreground">Browse POIs across Pyro, Stanton, and Nyx</p>
      </div>
      <div className="min-h-0 flex-1">
        <POIMap />
      </div>
    </div>
  );
}
