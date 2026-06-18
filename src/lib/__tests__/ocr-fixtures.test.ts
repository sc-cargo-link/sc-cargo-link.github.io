import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { parseScannedContract } from "@/lib/ocr-parser";

const OCR_DIR = join(process.cwd(), "src/data/ocr_data");

function loadFixture(name: string): string {
  return readFileSync(join(OCR_DIR, name), "utf-8");
}

function parseFixture(name: string) {
  return parseScannedContract({
    nameText: name,
    objectiveText: loadFixture(name),
    rewardText: "",
  });
}

function expectAllResolved(stops: { locationName: string; items: { name: string }[] }[]) {
  for (const stop of stops) {
    expect(stop.locationName, `missing location on stop`).not.toBe("");
    for (const item of stop.items) {
      expect(item.name, `missing item on stop ${stop.locationName}`).not.toBe("");
    }
  }
}

describe("OCR fixture parsing", () => {
  it("parses steller_po_1", () => {
    const c = parseFixture("steller_po_1.txt");
    expect(c.pickups).toHaveLength(2);
    expect(c.dropoffs).toHaveLength(1);
    expectAllResolved([...c.pickups, ...c.dropoffs]);
    expect(c.dropoffs[0].items[0].scu).toBe(8);
  });

  it("parses steller_po_2 with Chawlia OCR typo", () => {
    const c = parseFixture("steller_po_2.txt");
    expect(c.dropoffs).toHaveLength(1);
    expect(c.dropoffs[0].locationName).toBe("RL_Pyro4_col_m_scrp_indy_001");
  });

  it("parses steller_po_3 with pyro Stanton Gateway", () => {
    const c = parseFixture("steller_po_3.txt");
    expect(c.dropoffs).toHaveLength(1);
    expect(c.dropoffs[0].locationName).toBe("rs_ext_pyro-stan_jp1");
  });

  it("parses steller_po_4 wrapped dropoffs", () => {
    const c = parseFixture("steller_po_4.txt");
    expect(c.dropoffs).toHaveLength(3);
    expectAllResolved(c.dropoffs);
  });

  it("parses steller_po_5 wrapped dropoffs", () => {
    const c = parseFixture("steller_po_5.txt");
    expect(c.dropoffs).toHaveLength(2);
    expectAllResolved(c.dropoffs);
  });

  it("parses steller_po_6", () => {
    const c = parseFixture("steller_po_6.txt");
    expectAllResolved([...c.pickups, ...c.dropoffs]);
  });

  it("parses planetary_po_1", () => {
    const c = parseFixture("planetary_po_1.txt");
    expect(c.dropoffs).toHaveLength(3);
    expectAllResolved(c.dropoffs);
  });

  it("parses planetary_po_3 wrapped golden riviera", () => {
    const c = parseFixture("planetary_po_3.txt");
    expect(c.dropoffs).toHaveLength(1);
    expect(c.dropoffs[0].locationName).toBe("RL_Pyro3_col_m_trdpst_otlw_006");
  });

  it("parses planetary_po_4 split golden riviera", () => {
    const c = parseFixture("planetary_po_4.txt");
    expect(c.dropoffs).toHaveLength(2);
    expectAllResolved(c.dropoffs);
  });

  it("parses planetary_po_6 wrapped jackson swap", () => {
    const c = parseFixture("planetary_po_6.txt");
    expect(c.dropoffs).toHaveLength(1);
    expect(c.dropoffs[0].locationName).toBe("RL_Pyro2_col_m_trdp_indy_001");
  });

  it("parses intersteller_po_1 rayari outpost", () => {
    const c = parseFixture("intersteller_po_1.txt");
    expect(c.dropoffs).toHaveLength(1);
    expect(c.dropoffs[0].locationName).toContain("rayari");
    expect(c.pickups[0].items[0].name).toBe("Sunset Berry");
  });

  it("parses intersteller_po_2 baijini point", () => {
    const c = parseFixture("intersteller_po_2.txt");
    expect(c.dropoffs).toHaveLength(1);
    expect(c.dropoffs[0].locationName).toBeTruthy();
    expect(c.dropoffs[0].items.some((i) => i.name === "Hydrogen Fuel")).toBe(true);
  });

  it("parses intersteller_po_3 lagrange stations", () => {
    const c = parseFixture("intersteller_po_3.txt");
    expect(c.pickups).toHaveLength(1);
    expect(c.dropoffs).toHaveLength(2);
    expectAllResolved([...c.pickups, ...c.dropoffs]);
    expect(c.dropoffs[0].locationName).toBe("LOC_RR_S2_L4");
    expect(c.dropoffs[1].locationName).toBe("LOC_RR_S2_L5");
    expect(c.pickups[0].items.some((i) => i.name === "Revenant Tree Pollen")).toBe(true);
    expect(c.pickups[0].items.some((i) => i.name === "Tritium")).toBe(true);
  });

  it("parses intersteller_po_4 teasa spaceport as lorville", () => {
    const c = parseFixture("intersteller_po_4.txt");
    expect(c.dropoffs).toHaveLength(1);
    expect(c.dropoffs[0].locationName).toBe("ObjectContainer_Lorville_City");
    expect(c.dropoffs[0].items).toHaveLength(5);
    expectAllResolved(c.dropoffs);
    expect(c.pickups[0].items.some((i) => i.name === "Diamonds")).toBe(true);
    expect(c.pickups[0].items.some((i) => i.name === "Aphorite")).toBe(true);
  });

  it("parses all OCR fixtures without unresolved locations", () => {
    const files = readdirSync(OCR_DIR).filter((f) => f.endsWith(".txt"));
    for (const file of files) {
      const c = parseFixture(file);
      expectAllResolved(c.pickups);
      expectAllResolved(c.dropoffs);
    }
  });
});
