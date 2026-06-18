import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PrepTab } from "@/pages/contracts/PrepTab";
import { RoutingTab } from "@/pages/contracts/RoutingTab";
import { TrackingTab } from "@/pages/contracts/TrackingTab";

export function ContractsPage() {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold">Contracts</h1>
        <p className="text-xs text-muted-foreground">Prepare, route, and track hauling missions</p>
      </div>
      <Tabs defaultValue="prep">
        <TabsList>
          <TabsTrigger value="prep">Prep</TabsTrigger>
          <TabsTrigger value="routing">Routing</TabsTrigger>
          <TabsTrigger value="tracking">Cargo tracking</TabsTrigger>
        </TabsList>
        <TabsContent value="prep">
          <PrepTab />
        </TabsContent>
        <TabsContent value="routing" className="mt-3 h-[calc(100dvh-11rem)] min-h-0">
          <RoutingTab />
        </TabsContent>
        <TabsContent value="tracking">
          <TrackingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
