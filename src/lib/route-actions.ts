import { nanoid } from "nanoid";
import type { Contract, ContractStop, RouteAction, RouteVisit } from "@/types/contracts";
import { findLocation, getLocationStorageKey } from "@/lib/location-lookup";

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

function pickupItemsWithScu(pickup: ContractStop, contract: Contract): RouteAction["items"] {
  const hasScu = pickup.items.some((i) => i.scu > 0);
  if (hasScu) return pickup.items.map((i) => ({ ...i }));

  return pickup.items.map((pi) => {
    const scu = contract.dropoffs.reduce(
      (sum, dropoff) =>
        sum + dropoff.items.filter((di) => di.name === pi.name).reduce((s, di) => s + di.scu, 0),
      0
    );
    return { ...pi, scu };
  });
}

export function actionKey(action: Pick<RouteAction, "contractId" | "stopId" | "type">): string {
  return `${action.contractId}-${action.stopId}-${action.type}`;
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

export function createVisitFromActions(
  locationName: string,
  actions: RouteAction[]
): RouteVisit | null {
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
