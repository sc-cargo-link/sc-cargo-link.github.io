import { useMemo } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Plus, Trash2 } from "lucide-react";
import {
  actionKey,
  getAvailableActionsAtLocation,
  getContractStopCandidates,
  type AvailableRouteAction,
  type ContractStopCandidate,
} from "@/lib/route-actions";
import {
  getLocationDisplayName,
  getLocationStorageKey,
  isExactStoredLocation,
  searchLocations,
} from "@/lib/location-lookup";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatDistance, formatScu } from "@/lib/utils";
import { cargoItemLabel } from "@/lib/cargo-display";
import type { Contract, RouteAction, RoutePlan, RouteVisit } from "@/types/contracts";

const panelClass =
  "shadow-none ring-0 border-border/80 bg-card/80 backdrop-blur-sm";

function ActionsChecklist({
  contracts,
  locationName,
  selectedActions,
  onToggle,
  emptyHint,
}: {
  contracts: Contract[];
  locationName: string;
  selectedActions: RouteAction[];
  onToggle: (action: AvailableRouteAction, checked: boolean) => void;
  emptyHint: string;
}) {
  const available = useMemo(
    () => getAvailableActionsAtLocation(contracts, locationName),
    [contracts, locationName]
  );

  if (!locationName.trim()) {
    return <p className="text-xs text-muted-foreground">{emptyHint}</p>;
  }

  if (available.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No contract pickups or dropoffs at {getLocationDisplayName(locationName)}.
        You can still add this as a refuel stopover.
      </p>
    );
  }

  const selectedKeys = new Set(selectedActions.map((a) => actionKey(a)));

  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-muted-foreground">
        Available at {getLocationDisplayName(locationName)}
      </p>
      {available.map((action) => {
        const scu = action.items.reduce((sum, item) => sum + item.scu, 0);
        return (
          <label
            key={action.key}
            className="flex cursor-pointer items-start gap-2 rounded-md border border-border/70 bg-muted/20 px-2 py-1.5 text-xs hover:bg-accent/40"
          >
            <Checkbox
              checked={selectedKeys.has(action.key)}
              onCheckedChange={(v) => onToggle(action, !!v)}
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {action.type === "pickup" ? "Pick up" : "Drop off"} ·{" "}
                {action.contractTitle}
              </div>
              <div className="text-muted-foreground">
                {action.items
                  .map((it) => `${cargoItemLabel(it)} (${it.scu} SCU)`)
                  .join(", ") || formatScu(scu)}
              </div>
            </div>
          </label>
        );
      })}
    </div>
  );
}

function CandidateButton({
  candidate,
  selected,
  onSelect,
}: {
  candidate: ContractStopCandidate;
  selected: boolean;
  onSelect: () => void;
}) {
  const distanceLabel = Number.isFinite(candidate.distanceM)
    ? formatDistance(candidate.distanceM)
    : "—";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-md border px-2.5 py-2 text-left text-xs transition-colors",
        "border-border/70 bg-muted/20 hover:bg-accent/40",
        selected && "border-primary/50 bg-primary/10"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{candidate.displayName}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            {candidate.pickupScu > 0 && (
              <span className="inline-flex items-center gap-0.5 text-success">
                <ArrowUpFromLine className="h-3 w-3" />
                {formatScu(candidate.pickupScu)}
              </span>
            )}
            {candidate.dropoffScu > 0 && (
              <span className="inline-flex items-center gap-0.5 text-warning">
                <ArrowDownToLine className="h-3 w-3" />
                {formatScu(candidate.dropoffScu)}
              </span>
            )}
            {candidate.system && <span>{candidate.system}</span>}
          </div>
        </div>
        <div className="shrink-0 text-right tabular-nums text-[11px] text-muted-foreground">
          <div>{distanceLabel}</div>
          {candidate.jumps > 0 && <div>{candidate.jumps} jump</div>}
        </div>
      </div>
    </button>
  );
}

interface RouteStopInspectorProps {
  mode: "idle" | "edit" | "add";
  contracts: Contract[];
  route: RoutePlan | null;
  startingLocation: string;
  selectedVisit: RouteVisit | null;
  customLocationQuery: string;
  setCustomLocationQuery: (query: string) => void;
  pendingActions: RouteAction[];
  onToggleAction: (action: AvailableRouteAction, checked: boolean) => void;
  onSelectCandidate: (candidate: ContractStopCandidate) => void;
  onAddStop: () => void;
  onRemoveStop: () => void;
  onCancelAdd: () => void;
}

export function RouteStopInspector({
  mode,
  contracts,
  route,
  startingLocation,
  selectedVisit,
  customLocationQuery,
  setCustomLocationQuery,
  pendingActions,
  onToggleAction,
  onSelectCandidate,
  onAddStop,
  onRemoveStop,
  onCancelAdd,
}: RouteStopInspectorProps) {
  const candidates = useMemo(
    () => getContractStopCandidates(contracts, route, startingLocation),
    [contracts, route, startingLocation]
  );

  const customLocationDisplay = isExactStoredLocation(customLocationQuery)
    ? getLocationDisplayName(customLocationQuery)
    : customLocationQuery;
  const query = customLocationDisplay.trim().toLowerCase();
  const filteredCandidates = useMemo(() => {
    if (!query) return candidates;
    return candidates.filter(
      (c) =>
        c.displayName.toLowerCase().includes(query) ||
        (c.system?.toLowerCase().includes(query) ?? false)
    );
  }, [candidates, query]);

  const customSuggestions = useMemo(
    () => (customLocationDisplay.length > 2 ? searchLocations(customLocationDisplay, 8) : []),
    [customLocationDisplay]
  );

  const selectedCandidateKey = customLocationQuery.trim()
    ? customLocationQuery.toLowerCase().trim()
    : "";

  return (
    <div
      className={cn(
        panelClass,
        "flex min-h-[280px] flex-col overflow-hidden rounded-lg border lg:min-h-0"
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
        <h3 className="text-sm font-semibold">
          {mode === "edit" ? "Edit stop" : mode === "add" ? "Add stop" : "Stop details"}
        </h3>
        {mode === "add" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={onCancelAdd}
          >
            Cancel
          </Button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-2.5">
        {mode === "idle" && (
          <p className="px-1 py-6 text-center text-sm text-muted-foreground">
            Select a stop in the itinerary to edit it, or click Add stop to insert a
            custom location.
          </p>
        )}

        {mode === "edit" && selectedVisit && (
          <>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold uppercase tracking-wide">
                Location
              </Label>
              <p className="truncate text-sm font-medium">
                {getLocationDisplayName(selectedVisit.locationName)}
              </p>
              <p className="text-[11px] tabular-nums text-muted-foreground">
                Cargo after stop: {formatScu(selectedVisit.cargoAfter)}
              </p>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="pr-2">
                {selectedVisit.type === "start" ? (
                  <p className="text-xs text-muted-foreground">
                    Starting location. Change it from the settings bar, then regenerate
                    or rebuild the route.
                  </p>
                ) : (
                  <ActionsChecklist
                    contracts={contracts}
                    locationName={selectedVisit.locationName}
                    selectedActions={selectedVisit.actions}
                    onToggle={onToggleAction}
                    emptyHint="No location selected."
                  />
                )}
              </div>
            </ScrollArea>
            {selectedVisit.type !== "start" && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={onRemoveStop}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Remove stop
              </Button>
            )}
          </>
        )}

        {mode === "add" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide">
                Contract stops
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Nearest remaining stops from{" "}
                {route?.visits.length
                  ? getLocationDisplayName(route.visits[route.visits.length - 1].locationName)
                  : getLocationDisplayName(startingLocation) || "start"}
                .
              </p>
              <Input
                value={customLocationDisplay}
                onChange={(e) => setCustomLocationQuery(e.target.value)}
                placeholder="Filter or search any POI…"
                className="h-8"
                autoFocus
              />
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-2 pr-2">
                {filteredCandidates.length > 0 ? (
                  <div className="space-y-1">
                    {filteredCandidates.map((candidate) => (
                      <CandidateButton
                        key={candidate.locationKey}
                        candidate={candidate}
                        selected={
                          selectedCandidateKey.length > 0 &&
                          (candidate.displayName.toLowerCase() === selectedCandidateKey ||
                            candidate.locationName.toLowerCase() === selectedCandidateKey ||
                            candidate.locationKey === selectedCandidateKey)
                        }
                        onSelect={() => onSelectCandidate(candidate)}
                      />
                    ))}
                  </div>
                ) : candidates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No remaining contract stops. Select contracts in the left rail, or
                    search any POI below for a refuel stop.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No contract stops match this filter.
                  </p>
                )}

                {customSuggestions.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Other POIs
                    </p>
                    <div className="rounded-md border border-border/80 bg-popover p-1">
                      {customSuggestions.map((s) => (
                        <button
                          key={`custom-${s.system}-${s.name}`}
                          type="button"
                          className="block w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-accent"
                          onClick={() => setCustomLocationQuery(getLocationStorageKey(s))}
                        >
                          {s.name}{" "}
                          <span className="text-muted-foreground">({s.system})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {customLocationQuery.trim() && (
                  <ActionsChecklist
                    contracts={contracts}
                    locationName={customLocationQuery}
                    selectedActions={pendingActions}
                    onToggle={onToggleAction}
                    emptyHint="Select a stop to configure cargo."
                  />
                )}
              </div>
            </ScrollArea>

            <Button
              className="h-8 shrink-0"
              disabled={!customLocationQuery.trim()}
              onClick={onAddStop}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add to route
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
