import { ArrowDown, CheckCircle2, Circle, Fuel, MapPin, Route } from "lucide-react";
import type { Contract, RouteAction, RouteVisit } from "@/types/contracts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatDistance, formatScu } from "@/lib/utils";
import { cargoItemLabel } from "@/lib/cargo-display";
import { getLocationDisplayName } from "@/lib/location-lookup";

function visitIcon(type: RouteVisit["type"]) {
  switch (type) {
    case "start":
      return <MapPin className="h-3.5 w-3.5" />;
    case "stopover":
      return <Fuel className="h-3.5 w-3.5" />;
    case "gateway":
      return <Route className="h-3.5 w-3.5" />;
    default:
      return <MapPin className="h-3.5 w-3.5" />;
  }
}

function visitBadgeVariant(type: RouteVisit["type"]) {
  if (type === "start") return "secondary" as const;
  if (type === "stopover" || type === "gateway") return "outline" as const;
  if (type === "pickup") return "success" as const;
  return "warning" as const;
}

function visitLabel(type: RouteVisit["type"]) {
  if (type === "stopover") return "refuel";
  if (type === "gateway") return "gateway";
  return type;
}

function ActionRow({
  action,
  done,
  onToggle,
  onToggleContract,
  contractDone,
}: {
  action: RouteAction;
  done: boolean;
  onToggle: () => void;
  onToggleContract: () => void;
  contractDone: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-2 rounded-md px-2 py-1.5 text-xs",
        done
          ? "border border-success/30 bg-success/5"
          : "border border-transparent bg-muted/25"
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <Button variant="ghost" size="icon" className="mt-0.5 h-6 w-6 shrink-0" onClick={onToggle}>
          {done ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : (
            <Circle className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
        <div className="min-w-0">
          <div className={cn("font-medium", done && "text-muted-foreground line-through")}>
            {action.type === "pickup" ? "Pick up" : "Drop off"}
          </div>
          <div className={cn("text-muted-foreground", done && "line-through")}>
            {action.items.map((it) => `${cargoItemLabel(it)} (${formatScu(it.scu)})`).join(", ")}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">{action.contractTitle}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[11px]"
              onClick={onToggleContract}
            >
              {contractDone ? (
                <span className="text-success">Contract done</span>
              ) : (
                <span>Mark contract done</span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FlowConnector() {
  return (
    <div className="flex flex-col items-center py-0.5">
      <div className="h-3 w-px bg-border/80" />
      <ArrowDown className="h-3.5 w-3.5 text-muted-foreground/60" />
      <div className="h-3 w-px bg-border/80" />
    </div>
  );
}

function FlowNode({
  visit,
  index,
  active,
  done,
  isActionDone,
  onToggleAction,
  onToggleContract,
  getContract,
}: {
  visit: RouteVisit;
  index: number;
  active: boolean;
  done: boolean;
  isActionDone: (action: RouteAction) => boolean;
  onToggleAction: (action: RouteAction) => void;
  onToggleContract: (contractId: string) => void;
  getContract: (id: string) => Contract | undefined;
}) {
  return (
    <div className="flex w-full max-w-2xl flex-col items-stretch">
      <div
        className={cn(
          "w-full rounded-lg border border-border/70 bg-muted/20 p-3 transition-colors duration-200",
          active && "border-primary/50 bg-primary/5",
          done && !active && "opacity-75"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11px] font-bold tabular-nums transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : done
                    ? "bg-success/20 text-success"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                {index > 0 && (
                  <Badge variant="outline" className="tabular-nums">
                    Leg {index}
                  </Badge>
                )}
                <Badge variant={visitBadgeVariant(visit.type)} className="gap-1">
                  {visitIcon(visit.type)}
                  {visitLabel(visit.type)}
                </Badge>
                <span className="text-sm font-semibold tracking-tight">
                  {getLocationDisplayName(visit.locationName)}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] tabular-nums text-muted-foreground">
                <span>{visit.system}</span>
                {visit.distanceFromPrev > 0 && <span>+{formatDistance(visit.distanceFromPrev)}</span>}
                <span>Cargo after: {formatScu(visit.cargoAfter)}</span>
              </div>
            </div>
          </div>
        </div>

        {visit.type === "stopover" && (
          <p className="mt-2 text-xs text-muted-foreground">Refuel stopover — no cargo actions</p>
        )}
        {visit.type === "gateway" && (
          <p className="mt-2 text-xs text-muted-foreground">Transit through jump point</p>
        )}
        {visit.type === "start" && visit.actions.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">Starting location</p>
        )}

        {visit.actions.length > 0 && (
          <div className="mt-2 space-y-1">
            {visit.actions.map((action, i) => {
              const contract = getContract(action.contractId);
              return (
                <ActionRow
                  key={`${action.contractId}-${action.stopId}-${i}`}
                  action={action}
                  done={isActionDone(action)}
                  onToggle={() => onToggleAction(action)}
                  onToggleContract={() => onToggleContract(action.contractId)}
                  contractDone={contract?.completed ?? false}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function RouteFlowGraph({
  visits,
  contracts,
  onToggleAction,
  onToggleContract,
}: {
  visits: RouteVisit[];
  contracts: Contract[];
  onToggleAction: (action: RouteAction) => void;
  onToggleContract: (contractId: string) => void;
}) {
  const getContract = (id: string) => contracts.find((c) => c.id === id);

  const isActionDone = (action: RouteAction) => {
    const contract = getContract(action.contractId);
    if (!contract) return false;
    const stops = action.type === "pickup" ? contract.pickups : contract.dropoffs;
    return stops.find((s) => s.id === action.stopId)?.completed ?? false;
  };

  const isVisitDone = (visit: RouteVisit) => {
    if (visit.actions.length === 0) return true;
    return visit.actions.every(isActionDone);
  };

  const activeIndex = visits.findIndex((v) => !isVisitDone(v));

  return (
    <div className="flex flex-col items-center py-1">
      {visits.map((visit, index) => (
        <div key={visit.id} className="flex w-full flex-col items-center">
          <FlowNode
            visit={visit}
            index={index}
            active={index === activeIndex}
            done={isVisitDone(visit)}
            isActionDone={isActionDone}
            onToggleAction={onToggleAction}
            onToggleContract={onToggleContract}
            getContract={getContract}
          />
          {index < visits.length - 1 && <FlowConnector />}
        </div>
      ))}
    </div>
  );
}
