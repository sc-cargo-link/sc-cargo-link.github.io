import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen,
  Package,
  Route,
  ScanLine,
  Truck,
} from "lucide-react";

interface GuideStep {
  title: string;
  description: string;
  bullets?: string[];
  image?: string;
  imageAlt: string;
}

interface GuideSection {
  id: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  intro?: string;
  steps: GuideStep[];
}

const guideSections: GuideSection[] = [
  {
    id: "overview",
    title: "Getting started",
    icon: BookOpen,
    intro:
      "CargoLink helps you scan hauling contracts from in-game screenshots, plan an optimal route, and track pickups and dropoffs during your run. All data is saved in your browser.",
    steps: [
      {
        title: "Navigate the app",
        description:
          "Use the top navigation to move between Home, Contracts, Map, and Help. Contracts is where you'll spend most of your time — it has three tabs for the full workflow.",
        image: "/help/01-home.png",
        imageAlt: "CargoLink home page with navigation bar",
        bullets: [
          "Home — quick overview and links to other pages",
          "Contracts — prep, routing, and cargo tracking",
          "Map — browse star systems and points of interest",
          "Help — this guide",
        ],
      },
    ],
  },
  {
    id: "prep",
    title: "Prep — scan contracts",
    icon: ScanLine,
    intro:
      "Upload contract screenshots from the mobiGlas and let OCR extract pickup, dropoff, cargo, and reward details.",
    steps: [
      {
        title: "Set up scan regions (first time only)",
        description:
          "Before uploading contracts, calibrate where OCR should read on your screenshots. Upload one sample image and draw three boxes: Name, Primary objective, and Reward.",
        image: "/help/03-contracts-prep.png",
        imageAlt: "Contracts prep tab with scan region setup",
        bullets: [
          "Expand Scan regions and upload a sample contract screenshot",
          "PrintScreen will put the screenshots to 'Roberts Space Industries\\StarCitizen\\LIVE\\Screenshots' folder",
          "Switch between Name, Primary objective, and Reward tabs",
          "Draw a box on the image for each region — all future uploads use these boxes",
          "Regions are saved automatically in your browser",
        ],
      },
      {
        title: "Upload and review contracts",
        description:
          "Once scan regions are configured, upload your contract screenshots in batch. Each image becomes an editable contract card with the screenshot beside the fields.",
        bullets: [
          "Click Upload screenshots to process multiple images at once",
          "Review each contract: title, reward (aUEC), pickups, and dropoffs",
          "Edit locations and cargo items — autocomplete suggests matches from map data",
          "Unmatched OCR text appears as suggestion chips under the field",
          "Contracts stay in upload order; use the search bar to filter",
          "Click a screenshot to expand it; enable Developer mode to see raw OCR text",
        ],
      },
    ],
  },
  {
    id: "routing",
    title: "Routing — plan your haul",
    icon: Route,
    intro:
      "Configure your ship, select contracts, and generate an optimal route that respects capacity, range, and cross-system jump points.",
    steps: [
      {
        title: "Configure route settings",
        description:
          "Open the Routing tab and enter your ship details. Select which contracts to include, then generate the route.",
        image: "/help/04-contracts-routing.png",
        imageAlt: "Routing tab with ship settings and contract selection",
        bullets: [
          "Ship capacity (SCU) — maximum cargo your ship can carry",
          "Max range per tank (GM) — distance before a refuel stopover is added",
          "Starting location — where your haul begins",
          "Check the contracts you want to include in this run",
        ],
      },
      {
        title: "Review the planned route",
        description:
          "After generating, review each visit in the planned route list. The route map below shows your path with numbered legs. Click a visit to focus it on the map.",
        image: "/help/05-contracts-routing-planned.png",
        imageAlt: "Planned route with visit list and route map",
        bullets: [
          "Each visit shows leg number, type (start, pickup, dropoff, gateway, refuel), and distance",
          "Pickup and dropoff actions list the cargo and which contract it belongs to",
          "Use ↑↓ arrows to manually reorder visits (start is fixed)",
          "Add custom stops by searching a location and selecting available actions",
          "Clear route to start over with different settings",
        ],
      },
    ],
  },
  {
    id: "tracking",
    title: "Cargo tracking — fly the route",
    icon: Truck,
    intro:
      "Follow your planned route step by step and mark pickups and dropoffs as you complete them in-game.",
    steps: [
      {
        title: "Track progress on the flow graph",
        description:
          "The Cargo tracking tab shows your route as a vertical flow graph. The active stop is highlighted — check off each pickup and dropoff as you complete it.",
        image: "/help/06-contracts-tracking.png",
        imageAlt: "Cargo tracking flow graph with active visit highlighted",
        bullets: [
          "Progress bar shows stops, total distance, cargo, and completed actions",
          "Click the circle next to an action to mark it complete (turns green with strikethrough)",
          "Gateway and refuel stops have no cargo actions — just transit through them",
          "Mark an entire contract done from the sidebar or via the link on each visit",
        ],
      },
      {
        title: "Before you have a route",
        description:
          "If you open Cargo tracking before generating a route, you'll see a prompt to head to the Routing tab first.",
        image: "/help/07-contracts-tracking-empty.png",
        imageAlt: "Empty cargo tracking state with no planned route",
        bullets: [
          "Generate a route in the Routing tab to unlock the flow graph",
          "Contracts selected for routing still appear in the sidebar for reference",
        ],
      },
    ],
  },
  {
    id: "tips",
    title: "Tips & persistence",
    icon: Package,
    intro: "A few things worth knowing as you use CargoLink.",
    steps: [
      {
        title: "Your data stays local",
        description:
          "Contracts, scan regions, route plans, and settings are stored in your browser's local storage. They persist across page reloads but are not synced between devices.",
        imageAlt: "Local storage persistence",
        bullets: [
          "Clear all on the Prep tab removes every contract and uploaded screenshot",
          "Clear route on the Routing tab resets only the planned route",
          "Use the theme toggle in the header to switch light and dark mode",
        ],
      },
    ],
  },
];

function GuideScreenshot({ src, alt }: { src?: string; alt: string }) {
  if (!src) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted/30 shadow-sm">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="w-full object-cover object-top"
      />
    </div>
  );
}

function GuideStepCard({
  step,
  stepNumber,
}: {
  step: GuideStep;
  stepNumber: number;
}) {
  return (
    <article className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {stepNumber}
        </span>
        <div className="min-w-0 space-y-1">
          <h4 className="text-sm font-semibold leading-tight">{step.title}</h4>
          <p className="text-sm text-muted-foreground">{step.description}</p>
        </div>
      </div>

      {step.image && <GuideScreenshot src={step.image} alt={step.imageAlt} />}

      {step.bullets && step.bullets.length > 0 && (
        <ul className="ml-10 list-disc space-y-1.5 text-sm text-muted-foreground">
          {step.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function HelpGuide() {
  let globalStep = 0;

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <nav className="shrink-0 lg:sticky lg:top-16 lg:w-52 lg:self-start">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          On this page
        </p>
        <ul className="flex flex-wrap gap-1.5 lg:flex-col">
          {guideSections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <section.icon className="h-3.5 w-3.5 shrink-0" />
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 flex-1 space-y-8">
        {guideSections.map((section, sectionIndex) => (
          <section key={section.id} id={section.id} className="scroll-mt-20">
            <Card className="overflow-hidden border-border/80 bg-card/60">
              <CardContent className="space-y-5 p-4 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
                    <section.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">{section.title}</h2>
                    {section.intro && (
                      <p className="mt-0.5 text-sm text-muted-foreground">{section.intro}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="ml-auto">
                    {sectionIndex + 1} of {guideSections.length}
                  </Badge>
                </div>

                <Separator />

                <div className="space-y-8">
                  {section.steps.map((step) => {
                    globalStep += 1;
                    return (
                      <GuideStepCard
                        key={step.title}
                        step={step}
                        stepNumber={globalStep}
                      />
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </section>
        ))}
      </div>
    </div>
  );
}
