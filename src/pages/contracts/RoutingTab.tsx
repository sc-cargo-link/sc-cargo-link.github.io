import { Fragment, useMemo, useState } from "react";
import { Route, AlertCircle, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useContracts } from "@/context/ContractsContext";
import { optimizeRoute } from "@/lib/route-optimizer";
import {
  actionKey,
  createVisitFromActions,
  getAvailableActionsAtLocation,
  recalculateRouteCargo,
  finalizeRouteVisits,
  visitTypeForActions,
  type AvailableRouteAction,
} from "@/lib/route-actions";
import { contractMatchesSearch } from "@/lib/contract-search";
import { findLocation, getLocationDisplayName, getLocationStorageKey, searchLocations } from "@/lib/location-lookup";
import { POIMap } from "@/components/map/POIMap";
import { ContractDetailsTooltip } from "@/components/contracts/ContractDetailsTooltip";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatDistance, formatScu } from "@/lib/utils";
import { cargoItemLabel } from "@/lib/cargo-display";
import type { Contract, RouteAction, RouteVisit } from "@/types/contracts";
import type { StarSystem } from "@/types/map";

function uniqueStopLocations(stops: Contract["pickups"]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const stop of stops) {
    const label = getLocationDisplayName(stop.locationName) || stop.locationHint || "—";
    if (seen.has(label)) continue;
    seen.add(label);
    names.push(label);
  }
  return names;
}

function ContractRouteRow({ contract }: { contract: Contract }) {
  const pickups = uniqueStopLocations(contract.pickups);
  const dropoffs = uniqueStopLocations(contract.dropoffs);
  const rowCount = Math.max(pickups.length, dropoffs.length, 1);

  return (
    <div className="min-w-0 flex-1">
      <div className="truncate font-medium">{contract.title}</div>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Pickup
        </div>
        <div className="text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Drop off
        </div>
        {Array.from({ length: rowCount }, (_, i) => (
          <Fragment key={i}>
            <div className="truncate text-[10px] text-muted-foreground">
              {pickups[i] ?? (pickups.length === 0 && i === 0 ? "—" : "")}
            </div>
            <div className="truncate text-right text-[10px] text-muted-foreground">
              {dropoffs[i] ?? (dropoffs.length === 0 && i === 0 ? "—" : "")}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function VisitCard({
  visit,
  legNumber,
  selected,
  onSelect,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  visit: RouteVisit;
  legNumber: number | null;
  selected: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-md border p-2 text-left text-xs transition-colors ${
        selected ? "border-primary bg-primary/10" : "border-border hover:bg-accent/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {legNumber !== null && (
            <Badge variant="outline" className="shrink-0 tabular-nums">
              Leg {legNumber}
            </Badge>
          )}
          <Badge
            variant={
              visit.type === "start"
                ? "secondary"
                : visit.type === "stopover"
                  ? "outline"
                  : visit.type === "gateway"
                    ? "outline"
                    : visit.type === "pickup"
                      ? "success"
                      : "warning"
            }
          >
            {visit.type === "stopover"
              ? "refuel"
              : visit.type === "gateway"
                ? "gateway"
                : visit.type}
          </Badge>
          <span className="font-medium">{getLocationDisplayName(visit.locationName)}</span>
        </div>
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1"
            disabled={!canMoveUp}
            onClick={onMoveUp}
          >
            ↑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1"
            disabled={!canMoveDown}
            onClick={onMoveDown}
          >
            ↓
          </Button>
        </div>
      </div>
      {visit.distanceFromPrev > 0 && (
        <div className="mt-1 text-muted-foreground">+{formatDistance(visit.distanceFromPrev)}</div>
      )}
      {visit.type === "stopover" && (
        <div className="mt-1 text-muted-foreground">Refuel stopover</div>
      )}
      {visit.type === "gateway" && (
        <div className="mt-1 text-muted-foreground">Jump point transit</div>
      )}
      {visit.actions.map((action, i) => (
        <div key={i} className="mt-1 text-muted-foreground">
          {action.type === "pickup" ? "Pick up" : "Drop off"} ({action.contractTitle}):{" "}
          {action.items.map((it) => `${cargoItemLabel(it)} ${it.scu} SCU`).join(", ")}
        </div>
      ))}
      <div className="mt-1 text-[10px] text-muted-foreground">
        Cargo onboard: {formatScu(visit.cargoAfter)}
      </div>
    </button>
  );
}

function CustomRoutePanel({
  contracts,
  locationName,
  selectedActions,
  onToggle,
}: {
  contracts: Contract[];
  locationName: string;
  selectedActions: RouteAction[];
  onToggle: (action: AvailableRouteAction, checked: boolean) => void;
}) {
  const available = useMemo(
    () => getAvailableActionsAtLocation(contracts, locationName),
    [contracts, locationName]
  );

  if (!locationName) {
    return (
      <p className="text-xs text-muted-foreground">
        Select a route stop or search a location to configure pickups and dropoffs.
      </p>
    );
  }

  if (available.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No contract pickups or dropoffs at {getLocationDisplayName(locationName)}. Click Add stop
        to insert a refuel stopover.
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
            className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-accent/30"
          >
            <Checkbox
              checked={selectedKeys.has(action.key)}
              onCheckedChange={(v) => onToggle(action, !!v)}
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {action.type === "pickup" ? "Pick up" : "Drop off"} · {action.contractTitle}
              </div>
              <div className="text-muted-foreground">
                {action.items.map((it) => `${cargoItemLabel(it)} (${it.scu} SCU)`).join(", ") || formatScu(scu)}
              </div>
            </div>
          </label>
        );
      })}
    </div>
  );
}

export function RoutingTab() {
  const {
    contracts,
    route,
    setRoute,
    routingSettings,
    setRoutingSettings,
    toggleContractSelection,
  } = useContracts();
  const [locationQuery, setLocationQuery] = useState(() =>
    getLocationDisplayName(routingSettings.startingLocation)
  );
  const [startSuggestionsOpen, setStartSuggestionsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVisitIndex, setSelectedVisitIndex] = useState<number | null>(null);
  const [customLocationQuery, setCustomLocationQuery] = useState("");
  const [pendingActionKeys, setPendingActionKeys] = useState<Set<string>>(new Set());
  const [mapFocusRequest, setMapFocusRequest] = useState<{
    locationName: string;
    system: StarSystem;
    x: number;
    y: number;
    token: number;
  } | null>(null);
  const [contractSearchQuery, setContractSearchQuery] = useState("");

  const filteredContracts = useMemo(() => {
    const query = contractSearchQuery.trim().toLowerCase();
    if (!query) return contracts;
    return contracts.filter((contract) => contractMatchesSearch(contract, query));
  }, [contracts, contractSearchQuery]);

  const focusVisitOnMap = (visit: RouteVisit) => {
    setMapFocusRequest((prev) => ({
      locationName: visit.locationName,
      system: visit.system,
      x: visit.x,
      y: visit.y,
      token: (prev?.token ?? 0) + 1,
    }));
  };

  const suggestions = useMemo(
    () => (locationQuery.length > 2 ? searchLocations(locationQuery, 8) : []),
    [locationQuery]
  );

  const customSuggestions = useMemo(
    () => (customLocationQuery.length > 2 ? searchLocations(customLocationQuery, 8) : []),
    [customLocationQuery]
  );

  const configureLocation =
    selectedVisitIndex !== null && route
      ? route.visits[selectedVisitIndex]?.locationName
      : customLocationQuery;

  const selectedVisitActions =
    selectedVisitIndex !== null && route ? route.visits[selectedVisitIndex]?.actions ?? [] : [];

  const pendingActionsForPanel = useMemo(() => {
    if (selectedVisitIndex !== null) return selectedVisitActions;
    const available = getAvailableActionsAtLocation(contracts, customLocationQuery);
    return available
      .filter((a) => pendingActionKeys.has(a.key))
      .map((a) => ({
        contractId: a.contractId,
        contractTitle: a.contractTitle,
        stopId: a.stopId,
        type: a.type,
        items: a.items,
      }));
  }, [
    selectedVisitIndex,
    selectedVisitActions,
    contracts,
    customLocationQuery,
    pendingActionKeys,
  ]);

  const generateRoute = () => {
    setError(null);
    const startLoc = findLocation(locationQuery);
    const startingLocation = startLoc
      ? getLocationStorageKey(startLoc)
      : routingSettings.startingLocation;
    const settings = {
      ...routingSettings,
      startingLocation,
    };
    setRoutingSettings(settings);
    if (startLoc) setLocationQuery(startLoc.name);
    const result = optimizeRoute(contracts, settings);
    if ("error" in result) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    setRoute(result);
    setSelectedVisitIndex(null);
    setMapFocusRequest(null);
    toast.success("Route generated");
  };

  const clearRoute = () => {
    setRoute(null);
    setSelectedVisitIndex(null);
    setCustomLocationQuery("");
    setPendingActionKeys(new Set());
    setMapFocusRequest(null);
    setError(null);
    toast.success("Route cleared");
  };

  const moveVisit = (from: number, to: number) => {
    if (!route || to < 0 || to >= route.visits.length) return;
    const visits = [...route.visits];
    const [moved] = visits.splice(from, 1);
    visits.splice(to, 0, moved);
    const finalized = finalizeRouteVisits(visits, route.totalScu);
    setRoute({ ...route, ...finalized });
    if (selectedVisitIndex === from) setSelectedVisitIndex(to);
    else if (selectedVisitIndex !== null) {
      if (from < selectedVisitIndex && to >= selectedVisitIndex) {
        setSelectedVisitIndex(selectedVisitIndex - 1);
      } else if (from > selectedVisitIndex && to <= selectedVisitIndex) {
        setSelectedVisitIndex(selectedVisitIndex + 1);
      }
    }
  };

  const applyActionsToVisit = (visitIndex: number, actions: RouteAction[]) => {
    if (!route) return;
    const visits = [...route.visits];
    const visit = visits[visitIndex];
    const type =
      visit.type === "start" || visit.type === "gateway"
        ? visit.type
        : visitTypeForActions(actions, visit.type);
    visits[visitIndex] = { ...visit, actions, type };
    setRoute({ ...route, visits: recalculateRouteCargo(visits) });
  };

  const toggleActionOnVisit = (action: AvailableRouteAction, checked: boolean) => {
    if (selectedVisitIndex !== null) {
      if (!route) return;
      const visit = route.visits[selectedVisitIndex];
      let actions = [...visit.actions];
      if (checked) {
        if (!actions.some((a) => actionKey(a) === action.key)) {
          actions.push({
            contractId: action.contractId,
            contractTitle: action.contractTitle,
            stopId: action.stopId,
            type: action.type,
            items: action.items.map((i) => ({ ...i })),
          });
        }
      } else {
        actions = actions.filter((a) => actionKey(a) !== action.key);
      }
      applyActionsToVisit(selectedVisitIndex, actions);
      return;
    }

    setPendingActionKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(action.key);
      else next.delete(action.key);
      return next;
    });
  };

  const addCustomStop = () => {
    if (!customLocationQuery.trim()) return;
    const available = getAvailableActionsAtLocation(contracts, customLocationQuery);
    const actions = available
      .filter((a) => pendingActionKeys.has(a.key))
      .map((a) => ({
        contractId: a.contractId,
        contractTitle: a.contractTitle,
        stopId: a.stopId,
        type: a.type,
        items: a.items.map((i) => ({ ...i })),
      }));

    const newVisit = createVisitFromActions(customLocationQuery, actions);
    if (!newVisit) {
      toast.error("Location not found on map");
      return;
    }

    const visits = route ? [...route.visits, newVisit] : [newVisit];
    const finalized = finalizeRouteVisits(visits, route?.totalScu ?? 0);
    setRoute(finalized);
    setSelectedVisitIndex(visits.length - 1);
    setPendingActionKeys(new Set());
    toast.success(
      actions.length === 0 ? "Refuel stop added" : "Stop added to route"
    );
  };

  return (
    <div className="flex h-full min-h-[calc(100dvh-11rem)] flex-col gap-3">
      <div className="grid min-h-[680px] flex-1 gap-3 lg:grid-cols-[320px_1fr]">
        <Card className="flex h-full min-h-[680px] flex-col overflow-hidden">
          <CardHeader className="shrink-0 pb-2">
            <CardTitle className="text-sm">Route settings</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            <div className="shrink-0 space-y-3">
            <div className="space-y-1">
              <Label>Ship capacity (SCU)</Label>
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
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label>Max range per tank (GM)</Label>
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
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label>Starting location</Label>
              <Input
                value={locationQuery}
                onChange={(e) => {
                  setLocationQuery(e.target.value);
                  setStartSuggestionsOpen(true);
                }}
                onFocus={() => setStartSuggestionsOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setStartSuggestionsOpen(false), 150);
                }}
                placeholder="Search POI name…"
                className="h-8"
              />
              {startSuggestionsOpen && suggestions.length > 0 && (
                <div className="rounded-md border border-border bg-popover p-1">
                  {suggestions.map((s) => (
                    <button
                      key={`${s.system}-${s.name}`}
                      type="button"
                      className="block w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-accent"
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
                      {s.name} <span className="text-muted-foreground">({s.system})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button className="w-full" onClick={generateRoute}>
              <Route className="mr-1.5 h-3.5 w-3.5" />
              Generate optimal route
            </Button>
            {route && (
              <Button variant="outline" className="w-full" onClick={clearRoute}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Clear route
              </Button>
            )}
            {error && (
              <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-1">
              <div className="flex shrink-0 items-center justify-between gap-2">
                <Label>Contracts</Label>
                {contracts.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {contractSearchQuery.trim()
                      ? `${filteredContracts.length} of ${contracts.length}`
                      : `${contracts.length}`}
                  </span>
                )}
              </div>
              {contracts.length > 0 && (
                <div className="relative shrink-0">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={contractSearchQuery}
                    onChange={(e) => setContractSearchQuery(e.target.value)}
                    placeholder="Search contracts…"
                    className="h-8 pl-8"
                  />
                </div>
              )}
              <ScrollArea className="min-h-0 flex-1">
                <TooltipProvider delayDuration={200}>
                  <div className="space-y-1 pr-2">
                    {contracts.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Add contracts in Prep first.</p>
                    ) : filteredContracts.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No contracts match your search.</p>
                    ) : (
                      filteredContracts.map((c) => (
                        <ContractDetailsTooltip key={c.id} contract={c}>
                          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-2 py-1.5 text-xs">
                            <Checkbox
                              checked={c.selectedForRoute}
                              onCheckedChange={(v) => toggleContractSelection(c.id, !!v)}
                              className="mt-0.5"
                            />
                            <ContractRouteRow contract={c} />
                          </label>
                        </ContractDetailsTooltip>
                      ))
                    )}
                  </div>
                </TooltipProvider>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>

        <Card className="flex h-full min-h-[680px] flex-col overflow-hidden">
          <CardHeader className="flex shrink-0 flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Planned route</CardTitle>
            <div className="flex items-center gap-2">
              {route && (
                <>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{formatDistance(route.totalDistance)}</Badge>
                    <Badge variant="outline">{formatScu(route.totalScu)}</Badge>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearRoute}>
                    <Trash2 className="mr-1 h-3 w-3" />
                    Clear
                  </Button>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden p-0">
            <ScrollArea className="min-h-0 flex-1 px-6">
              <div className="space-y-2 pb-4 pr-2">
                {route ? (
                  route.visits.map((visit: RouteVisit, index) => (
                    <VisitCard
                      key={visit.id}
                      visit={visit}
                      legNumber={index > 0 ? index : null}
                      selected={selectedVisitIndex === index}
                      onSelect={() => {
                        setSelectedVisitIndex(index);
                        setCustomLocationQuery("");
                        setPendingActionKeys(new Set());
                        focusVisitOnMap(visit);
                      }}
                      onMoveUp={() => moveVisit(index, index - 1)}
                      onMoveDown={() => moveVisit(index, index + 1)}
                      canMoveUp={index > 1}
                      canMoveDown={index < route.visits.length - 1}
                    />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Generate a route or add a custom stop below.
                  </p>
                )}
              </div>
            </ScrollArea>

            <Separator />

            <div className="shrink-0 space-y-2 px-6 py-3">
              <Label className="text-xs">Custom route</Label>
              <div className="flex gap-2">
                <Input
                  value={customLocationQuery}
                  onChange={(e) => {
                    setCustomLocationQuery(e.target.value);
                    setSelectedVisitIndex(null);
                    setPendingActionKeys(new Set());
                  }}
                  placeholder="Location for new stop…"
                  className="h-8 flex-1"
                />
                <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={addCustomStop}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add stop
                </Button>
              </div>
              {customSuggestions.length > 0 && selectedVisitIndex === null && (
                <div className="rounded-md border border-border bg-popover p-1">
                  {customSuggestions.map((s) => (
                    <button
                      key={`custom-${s.system}-${s.name}`}
                      type="button"
                      className="block w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-accent"
                      onClick={() => setCustomLocationQuery(s.name)}
                    >
                      {s.name} <span className="text-muted-foreground">({s.system})</span>
                    </button>
                  ))}
                </div>
              )}
              <ScrollArea className="max-h-40">
                <CustomRoutePanel
                  contracts={contracts}
                  locationName={configureLocation}
                  selectedActions={pendingActionsForPanel}
                  onToggle={toggleActionOnVisit}
                />
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shrink-0 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Route map</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <POIMap compact routeVisits={route?.visits} focusRequest={mapFocusRequest} />
        </CardContent>
      </Card>
    </div>
  );
}
