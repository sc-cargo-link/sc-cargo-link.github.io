export type StarSystem = "stanton" | "nyx" | "pyro";

export type PoiCategory = "poi" | "planet" | "moon" | "star" | "lagrangian_point" | "station";

export interface MapBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface MapOrbit {
  n: string;
  entityName?: string;
  cx: number;
  cy: number;
  r: number;
  px?: number;
  py?: number;
}

export interface MapPOI {
  n: string;
  x: number;
  y: number;
  z: number;
  en?: string;
  pc?: string[];
  category?: PoiCategory;
  sm?: string;
  src?: string;
  icon?: string;
  recordName?: string;
  description?: string;
}

export interface MapTreeNode {
  name: string;
  path: string[];
  children: MapTreeNode[];
  poiIndices: number[];
}

export interface MapCategoryCounts {
  poi?: number;
  lagrangian_point?: number;
  station?: number;
  star?: number;
  planet?: number;
  moon?: number;
}

export interface MapData {
  system: StarSystem;
  count: number;
  categoryCounts?: MapCategoryCounts;
  bounds: MapBounds;
  orbits: MapOrbit[];
  orbitExceptions: Record<string, string>;
  tree: MapTreeNode;
  entityIndex: Record<string, number>;
  pois: MapPOI[];
}

export type LocationCategory =
  | "planets"
  | "moons"
  | "lagrangian"
  | "stations"
  | "otherPoi";

export interface MapTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface RouteOverlayPoint {
  x: number;
  y: number;
  label: string;
  order: number;
  type: "start" | "pickup" | "dropoff" | "stopover" | "gateway";
  system?: StarSystem;
  /** Distance from the previous overlay point along the route (meters). */
  legDistance?: number;
}

export interface RouteMapLeg {
  legNumber: number;
  distance: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

/** Raw JSON shape from src/data/map_data/*.json */
export interface RawMapOrbit {
  name: string;
  entity_name?: string;
  center: [number, number];
  radius: number;
  planet_position?: [number, number];
}

export interface RawMapPOI {
  display_name: string;
  entity_name?: string;
  category?: PoiCategory;
  world_position: [number, number, number];
  parent_chain?: string[];
  star_map_record_id?: string;
  source?: string;
  nav_icon?: string;
  record_name?: string;
  description?: string;
}

export interface RawMapData {
  system: StarSystem;
  count: number;
  category_counts?: MapCategoryCounts;
  bounds: MapBounds;
  orbits: RawMapOrbit[];
  orbit_exceptions?: Record<string, string>;
  tree: MapTreeNode;
  entity_index: Record<string, number>;
  pois: RawMapPOI[];
}
