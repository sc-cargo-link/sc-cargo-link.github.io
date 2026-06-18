import { useEffect, useMemo, useState } from "react";
import type { LocationCategory, StarSystem } from "@/types/map";
import type { RouteVisit } from "@/types/contracts";
import { loadMapSystem, saveMapSystem } from "@/lib/contracts-storage";
import { findPoiIndexInMapData } from "@/lib/location-lookup";
import { routeToMapLegs, routeToOverlay } from "@/lib/route-optimizer";
import { getMapData, STAR_SYSTEMS } from "@/lib/map-data";
import { POIMapCanvas } from "@/components/map/POIMapCanvas";
import { LocationSearch } from "@/components/map/LocationSearch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FILTER_LABELS: Record<LocationCategory, string> = {
  planets: "Planets",
  moons: "Moons",
  lagrangian: "Lagrangian",
  stations: "Stations",
  otherPoi: "Other POI",
};

const DEFAULT_FILTERS: Record<LocationCategory, boolean> = {
  planets: true,
  moons: true,
  lagrangian: true,
  stations: true,
  otherPoi: true,
};

interface POIMapProps {
  initialSystem?: StarSystem;
  routeVisits?: RouteVisit[];
  compact?: boolean;
  focusRequest?: {
    locationName: string;
    system: StarSystem;
    x: number;
    y: number;
    token: number;
  } | null;
}

export function POIMap({ initialSystem, routeVisits, compact, focusRequest }: POIMapProps) {
  const [system, setSystem] = useState<StarSystem>(() => initialSystem ?? loadMapSystem());
  const [selectedPath, setSelectedPath] = useState<string[] | null>(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [focusTarget, setFocusTarget] = useState<{ poiIndex: number; token: number } | null>(null);
  const [focusToken, setFocusToken] = useState(0);

  useEffect(() => {
    saveMapSystem(system);
  }, [system]);

  useEffect(() => {
    if (!focusRequest) return;
    if (focusRequest.system !== system) {
      setSystem(focusRequest.system);
      return;
    }

    const mapData = getMapData(system);
    const poiIndex = findPoiIndexInMapData(
      mapData,
      focusRequest.locationName,
      focusRequest.x,
      focusRequest.y
    );
    if (poiIndex === null) return;

    const poi = mapData.pois[poiIndex];
    if (poi?.pc?.length) setSelectedPath(poi.pc);
    setFocusTarget({ poiIndex, token: focusRequest.token });
  }, [focusRequest, system]);

  const data = useMemo(() => getMapData(system), [system]);

  const systemOverlay = useMemo(
    () => (routeVisits ? routeToOverlay(routeVisits, system) : undefined),
    [routeVisits, system]
  );

  const systemLegs = useMemo(
    () => (routeVisits ? routeToMapLegs(routeVisits, system) : undefined),
    [routeVisits, system]
  );

  const toggleFilter = (key: LocationCategory) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const clearSelection = () => {
    setSelectedPath(null);
    setFocusTarget(null);
  };

  return (
    <div className={`flex min-h-0 flex-col ${compact ? "h-[65vh] min-h-[520px]" : "h-full min-h-[calc(100vh-5rem)]"}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card p-2">
        <div className="flex items-center gap-2">
          <Label>System</Label>
          <Select
            value={system}
            onValueChange={(v) => {
              setSystem(v as StarSystem);
              setSelectedPath(null);
              setFocusTarget(null);
            }}
          >
            <SelectTrigger className="h-8 w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAR_SYSTEMS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <LocationSearch
          data={data}
          onSelect={(result) => {
            const poi = data.pois[result.poiIndex];
            if (poi?.pc?.length) setSelectedPath(poi.pc);
            const token = focusToken + 1;
            setFocusToken(token);
            setFocusTarget({ poiIndex: result.poiIndex, token });
          }}
        />
        <Button variant="outline" size="sm" onClick={clearSelection}>
          Clear
        </Button>
        <div className="flex flex-wrap gap-3">
          {(Object.keys(FILTER_LABELS) as LocationCategory[]).map((key) => (
            <label key={key} className="flex items-center gap-1.5 text-[11px] text-foreground">
              <Switch checked={filters[key]} onCheckedChange={() => toggleFilter(key)} />
              {FILTER_LABELS[key]}
            </label>
          ))}
        </div>
      </div>

      <POIMapCanvas
        data={data}
        filters={filters}
        selectedPath={selectedPath}
        onSelectPath={setSelectedPath}
        routeOverlay={systemOverlay}
        routeLegs={systemLegs}
        focusTarget={focusTarget}
        className="min-h-[480px] flex-1"
      />
    </div>
  );
}
