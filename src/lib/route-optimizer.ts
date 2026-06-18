import { nanoid } from "nanoid";
import type { RouteMapLeg, StarSystem } from "@/types/map";
import type {
  Contract,
  ContractStop,
  RouteAction,
  RoutePlan,
  RouteVisit,
  RoutingSettings,
  CargoItem,
} from "@/types/contracts";
import { distance2d } from "@/lib/map-data";
import {
  findLocation,
  getLocationDisplayName,
  getLocationStorageKey,
  getRefuelStationsInRange,
  type ResolvedLocation,
} from "@/lib/location-lookup";
import { cargoItemLabel, cargoItemsMatch, contractRouteLabel } from "@/lib/cargo-display";
import { findGateway } from "@/lib/gateway-lookup";
import { formatDistance } from "@/lib/utils";

interface PendingTask {
  id: string;
  contractId: string;
  contractTitle: string;
  stopId: string;
  type: "pickup" | "dropoff";
  locationName: string;
  x: number;
  y: number;
  system: StarSystem;
  scu: number;
  items: RouteAction["items"];
  dependsOn: string[];
}

interface TravelHop {
  locationName: string;
  x: number;
  y: number;
  system: StarSystem;
  visitType: RouteVisit["type"];
  distance: number;
}

function samePlace(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < 1;
}

function resolveStopLocation(stop: ContractStop): ResolvedLocation | null {
  if (stop.locationName) {
    const resolved = findLocation(stop.locationName);
    if (resolved) return resolved;
  }
  if (stop.locationHint) return findLocation(stop.locationHint);
  return null;
}

function stopStorageKey(stop: ContractStop, loc: ResolvedLocation): string {
  return stop.locationName || getLocationStorageKey(loc);
}

function systemsAlongLeg(from: ResolvedLocation, to: ResolvedLocation): StarSystem[] {
  return from.system === to.system ? [from.system] : [from.system, to.system];
}

function buildFuelRangeError(
  from: ResolvedLocation,
  to: ResolvedLocation,
  maxDistanceGm: number,
  legDistanceM: number
): string {
  const maxDistanceM = maxDistanceGm * 1e9;
  const stations = getRefuelStationsInRange(
    from,
    maxDistanceM,
    systemsAlongLeg(from, to)
  );

  const fromLabel = getLocationDisplayName(from.name) || from.name;
  const toLabel = getLocationDisplayName(to.name) || to.name;

  let msg = `Not enough fuel to jump from ${fromLabel} to ${toLabel}. Range is ${maxDistanceGm} GM`;
  if (legDistanceM > 0) msg += `, this leg is ${formatDistance(legDistanceM)}`;
  msg += ".";

  if (stations.length > 0) {
    msg += ` Stations within range from ${fromLabel}: ${stations
      .map((s) => `${s.name} (${formatDistance(s.distanceM)})`)
      .join(", ")}.`;
  } else {
    msg += ` No refuel stations found within range from ${fromLabel}.`;
  }

  return msg;
}

function hopToLocation(hop: TravelHop): ResolvedLocation {
  const loc = findLocation(hop.locationName);
  if (loc) return loc;
  return {
    name: hop.locationName,
    x: hop.x,
    y: hop.y,
    system: hop.system,
    poi: { n: hop.locationName, x: hop.x, y: hop.y, z: 0 },
  };
}

/** Each hop is checked with a full tank — user refuels at every station visit. */
function validateTravelFuel(
  from: ResolvedLocation,
  travel: TravelHop[],
  maxDistanceGm: number
): { error: string } | null {
  const maxDistanceM = maxDistanceGm * 1e9;
  let fromLoc = from;

  for (const hop of travel) {
    if (hop.distance > maxDistanceM) {
      return {
        error: buildFuelRangeError(fromLoc, hopToLocation(hop), maxDistanceGm, hop.distance),
      };
    }
    if (hop.distance > 0 || hop.visitType === "gateway") {
      fromLoc = hopToLocation(hop);
    }
  }

  return null;
}

function planTravel(from: ResolvedLocation, to: ResolvedLocation): TravelHop[] | { error: string } {
  if (from.system === to.system) {
    if (samePlace(from, to)) return [];
    return [
      {
        locationName: getLocationStorageKey(to),
        x: to.x,
        y: to.y,
        system: to.system,
        visitType: "pickup",
        distance: distance2d(from, to),
      },
    ];
  }

  const exitGw = findGateway(from.system, to.system, "exit");
  const entryGw = findGateway(from.system, to.system, "entry");
  if (!exitGw || !entryGw) {
    return {
      error: `No gateway route found between ${from.system} and ${to.system}.`,
    };
  }

  const hops: TravelHop[] = [];

  if (!samePlace(from, exitGw)) {
    hops.push({
      locationName: getLocationStorageKey(exitGw),
      x: exitGw.x,
      y: exitGw.y,
      system: exitGw.system,
      visitType: "gateway",
      distance: distance2d(from, exitGw),
    });
  } else {
    hops.push({
      locationName: getLocationStorageKey(exitGw),
      x: exitGw.x,
      y: exitGw.y,
      system: exitGw.system,
      visitType: "gateway",
      distance: 0,
    });
  }

  hops.push({
    locationName: getLocationStorageKey(entryGw),
    x: entryGw.x,
    y: entryGw.y,
    system: entryGw.system,
    visitType: "gateway",
    distance: 0,
  });

  if (!samePlace(entryGw, to)) {
    hops.push({
      locationName: to.name,
      x: to.x,
      y: to.y,
      system: to.system,
      visitType: "pickup",
      distance: distance2d(entryGw, to),
    });
  }

  return hops;
}

function travelDistance(from: ResolvedLocation, to: ResolvedLocation): number {
  const hops = planTravel(from, to);
  if ("error" in hops) return Infinity;
  return hops.reduce((sum, hop) => sum + hop.distance, 0);
}

function visitToResolvedLocation(visit: RouteVisit): ResolvedLocation {
  const loc = findLocation(visit.locationName);
  if (loc) return loc;
  return {
    name: visit.locationName,
    x: visit.x,
    y: visit.y,
    system: visit.system,
    poi: { n: visit.locationName, x: visit.x, y: visit.y, z: 0 },
  };
}

function legDistanceBetweenVisits(prev: RouteVisit, curr: RouteVisit): number {
  if (samePlace(prev, curr)) return 0;
  if (prev.type === "gateway" && curr.type === "gateway") return 0;

  const from = visitToResolvedLocation(prev);
  const to = visitToResolvedLocation(curr);

  if (from.system === to.system) return distance2d(from, to);
  if (prev.type === "gateway" || curr.type === "gateway") {
    return distance2d(from, to);
  }

  return travelDistance(from, to);
}

export function recalculateRouteLegs(visits: RouteVisit[]): {
  visits: RouteVisit[];
  totalDistance: number;
} {
  let totalDistance = 0;
  const updated = visits.map((visit, index) => {
    if (index === 0) return { ...visit, distanceFromPrev: 0 };
    const dist = legDistanceBetweenVisits(visits[index - 1], visit);
    totalDistance += dist;
    return { ...visit, distanceFromPrev: dist };
  });
  return { visits: updated, totalDistance };
}

/** 0 when same system, 1 when a cross-system gateway leg is required. */
export function countSystemJumps(from: ResolvedLocation, to: ResolvedLocation): number {
  return from.system === to.system ? 0 : 1;
}

interface TaskTravelScore {
  jumps: number;
  distance: number;
}

function scoreTaskTravel(from: ResolvedLocation, to: ResolvedLocation): TaskTravelScore {
  return {
    jumps: countSystemJumps(from, to),
    distance: travelDistance(from, to),
  };
}

function isBetterTaskScore(candidate: TaskTravelScore, best: TaskTravelScore): boolean {
  if (candidate.jumps !== best.jumps) return candidate.jumps < best.jumps;
  return candidate.distance < best.distance;
}

function resolvePickupTask(
  pickup: ContractStop,
  contract: Contract
): { scu: number; items: CargoItem[] } {
  const directScu = pickup.items.reduce((s, i) => s + i.scu, 0);
  if (directScu > 0) {
    return { scu: directScu, items: pickup.items.map((i) => ({ ...i })) };
  }

  const items = pickup.items.map((pi) => {
    const matchedScu = contract.dropoffs.reduce(
      (sum, dropoff) =>
        sum +
        dropoff.items
          .filter((di) => cargoItemsMatch(di, pi))
          .reduce((s, di) => s + di.scu, 0),
      0
    );
    return { ...pi, name: cargoItemLabel(pi), scu: matchedScu };
  });
  const scu = items.reduce((s, i) => s + i.scu, 0);
  if (scu > 0) return { scu, items };

  const fallbackScu = contract.dropoffs.reduce(
    (sum, dropoff) => sum + dropoff.items.reduce((s, i) => s + i.scu, 0),
    0
  );
  if (pickup.items.length === 1) {
    return {
      scu: fallbackScu,
      items: [{ ...pickup.items[0], scu: fallbackScu }],
    };
  }
  return {
    scu: fallbackScu,
    items: pickup.items.map((i, idx) => ({ ...i, scu: idx === 0 ? fallbackScu : 0 })),
  };
}

interface CargoLeg {
  pickup: ContractStop;
  dropoff: ContractStop;
  items: CargoItem[];
  totalScu: number;
}

interface PickupPortion {
  pickup: ContractStop;
  items: CargoItem[];
  totalScu: number;
}

interface CargoLegPlan {
  dropoff: ContractStop;
  dropoffItems: CargoItem[];
  totalScu: number;
  pickups: PickupPortion[];
}

function splitScuAcrossStops(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(total / parts);
  const remainder = total % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}

function buildCargoLegPlans(contract: Contract): CargoLegPlan[] {
  const plans: CargoLegPlan[] = [];
  const activeDropoffs = contract.dropoffs.filter((d) => !d.completed);
  const fallbackPickup = contract.pickups.find((p) => !p.completed);

  for (const dropoff of activeDropoffs) {
    for (const item of dropoff.items) {
      if (item.scu <= 0) continue;

      const matchingPickups = contract.pickups.filter(
        (p) => !p.completed && p.items.some((pi) => cargoItemsMatch(pi, item)),
      );
      const labeledItem: CargoItem = {
        id: item.id,
        name: cargoItemLabel(item),
        nameHint: item.nameHint,
        scu: item.scu,
      };

      let pickupsForItem: ContractStop[];
      if (matchingPickups.length > 1 && activeDropoffs.length === 1) {
        pickupsForItem = matchingPickups;
      } else if (matchingPickups.length > 1 && activeDropoffs.length > 1) {
        const dropoffIdx = activeDropoffs.indexOf(dropoff);
        pickupsForItem = [matchingPickups[dropoffIdx % matchingPickups.length]];
      } else if (matchingPickups.length === 1) {
        pickupsForItem = matchingPickups;
      } else if (fallbackPickup) {
        pickupsForItem = [fallbackPickup];
      } else {
        continue;
      }

      const scuParts = splitScuAcrossStops(item.scu, pickupsForItem.length);
      const pickups: PickupPortion[] = pickupsForItem
        .map((pickup, idx) => ({
          pickup,
          totalScu: scuParts[idx] ?? 0,
          items: [{ ...labeledItem, id: nanoid(6), scu: scuParts[idx] ?? 0 }],
        }))
        .filter((portion) => portion.totalScu > 0);

      if (pickups.length === 0) continue;

      plans.push({
        dropoff,
        dropoffItems: [labeledItem],
        totalScu: item.scu,
        pickups,
      });
    }
  }

  if (plans.length === 0) {
    for (const pickup of contract.pickups) {
      if (pickup.completed) continue;
      const dropoff = contract.dropoffs.find((d) => !d.completed);
      if (!dropoff) continue;
      const { items, scu } = resolvePickupTask(pickup, contract);
      if (scu <= 0) continue;
      const labeledItems = items.map((i) => ({ ...i, name: cargoItemLabel(i) }));
      plans.push({
        dropoff,
        dropoffItems: labeledItems,
        totalScu: scu,
        pickups: [{ pickup, items: labeledItems.map((i) => ({ ...i })), totalScu: scu }],
      });
    }
  }

  return plans;
}

function buildCargoLegs(contract: Contract): CargoLeg[] {
  return buildCargoLegPlans(contract).map((plan) => ({
    pickup: plan.pickups[0].pickup,
    dropoff: plan.dropoff,
    items: plan.dropoffItems,
    totalScu: plan.totalScu,
  }));
}

function splitLegIntoChunks(leg: CargoLeg, capacity: number): CargoItem[][] {
  const chunks: CargoItem[][] = [];
  const items = leg.items.map((i) => ({ ...i }));
  let itemIdx = 0;
  let itemLeft = items[0]?.scu ?? 0;
  let remaining = leg.totalScu;

  while (remaining > 0) {
    const chunkCap = Math.min(remaining, capacity);
    const chunk: CargoItem[] = [];
    let chunkLeft = chunkCap;

    while (chunkLeft > 0 && itemIdx < items.length) {
      const take = Math.min(chunkLeft, itemLeft);
      if (take > 0) {
        chunk.push({ id: nanoid(6), name: cargoItemLabel(items[itemIdx]), scu: take });
        chunkLeft -= take;
        itemLeft -= take;
        remaining -= take;
      }
      if (itemLeft <= 0) {
        itemIdx += 1;
        itemLeft = items[itemIdx]?.scu ?? 0;
      }
    }

    if (chunk.length > 0) chunks.push(chunk);
    else break;
  }

  return chunks;
}

function addChunkedLegTasks(
  tasks: PendingTask[],
  contract: Contract,
  leg: CargoLeg,
  capacity: number
): void {
  const pickupLoc = resolveStopLocation(leg.pickup);
  const dropoffLoc = resolveStopLocation(leg.dropoff);
  if (!pickupLoc || !dropoffLoc) return;

  const pickupKey = stopStorageKey(leg.pickup, pickupLoc);
  const dropoffKey = stopStorageKey(leg.dropoff, dropoffLoc);
  const routeLabel = contractRouteLabel(contract);

  const itemChunks = splitLegIntoChunks(leg, capacity);
  let prevTaskId: string | null = null;

  for (const chunkItems of itemChunks) {
    const chunkScu = chunkItems.reduce((s, i) => s + i.scu, 0);

    const pickupId = nanoid(8);
    tasks.push({
      id: pickupId,
      contractId: contract.id,
      contractTitle: routeLabel,
      stopId: leg.pickup.id,
      type: "pickup",
      locationName: pickupKey,
      x: pickupLoc.x,
      y: pickupLoc.y,
      system: pickupLoc.system,
      scu: chunkScu,
      items: chunkItems.map((i) => ({ ...i })),
      dependsOn: prevTaskId ? [prevTaskId] : [],
    });

    const dropoffId = nanoid(8);
    tasks.push({
      id: dropoffId,
      contractId: contract.id,
      contractTitle: routeLabel,
      stopId: leg.dropoff.id,
      type: "dropoff",
      locationName: dropoffKey,
      x: dropoffLoc.x,
      y: dropoffLoc.y,
      system: dropoffLoc.system,
      scu: chunkScu,
      items: chunkItems.map((i) => ({ ...i })),
      dependsOn: [pickupId],
    });

    prevTaskId = dropoffId;
  }
}

function addChunkedLegPlanTasks(
  tasks: PendingTask[],
  contract: Contract,
  plan: CargoLegPlan,
  capacity: number,
): void {
  if (plan.pickups.length === 1) {
    addChunkedLegTasks(tasks, contract, {
      pickup: plan.pickups[0].pickup,
      dropoff: plan.dropoff,
      items: plan.dropoffItems,
      totalScu: plan.totalScu,
    }, capacity);
    return;
  }

  const dropoffLoc = resolveStopLocation(plan.dropoff);
  if (!dropoffLoc) return;

  const dropoffKey = stopStorageKey(plan.dropoff, dropoffLoc);
  const routeLabel = contractRouteLabel(contract);
  const itemName = cargoItemLabel(plan.dropoffItems[0] ?? { id: "", name: "", scu: 0 });

  const resolvedPickups = plan.pickups
    .map((portion) => {
      const loc = resolveStopLocation(portion.pickup);
      if (!loc) return null;
      return {
        portion,
        loc,
        key: stopStorageKey(portion.pickup, loc),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (resolvedPickups.length !== plan.pickups.length) return;

  let remaining = plan.totalScu;
  let prevRoundDropoffId: string | null = null;

  while (remaining > 0) {
    const roundScu = Math.min(remaining, capacity);
    const roundPickupScu = splitScuAcrossStops(roundScu, resolvedPickups.length);
    const pickupTaskIds: string[] = [];

    for (let i = 0; i < resolvedPickups.length; i++) {
      const portionScu = roundPickupScu[i] ?? 0;
      if (portionScu <= 0) continue;

      const { portion, loc, key } = resolvedPickups[i];
      const pickupId = nanoid(8);
      tasks.push({
        id: pickupId,
        contractId: contract.id,
        contractTitle: routeLabel,
        stopId: portion.pickup.id,
        type: "pickup",
        locationName: key,
        x: loc.x,
        y: loc.y,
        system: loc.system,
        scu: portionScu,
        items: [{ id: nanoid(6), name: itemName, scu: portionScu }],
        dependsOn: prevRoundDropoffId ? [prevRoundDropoffId] : [],
      });
      pickupTaskIds.push(pickupId);
    }

    const dropoffId = nanoid(8);
    tasks.push({
      id: dropoffId,
      contractId: contract.id,
      contractTitle: routeLabel,
      stopId: plan.dropoff.id,
      type: "dropoff",
      locationName: dropoffKey,
      x: dropoffLoc.x,
      y: dropoffLoc.y,
      system: dropoffLoc.system,
      scu: roundScu,
      items: [{ id: nanoid(6), name: itemName, scu: roundScu }],
      dependsOn: pickupTaskIds,
    });

    prevRoundDropoffId = dropoffId;
    remaining -= roundScu;
  }
}

function buildTasks(contracts: Contract[], capacity: number): PendingTask[] {
  const tasks: PendingTask[] = [];

  for (const contract of contracts) {
    if (!contract.selectedForRoute || contract.completed) continue;

    const plans = buildCargoLegPlans(contract);
    for (const plan of plans) {
      addChunkedLegPlanTasks(tasks, contract, plan, capacity);
    }
  }

  return tasks;
}

function canDoTask(
  task: PendingTask,
  completed: Set<string>,
  onboardScu: number,
  capacity: number
): boolean {
  if (!task.dependsOn.every((id) => completed.has(id))) return false;
  if (task.type === "pickup" && onboardScu + task.scu > capacity) return false;
  if (task.type === "dropoff" && onboardScu < task.scu) return false;
  return true;
}

function mergeVisitActions(visit: RouteVisit, task: PendingTask): RouteVisit {
  const existing = visit.actions.find(
    (a) => a.contractId === task.contractId && a.stopId === task.stopId && a.type === task.type
  );
  if (existing) {
    existing.items = [...existing.items, ...task.items];
    return visit;
  }
  return {
    ...visit,
    actions: [
      ...visit.actions,
      {
        contractId: task.contractId,
        contractTitle: task.contractTitle,
        stopId: task.stopId,
        type: task.type,
        items: task.items,
      },
    ],
  };
}

function applyCargoTask(
  visits: RouteVisit[],
  task: PendingTask,
  taskLoc: ResolvedLocation,
  hopDistance: number,
  onboardScu: number
): number {
  if (task.type === "pickup") onboardScu += task.scu;
  else onboardScu -= task.scu;

  const lastVisit = visits[visits.length - 1];
  const sameLocation =
    lastVisit &&
    lastVisit.system === taskLoc.system &&
    samePlace(lastVisit, taskLoc) &&
    lastVisit.type === task.type;

  if (sameLocation) {
    visits[visits.length - 1] = {
      ...mergeVisitActions(lastVisit, task),
      cargoAfter: onboardScu,
    };
  } else {
    visits.push({
      id: nanoid(8),
      locationName: task.locationName,
      x: task.x,
      y: task.y,
      system: task.system,
      type: task.type,
      actions: [
        {
          contractId: task.contractId,
          contractTitle: task.contractTitle,
          stopId: task.stopId,
          type: task.type,
          items: task.items,
        },
      ],
      cargoAfter: onboardScu,
      distanceFromPrev: hopDistance,
    });
  }

  return onboardScu;
}

function pushVisit(
  visits: RouteVisit[],
  hop: TravelHop,
  onboardScu: number
): void {
  const lastVisit = visits[visits.length - 1];
  const sameLocation =
    lastVisit &&
    lastVisit.system === hop.system &&
    samePlace(lastVisit, hop) &&
    lastVisit.type === hop.visitType;

  if (sameLocation) return;

  visits.push({
    id: nanoid(8),
    locationName: hop.locationName,
    x: hop.x,
    y: hop.y,
    system: hop.system,
    type: hop.visitType,
    actions: [],
    cargoAfter: onboardScu,
    distanceFromPrev: hop.distance,
  });
}

export function optimizeRoute(
  contracts: Contract[],
  settings: RoutingSettings
): RoutePlan | { error: string } {
  const startLoc = findLocation(settings.startingLocation);
  if (!startLoc) {
    return { error: `Starting location "${settings.startingLocation}" not found on map.` };
  }

  const tasks = buildTasks(contracts, settings.shipCapacity);
  if (tasks.length === 0) {
    return { error: "No routable tasks. Select contracts with valid locations." };
  }

  const completed = new Set<string>();
  const remaining = [...tasks];
  let current = startLoc;
  let onboardScu = 0;
  let totalDistance = 0;
  const visits: RouteVisit[] = [
    {
      id: nanoid(8),
      locationName: getLocationStorageKey(startLoc),
      x: startLoc.x,
      y: startLoc.y,
      system: startLoc.system,
      type: "start",
      actions: [],
      cargoAfter: 0,
      distanceFromPrev: 0,
    },
  ];

  while (remaining.length > 0) {
    let bestIdx = -1;
    let bestScore: TaskTravelScore | null = null;

    for (let i = 0; i < remaining.length; i++) {
      const task = remaining[i];
      if (!canDoTask(task, completed, onboardScu, settings.shipCapacity)) continue;
      const taskLoc = findLocation(task.locationName);
      if (!taskLoc) continue;
      const score = scoreTaskTravel(current, taskLoc);
      if (bestScore === null || isBetterTaskScore(score, bestScore)) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx < 0) {
      return {
        error:
          "Cannot complete all tasks within capacity constraints. Try increasing ship SCU or splitting contracts.",
      };
    }

    const task = remaining.splice(bestIdx, 1)[0];
    const taskLoc = findLocation(task.locationName);
    if (!taskLoc) {
      return { error: `Location "${task.locationName}" not found on map.` };
    }

    let travel = planTravel(current, taskLoc);
    if ("error" in travel) return { error: travel.error };

    const fuelError = validateTravelFuel(current, travel, settings.maxDistanceGm);
    if (fuelError) return fuelError;

    if (travel.length === 0) {
      onboardScu = applyCargoTask(visits, task, taskLoc, 0, onboardScu);
    } else {
      for (let i = 0; i < travel.length; i++) {
        const hop = travel[i];
        const isLast = i === travel.length - 1;

        totalDistance += hop.distance;

        if (isLast) {
          onboardScu = applyCargoTask(visits, task, taskLoc, hop.distance, onboardScu);
        } else {
          pushVisit(visits, hop, onboardScu);
        }
      }
    }

    completed.add(task.id);
    current = taskLoc;
  }

  const totalScu = contracts
    .filter((c) => c.selectedForRoute && !c.completed)
    .reduce((sum, c) => {
      const dropoffScu = c.dropoffs.reduce(
        (s, stop) => s + stop.items.reduce((a, i) => a + i.scu, 0),
        0
      );
      return sum + dropoffScu;
    }, 0);

  return { visits, totalDistance, totalScu };
}

export function routeToOverlay(visits: RouteVisit[], system?: StarSystem) {
  const points: RouteOverlayPoint[] = [];
  let filteredOrder = 0;
  let lastIncludedIdx = -1;

  for (let i = 0; i < visits.length; i++) {
    const v = visits[i];
    if (system && v.system !== system) continue;

    let legDistance = 0;
    if (lastIncludedIdx >= 0) {
      for (let j = lastIncludedIdx + 1; j <= i; j++) {
        legDistance += visits[j].distanceFromPrev;
      }
    }

    points.push({
      x: v.x,
      y: v.y,
      label: getLocationDisplayName(v.locationName),
      order: filteredOrder++,
      system: v.system,
      type: v.type === "start" ? ("start" as const) : v.type,
      legDistance,
    });
    lastIncludedIdx = i;
  }

  return points;
}

export function routeToMapLegs(visits: RouteVisit[], system?: StarSystem): RouteMapLeg[] {
  const legs: RouteMapLeg[] = [];
  let lastIncludedIdx = -1;

  for (let i = 0; i < visits.length; i++) {
    const v = visits[i];
    if (system && v.system !== system) continue;

    if (lastIncludedIdx >= 0) {
      const fromX = visits[lastIncludedIdx].x;
      const fromY = visits[lastIncludedIdx].y;
      const toX = v.x;
      const toY = v.y;

      for (let j = lastIncludedIdx + 1; j <= i; j++) {
        const dist = visits[j].distanceFromPrev;
        if (dist <= 0) continue;
        legs.push({
          legNumber: j,
          distance: dist,
          fromX,
          fromY,
          toX,
          toY,
        });
      }
    }
    lastIncludedIdx = i;
  }

  return legs;
}
