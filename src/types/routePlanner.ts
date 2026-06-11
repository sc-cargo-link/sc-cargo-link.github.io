export interface CargoItem {
  itemName: string;
  quantity: number;
}

export interface RouteStop {
  id: string;
  stationId: number | null; // null for custom stations not in AllEntities
  stationName: string;
  pickupSelections: Map<string, boolean>;
  availablePickups: CargoItem[];
  dropoffs: CargoItem[];
  inventoryAfter: CargoItem[];
  currentSCU: number;
  isCustomStation?: boolean; // flag to identify custom stations
}

export interface RoutePlannerState {
  startingLocation: string;
  startingLocationId: number | null;
  cargoSpace: number;
  routeStops: RouteStop[];
}

