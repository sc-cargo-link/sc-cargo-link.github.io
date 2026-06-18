import { describe, expect, it } from "vitest";
import { optimizeRoute, countSystemJumps, recalculateRouteLegs } from "@/lib/route-optimizer";
import { createStopoverVisit, createVisitFromActions, finalizeRouteVisits } from "@/lib/route-actions";
import { findLocation } from "@/lib/location-lookup";
import type { Contract, RouteVisit } from "@/types/contracts";

function makeContract(overrides: Partial<Contract> & Pick<Contract, "id" | "title">): Contract {
  return {
    pickups: [],
    dropoffs: [],
    completed: false,
    order: 0,
    selectedForRoute: true,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("optimizeRoute capacity", () => {
  it("completes multiple pickups at the same location within ship capacity", () => {
    const contract = makeContract({
      id: "c1",
      title: "Dual cargo",
      pickups: [
        {
          id: "p1",
          locationName: "Area18",
          completed: false,
          items: [
            { id: "i1", name: "Hydrogen", scu: 0 },
            { id: "i2", name: "Waste", scu: 0 },
          ],
        },
      ],
      dropoffs: [
        {
          id: "d1",
          locationName: "Lorville",
          completed: false,
          items: [
            { id: "i3", name: "Hydrogen", scu: 10 },
            { id: "i4", name: "Waste", scu: 15 },
          ],
        },
      ],
    });

    const result = optimizeRoute([contract], {
      shipCapacity: 100,
      maxDistanceGm: 50,
      startingLocation: "Area18",
    });

    expect("error" in result).toBe(false);
    if ("error" in result) return;

    const pickups = result.visits.filter((v) => v.type === "pickup");
    const dropoffs = result.visits.filter((v) => v.type === "dropoff");
    expect(pickups.length).toBeGreaterThan(0);
    expect(dropoffs.length).toBeGreaterThan(0);
    expect(Math.max(...result.visits.map((v) => v.cargoAfter))).toBeLessThanOrEqual(100);
  });

  it("chunks cargo above ship capacity across multiple runs", () => {
    const contract = makeContract({
      id: "c2",
      title: "Heavy haul",
      pickups: [{ id: "p1", locationName: "Area18", completed: false, items: [{ id: "i1", name: "Hydrogen", scu: 0 }] }],
      dropoffs: [
        {
          id: "d1",
          locationName: "Lorville",
          completed: false,
          items: [{ id: "i2", name: "Hydrogen", scu: 40 }],
        },
      ],
    });

    const result = optimizeRoute([contract], {
      shipCapacity: 20,
      maxDistanceGm: 50,
      startingLocation: "Area18",
    });

    expect("error" in result).toBe(false);
    if ("error" in result) return;

    expect(result.visits.filter((v) => v.type === "pickup").length).toBeGreaterThan(1);
    expect(Math.max(...result.visits.map((v) => v.cargoAfter))).toBeLessThanOrEqual(20);
  });
});

describe("optimizeRoute fuel range", () => {
  it("errors per leg when hop exceeds max range (full tank at each stop)", () => {
    const contract = makeContract({
      id: "c3",
      title: "Long haul",
      pickups: [{ id: "p1", locationName: "Area18", completed: false, items: [{ id: "i1", name: "Hydrogen", scu: 10 }] }],
      dropoffs: [
        {
          id: "d1",
          locationName: "Lorville",
          completed: false,
          items: [{ id: "i2", name: "Hydrogen", scu: 10 }],
        },
      ],
    });

    const result = optimizeRoute([contract], {
      shipCapacity: 100,
      maxDistanceGm: 1,
      startingLocation: "Area18",
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toMatch(/Not enough fuel to jump/);
    expect(result.error).toMatch(/this leg is/);
  });
});

describe("optimizeRoute system jumps", () => {
  it("completes same-system cargo before crossing to another system", () => {
    const pyroContract = makeContract({
      id: "pyro",
      title: "Pyro haul",
      pickups: [
        {
          id: "p-pyro",
          locationName: "The Golden Riviera",
          completed: false,
          items: [{ id: "i1", name: "Hydrogen", scu: 0 }],
        },
      ],
      dropoffs: [
        {
          id: "d-pyro",
          locationName: "Rustville",
          completed: false,
          items: [{ id: "i2", name: "Hydrogen", scu: 8 }],
        },
      ],
    });

    const stantonContract = makeContract({
      id: "stanton",
      title: "Stanton haul",
      pickups: [
        {
          id: "p-stanton",
          locationName: "Area18",
          completed: false,
          items: [{ id: "i3", name: "Waste", scu: 0 }],
        },
      ],
      dropoffs: [
        {
          id: "d-stanton",
          locationName: "Lorville",
          completed: false,
          items: [{ id: "i4", name: "Waste", scu: 6 }],
        },
      ],
    });

    const result = optimizeRoute([pyroContract, stantonContract], {
      shipCapacity: 100,
      maxDistanceGm: 500,
      startingLocation: "Stanton Gateway",
    });

    expect("error" in result).toBe(false);
    if ("error" in result) return;

    const cargoVisits = result.visits.filter(
      (v) => v.type === "pickup" || v.type === "dropoff"
    );
    const firstStantonCargoIdx = cargoVisits.findIndex((v) => v.system === "stanton");
    const lastPyroCargoIdx = cargoVisits.reduce(
      (last, v, i) => (v.system === "pyro" ? i : last),
      -1
    );

    expect(lastPyroCargoIdx).toBeGreaterThanOrEqual(0);
    expect(firstStantonCargoIdx).toBeGreaterThan(lastPyroCargoIdx);
  });

  it("counts a cross-system leg as one jump", () => {
    const pyro = findLocation("Rustville");
    const stanton = findLocation("Lorville");
    expect(pyro).not.toBeNull();
    expect(stanton).not.toBeNull();
    if (!pyro || !stanton) return;

    expect(countSystemJumps(pyro, stanton)).toBe(1);
    expect(countSystemJumps(pyro, pyro)).toBe(0);
  });
});

describe("route-actions stopover", () => {
  it("creates a stopover visit without cargo actions", () => {
    const visit = createStopoverVisit("Checkmate");
    expect(visit).not.toBeNull();
    expect(visit?.type).toBe("stopover");
    expect(visit?.actions).toHaveLength(0);
  });

  it("creates stopover when createVisitFromActions has no actions", () => {
    const visit = createVisitFromActions("Patch City", []);
    expect(visit?.type).toBe("stopover");
    expect(visit?.actions).toHaveLength(0);
  });
});

describe("recalculateRouteLegs", () => {
  function makeVisit(
    locationName: string,
    type: RouteVisit["type"] = "pickup"
  ): RouteVisit {
    const loc = findLocation(locationName);
    if (!loc) throw new Error(`missing ${locationName}`);
    return {
      id: locationName,
      locationName: loc.poi.en ?? locationName,
      x: loc.x,
      y: loc.y,
      system: loc.system,
      type,
      actions: [],
      cargoAfter: 0,
      distanceFromPrev: 0,
    };
  }

  it("updates leg distances and total when visits are reordered", () => {
    const visits = [
      makeVisit("Area18", "start"),
      makeVisit("Lorville", "dropoff"),
      makeVisit("Rustville", "pickup"),
    ];

    const forward = recalculateRouteLegs(visits);
    expect(forward.totalDistance).toBeGreaterThan(0);
    expect(forward.visits[1].distanceFromPrev).toBeGreaterThan(0);

    const reversed = recalculateRouteLegs([visits[0], visits[2], visits[1]]);
    expect(reversed.totalDistance).not.toBe(forward.totalDistance);
    expect(reversed.visits[2].distanceFromPrev).toBeGreaterThan(0);
    expect(reversed.totalDistance).toBe(
      reversed.visits.slice(1).reduce((sum, v) => sum + v.distanceFromPrev, 0)
    );
  });

  it("finalizeRouteVisits recalculates cargo and distances together", () => {
    const visits = [
      makeVisit("Area18", "start"),
      makeVisit("Lorville", "dropoff"),
    ];
    const result = finalizeRouteVisits(visits, 12);
    expect(result.totalScu).toBe(12);
    expect(result.totalDistance).toBeGreaterThan(0);
    expect(result.visits[0].distanceFromPrev).toBe(0);
  });
});
