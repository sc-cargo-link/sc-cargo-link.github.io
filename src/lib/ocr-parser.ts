import { nanoid } from "nanoid";
import type {
  CargoItem,
  Contract,
  ContractStop,
  ScanRegion,
  ScanRegions,
  ScannedFields,
} from "@/types/contracts";
import { findLocationExactEntity } from "@/lib/location-lookup";
import { findMissionItem } from "@/lib/mission-item-lookup";

interface ObjectiveClause {
  scu?: number;
  item?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
}

function parseScuFromLine(line: string): number | undefined {
  const match = line.match(/\d+\/(\d+(?:\.\d+)?)\s*scu\b/i);
  if (!match) return undefined;
  const value = parseFloat(match[1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function cleanLocationName(raw: string): string {
  return raw
    .trim()
    .replace(/[.,;]+$/, "")
    .replace(/\s+(?:on|at|to)\s+.+$/i, "")
    .trim();
}

function parseObjectiveLine(line: string): ObjectiveClause {
  const clause: ObjectiveClause = { scu: parseScuFromLine(line) };

  const fromMatch = line.match(/\bfrom\s+(.+?)(?:\s+to\s+|$)/i);
  if (fromMatch) {
    clause.pickupLocation = cleanLocationName(fromMatch[1]);
  }

  const toMatch = line.match(/\bto\s+(.+?)$/i);
  if (toMatch) {
    clause.dropoffLocation = cleanLocationName(toMatch[1]);
  }

  const ofToMatch = line.match(/\bof\s+(.+?)\s+to\b/i);
  if (ofToMatch) {
    clause.item = ofToMatch[1].trim();
  } else {
    const collectMatch = line.match(/\bcollect\s+(.+?)\s+from\b/i);
    if (collectMatch) clause.item = collectMatch[1].trim();
    else {
      const pickupMatch = line.match(/\bpick\s*up\s+(.+?)\s+from\b/i);
      if (pickupMatch) clause.item = pickupMatch[1].trim();
    }
  }

  return clause;
}

function resolveItemName(raw: string): { name: string; nameHint?: string } {
  const trimmed = raw.trim();
  const exact = findMissionItem(trimmed);
  if (exact) return { name: exact };
  return { name: "", nameHint: trimmed || undefined };
}

function resolveLocationName(raw: string): { locationName: string; locationHint?: string } {
  const trimmed = cleanLocationName(raw);
  const entity = findLocationExactEntity(trimmed);
  if (entity) return { locationName: entity };
  return { locationName: "", locationHint: trimmed || undefined };
}

function parseObjectiveText(text: string): { pickups: ContractStop[]; dropoffs: ContractStop[] } {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 2);

  const clauses = lines.map(parseObjectiveLine);
  const defaultScu = clauses.find((c) => c.scu)?.scu ?? 1;
  const defaultItem = clauses.find((c) => c.item)?.item ?? "Cargo";

  const pickupMap = new Map<string, { name: string; nameHint?: string }[]>();
  const dropoffMap = new Map<string, { name: string; nameHint?: string; scu: number }[]>();
  const displayNames = new Map<string, string>();
  const locationHints = new Map<string, string | undefined>();

  const addPickupItem = (rawLocation: string, rawItem: string) => {
    const { locationName, locationHint } = resolveLocationName(rawLocation);
    const { name, nameHint } = resolveItemName(rawItem);
    const key =
      locationName ||
      `hint:${(locationHint ?? cleanLocationName(rawLocation)).toLowerCase()}`;
    displayNames.set(key, locationName);
    locationHints.set(key, locationHint);
    const items = pickupMap.get(key) ?? [];
    items.push({ name, nameHint });
    pickupMap.set(key, items);
  };

  const addDropoffItem = (rawLocation: string, rawItem: string, scu: number) => {
    const { locationName, locationHint } = resolveLocationName(rawLocation);
    const { name, nameHint } = resolveItemName(rawItem);
    const key =
      locationName ||
      `hint:${(locationHint ?? cleanLocationName(rawLocation)).toLowerCase()}`;
    displayNames.set(key, locationName);
    locationHints.set(key, locationHint);
    const items = dropoffMap.get(key) ?? [];
    items.push({ name, nameHint, scu });
    dropoffMap.set(key, items);
  };

  for (const clause of clauses) {
    const item = clause.item ?? defaultItem;

    if (clause.pickupLocation) {
      addPickupItem(clause.pickupLocation, item);
    }
    if (clause.dropoffLocation) {
      const scu = clause.scu ?? defaultScu;
      addDropoffItem(clause.dropoffLocation, item, scu);
    }
  }

  const toPickupStops = (): ContractStop[] =>
    [...pickupMap.entries()].map(([key, items]) =>
      makeStop(displayNames.get(key) ?? "", locationHints.get(key), makePickupItems(items))
    );

  const toDropoffStops = (): ContractStop[] =>
    [...dropoffMap.entries()].map(([key, items]) =>
      makeStop(displayNames.get(key) ?? "", locationHints.get(key), makeItems(items))
    );

  let pickups = toPickupStops();
  let dropoffs = toDropoffStops();

  if (pickups.length === 0) {
    pickups = [makeStop("Pickup Location", makePickupItems([{ name: resolveItemName(defaultItem) }]))];
  }
  if (dropoffs.length === 0) {
    dropoffs = [makeStop("Dropoff Location", makeItems([{ name: resolveItemName(defaultItem), scu: defaultScu }]))];
  }

  return { pickups, dropoffs };
}

function parseReward(text: string): number | undefined {
  const cleaned = text.replace(/\s/g, "");
  const match = cleaned.match(/([\d,]+)(?:a?uec)?/i) || text.match(/([\d,]+)/);
  if (!match) return undefined;
  const value = parseInt(match[1].replace(/,/g, ""), 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function makeStop(
  locationName: string,
  locationHint: string | undefined,
  items: CargoItem[]
): ContractStop {
  return { id: nanoid(8), locationName, locationHint, items, completed: false };
}

function makePickupItems(parsed: { name: string; nameHint?: string }[]): CargoItem[] {
  return parsed.map((p) => ({
    id: nanoid(6),
    name: p.name,
    nameHint: p.nameHint,
    scu: 0,
  }));
}

function makeItems(parsed: { name: string; nameHint?: string; scu: number }[]): CargoItem[] {
  return parsed.map((p) => ({
    id: nanoid(6),
    name: p.name,
    nameHint: p.nameHint,
    scu: p.scu,
  }));
}

export type { ScannedFields } from "@/types/contracts";

export function parseScannedContract(
  fields: ScannedFields,
  screenshot?: string,
  ocrRaw?: ScannedFields
): Contract {
  const title =
    fields.nameText
      .split(/\n+/)
      .map((l) => l.trim())
      .find((l) => l.length > 2) || "New Contract";

  const reward = parseReward(fields.rewardText);
  const { pickups, dropoffs } = parseObjectiveText(fields.objectiveText);

  return {
    id: nanoid(10),
    title: title.slice(0, 80),
    reward,
    screenshot,
    ocrRaw: ocrRaw ?? fields,
    pickups,
    dropoffs,
    completed: false,
    order: Date.now(),
    selectedForRoute: true,
    createdAt: Date.now(),
  };
}

/** @deprecated Use scanContractScreenshot with regions */
export function parseOcrToContract(text: string, screenshot?: string): Contract {
  return parseScannedContract(
    { nameText: text, objectiveText: text, rewardText: text },
    screenshot
  );
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export async function cropRegionToCanvas(
  file: File,
  region: ScanRegion
): Promise<HTMLCanvasElement> {
  const img = await loadImage(file);
  const sx = Math.round(region.x * img.width);
  const sy = Math.round(region.y * img.height);
  const sw = Math.max(1, Math.round(region.width * img.width));
  const sh = Math.max(1, Math.round(region.height * img.height));

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas;
}

export async function ocrCanvas(canvas: HTMLCanvasElement): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const {
      data: { text },
    } = await worker.recognize(canvas);
    return text;
  } finally {
    await worker.terminate();
  }
}

export async function ocrRegion(file: File, region: ScanRegion): Promise<string> {
  const canvas = await cropRegionToCanvas(file, region);
  return ocrCanvas(canvas);
}

export async function ocrImage(file: File): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const {
      data: { text },
    } = await worker.recognize(file);
    return text;
  } finally {
    await worker.terminate();
  }
}

export async function scanContractScreenshot(
  file: File,
  regions: ScanRegions,
  screenshotDataUrl: string
): Promise<Contract> {
  const [nameText, objectiveText, rewardText] = await Promise.all([
    ocrRegion(file, regions.name),
    ocrRegion(file, regions.objective),
    ocrRegion(file, regions.reward),
  ]);

  return parseScannedContract({ nameText, objectiveText, rewardText }, screenshotDataUrl, {
    nameText,
    objectiveText,
    rewardText,
  });
}

export function contractTotalScu(contract: Contract): number {
  return contract.dropoffs.reduce(
    (sum, stop) => sum + stop.items.reduce((s, i) => s + i.scu, 0),
    0
  );
}

export function stopTotalScu(stop: ContractStop, type: "pickup" | "dropoff" = "dropoff"): number {
  if (type === "pickup") return 0;
  return stop.items.reduce((s, i) => s + i.scu, 0);
}
