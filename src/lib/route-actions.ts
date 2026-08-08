import { nanoid } from "nanoid";
import type { Contract, ContractStop, RouteAction, RoutePlan, RouteVisit } from "@/types/contracts";
import type { StarSystem } from "@/types/map";
import {
  findLocation,
  getLocationDisplayName,
  getLocationStorageKey,
  type ResolvedLocation,
} from "@/lib/location-lookup";
import { cargoItemsMatch, cargoItemLabel } from "@/lib/cargo-display";
import { countSystemJumps, recalculateRouteLegs, travelDistance } from "@/lib/route-optimizer";

export interface AvailableRouteAction {
  key: string;
  contractId: string;
  contractTitle: string;
  stopId: string;
  type: "pickup" | "dropoff";
  locationName: string;
  items: RouteAction["items"];
}

function locationKey(name: string): string {
  const loc = findLocation(name);
  return (loc?.poi.en ?? name).toLowerCase().trim();
}

export function pickupItemsWithScu(pickup: ContractStop, contract: Contract): RouteAction["items"] {
  const hasScu = pickup.items.some((i) => i.scu > 0);
  if (hasScu) return pickup.items.map((i) => ({ ...i }));

  return pickup.items.map((pi) => {
    const scu = contract.dropoffs.reduce(
      (sum, dropoff) =>
        sum +
        dropoff.items.filter((di) => cargoItemsMatch(di, pi)).reduce((s, di) => s + di.scu, 0),
      0
    );
    return { ...pi, name: cargoItemLabel(pi), scu };
  });
}

export function actionKey(action: Pick<RouteAction, "contractId" | "stopId" | "type">): string {
  return `${action.contractId}-${action.stopId}-${action.type}`;
}

export function getContractRouteInclusion(
  contract: Contract,
  route: RoutePlan | null
): { included: number; total: number } {
  const activePickups = contract.pickups.filter((p) => !p.completed);
  const activeDropoffs = contract.dropoffs.filter((d) => !d.completed);
  const total = activePickups.length + activeDropoffs.length;

  if (!route || total === 0) return { included: 0, total };

  const includedKeys = new Set<string>();
  for (const visit of route.visits) {
    for (const action of visit.actions) {
      if (action.contractId === contract.id) {
        includedKeys.add(actionKey(action));
      }
    }
  }

  let included = 0;
  for (const pickup of activePickups) {
    if (includedKeys.has(actionKey({ contractId: contract.id, stopId: pickup.id, type: "pickup" }))) {
      included++;
    }
  }
  for (const dropoff of activeDropoffs) {
    if (includedKeys.has(actionKey({ contractId: contract.id, stopId: dropoff.id, type: "dropoff" }))) {
      included++;
    }
  }

  return { included, total };
}

export function getAvailableActionsAtLocation(
  contracts: Contract[],
  locationName: string
): AvailableRouteAction[] {
  const key = locationKey(locationName);
  const actions: AvailableRouteAction[] = [];

  for (const contract of contracts) {
    if (!contract.selectedForRoute || contract.completed) continue;

    for (const pickup of contract.pickups) {
      if (pickup.completed) continue;
      if (locationKey(pickup.locationName) !== key) continue;
      actions.push({
        key: `${contract.id}-${pickup.id}-pickup`,
        contractId: contract.id,
        contractTitle: contract.title,
        stopId: pickup.id,
        type: "pickup",
        locationName: pickup.locationName,
        items: pickupItemsWithScu(pickup, contract),
      });
    }

    for (const dropoff of contract.dropoffs) {
      if (dropoff.completed) continue;
      if (locationKey(dropoff.locationName) !== key) continue;
      actions.push({
        key: `${contract.id}-${dropoff.id}-dropoff`,
        contractId: contract.id,
        contractTitle: contract.title,
        stopId: dropoff.id,
        type: "dropoff",
        locationName: dropoff.locationName,
        items: dropoff.items.map((i) => ({ ...i })),
      });
    }
  }

  return actions;
}

export interface ContractStopCandidate {
  locationKey: string;
  locationName: string;
  displayName: string;
  system: StarSystem | null;
  distanceM: number;
  jumps: number;
  pickupScu: number;
  dropoffScu: number;
  actions: AvailableRouteAction[];
}

function resolveFromPoint(
  route: RoutePlan | null,
  startingLocation: string
): ResolvedLocation | null {
  if (route && route.visits.length > 0) {
    const last = route.visits[route.visits.length - 1];
    const loc = findLocation(last.locationName);
    if (loc) return loc;
    return {
      name: last.locationName,
      x: last.x,
      y: last.y,
      system: last.system,
      poi: { n: last.locationName, x: last.x, y: last.y, z: 0 },
    };
  }
  return findLocation(startingLocation);
}

function routedActionKeys(route: RoutePlan | null): Set<string> {
  const keys = new Set<string>();
  if (!route) return keys;
  for (const visit of route.visits) {
    for (const action of visit.actions) {
      keys.add(actionKey(action));
    }
  }
  return keys;
}

/** Remaining contract stops for manual routing, nearest-first from the last route stop (or start). */
export function getContractStopCandidates(
  contracts: Contract[],
  route: RoutePlan | null,
  startingLocation: string
): ContractStopCandidate[] {
  const from = resolveFromPoint(route, startingLocation);
  const alreadyRouted = routedActionKeys(route);
  const byLocation = new Map<string, AvailableRouteAction[]>();

  for (const contract of contracts) {
    if (!contract.selectedForRoute || contract.completed) continue;

    for (const pickup of contract.pickups) {
      if (pickup.completed) continue;
      const key = actionKey({ contractId: contract.id, stopId: pickup.id, type: "pickup" });
      if (alreadyRouted.has(key)) continue;
      const locKey = locationKey(pickup.locationName);
      const list = byLocation.get(locKey) ?? [];
      list.push({
        key,
        contractId: contract.id,
        contractTitle: contract.title,
        stopId: pickup.id,
        type: "pickup",
        locationName: pickup.locationName,
        items: pickupItemsWithScu(pickup, contract),
      });
      byLocation.set(locKey, list);
    }

    for (const dropoff of contract.dropoffs) {
      if (dropoff.completed) continue;
      const key = actionKey({ contractId: contract.id, stopId: dropoff.id, type: "dropoff" });
      if (alreadyRouted.has(key)) continue;
      const locKey = locationKey(dropoff.locationName);
      const list = byLocation.get(locKey) ?? [];
      list.push({
        key,
        contractId: contract.id,
        contractTitle: contract.title,
        stopId: dropoff.id,
        type: "dropoff",
        locationName: dropoff.locationName,
        items: dropoff.items.map((i) => ({ ...i })),
      });
      byLocation.set(locKey, list);
    }
  }

  const candidates: ContractStopCandidate[] = [];

  for (const [locKey, actions] of byLocation) {
    const sampleName = actions[0]?.locationName ?? locKey;
    const resolved = findLocation(sampleName);
    const pickupScu = actions
      .filter((a) => a.type === "pickup")
      .reduce((sum, a) => sum + a.items.reduce((s, i) => s + i.scu, 0), 0);
    const dropoffScu = actions
      .filter((a) => a.type === "dropoff")
      .reduce((sum, a) => sum + a.items.reduce((s, i) => s + i.scu, 0), 0);

    let distanceM = Number.POSITIVE_INFINITY;
    let jumps = 0;
    if (from && resolved) {
      jumps = countSystemJumps(from, resolved);
      distanceM = travelDistance(from, resolved);
    } else if (!resolved) {
      distanceM = Number.POSITIVE_INFINITY;
    } else {
      distanceM = 0;
    }

    candidates.push({
      locationKey: locKey,
      locationName: resolved ? getLocationStorageKey(resolved) : sampleName,
      displayName: getLocationDisplayName(sampleName) || sampleName,
      system: resolved?.system ?? null,
      distanceM,
      jumps,
      pickupScu,
      dropoffScu,
      actions,
    });
  }

  return candidates.sort((a, b) => {
    if (a.jumps !== b.jumps) return a.jumps - b.jumps;
    if (a.distanceM !== b.distanceM) return a.distanceM - b.distanceM;
    return a.displayName.localeCompare(b.displayName);
  });
}

export function recalculateRouteCargo(visits: RouteVisit[]): RouteVisit[] {
  let onboard = 0;
  return visits.map((visit) => {
    for (const action of visit.actions) {
      const scu = action.items.reduce((sum, item) => sum + item.scu, 0);
      if (action.type === "pickup") onboard += scu;
      else onboard -= scu;
    }
    return { ...visit, cargoAfter: Math.max(0, onboard) };
  });
}

export function finalizeRouteVisits(
  visits: RouteVisit[],
  totalScu = 0
): { visits: RouteVisit[]; totalDistance: number; totalScu: number } {
  const withCargo = recalculateRouteCargo(visits);
  const { visits: withDistances, totalDistance } = recalculateRouteLegs(withCargo);
  return { visits: withDistances, totalDistance, totalScu };
}

export function createStopoverVisit(locationName: string): RouteVisit | null {
  const loc = findLocation(locationName);
  if (!loc) return null;

  return {
    id: nanoid(8),
    locationName: getLocationStorageKey(loc),
    x: loc.x,
    y: loc.y,
    system: loc.system,
    type: "stopover",
    actions: [],
    cargoAfter: 0,
    distanceFromPrev: 0,
  };
}

export function createStartVisit(locationName: string): RouteVisit | null {
  const loc = findLocation(locationName);
  if (!loc) return null;

  return {
    id: nanoid(8),
    locationName: getLocationStorageKey(loc),
    x: loc.x,
    y: loc.y,
    system: loc.system,
    type: "start",
    actions: [],
    cargoAfter: 0,
    distanceFromPrev: 0,
  };
}

export function createVisitFromActions(
  locationName: string,
  actions: RouteAction[]
): RouteVisit | null {
  if (actions.length === 0) return createStopoverVisit(locationName);

  const loc = findLocation(locationName);
  if (!loc) return null;

  const hasPickup = actions.some((a) => a.type === "pickup");
  const hasDropoff = actions.some((a) => a.type === "dropoff");
  let visitType: RouteVisit["type"] = "pickup";
  if (hasPickup && hasDropoff) visitType = "pickup";
  else if (hasDropoff) visitType = "dropoff";

  return {
    id: nanoid(8),
    locationName: getLocationStorageKey(loc),
    x: loc.x,
    y: loc.y,
    system: loc.system,
    type: visitType,
    actions,
    cargoAfter: 0,
    distanceFromPrev: 0,
  };
}

export function visitTypeForActions(
  actions: RouteAction[],
  fallback: RouteVisit["type"] = "stopover"
): RouteVisit["type"] {
  if (actions.length === 0) return "stopover";
  if (actions.some((a) => a.type === "pickup")) return "pickup";
  if (actions.some((a) => a.type === "dropoff")) return "dropoff";
  return fallback;
}
