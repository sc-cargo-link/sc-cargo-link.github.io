import type { CargoItem, Contract } from "@/types/contracts";

export function cargoItemLabel(item: Pick<CargoItem, "name" | "nameHint">): string {
  return item.name?.trim() || item.nameHint?.trim() || "Cargo";
}

export function cargoItemsMatch(
  a: Pick<CargoItem, "name" | "nameHint">,
  b: Pick<CargoItem, "name" | "nameHint">,
): boolean {
  const aKey = cargoItemLabel(a).toLowerCase();
  const bKey = cargoItemLabel(b).toLowerCase();
  return aKey !== "cargo" && aKey === bKey;
}

export function contractRouteLabel(
  contract: Pick<Contract, "title" | "dropoffs" | "pickups">,
): string {
  const items = new Set<string>();
  for (const stop of [...contract.dropoffs, ...contract.pickups]) {
    for (const item of stop.items) {
      const label = cargoItemLabel(item);
      if (label !== "Cargo") items.add(label);
    }
  }
  const cargo = [...items].join(", ");
  return cargo ? `${contract.title} · ${cargo}` : contract.title;
}
