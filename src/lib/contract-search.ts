import { getLocationDisplayName } from "@/lib/location-lookup";
import type { Contract, ContractStop } from "@/types/contracts";

function stopSearchText(stop: ContractStop): string[] {
  return [
    stop.locationName,
    stop.locationHint ?? "",
    getLocationDisplayName(stop.locationName),
    ...stop.items.flatMap((item) => [item.name, item.nameHint ?? ""]),
  ];
}

export function contractMatchesSearch(contract: Contract, query: string): boolean {
  const haystack = [
    contract.title,
    ...contract.pickups.flatMap(stopSearchText),
    ...contract.dropoffs.flatMap(stopSearchText),
  ];
  return haystack.some((text) => text.toLowerCase().includes(query));
}
