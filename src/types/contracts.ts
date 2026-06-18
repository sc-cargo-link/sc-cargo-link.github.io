import type { StarSystem } from "@/types/map";

export interface CargoItem {
  id: string;
  name: string;
  scu: number;
  /** OCR hint when no exact mission item match */
  nameHint?: string;
}

export interface ContractStop {
  id: string;
  locationName: string;
  items: CargoItem[];
  completed?: boolean;
  /** OCR hint when no exact location match */
  locationHint?: string;
}

export interface Contract {
  id: string;
  title: string;
  reward?: number;
  screenshot?: string;
  ocrRaw?: ScannedFields;
  pickups: ContractStop[];
  dropoffs: ContractStop[];
  completed: boolean;
  order: number;
  selectedForRoute: boolean;
  createdAt: number;
}

export interface ScannedFields {
  nameText: string;
  objectiveText: string;
  rewardText: string;
}

export interface ScanRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ScanRegionKey = "name" | "objective" | "reward";

export interface ScanRegions {
  name: ScanRegion;
  objective: ScanRegion;
  reward: ScanRegion;
}

export const DEFAULT_SCAN_REGIONS: ScanRegions = {
  name: { x: 0.04, y: 0.06, width: 0.55, height: 0.09 },
  objective: { x: 0.04, y: 0.22, width: 0.62, height: 0.28 },
  reward: { x: 0.68, y: 0.06, width: 0.28, height: 0.1 },
};

export interface RouteAction {
  contractId: string;
  contractTitle: string;
  stopId: string;
  type: "pickup" | "dropoff";
  items: CargoItem[];
}

export interface RouteVisit {
  id: string;
  locationName: string;
  x: number;
  y: number;
  type: "start" | "pickup" | "dropoff" | "stopover" | "gateway";
  system: StarSystem;
  actions: RouteAction[];
  cargoAfter: number;
  distanceFromPrev: number;
}

export interface RoutePlan {
  visits: RouteVisit[];
  totalDistance: number;
  totalScu: number;
}

export interface RoutingSettings {
  shipCapacity: number;
  maxDistanceGm: number;
  startingLocation: string;
}
