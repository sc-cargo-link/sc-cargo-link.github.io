import { nanoid } from "nanoid";
import type {
  CargoItem,
  Contract,
  ContractStop,
  ScanRegion,
  ScanRegions,
  ScannedFields,
} from "@/types/contracts";
import {
  findLocationExactEntity,
  findLocationExactMatches,
  resolveLocationAlias,
} from "@/lib/location-lookup";
import { findMissionItem } from "@/lib/mission-item-lookup";
import type { StarSystem } from "@/types/map";

interface ObjectiveClause {
  scu?: number;
  item?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
}

function normalizeApostrophes(text: string): string {
  return text.replace(/[\u2018\u2019\u201B\u2032]/g, "'");
}

function stripOcrLinePrefix(line: string): string {
  return line.replace(/^[^a-zA-Z\d[]+/, "").trim();
}

function normalizeOcrRomanNumerals(text: string): string {
  return text
    .replace(/\bpyro\s+il\b/gi, "Pyro II")
    .replace(/\bpyro\s+ll\b/gi, "Pyro II")
    .replace(/\bpyroll\b/gi, "Pyro II")
    .replace(/\bpyro\s+lll\b/gi, "Pyro III")
    .replace(/\bpyro\s+nn\b/gi, "Pyro III")
    .replace(/\bpyro\s+iv\b/gi, "Pyro IV")
    .replace(/\bpyro\s+vi\b/gi, "Pyro VI")
    .replace(/\bpyro\s+5b\b/gi, "Pyro Vb");
}

function isObjectiveStart(line: string): boolean {
  return /^(?:deliver|collect|pick\s*up)\b/i.test(line);
}

function needsContinuation(line: string): boolean {
  const s = line.trim();
  if (!s || /[.!?]$/.test(s)) return false;
  if (/\b(?:on|at|in|above|from|to)\s*$/i.test(s)) return true;

  const toMatch = s.match(/\bto\s+(.+)$/i);
  if (toMatch) {
    const loc = toMatch[1].trim();
    if (
      /^(the\s+)?\w+$/i.test(loc) ||
      (/^[\w']+(?:\s+[\w']+)?$/i.test(loc) &&
        loc.split(/\s+/).length <= 2 &&
        !/(station|outpost|gateway|swap|city|beach|canyon|riviera|landings|ravine|point|field|rest|plot|view|mesa|clinic|refueling|harbor|spaceport)/i.test(
          loc
        ))
    ) {
      return true;
    }
  }

  const fromMatch = s.match(/\bfrom\s+(.+)$/i);
  if (fromMatch && /['']s?\s*$/i.test(fromMatch[1])) return true;

  return false;
}

function isContinuationLine(line: string): boolean {
  return !isObjectiveStart(line);
}

export function mergeObjectiveLines(lines: string[]): string[] {
  const merged: string[] = [];

  for (const raw of lines) {
    const line = stripOcrLinePrefix(raw);
    if (!line) continue;

    if (
      merged.length > 0 &&
      (isContinuationLine(line) || needsContinuation(merged[merged.length - 1]))
    ) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${line}`;
    } else {
      merged.push(line);
    }
  }

  return merged;
}

export function preprocessObjectiveText(text: string): string[] {
  const normalized = normalizeOcrRomanNumerals(normalizeApostrophes(text));
  const lines = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 2 && !/^primary\s+objectives$/i.test(line));

  return mergeObjectiveLines(lines);
}

function parseScuFromLine(line: string): number | undefined {
  const match = line.match(/\d+\/(\d+(?:\.\d+)?)\s*scu\b/i);
  if (!match) return undefined;
  const value = parseFloat(match[1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function cleanLocationName(raw: string): string {
  const normalized = normalizeOcrRomanNumerals(normalizeApostrophes(raw));
  return resolveLocationAlias(
    normalized
      .trim()
      .replace(/[.,;]+$/, "")
      .replace(/\s+(?:on|at|in|above|to)\s+.+$/i, "")
      .replace(/\s+(?:on|at|in|above)$/i, "")
      .trim()
  );
}

function normalizeItemName(raw: string): string {
  return raw
    .trim()
    .replace(/^[\[(]*!?[\d]+[\])]*\s*/, "")
    .replace(/\s+/g, " ")
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
    clause.item = normalizeItemName(ofToMatch[1]);
  } else {
    const collectMatch = line.match(/\bcollect\s+(.+?)\s+from\b/i);
    if (collectMatch) clause.item = normalizeItemName(collectMatch[1]);
    else {
      const pickupMatch = line.match(/\bpick\s*up\s+(.+?)\s+from\b/i);
      if (pickupMatch) clause.item = normalizeItemName(pickupMatch[1]);
    }
  }

  return clause;
}

function resolveItemName(raw: string): { name: string; nameHint?: string } {
  const trimmed = normalizeItemName(raw);
  const exact = findMissionItem(trimmed);
  if (exact) return { name: exact };
  return { name: "", nameHint: trimmed || undefined };
}

function inferPreferredSystem(clauses: ObjectiveClause[]): StarSystem | undefined {
  const systems = new Set<StarSystem>();

  for (const clause of clauses) {
    for (const loc of [clause.pickupLocation, clause.dropoffLocation]) {
      if (!loc) continue;
      const matches = findLocationExactMatches(loc);
      if (matches.length === 1) systems.add(matches[0].system);
    }
  }

  if (systems.size === 1) return [...systems][0];
  if (systems.has("pyro")) return "pyro";
  return undefined;
}

function resolveLocationName(
  raw: string,
  preferredSystem?: StarSystem
): { locationName: string; locationHint?: string } {
  const trimmed = cleanLocationName(raw);
  const entity = findLocationExactEntity(trimmed, { preferredSystem });
  if (entity) return { locationName: entity };
  return { locationName: "", locationHint: trimmed || undefined };
}

function locationStopKey(
  locationName: string,
  locationHint: string | undefined,
  rawLocation: string
): string {
  if (locationName) return `entity:${locationName}`;
  const hint = (locationHint ?? cleanLocationName(rawLocation)).toLowerCase();
  const alias = resolveLocationAlias(hint);
  const aliasMatches = findLocationExactMatches(alias);
  if (aliasMatches.length === 1 && aliasMatches[0].poi.en) {
    return `entity:${aliasMatches[0].poi.en}`;
  }
  return `hint:${hint}`;
}

function parseObjectiveText(text: string): { pickups: ContractStop[]; dropoffs: ContractStop[] } {
  const lines = preprocessObjectiveText(text);
  const clauses = lines.map(parseObjectiveLine);
  const preferredSystem = inferPreferredSystem(clauses);
  const defaultScu = clauses.find((c) => c.scu)?.scu ?? 1;
  const defaultItem = clauses.find((c) => c.item)?.item ?? "Cargo";

  const pickupMap = new Map<string, { name: string; nameHint?: string }[]>();
  const dropoffMap = new Map<string, { name: string; nameHint?: string; scu: number }[]>();
  const displayNames = new Map<string, string>();
  const locationHints = new Map<string, string | undefined>();

  const addPickupItem = (rawLocation: string, rawItem: string) => {
    const { locationName, locationHint } = resolveLocationName(rawLocation, preferredSystem);
    const { name, nameHint } = resolveItemName(rawItem);
    const key = locationStopKey(locationName, locationHint, rawLocation);
    displayNames.set(key, locationName);
    locationHints.set(key, locationHint);
    const items = pickupMap.get(key) ?? [];
    items.push({ name, nameHint });
    pickupMap.set(key, items);
  };

  const addDropoffItem = (rawLocation: string, rawItem: string, scu: number) => {
    const { locationName, locationHint } = resolveLocationName(rawLocation, preferredSystem);
    const { name, nameHint } = resolveItemName(rawItem);
    const key = locationStopKey(locationName, locationHint, rawLocation);
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
    pickups = [
      makeStop("Pickup Location", undefined, makePickupItems([resolveItemName(defaultItem)])),
    ];
  }
  if (dropoffs.length === 0) {
    dropoffs = [
      makeStop(
        "Dropoff Location",
        undefined,
        makeItems([{ ...resolveItemName(defaultItem), scu: defaultScu }])
      ),
    ];
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
