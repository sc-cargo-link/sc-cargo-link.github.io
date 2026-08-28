import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useContracts } from "@/context/ContractsContext";
import { optimizeRoute, type RouteOptimizeMode } from "@/lib/route-optimizer";
import {
  actionKey,
  createStartVisit,
  createVisitFromActions,
  getAvailableActionsAtLocation,
  recalculateRouteCargo,
  finalizeRouteVisits,
  visitTypeForActions,
  type AvailableRouteAction,
  type ContractStopCandidate,
} from "@/lib/route-actions";
import {
  findLocation,
  getLocationDisplayName,
  getLocationStorageKey,
  resolveLocationReference,
} from "@/lib/location-lookup";
import { POIMap } from "@/components/map/POIMap";
import { RouteSettingsBar } from "@/components/contracts/routing/RouteSettingsBar";
import { RouteContractsRail } from "@/components/contracts/routing/RouteContractsRail";
import { RouteItinerary } from "@/components/contracts/routing/RouteItinerary";
import { RouteStopInspector } from "@/components/contracts/routing/RouteStopInspector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RouteAction, RouteVisit } from "@/types/contracts";
import type { StarSystem } from "@/types/map";

const panelClass =
  "shadow-none ring-0 border-border/80 bg-card/80 backdrop-blur-sm";

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
  const [error, setError] = useState<string | null>(null);
  const [selectedVisitIndex, setSelectedVisitIndex] = useState<number | null>(null);
  const [addingStop, setAddingStop] = useState(false);
  const [customLocationQuery, setCustomLocationQuery] = useState("");
  const [pendingActionKeys, setPendingActionKeys] = useState<Set<string>>(new Set());
  const [routeManuallyEdited, setRouteManuallyEdited] = useState(false);
  const [mapFocusRequest, setMapFocusRequest] = useState<{
    locationName: string;
    system: StarSystem;
    x: number;
    y: number;
    token: number;
  } | null>(null);

  const inspectorMode: "idle" | "edit" | "add" = addingStop
    ? "add"
    : selectedVisitIndex !== null
      ? "edit"
      : "idle";

  const selectedVisit =
    selectedVisitIndex !== null && route
      ? route.visits[selectedVisitIndex] ?? null
      : null;

  const pendingActionsForAdd: RouteAction[] = useMemo(() => {
    if (!addingStop) return [];
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
  }, [addingStop, contracts, customLocationQuery, pendingActionKeys]);

  const focusVisitOnMap = (visit: RouteVisit) => {
    setMapFocusRequest((prev) => ({
      locationName: visit.locationName,
      system: visit.system,
      x: visit.x,
      y: visit.y,
      token: (prev?.token ?? 0) + 1,
    }));
  };

  const markEdited = () => setRouteManuallyEdited(true);

  const generateLabel =
    route && routeManuallyEdited
      ? "Regenerate (replaces plan)"
      : route
        ? "Regenerate route"
        : "Generate optimal route";

  const generateRoute = (mode: RouteOptimizeMode = "optimal") => {
    if (route && routeManuallyEdited) {
      const ok = window.confirm(
        "Regenerating will replace your current customized route. Continue?"
      );
      if (!ok) return;
    }

    setError(null);
    const configuredStart = resolveLocationReference(routingSettings.startingLocation);
    const startLoc =
      configuredStart &&
      getLocationDisplayName(routingSettings.startingLocation).trim().toLowerCase() ===
        locationQuery.trim().toLowerCase()
        ? configuredStart
        : findLocation(locationQuery);
    const startingLocation = startLoc
      ? getLocationStorageKey(startLoc)
      : routingSettings.startingLocation;
    const settings = {
      ...routingSettings,
      startingLocation,
    };
    setRoutingSettings(settings);
    if (startLoc) setLocationQuery(startLoc.name);
    const result = optimizeRoute(contracts, settings, mode);
    if ("error" in result) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    setRoute(result);
    setSelectedVisitIndex(null);
    setAddingStop(false);
    setCustomLocationQuery("");
    setPendingActionKeys(new Set());
    setMapFocusRequest(null);
    setRouteManuallyEdited(false);
    toast.success(
      mode === "sequential"
        ? "Sequential route generated"
        : "Route generated"
    );
  };

  const clearRoute = () => {
    setRoute(null);
    setSelectedVisitIndex(null);
    setAddingStop(false);
    setCustomLocationQuery("");
    setPendingActionKeys(new Set());
    setMapFocusRequest(null);
    setRouteManuallyEdited(false);
    setError(null);
    toast.success("Route cleared");
  };

  const moveVisit = (from: number, to: number) => {
    if (!route || to < 0 || to >= route.visits.length) return;
    if (from === 0 || to === 0) return;
    const visits = [...route.visits];
    const [moved] = visits.splice(from, 1);
    visits.splice(to, 0, moved);
    const finalized = finalizeRouteVisits(visits, route.totalScu);
    setRoute({ ...route, ...finalized });
    markEdited();
    if (selectedVisitIndex === from) setSelectedVisitIndex(to);
    else if (selectedVisitIndex !== null) {
      if (from < selectedVisitIndex && to >= selectedVisitIndex) {
        setSelectedVisitIndex(selectedVisitIndex - 1);
      } else if (from > selectedVisitIndex && to <= selectedVisitIndex) {
        setSelectedVisitIndex(selectedVisitIndex + 1);
      }
    }
  };

  const removeVisit = (index: number) => {
    if (!route || index <= 0) return;
    const visits = route.visits.filter((_, i) => i !== index);
    if (visits.length === 0) {
      clearRoute();
      return;
    }
    const finalized = finalizeRouteVisits(visits, route.totalScu);
    setRoute({ ...route, ...finalized });
    markEdited();
    if (selectedVisitIndex === index) {
      setSelectedVisitIndex(null);
    } else if (selectedVisitIndex !== null && selectedVisitIndex > index) {
      setSelectedVisitIndex(selectedVisitIndex - 1);
    }
    toast.success("Stop removed");
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
    markEdited();
  };

  const toggleAction = (action: AvailableRouteAction, checked: boolean) => {
    if (addingStop) {
      setPendingActionKeys((prev) => {
        const next = new Set(prev);
        if (checked) next.add(action.key);
        else next.delete(action.key);
        return next;
      });
      return;
    }

    if (selectedVisitIndex === null || !route) return;
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
  };

  const addStopWithActions = (locationName: string, actions: RouteAction[]) => {
    const newVisit = createVisitFromActions(locationName, actions);
    if (!newVisit) {
      toast.error("Location not found on map");
      return;
    }

    let visits: RouteVisit[];
    if (route && route.visits.length > 0) {
      visits = [...route.visits, newVisit];
    } else {
      const start =
        createStartVisit(locationQuery) ||
        createStartVisit(routingSettings.startingLocation);
      if (!start) {
        toast.error("Set a valid starting location first");
        return;
      }
      visits = [start, newVisit];
    }
    const finalized = finalizeRouteVisits(visits, route?.totalScu ?? 0);
    setRoute(finalized);
    setSelectedVisitIndex(null);
    setAddingStop(true);
    setCustomLocationQuery("");
    setPendingActionKeys(new Set());
    markEdited();
    focusVisitOnMap(newVisit);
    toast.success(
      actions.length === 0 ? "Refuel stop added" : "Stop added — pick the next"
    );
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
    addStopWithActions(customLocationQuery, actions);
  };

  const selectVisit = (index: number) => {
    if (!route) return;
    setAddingStop(false);
    setCustomLocationQuery("");
    setPendingActionKeys(new Set());
    setSelectedVisitIndex(index);
    focusVisitOnMap(route.visits[index]);
  };

  const startAddStop = () => {
    setSelectedVisitIndex(null);
    setAddingStop(true);
    setPendingActionKeys(new Set());
  };

  const cancelAdd = () => {
    setAddingStop(false);
    setCustomLocationQuery("");
    setPendingActionKeys(new Set());
  };

  const selectCandidate = (candidate: ContractStopCandidate) => {
    if (candidate.actions.length === 1) {
      const action = candidate.actions[0];
      addStopWithActions(candidate.locationName, [
        {
          contractId: action.contractId,
          contractTitle: action.contractTitle,
          stopId: action.stopId,
          type: action.type,
          items: action.items.map((i) => ({ ...i })),
        },
      ]);
      return;
    }

    setCustomLocationQuery(candidate.locationName);
    setPendingActionKeys(new Set(candidate.actions.map((a) => a.key)));
  };

  return (
    <div className="flex flex-col gap-2.5">
      <RouteSettingsBar
        routingSettings={routingSettings}
        setRoutingSettings={setRoutingSettings}
        locationQuery={locationQuery}
        setLocationQuery={setLocationQuery}
        route={route}
        error={error}
        generateLabel={generateLabel}
        onGenerate={generateRoute}
        onClear={clearRoute}
      />

      <div className="grid min-h-[420px] gap-2.5 lg:h-[520px] lg:min-h-[520px] lg:grid-cols-[220px_minmax(0,1fr)_280px]">
        <RouteContractsRail
          contracts={contracts}
          route={route}
          onToggle={toggleContractSelection}
        />

        <RouteItinerary
          route={route}
          selectedVisitIndex={selectedVisitIndex}
          onSelectVisit={selectVisit}
          onMoveVisit={moveVisit}
          onRemoveVisit={removeVisit}
          onStartAddStop={startAddStop}
          addingStop={addingStop}
        />

        <RouteStopInspector
          mode={inspectorMode}
          contracts={contracts}
          route={route}
          startingLocation={routingSettings.startingLocation || locationQuery}
          selectedVisit={selectedVisit}
          customLocationQuery={customLocationQuery}
          setCustomLocationQuery={(query) => {
            setCustomLocationQuery(query);
            setPendingActionKeys(new Set());
          }}
          pendingActions={pendingActionsForAdd}
          onToggleAction={toggleAction}
          onSelectCandidate={selectCandidate}
          onAddStop={addCustomStop}
          onRemoveStop={() => {
            if (selectedVisitIndex !== null) removeVisit(selectedVisitIndex);
          }}
          onCancelAdd={cancelAdd}
        />
      </div>

      <Card className={cn(panelClass, "shrink-0 overflow-hidden")}>
        <CardHeader className="py-2 pb-1.5">
          <CardTitle className="text-sm font-semibold">Route map</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <POIMap compact routeVisits={route?.visits} focusRequest={mapFocusRequest} />
        </CardContent>
      </Card>
    </div>
  );
}
