import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { getContractRouteInclusion } from "@/lib/route-actions";
import { contractMatchesSearch } from "@/lib/contract-search";
import { ContractDetailsTooltip } from "@/components/contracts/ContractDetailsTooltip";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Contract, RoutePlan } from "@/types/contracts";

const panelClass =
  "shadow-none ring-0 border-border/80 bg-card/80 backdrop-blur-sm";

interface RouteContractsRailProps {
  contracts: Contract[];
  route: RoutePlan | null;
  onToggle: (contractId: string, selected: boolean) => void;
}

function SlimContractRow({
  contract,
  route,
}: {
  contract: Contract;
  route: RoutePlan | null;
}) {
  const { included, total } = getContractRouteInclusion(contract, route);
  const allIncluded = total > 0 && included >= total;

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 truncate text-xs font-medium">
          {contract.title}
        </div>
        {contract.selectedForRoute && total > 0 && (
          <span
            className={cn(
              "shrink-0 tabular-nums text-[11px] font-semibold",
              allIncluded ? "text-success" : "text-warning"
            )}
          >
            ({included}/{total})
          </span>
        )}
      </div>
    </div>
  );
}

export function RouteContractsRail({
  contracts,
  route,
  onToggle,
}: RouteContractsRailProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredContracts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return contracts;
    return contracts.filter((contract) => contractMatchesSearch(contract, query));
  }, [contracts, searchQuery]);

  return (
    <div
      className={cn(
        panelClass,
        "flex min-h-[280px] flex-col overflow-hidden rounded-lg border lg:min-h-0"
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
        <Label className="text-xs font-semibold">Contracts</Label>
        {contracts.length > 0 && (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {searchQuery.trim()
              ? `${filteredContracts.length} of ${contracts.length}`
              : `${contracts.length}`}
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2.5">
        {contracts.length > 0 && (
          <div className="relative shrink-0">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search…"
              className="h-8 pl-8"
            />
          </div>
        )}
        <ScrollArea className="min-h-0 flex-1">
          <TooltipProvider delayDuration={200}>
            <div className="space-y-1 pr-2">
              {contracts.length === 0 ? (
                <p className="px-1 py-4 text-xs text-muted-foreground">
                  Add contracts in Prep first.
                </p>
              ) : filteredContracts.length === 0 ? (
                <p className="px-1 py-4 text-xs text-muted-foreground">
                  No contracts match your search.
                </p>
              ) : (
                filteredContracts.map((c) => (
                  <ContractDetailsTooltip key={c.id} contract={c}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border/70 bg-muted/20 px-2 py-1.5 text-xs hover:bg-accent/30">
                      <Checkbox
                        checked={c.selectedForRoute}
                        onCheckedChange={(v) => onToggle(c.id, !!v)}
                      />
                      <SlimContractRow contract={c} route={route} />
                    </label>
                  </ContractDetailsTooltip>
                ))
              )}
            </div>
          </TooltipProvider>
        </ScrollArea>
      </div>
    </div>
  );
}
