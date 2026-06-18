import { describe, expect, it } from "vitest";
import { optimizeRoute } from "@/lib/route-optimizer";
import type { Contract } from "@/types/contracts";

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
