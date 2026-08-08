import { CheckCircle2, Circle, Route } from "lucide-react";
import { useContracts } from "@/context/ContractsContext";
import { RouteFlowGraph } from "@/components/contracts/RouteFlowGraph";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getLocationDisplayName } from "@/lib/location-lookup";
import { cn, formatDistance, formatScu } from "@/lib/utils";
import type { Contract, RouteAction } from "@/types/contracts";

const panelClass =
  "shadow-none ring-0 border-border/80 bg-card/80 backdrop-blur-sm";

function ContractSummaryRow({
  contract,
  onToggle,
}: {
  contract: Contract;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/20 px-2 py-1.5 text-xs",
        contract.completed && "opacity-60"
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onToggle}>
          {contract.completed ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : (
            <Circle className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
        <span className={cn("truncate font-medium", contract.completed && "line-through")}>
          {contract.title}
        </span>
      </div>
      <Badge variant={contract.completed ? "success" : "secondary"}>
        {contract.pickups.filter((p) => p.completed).length}/{contract.pickups.length}↑{" "}
        {contract.dropoffs.filter((d) => d.completed).length}/{contract.dropoffs.length}↓
      </Badge>
    </div>
  );
}

export function TrackingTab() {
  const { contracts, route, routingSettings, updateContract } = useContracts();

  const selectedContracts = contracts.filter((c) => c.selectedForRoute);

  const toggleAction = (action: RouteAction) => {
    const contract = contracts.find((c) => c.id === action.contractId);
    if (!contract) return;

    if (action.type === "pickup") {
      updateContract(contract.id, {
        pickups: contract.pickups.map((p) =>
          p.id === action.stopId ? { ...p, completed: !p.completed } : p
        ),
      });
    } else {
      updateContract(contract.id, {
        dropoffs: contract.dropoffs.map((d) =>
          d.id === action.stopId ? { ...d, completed: !d.completed } : d
        ),
      });
    }
  };

  const toggleContract = (contractId: string) => {
    const contract = contracts.find((c) => c.id === contractId);
    if (!contract) return;
    updateContract(contractId, { completed: !contract.completed });
  };

  const completedStops = selectedContracts.reduce((sum, c) => {
    const pickups = c.pickups.filter((p) => p.completed).length;
    const dropoffs = c.dropoffs.filter((d) => d.completed).length;
    return sum + pickups + dropoffs;
  }, 0);

  const totalStops = selectedContracts.reduce(
    (sum, c) => sum + c.pickups.length + c.dropoffs.length,
    0
  );

  if (!route?.visits.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/80 py-14 text-center">
        <Route className="h-7 w-7 text-muted-foreground" />
        <div>
          <p className="text-sm font-semibold">No planned route</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Build a flight plan first, then work pickups and dropoffs stop by stop.
          </p>
        </div>
        {selectedContracts.length > 0 && (
          <Card className={cn(panelClass, "w-full max-w-md text-left")}>
            <CardHeader className="py-2.5 pb-2">
              <CardTitle className="text-sm font-semibold">
                Contracts ({selectedContracts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {selectedContracts.map((c) => (
                <ContractSummaryRow
                  key={c.id}
                  contract={c}
                  onToggle={() => toggleContract(c.id)}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  const progressPct = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

  return (
    <div className="flex min-h-0 flex-col gap-2.5 lg:flex-row">
      <div className="flex min-h-0 flex-1 flex-col gap-2.5">
        <div
          className={cn(
            "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border/80 bg-card/80 px-3 py-2 text-xs backdrop-blur-sm"
          )}
        >
          <Badge variant="secondary" className="max-w-[12rem] truncate">
            From{" "}
            {getLocationDisplayName(routingSettings.startingLocation) ||
              getLocationDisplayName(route.visits[0]?.locationName ?? "") ||
              "—"}
          </Badge>
          <span className="tabular-nums text-muted-foreground">
            {route.visits.length} stops · {formatDistance(route.totalDistance)} ·{" "}
            {formatScu(route.totalScu)}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="tabular-nums text-muted-foreground">
              {completedStops}/{totalStops}
            </span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        <ScrollArea
          className={cn(
            "min-h-[420px] flex-1 rounded-lg border border-border/80 bg-card/60 backdrop-blur-sm"
          )}
        >
          <div className="p-3 sm:p-4">
            <RouteFlowGraph
              visits={route.visits}
              contracts={contracts}
              onToggleAction={toggleAction}
              onToggleContract={toggleContract}
            />
          </div>
        </ScrollArea>
      </div>

      <Card className={cn(panelClass, "w-full shrink-0 lg:w-72")}>
        <CardHeader className="py-2.5 pb-2">
          <CardTitle className="text-sm font-semibold">Contracts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {selectedContracts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No contracts selected for routing.</p>
          ) : (
            selectedContracts.map((c) => (
              <ContractSummaryRow key={c.id} contract={c} onToggle={() => toggleContract(c.id)} />
            ))
          )}
          <p className="pt-2 text-[11px] text-muted-foreground">
            Mark pickups and dropoffs in the flow, or mark an entire contract done here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
