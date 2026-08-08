import type { Contract } from "@/types/contracts";
import { contractTotalScu } from "@/lib/ocr-parser";
import { getLocationDisplayName } from "@/lib/location-lookup";
import { formatAuec, formatScu } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function ContractDetailsContent({ contract }: { contract: Contract }) {
  return (
    <div className="max-w-xs space-y-2 text-left text-xs">
      <div className="text-sm font-semibold tracking-tight">{contract.title}</div>
      {contract.reward != null && (
        <div className="tabular-nums text-muted-foreground">
          Reward: {formatAuec(contract.reward)}
        </div>
      )}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Pickups
        </div>
        {contract.pickups.length === 0 ? (
          <div className="text-muted-foreground">None</div>
        ) : (
          contract.pickups.map((stop) => (
            <div key={stop.id} className="text-muted-foreground">
              <span className="text-foreground">
                {getLocationDisplayName(stop.locationName) || stop.locationHint || "—"}
              </span>
              {": "}
              {stop.items
                .map((i) => i.name || i.nameHint || "—")
                .join(", ") || "—"}
            </div>
          ))
        )}
      </div>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Dropoffs
        </div>
        {contract.dropoffs.length === 0 ? (
          <div className="text-muted-foreground">None</div>
        ) : (
          contract.dropoffs.map((stop) => (
            <div key={stop.id} className="text-muted-foreground">
              <span className="text-foreground">
                {getLocationDisplayName(stop.locationName) || stop.locationHint || "—"}
              </span>
              {": "}
              {stop.items
                .map((i) => `${i.name || i.nameHint || "—"} (${i.scu} SCU)`)
                .join(", ") || "—"}
            </div>
          ))
        )}
      </div>
      <div className="border-t border-border/70 pt-1.5 tabular-nums text-foreground">
        Total cargo: {formatScu(contractTotalScu(contract))}
      </div>
    </div>
  );
}

export function ContractDetailsTooltip({
  contract,
  children,
}: {
  contract: Contract;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" className="p-3">
        <ContractDetailsContent contract={contract} />
      </TooltipContent>
    </Tooltip>
  );
}
