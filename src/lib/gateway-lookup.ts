import type { StarSystem } from "@/types/map";
import { STAR_SYSTEMS } from "@/lib/map-data";
import { findLocationInSystem, type ResolvedLocation } from "@/lib/location-lookup";

function systemLabel(system: StarSystem): string {
  return STAR_SYSTEMS.find((s) => s.value === system)?.label ?? system;
}

export function getExitGatewayName(from: StarSystem, to: StarSystem): string {
  return `${systemLabel(to)} Gateway`;
}

export function getEntryGatewayName(from: StarSystem, to: StarSystem): string {
  return `${systemLabel(from)} Gateway`;
}

export function findGateway(from: StarSystem, to: StarSystem, side: "exit" | "entry"): ResolvedLocation | null {
  const name = side === "exit" ? getExitGatewayName(from, to) : getEntryGatewayName(from, to);
  return findLocationInSystem(name, side === "exit" ? from : to);
}
