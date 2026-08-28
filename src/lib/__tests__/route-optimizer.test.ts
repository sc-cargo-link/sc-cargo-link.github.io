import { describe, expect, it } from "vitest";
import {
  optimizeRoute,
  optimizeRouteSequential,
  countSystemJumps,
  recalculateRouteLegs,
} from "@/lib/route-optimizer";
import { createStopoverVisit, createVisitFromActions, finalizeRouteVisits } from "@/lib/route-actions";
import { findLocation, getAllLocations } from "@/lib/location-lookup";
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

  it("visits all pickup stops when one dropoff has multiple collect locations", () => {
    const contract = makeContract({
      id: "waste",
      title: "Waste haul",
      pickups: [
        {
          id: "p-sacren",
          locationName: "RL_Pyro4_col_m_trdpst_indy_001",
          completed: false,
          items: [{ id: "i1", name: "Waste", scu: 0 }],
        },
        {
          id: "p-jackson",
          locationName: "RL_Pyro2_col_m_trdp_indy_001",
          completed: false,
          items: [{ id: "i2", name: "Waste", scu: 0 }],
        },
      ],
      dropoffs: [
        {
          id: "d1",
          locationName: "RL_Pyro2_col_m_scrp_indy_001",
          completed: false,
          items: [{ id: "i3", name: "Waste", scu: 12 }],
        },
      ],
    });

    const result = optimizeRoute([contract], {
      shipCapacity: 128,
      maxDistanceGm: 500,
      startingLocation: "RL_Pyro2_col_m_trdp_indy_001",
    });

    expect("error" in result).toBe(false);
    if ("error" in result) return;

    const pickupLocations = result.visits
      .filter((v) => v.type === "pickup")
      .map((v) => v.locationName);

    expect(pickupLocations).toContain("RL_Pyro4_col_m_trdpst_indy_001");
    expect(pickupLocations).toContain("RL_Pyro2_col_m_trdp_indy_001");
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

describe("optimizeRouteSequential", () => {
  it("finishes each contract before starting the next in list order", () => {
    const first = makeContract({
      id: "first",
      title: "First contract",
      order: 0,
      createdAt: 1,
      pickups: [
        {
          id: "p1",
          locationName: "Area18",
          completed: false,
          items: [{ id: "i1", name: "Hydrogen", scu: 0 }],
        },
      ],
      dropoffs: [
        {
          id: "d1",
          locationName: "Lorville",
          completed: false,
          items: [{ id: "i2", name: "Hydrogen", scu: 5 }],
        },
      ],
    });

    const second = makeContract({
      id: "second",
      title: "Second contract",
      order: 1,
      createdAt: 2,
      pickups: [
        {
          id: "p2",
          locationName: "Area18",
          completed: false,
          items: [{ id: "i3", name: "Waste", scu: 0 }],
        },
      ],
      dropoffs: [
        {
          id: "d2",
          locationName: "New Babbage",
          completed: false,
          items: [{ id: "i4", name: "Waste", scu: 4 }],
        },
      ],
    });

    // Pass second first in the array; sequential should still honor order.
    const result = optimizeRouteSequential([second, first], {
      shipCapacity: 100,
      maxDistanceGm: 500,
      startingLocation: "Area18",
    });

    expect("error" in result).toBe(false);
    if ("error" in result) return;

    const actionContractIds = result.visits.flatMap((v) =>
      v.actions.map((a) => a.contractId)
    );
    const lastFirst = actionContractIds.lastIndexOf("first");
    const firstSecond = actionContractIds.indexOf("second");

    expect(lastFirst).toBeGreaterThanOrEqual(0);
    expect(firstSecond).toBeGreaterThan(lastFirst);
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

  it("keeps the selected POI when a route visit shares its display name", () => {
    const byName = new Map<string, ReturnType<typeof getAllLocations>>();
    for (const location of getAllLocations()) {
      const matches = byName.get(location.name) ?? [];
      matches.push(location);
      byName.set(location.name, matches);
    }
    const duplicateLocations = [...byName.values()].find(
      (matches) =>
        matches.length > 1 &&
        matches.some((a) => matches.some((b) => Math.hypot(a.x - b.x, a.y - b.y) >= 1))
    );
    expect(duplicateLocations).toBeDefined();
    if (!duplicateLocations) return;

    const selected = duplicateLocations[duplicateLocations.length - 1];
    const destination = getAllLocations().find(
      (location) =>
        location.system === selected.system &&
        Math.hypot(location.x - selected.x, location.y - selected.y) >= 1
    );
    expect(destination).toBeDefined();
    if (!destination) return;

    const result = recalculateRouteLegs([
      {
        id: "selected",
        locationName: selected.name,
        x: selected.x,
        y: selected.y,
        system: selected.system,
        type: "pickup",
        actions: [],
        cargoAfter: 0,
        distanceFromPrev: 0,
      },
      {
        id: "destination",
        locationName: destination.poi.en ?? destination.name,
        x: destination.x,
        y: destination.y,
        system: destination.system,
        type: "dropoff",
        actions: [],
        cargoAfter: 0,
        distanceFromPrev: 0,
      },
    ]);

    expect(result.visits[1].distanceFromPrev).toBeCloseTo(
      Math.hypot(selected.x - destination.x, selected.y - destination.y)
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
