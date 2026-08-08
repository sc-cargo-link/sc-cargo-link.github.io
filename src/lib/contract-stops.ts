import { nanoid } from "nanoid";
import type { CargoItem, ContractStop } from "@/types/contracts";
import { cargoItemLabel } from "@/lib/cargo-display";
import { findLocation } from "@/lib/location-lookup";

function stopLocationKey(stop: ContractStop): string {
  const resolved = findLocation(stop.locationName);
  if (resolved) return (resolved.poi.en ?? resolved.name).toLowerCase().trim();

  const fallback = (stop.locationName || stop.locationHint || "").toLowerCase().trim();
  // Keep manually added placeholders as separate cards until a real location is set.
  if (!fallback || fallback === "pickup" || fallback === "dropoff") {
    return `id:${stop.id}`;
  }
  return fallback;
}

function itemKey(item: CargoItem): string {
  return cargoItemLabel(item).toLowerCase();
}

/** Merge cargo rows with the same name; sum SCU for dropoffs. */
export function mergeCargoItems(
  items: CargoItem[],
  type: "pickup" | "dropoff"
): CargoItem[] {
  const byName = new Map<string, CargoItem>();

  for (const item of items) {
    const key = itemKey(item);
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, { ...item, id: item.id || nanoid(6) });
      continue;
    }
    if (type === "dropoff") {
      existing.scu += item.scu;
    }
    if (!existing.name && item.name) existing.name = item.name;
    if (!existing.nameHint && item.nameHint) existing.nameHint = item.nameHint;
  }

  return [...byName.values()];
}

/** One stop per location; duplicate cargo at that location shown once. */
export function consolidateStops(
  stops: ContractStop[],
  type: "pickup" | "dropoff"
): ContractStop[] {
  const byLocation = new Map<string, ContractStop>();

  for (const stop of stops) {
    const key = stopLocationKey(stop);
    const existing = byLocation.get(key);
    if (!existing) {
      byLocation.set(key, {
        ...stop,
        items: mergeCargoItems(stop.items, type),
      });
      continue;
    }

    byLocation.set(key, {
      ...existing,
      locationName: existing.locationName || stop.locationName,
      locationHint: existing.locationHint || stop.locationHint,
      items: mergeCargoItems([...existing.items, ...stop.items], type),
      completed: Boolean(existing.completed && stop.completed),
    });
  }

  return [...byLocation.values()];
}
