import Dexie, { type EntityTable } from "dexie";

interface ScreenshotRecord {
  id: string;
  dataUrl: string;
}

interface CalibrationRecord {
  id: "default";
  dataUrl: string;
}

class CargoLinkBlobDb extends Dexie {
  screenshots!: EntityTable<ScreenshotRecord, "id">;
  calibration!: EntityTable<CalibrationRecord, "id">;

  constructor() {
    super("cargolink-blobs");
    this.version(1).stores({
      screenshots: "id",
      calibration: "id",
    });
  }
}

const db = new CargoLinkBlobDb();

export async function saveScreenshot(id: string, dataUrl: string): Promise<void> {
  await db.screenshots.put({ id, dataUrl });
}

export async function getScreenshot(id: string): Promise<string | undefined> {
  return (await db.screenshots.get(id))?.dataUrl;
}

export async function getScreenshotsForIds(ids: string[]): Promise<Map<string, string>> {
  const records = await db.screenshots.bulkGet(ids);
  const map = new Map<string, string>();
  for (const rec of records) {
    if (rec) map.set(rec.id, rec.dataUrl);
  }
  return map;
}

export async function deleteScreenshot(id: string): Promise<void> {
  await db.screenshots.delete(id);
}

export async function deleteAllScreenshots(): Promise<void> {
  await db.screenshots.clear();
}

export async function pruneScreenshots(keepIds: Set<string>): Promise<void> {
  const stale = await db.screenshots.filter((rec) => !keepIds.has(rec.id)).primaryKeys();
  if (stale.length > 0) await db.screenshots.bulkDelete(stale);
}

export async function saveCalibrationImage(dataUrl: string): Promise<void> {
  await db.calibration.put({ id: "default", dataUrl });
}

export async function getCalibrationImage(): Promise<string | null> {
  return (await db.calibration.get("default"))?.dataUrl ?? null;
}

export async function deleteCalibrationImage(): Promise<void> {
  await db.calibration.delete("default");
}
