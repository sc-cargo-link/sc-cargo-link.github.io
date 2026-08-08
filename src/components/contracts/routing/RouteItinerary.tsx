import { useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { getLocationDisplayName } from "@/lib/location-lookup";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatDistance, formatScu } from "@/lib/utils";
import { cargoItemLabel } from "@/lib/cargo-display";
import type { RoutePlan, RouteVisit } from "@/types/contracts";

const panelClass =
  "shadow-none ring-0 border-border/80 bg-card/80 backdrop-blur-sm";

function visitTypeLabel(type: RouteVisit["type"]): string {
  if (type === "stopover") return "refuel";
  if (type === "gateway") return "gateway";
  return type;
}

function VisitCard({
  visit,
  index,
  legNumber,
  selected,
  onSelect,
  onMoveUp,
  onMoveDown,
  onRemove,
  canMoveUp,
  canMoveDown,
  canRemove,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  dragging,
}: {
  visit: RouteVisit;
  index: number;
  legNumber: number | null;
  selected: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canRemove: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  dragging: boolean;
}) {
  const actionSummary =
    visit.actions.length === 0
      ? visit.type === "stopover"
        ? "Refuel stopover"
        : visit.type === "gateway"
          ? "Jump point transit"
          : visit.type === "start"
            ? "Starting point"
            : null
      : visit.actions
          .map((action) => {
            const items = action.items
              .map((it) => `${cargoItemLabel(it)} ${it.scu}`)
              .join(", ");
            return `${action.type === "pickup" ? "↑" : "↓"} ${items || action.contractTitle}`;
          })
          .join(" · ");

  return (
    <div
      draggable={canMoveUp || canMoveDown}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className={cn(
        "rounded-md border text-left text-xs transition-colors",
        "border-border/70 bg-muted/20",
        selected && "border-primary/50 bg-primary/10",
        dragging && "opacity-50"
      )}
    >
      <div className="flex items-stretch">
        {(canMoveUp || canMoveDown) && (
          <div
            className="flex cursor-grab items-center px-1 text-muted-foreground active:cursor-grabbing"
            title="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 p-2 text-left hover:bg-accent/30"
        >
          <div className="flex items-center gap-2">
            {legNumber !== null ? (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold tabular-nums">
                {legNumber}
              </span>
            ) : (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                S
              </span>
            )}
            <Badge
              variant={
                visit.type === "start"
                  ? "secondary"
                  : visit.type === "stopover" || visit.type === "gateway"
                    ? "outline"
                    : visit.type === "pickup"
                      ? "success"
                      : "warning"
              }
              className="shrink-0"
            >
              {visitTypeLabel(visit.type)}
            </Badge>
            <span className="min-w-0 truncate font-medium">
              {getLocationDisplayName(visit.locationName)}
            </span>
          </div>
          {visit.distanceFromPrev > 0 && (
            <div className="mt-1 pl-7 text-muted-foreground">
              +{formatDistance(visit.distanceFromPrev)}
            </div>
          )}
          {actionSummary && (
            <div className="mt-1 truncate pl-7 text-muted-foreground">
              {actionSummary}
            </div>
          )}
          <div className="mt-1 pl-7 text-[11px] tabular-nums text-muted-foreground">
            Cargo after: {formatScu(visit.cargoAfter)}
          </div>
        </button>
        <div className="flex flex-col items-center justify-center gap-0.5 border-l border-border/50 px-1 py-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:bg-transparent hover:text-foreground"
            disabled={!canMoveUp}
            onClick={onMoveUp}
            aria-label={`Move stop ${index + 1} up`}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:bg-transparent hover:text-foreground"
            disabled={!canMoveDown}
            onClick={onMoveDown}
            aria-label={`Move stop ${index + 1} down`}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          {canRemove && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:bg-transparent hover:text-destructive"
              onClick={onRemove}
              aria-label={`Remove stop ${index + 1}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface RouteItineraryProps {
  route: RoutePlan | null;
  selectedVisitIndex: number | null;
  onSelectVisit: (index: number) => void;
  onMoveVisit: (from: number, to: number) => void;
  onRemoveVisit: (index: number) => void;
  onStartAddStop: () => void;
  addingStop: boolean;
}

export function RouteItinerary({
  route,
  selectedVisitIndex,
  onSelectVisit,
  onMoveVisit,
  onRemoveVisit,
  onStartAddStop,
  addingStop,
}: RouteItineraryProps) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  return (
    <div
      className={cn(
        panelClass,
        "flex min-h-[320px] flex-col overflow-hidden rounded-lg border lg:min-h-0"
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
        <h3 className="text-sm font-semibold">Itinerary</h3>
        <Button
          variant={addingStop ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs"
          onClick={onStartAddStop}
        >
          <Plus className="mr-1 h-3 w-3" />
          Add stop
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-2.5 py-2">
        <div className="space-y-1.5 pr-2">
          {route ? (
            route.visits.map((visit, index) => (
              <VisitCard
                key={visit.id}
                visit={visit}
                index={index}
                legNumber={index > 0 ? index : null}
                selected={selectedVisitIndex === index && !addingStop}
                onSelect={() => onSelectVisit(index)}
                onMoveUp={() => onMoveVisit(index, index - 1)}
                onMoveDown={() => onMoveVisit(index, index + 1)}
                onRemove={() => onRemoveVisit(index)}
                canMoveUp={index > 1}
                canMoveDown={index > 0 && index < route.visits.length - 1}
                canRemove={visit.type !== "start"}
                dragging={dragFrom === index}
                onDragStart={() => setDragFrom(index)}
                onDragEnd={() => setDragFrom(null)}
                onDragOver={(e) => {
                  if (dragFrom === null || dragFrom === 0 || index === 0) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={() => {
                  if (dragFrom === null || dragFrom === index || index === 0 || dragFrom === 0) {
                    setDragFrom(null);
                    return;
                  }
                  onMoveVisit(dragFrom, index);
                  setDragFrom(null);
                }}
              />
            ))
          ) : (
            <p className="px-1 py-8 text-center text-sm text-muted-foreground">
              Generate a route or add a custom stop to begin.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
