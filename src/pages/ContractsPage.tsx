import { ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PrepTab } from "@/pages/contracts/PrepTab";
import { RoutingTab } from "@/pages/contracts/RoutingTab";
import { TrackingTab } from "@/pages/contracts/TrackingTab";
import { cn } from "@/lib/utils";

const steps = [
  { value: "prep", label: "Manifest" },
  { value: "routing", label: "Flight plan" },
  { value: "tracking", label: "On the road" },
] as const;


export function ContractsPage() {
  return (
    <div className="-m-[50px] min-h-[calc(100dvh-3rem)] px-4 py-4 sm:px-6 sm:py-5">
      <div className="relative mx-auto max-w-[1600px] space-y-3 before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-atmosphere">
        <Tabs defaultValue="prep" className="space-y-6">
          <TabsList className="flex h-auto w-full items-center justify-center gap-3 rounded-none border-0 bg-transparent p-0 text-muted-foreground shadow-none sm:gap-4">
            {steps.map((step, index) => (
              <Fragment key={step.value}>
                {index > 0 && (
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground/45 sm:h-5 sm:w-5"
                    aria-hidden
                  />
                )}
                <TabsTrigger
                  value={step.value}
                  className={cn(
                    "h-auto rounded-none bg-transparent px-1 py-1.5 text-lg font-medium tracking-tight shadow-none sm:text-xl",
                    "text-muted-foreground transition-colors",
                    "hover:text-foreground/80",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none",
                    "data-[state=active]:font-semibold"
                  )}
                >
                  {step.label}
                </TabsTrigger>
              </Fragment>
            ))}
          </TabsList>

          <TabsContent
            value="prep"
            className="mt-0 animate-in fade-in-0 duration-200 focus-visible:outline-none"
          >
            <PrepTab />
          </TabsContent>
          <TabsContent
            value="routing"
            className="mt-0 animate-in fade-in-0 duration-200 focus-visible:outline-none"
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
