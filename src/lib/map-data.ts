import type {
  LocationCategory,
  MapData,
  MapPOI,
  MapTreeNode,
  RawMapData,
  StarSystem,
} from "@/types/map";

import nyxData from "@/data/map_data/nyx.json";
import pyroData from "@/data/map_data/pyro.json";
import stantonData from "@/data/map_data/stanton.json";

function normalizeMapData(raw: RawMapData): MapData {
  return {
    system: raw.system,
    count: raw.count,
    categoryCounts: raw.category_counts,
    bounds: raw.bounds,
    orbits: (raw.orbits || []).map((orbit) => ({
      n: orbit.name,
      entityName: orbit.entity_name,
      cx: orbit.center[0],
      cy: orbit.center[1],
      r: orbit.radius,
      px: orbit.planet_position?.[0],
      py: orbit.planet_position?.[1],
    })),
    orbitExceptions: raw.orbit_exceptions || {},
    entityIndex: raw.entity_index || {},
    tree: raw.tree,
    pois: (raw.pois || []).map((poi) => ({
      n: poi.display_name,
      x: poi.world_position[0],
      y: poi.world_position[1],
      z: poi.world_position[2],
      en: poi.entity_name,
      pc: poi.parent_chain,
      category: poi.category,
      sm: poi.star_map_record_id,
      src: poi.source,
      icon: poi.nav_icon,
      recordName: poi.record_name,
      description: poi.description,
    })),
  };
}

const MAP_DATA: Record<StarSystem, MapData> = {
  stanton: normalizeMapData(stantonData as RawMapData),
  nyx: normalizeMapData(nyxData as RawMapData),
  pyro: normalizeMapData(pyroData as RawMapData),
};

export const STAR_SYSTEMS: { value: StarSystem; label: string }[] = [
  { value: "stanton", label: "Stanton" },
  { value: "nyx", label: "Nyx" },
  { value: "pyro", label: "Pyro" },
];

export function getMapData(system: StarSystem): MapData {
  return MAP_DATA[system];
}

export function pathKey(path: string[]): string {
  return path.join("\0");
}

export function pathsEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function collectSubtreeIndices(node: MapTreeNode): number[] {
  const indices = [...node.poiIndices];
  for (const child of node.children) {
    indices.push(...collectSubtreeIndices(child));
  }
  return indices;
}

export function findTreeNodeByPath(tree: MapTreeNode, path: string[]): MapTreeNode | null {
  let node = tree;
  if (path.length === 0) return node;
  for (const segment of path) {
    node = node.children.find((c) => c.name === segment);
    if (!node) return null;
  }
  return node;
}

export function resolveOrbitParentEntity(data: MapData, path: string[]): string | null {
  const exceptions = data.orbitExceptions || {};
  for (let i = path.length - 1; i >= 0; i -= 1) {
    const mapped = exceptions[path[i]];
    if (mapped) return mapped;
  }
  return path.length ? path[path.length - 1] : null;
}

export function pathUsesPyro4MoonOrbit(data: MapData, path: string[]): boolean {
  const exceptions = data.orbitExceptions || {};
  return path.some((segment) => exceptions[segment] === "pyro5");
}

export function fitToBounds(
  bounds: MapData["bounds"],
  width: number,
  height: number,
  padding = 40
) {
  const mapWidth = bounds.maxX - bounds.minX || 1;
  const mapHeight = bounds.maxY - bounds.minY || 1;
  const scaleX = (width - padding * 2) / mapWidth;
  const scaleY = (height - padding * 2) / mapHeight;
  const scale = Math.min(scaleX, scaleY);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return {
    scale,
    offsetX: -cx * scale,
    offsetY: cy * scale,
  };
}

export function distance2d(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function categorizePoi(poi: MapPOI): LocationCategory[] {
  const categories = new Set<LocationCategory>();
  const chain = poi.pc || [];
  const chainText = chain.join(" ").toLowerCase();
  const name = poi.n.toLowerCase();
  const icon = (poi.icon || "").toLowerCase();

  switch (poi.category) {
    case "planet":
      categories.add("planets");
      return Array.from(categories);
    case "moon":
      categories.add("moons");
      return Array.from(categories);
    case "lagrangian_point":
      categories.add("lagrangian");
      return Array.from(categories);
    case "station":
      categories.add("stations");
      return Array.from(categories);
    case "star":
      categories.add("otherPoi");
      return Array.from(categories);
    default:
      break;
  }

  const isLagrangian = /_l[1-5](?:_|$)/i.test(chainText) || /lagrange|lagrangian/i.test(chainText);
  const isMoon = /_\d+a_/i.test(chainText) || /moon/i.test(chainText);
  const isPlanet =
    /_\d+_[a-z]/i.test(chainText) &&
    !isMoon &&
    !/_l[1-5]/i.test(chainText) &&
    !/jumppoint|jump_point/i.test(chainText);

  const isStation =
    icon === "outpost" ||
    icon === "station" ||
    /station|reststop|rest stop|port|depot|trading|hospital|admin|security post|services/i.test(
      name
    ) ||
    /rr_|rest_stop|station/i.test(chainText);

  if (isPlanet) categories.add("planets");
  if (isMoon) categories.add("moons");
  if (isLagrangian) categories.add("lagrangian");
  if (isStation) categories.add("stations");

  if (
    categories.size === 0 ||
    poi.category === "poi" ||
    (!isPlanet && !isMoon && !isLagrangian && !isStation)
  ) {
    categories.add("otherPoi");
  }

  return Array.from(categories);
}

export function poiMatchesFilters(
  poi: MapPOI,
  filters: Record<LocationCategory, boolean>
): boolean {
  const cats = categorizePoi(poi);
  if (filters.planets && cats.includes("planets")) return true;
  if (filters.moons && cats.includes("moons")) return true;
  if (filters.lagrangian && cats.includes("lagrangian")) return true;
  if (filters.stations && cats.includes("stations")) return true;
  if (filters.otherPoi && cats.includes("otherPoi")) return true;
  return false;
}

export function getVisiblePoiIndices(
  data: MapData,
  filters: Record<LocationCategory, boolean>
): number[] {
  return data.pois
    .map((poi, i) => (poiMatchesFilters(poi, filters) ? i : -1))
    .filter((i) => i >= 0);
}

type PathSegmentKind = "planet" | "moon" | "lagrangian" | "station" | "jumppoint" | "container";

function classifyPathSegment(segment: string): PathSegmentKind | null {
  if (/^OOC_(Stanton|Pyro|Nyx)$/i.test(segment)) return null;
  if (/^OOC_\w+$/i.test(segment) && !/_\d/.test(segment)) return null;
  if (/jumppoint|jump_point/i.test(segment)) return "jumppoint";
  if (/^OOC_\w+_\d+[a-z]+_/i.test(segment)) return "moon";
  if (/^OOC_\w+_\d+_/i.test(segment)) return "planet";
  if (/_L\d+$/i.test(segment) || /Stanton\d_L\d/i.test(segment)) return "lagrangian";
  if (/^LOC_RR_|^rs_|rest_stop|reststop/i.test(segment)) return "station";
  return "container";
}

function humanizeContainer(segment: string): string | null {
  if (/FloatingIslandCluster/i.test(segment)) return "Orison";
  if (/Area18/i.test(segment)) return "Area 18";
  if (/Lorville/i.test(segment)) return "Lorville";
  if (/^LOC_RR_/i.test(segment)) {
    return segment
      .replace(/^LOC_RR_/i, "")
      .replace(/_/g, " ")
      .replace(/\b([A-Z]{2,})\b/g, (m) => m);
  }
  if (/^rs_/i.test(segment)) {
    return segment.replace(/^rs_/i, "").replace(/_/g, " ");
  }
  if (/ObjectContainer/i.test(segment) || /^OC_/i.test(segment)) return null;
  if (/^ab_|^Drlct_|^s\d/i.test(segment)) return null;

  const cleaned = segment
    .replace(/^OOC_\w+_/, "")
    .replace(/_/g, " ")
    .trim();
  if (!cleaned || cleaned.length > 40) return null;
  return cleaned;
}

function resolvePathSegmentName(
  segment: string,
  kind: PathSegmentKind,
  entityNames: Map<string, string>
): string | null {
  if (entityNames.has(segment)) return entityNames.get(segment)!;

  if (kind === "planet") {
    const match = segment.match(/^OOC_\w+_\d+_(.+)$/i);
    if (match) return match[1].replace(/_/g, " ");
  }
  if (kind === "moon") {
    const match = segment.match(/^OOC_\w+_\d+[a-z]+_(.+)$/i);
    if (match) return match[1].replace(/_/g, " ");
  }
  if (kind === "lagrangian") {
    const match = segment.match(/_L(\d+)$/i);
    return match ? `Lagrange L${match[1]}` : "Lagrange point";
  }
  if (kind === "station" || kind === "jumppoint") {
    return humanizeContainer(segment) || segment.replace(/_/g, " ");
  }
  return humanizeContainer(segment);
}

function buildEntityNameIndex(data: MapData): Map<string, string> {
  const names = new Map<string, string>();
  for (const poi of data.pois) {
    if (poi.en) names.set(poi.en, poi.n);
  }
  return names;
}

/** Human-readable hierarchy: planet → moon → … → POI */
export function getPoiTreePath(data: MapData, poi: MapPOI): string[] {
  const entityNames = buildEntityNameIndex(data);
  const path = poi.pc || [];

  let planet: string | null = null;
  let moon: string | null = null;
  const middle: string[] = [];

  for (const segment of path) {
    const kind = classifyPathSegment(segment);
    if (!kind) continue;

    const label = resolvePathSegmentName(segment, kind, entityNames);
    if (!label) continue;

    if (kind === "planet") planet = label;
    else if (kind === "moon") moon = label;
    else if (kind === "lagrangian" || kind === "station" || kind === "jumppoint") {
      if (!middle.includes(label)) middle.push(label);
    } else if (kind === "container") {
      if (!middle.includes(label)) middle.push(label);
    }
  }

  const chain: string[] = [];
  if (planet) chain.push(planet);
  if (moon) chain.push(moon);
  for (const label of middle) {
    if (!chain.includes(label)) chain.push(label);
  }

  const isBody =
    poi.category === "planet" ||
    poi.category === "moon" ||
    poi.icon === "Planet" ||
    poi.icon === "Moon";
  if (isBody) {
    return chain.length > 0 && chain[chain.length - 1] === poi.n ? chain : [poi.n];
  }

  if (!chain.includes(poi.n)) chain.push(poi.n);

  return chain.filter((label, i, arr) => i === 0 || label !== arr[i - 1]);
}

export function formatPoiTreePath(data: MapData, poi: MapPOI): string {
  return getPoiTreePath(data, poi).join(" → ");
}
