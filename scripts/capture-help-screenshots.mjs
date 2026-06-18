import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../public/help");
const BASE_URL = process.env.HELP_SCREENSHOT_URL ?? "http://localhost:8081";

const demoContracts = [
  {
    id: "demo-1",
    title: "Waste Delivery",
    reward: 12500,
    pickups: [
      {
        id: "p1",
        locationName: "RL_Pyro2_col_m_scrp_indy_001",
        items: [{ id: "i1", name: "Waste", scu: 0 }],
      },
    ],
    dropoffs: [
      {
        id: "d1",
        locationName: "RL_Pyro1_col_m_scrp_out_001",
        items: [{ id: "i2", name: "Waste", scu: 2 }],
      },
    ],
    completed: false,
    order: 0,
    selectedForRoute: true,
    createdAt: Date.now(),
  },
  {
    id: "demo-2",
    title: "Hydrogen Run",
    reward: 48000,
    pickups: [
      {
        id: "p2",
        locationName: "RL_Pyro1_col_m_scrp_out_001",
        items: [{ id: "i3", name: "Hydrogen", scu: 0 }],
      },
    ],
    dropoffs: [
      {
        id: "d2",
        locationName: "Area18_City_objectContainer",
        items: [{ id: "i4", name: "Hydrogen", scu: 20 }],
      },
    ],
    completed: false,
    order: 1,
    selectedForRoute: true,
    createdAt: Date.now() + 1,
  },
];

const demoSettings = {
  shipCapacity: 128,
  maxDistanceGm: 500,
  startingLocation: "Area18_City_objectContainer",
};

async function seedStorage(page) {
  await page.evaluate(
    ({ contracts, settings }) => {
      localStorage.setItem("cargolink-contracts", JSON.stringify(contracts));
      localStorage.setItem("cargolink-routing-settings", JSON.stringify(settings));
      localStorage.setItem("cargolink-map-system", "pyro");
      localStorage.removeItem("cargolink-route");
    },
    { contracts: demoContracts, settings: demoSettings }
  );
}

async function capture(page, name, url, options = {}) {
  await page.goto(url, { waitUntil: "networkidle" });
  if (options.waitMs) await page.waitForTimeout(options.waitMs);
  if (options.click) {
    for (const selector of options.click) {
      await page.click(selector);
      await page.waitForTimeout(300);
    }
  }
  await page.screenshot({
    path: path.join(OUT_DIR, `${name}.png`),
    fullPage: options.fullPage ?? false,
  });
  console.log(`saved ${name}.png`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  await capture(page, "01-home", `${BASE_URL}/`, { waitMs: 500 });
  await capture(page, "02-map", `${BASE_URL}/map`, { waitMs: 1200 });

  await seedStorage(page);
  await capture(page, "03-contracts-prep", `${BASE_URL}/contracts`, { waitMs: 800 });

  await page.goto(`${BASE_URL}/contracts`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Routing" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, "04-contracts-routing.png") });
  console.log("saved 04-contracts-routing.png");

  await page.getByRole("button", { name: /Generate optimal route/i }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT_DIR, "05-contracts-routing-planned.png"), fullPage: true });
  console.log("saved 05-contracts-routing-planned.png");

  await page.getByRole("tab", { name: /Cargo tracking/i }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT_DIR, "06-contracts-tracking.png"), fullPage: true });
  console.log("saved 06-contracts-tracking.png");

  await page.evaluate(() => localStorage.removeItem("cargolink-route"));
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /Cargo tracking/i }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, "07-contracts-tracking-empty.png") });
  console.log("saved 07-contracts-tracking-empty.png");

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
