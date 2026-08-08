import { ClipboardList, PackageCheck, Route } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PrepTab } from "@/pages/contracts/PrepTab";
import { RoutingTab } from "@/pages/contracts/RoutingTab";
import { TrackingTab } from "@/pages/contracts/TrackingTab";
import { cn } from "@/lib/utils";

const steps = [
  {
    value: "prep",
    label: "Prep",
    description: "Scan & edit",
    icon: ClipboardList,
  },
  {
    value: "routing",
    label: "Routing",
    description: "Plan haul",
    icon: Route,
  },
  {
    value: "tracking",
    label: "Tracking",
    description: "Follow cargo",
    icon: PackageCheck,
  },
] as const;

export function ContractsPage() {
  return (
    <div className="-m-[50px] min-h-[calc(100dvh-3rem)] px-4 py-4 sm:px-6 sm:py-5">
      <div
        className={cn(
          "relative mx-auto max-w-[1600px] space-y-3",
          "before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,hsl(24_60%_42%/0.12),transparent_55%),radial-gradient(ellipse_60%_40%_at_100%_0%,hsl(222_28%_18%/0.5),transparent_50%)]",
          "dark:before:bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,hsl(24_60%_50%/0.14),transparent_55%),radial-gradient(ellipse_50%_35%_at_100%_0%,hsl(222_40%_12%/0.8),transparent_50%)]"
        )}
      >
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Contracts</h1>
            <p className="text-xs text-muted-foreground">
              Prepare, route, and track hauling missions
            </p>
          </div>
        </header>

        <Tabs defaultValue="prep" className="space-y-3">
          <TabsList
            className={cn(
              "flex h-auto w-full flex-col gap-1 rounded-lg border border-border/80 bg-card/70 p-1 shadow-none backdrop-blur-sm",
              "sm:flex-row sm:items-stretch sm:gap-0"
            )}
          >
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <TabsTrigger
                  key={step.value}
                  value={step.value}
                  className={cn(
                    "group relative flex h-auto min-h-14 flex-1 cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-left",
                    "border border-transparent bg-transparent shadow-none transition-all duration-200",
                    "hover:bg-accent/50 hover:text-foreground",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "data-[state=active]:border-primary/30 data-[state=active]:bg-primary/10",
                    "data-[state=active]:text-foreground data-[state=active]:shadow-none",
                    "sm:rounded-md"
                  )}
                >
                  <span
                    className={cn(
                      "absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-transparent transition-colors duration-200",
                      "group-data-[state=active]:bg-primary"
                    )}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold tabular-nums transition-colors duration-200",
                      "bg-muted/80 text-muted-foreground",
                      "group-data-[state=active]:bg-primary group-data-[state=active]:text-primary-foreground"
                    )}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Icon
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors duration-200",
                          "group-data-[state=active]:text-primary"
                        )}
                      />
                      <span className="text-sm font-semibold tracking-tight">{step.label}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground group-data-[state=active]:text-foreground/65">
                      {step.description}
                    </p>
                  </div>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent
            value="prep"
            className="mt-0 animate-in fade-in-0 duration-200 focus-visible:outline-none"
          >
            <PrepTab />
          </TabsContent>
          <TabsContent
            value="routing"
            className="mt-0 h-[calc(100dvh-11rem)] min-h-0 animate-in fade-in-0 duration-200 focus-visible:outline-none"
          >
            <RoutingTab />
          </TabsContent>
          <TabsContent
            value="tracking"
            className="mt-0 animate-in fade-in-0 duration-200 focus-visible:outline-none"
          >
            <TrackingTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
