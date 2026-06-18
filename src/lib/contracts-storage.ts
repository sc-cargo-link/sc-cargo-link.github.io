import type { Contract, RoutePlan, RoutingSettings, ScanRegions } from "@/types/contracts";
import { DEFAULT_SCAN_REGIONS } from "@/types/contracts";
import type { StarSystem } from "@/types/map";
import { STAR_SYSTEMS } from "@/lib/map-data";
import { migrateLocationToEntity } from "@/lib/location-lookup";
import {
  deleteAllScreenshots,
  deleteCalibrationImage,
  deleteScreenshot,
  getCalibrationImage,
  getScreenshotsForIds,
  pruneScreenshots,
  saveCalibrationImage,
  saveScreenshot,
} from "@/lib/blob-storage";

const CONTRACTS_KEY = "cargolink-contracts";
const ROUTE_KEY = "cargolink-route";
const SETTINGS_KEY = "cargolink-routing-settings";
const SCAN_REGIONS_KEY = "cargolink-scan-regions";
const SCAN_CALIBRATION_KEY = "cargolink-scan-calibration";
const DEVELOPER_MODE_KEY = "cargolink-developer-mode";
const MAP_SYSTEM_KEY = "cargolink-map-system";

const DEFAULT_SETTINGS: RoutingSettings = {
  shipCapacity: 128,
  maxDistanceGm: 500,
  startingLocation: "",
};

export function loadContracts(): Contract[] {
  try {
    const raw = localStorage.getItem(CONTRACTS_KEY);
    if (!raw) return [];
    const contracts = JSON.parse(raw) as Contract[];
    return contracts
      .map((contract) => ({
        ...contract,
        pickups: contract.pickups.map((stop) => ({
          ...stop,
          locationName: migrateLocationToEntity(stop.locationName),
        })),
        dropoffs: contract.dropoffs.map((stop) => ({
          ...stop,
          locationName: migrateLocationToEntity(stop.locationName),
        })),
      }))
      .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

function toLeanContracts(contracts: Contract[]): Contract[] {
  return contracts.map(({ screenshot: _screenshot, ...rest }) => rest);
}

export async function persistContracts(
  contracts: Contract[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const keepIds = new Set(contracts.map((c) => c.id));
    await Promise.all(
      contracts
        .filter((c) => c.screenshot)
        .map((c) => saveScreenshot(c.id, c.screenshot!)),
    );
    await pruneScreenshots(keepIds);
    localStorage.setItem(CONTRACTS_KEY, JSON.stringify(toLeanContracts(contracts)));
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === "QuotaExceededError"
        ? "Storage quota exceeded. Remove some contracts or clear browser data."
        : "Failed to save contracts.";
    return { ok: false, message };
  }
}

export async function hydrateContracts(contracts: Contract[]): Promise<Contract[]> {
  const missing = contracts.filter((c) => !c.screenshot).map((c) => c.id);
  if (missing.length === 0) return contracts;

  const screenshots = await getScreenshotsForIds(missing);
  return contracts.map((contract) => {
    const dataUrl = contract.screenshot ?? screenshots.get(contract.id);
    return dataUrl ? { ...contract, screenshot: dataUrl } : contract;
  });
}

export async function migrateInlineScreenshots(contracts: Contract[]): Promise<void> {
  const withInline = contracts.filter((c) => c.screenshot);
  if (withInline.length === 0) return;

  await Promise.all(
    withInline.map((c) => saveScreenshot(c.id, c.screenshot!)),
  );

  try {
    localStorage.setItem(CONTRACTS_KEY, JSON.stringify(toLeanContracts(contracts)));
  } catch {
    // lean payload should be small; ignore migration write failures
  }
}

export async function removeContractScreenshot(id: string): Promise<void> {
  await deleteScreenshot(id);
}

export async function removeAllContractScreenshots(): Promise<void> {
  await deleteAllScreenshots();
}

export function loadRoute(): RoutePlan | null {
  try {
    const raw = localStorage.getItem(ROUTE_KEY);
    if (!raw) return null;
    const route = JSON.parse(raw) as RoutePlan;
    return {
      ...route,
      visits: route.visits.map((visit) => ({
        ...visit,
        locationName: migrateLocationToEntity(visit.locationName),
      })),
    };
  } catch {
    return null;
  }
}

export function saveRoute(route: RoutePlan | null): void {
  if (route) localStorage.setItem(ROUTE_KEY, JSON.stringify(route));
  else localStorage.removeItem(ROUTE_KEY);
}

export function loadRoutingSettings(): RoutingSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as RoutingSettings;
    return {
      ...parsed,
      startingLocation: migrateLocationToEntity(parsed.startingLocation),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveRoutingSettings(settings: RoutingSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadScanRegions(): ScanRegions {
  try {
    const raw = localStorage.getItem(SCAN_REGIONS_KEY);
    if (!raw) return { ...DEFAULT_SCAN_REGIONS };
    return { ...DEFAULT_SCAN_REGIONS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SCAN_REGIONS };
  }
}

export function saveScanRegions(regions: ScanRegions): void {
  localStorage.setItem(SCAN_REGIONS_KEY, JSON.stringify(regions));
}

export async function loadScanCalibrationImage(): Promise<string | null> {
  try {
    const fromDb = await getCalibrationImage();
    if (fromDb) return fromDb;

    const legacy = localStorage.getItem(SCAN_CALIBRATION_KEY);
    if (!legacy) return null;

    await saveCalibrationImage(legacy);
    localStorage.removeItem(SCAN_CALIBRATION_KEY);
    return legacy;
  } catch {
    return null;
  }
}

export async function persistScanCalibrationImage(
  dataUrl: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    if (dataUrl) {
      await saveCalibrationImage(dataUrl);
    } else {
      await deleteCalibrationImage();
    }
    localStorage.removeItem(SCAN_CALIBRATION_KEY);
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === "QuotaExceededError"
        ? "Storage quota exceeded. Remove the calibration image or clear browser data."
        : "Failed to save calibration image.";
    return { ok: false, message };
  }
}

export function loadDeveloperMode(): boolean {
  try {
    return localStorage.getItem(DEVELOPER_MODE_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveDeveloperMode(enabled: boolean): void {
  localStorage.setItem(DEVELOPER_MODE_KEY, enabled ? "true" : "false");
}

const VALID_MAP_SYSTEMS = new Set<StarSystem>(STAR_SYSTEMS.map((s) => s.value));

export function loadMapSystem(): StarSystem {
  try {
    const raw = localStorage.getItem(MAP_SYSTEM_KEY) as StarSystem | null;
    if (raw && VALID_MAP_SYSTEMS.has(raw)) return raw;
    return "stanton";
  } catch {
    return "stanton";
  }
}

export function saveMapSystem(system: StarSystem): void {
  localStorage.setItem(MAP_SYSTEM_KEY, system);
}
