import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ChevronDown, ListOrdered, MapPin, Route, Trash2 } from "lucide-react";
import { getLocationStorageKey, getSystemLabel, searchLocations } from "@/lib/location-lookup";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn, formatDistance, formatScu } from "@/lib/utils";
import type { RouteOptimizeMode } from "@/lib/route-optimizer";
import type { RoutePlan, RoutingSettings } from "@/types/contracts";

const panelClass =
  "shadow-none ring-0 border-border/80 bg-card/80 backdrop-blur-sm";

interface RouteSettingsBarProps {
  routingSettings: RoutingSettings;
  setRoutingSettings: (settings: RoutingSettings) => void;
  locationQuery: string;
  setLocationQuery: (query: string) => void;
  route: RoutePlan | null;
  error: string | null;
  generateLabel: string;
  onGenerate: (mode?: RouteOptimizeMode) => void;
  onClear: () => void;
}

export function RouteSettingsBar({
  routingSettings,
  setRoutingSettings,
  locationQuery,
  setLocationQuery,
  route,
  error,
  generateLabel,
  onGenerate,
  onClear,
}: RouteSettingsBarProps) {
  const [startSuggestionsOpen, setStartSuggestionsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const startWrapRef = useRef<HTMLDivElement>(null);
  const startInputRef = useRef<HTMLInputElement>(null);
  const startMenuRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(
    () => (locationQuery.trim().length >= 1 ? searchLocations(locationQuery, 8) : []),
    [locationQuery]
  );

  const updateMenuPos = () => {
    const el = startInputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(rect.width, 280);
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8);
    }
    setMenuPos({ top: rect.bottom + 4, left, width });
  };

  useLayoutEffect(() => {
    if (!startSuggestionsOpen || suggestions.length === 0) {
      setMenuPos(null);
      return;
    }
    updateMenuPos();
    const onReposition = () => updateMenuPos();
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [startSuggestionsOpen, suggestions.length, locationQuery]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (startWrapRef.current?.contains(t) || startMenuRef.current?.contains(t)) return;
      setStartSuggestionsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const showStartSuggestions =
    startSuggestionsOpen && suggestions.length > 0 && menuPos != null;

  return (
    <div
      className={cn(
        panelClass,
        "relative z-30 shrink-0 rounded-lg border px-3 py-2.5 sm:px-4"
      )}
    >
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-end lg:gap-3">
        <div className="grid flex-1 gap-2 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold uppercase tracking-wide">
              Capacity (SCU)
            </Label>
            <Input
              type="number"
              min={1}
              value={routingSettings.shipCapacity}
              onChange={(e) =>
                setRoutingSettings({
                  ...routingSettings,
                  shipCapacity: parseInt(e.target.value, 10) || 1,
                })
              }
              className="h-8 tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold uppercase tracking-wide">
              Max range (GM)
            </Label>
            <Input
              type="number"
              min={1}
              value={routingSettings.maxDistanceGm}
              onChange={(e) =>
                setRoutingSettings({
                  ...routingSettings,
                  maxDistanceGm: parseFloat(e.target.value) || 1,
                })
              }
              className="h-8 tabular-nums"
            />
          </div>
          <div ref={startWrapRef} className="relative space-y-1">
            <Label className="text-[11px] font-semibold uppercase tracking-wide">
              Start
            </Label>
            <Input
              ref={startInputRef}
              value={locationQuery}
              onChange={(e) => {
                setLocationQuery(e.target.value);
                setStartSuggestionsOpen(true);
              }}
              onFocus={() => {
                if (locationQuery.trim()) setStartSuggestionsOpen(true);
              }}
              placeholder="Search POI…"
              className="h-8"
            />
            {showStartSuggestions &&
              createPortal(
                <div
                  ref={startMenuRef}
                  style={{
                    position: "fixed",
                    top: menuPos.top,
                    left: menuPos.left,
                    width: menuPos.width,
                  }}
                  className="z-[200] max-h-48 overflow-y-auto rounded-md border border-border/80 bg-popover p-1 shadow-md"
                >
                  {suggestions.map((s) => (
                    <button
                      key={`${s.system}-${s.name}-${s.x}`}
                      type="button"
                      className="flex w-full items-center gap-2 truncate rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setLocationQuery(s.name);
                        setStartSuggestionsOpen(false);
                        setRoutingSettings({
                          ...routingSettings,
                          startingLocation: getLocationStorageKey(s),
                        });
                      }}
                    >
                      <MapPin className="h-3 w-3 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate">{s.name}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {getSystemLabel(s.system)}
                      </span>
                    </button>
                  ))}
                </div>,
                document.body
              )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 lg:shrink-0">
          {route && (
            <div className="mr-1 flex gap-1.5">
              <Badge variant="outline" className="tabular-nums">
                {formatDistance(route.totalDistance)}
              </Badge>
              <Badge variant="outline" className="tabular-nums">
                {formatScu(route.totalScu)}
              </Badge>
            </div>
          )}
          <div className="flex items-stretch">
            <Button
              className="h-8 rounded-r-none"
              onClick={() => onGenerate("optimal")}
            >
              <Route className="mr-1.5 h-3.5 w-3.5" />
              {generateLabel}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="h-8 rounded-l-none border-l border-primary-foreground/30 px-2"
                  aria-label="More generate options"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuItem
                  className="cursor-pointer items-start gap-2 py-2"
                  onSelect={() => onGenerate("sequential")}
                >
                  <ListOrdered className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 space-y-0.5">
                    <div className="font-medium">Generate in sequence</div>
                    <p className="text-xs text-muted-foreground">
                      Finish each contract before the next, optimizing stops within
                      each contract.
                    </p>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {route && (
            <Button variant="outline" className="h-8" onClick={onClear}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-2 flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
