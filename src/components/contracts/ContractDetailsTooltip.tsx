import type { Contract } from "@/types/contracts";
import { contractTotalScu } from "@/lib/ocr-parser";
import { getLocationDisplayName } from "@/lib/location-lookup";
import { formatAuec, formatScu } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function ContractDetailsContent({ contract }: { contract: Contract }) {
  return (
    <div className="max-w-xs space-y-2 text-left">
      <div className="font-semibold">{contract.title}</div>
      {contract.reward != null && (
        <div className="text-muted-foreground">Reward: {formatAuec(contract.reward)}</div>
      )}
      <div>
        <div className="font-medium text-foreground">Pickups</div>
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
        <div className="font-medium text-foreground">Dropoffs</div>
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
      <div className="border-t border-border pt-1 text-foreground">
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
