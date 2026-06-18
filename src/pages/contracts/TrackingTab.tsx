import { CheckCircle2, Circle, Route } from "lucide-react";
import { useContracts } from "@/context/ContractsContext";
import { RouteFlowGraph } from "@/components/contracts/RouteFlowGraph";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistance, formatScu } from "@/lib/utils";
import type { Contract, RouteAction } from "@/types/contracts";

function ContractSummaryRow({
  contract,
  onToggle,
}: {
  contract: Contract;
  onToggle: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs ${
        contract.completed ? "border-border/60 opacity-60" : "border-border"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onToggle}>
          {contract.completed ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <Circle className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
        <span className={`truncate font-medium ${contract.completed ? "line-through" : ""}`}>
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
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
        <Route className="h-8 w-8 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">No planned route</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Generate a route in the Routing tab to track pickups and dropoffs step by step.
          </p>
        </div>
        {selectedContracts.length > 0 && (
          <Card className="w-full max-w-md text-left">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Contracts ({selectedContracts.length})</CardTitle>
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

  return (
    <div className="flex min-h-0 flex-col gap-3 lg:flex-row">
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-xs">
          <Badge variant="secondary">From {routingSettings.startingLocation || "—"}</Badge>
          <span className="text-muted-foreground">
            {route.visits.length} stops · {formatDistance(route.totalDistance)} ·{" "}
            {formatScu(route.totalScu)} cargo
          </span>
          <span className="text-muted-foreground">
            Progress: {completedStops}/{totalStops} actions
          </span>
        </div>

        <ScrollArea className="min-h-[420px] flex-1 rounded-lg border border-border bg-muted/20">
          <div className="p-4">
            <RouteFlowGraph
              visits={route.visits}
              contracts={contracts}
              onToggleAction={toggleAction}
              onToggleContract={toggleContract}
            />
          </div>
        </ScrollArea>
      </div>

      <Card className="w-full shrink-0 lg:w-72">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Contracts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {selectedContracts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No contracts selected for routing.</p>
          ) : (
            selectedContracts.map((c) => (
              <ContractSummaryRow key={c.id} contract={c} onToggle={() => toggleContract(c.id)} />
            ))
          )}
          <p className="pt-2 text-[10px] text-muted-foreground">
            Mark individual pickups and dropoffs in the flow graph, or mark an entire contract done
            here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
