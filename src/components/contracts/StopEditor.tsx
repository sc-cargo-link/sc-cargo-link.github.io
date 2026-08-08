import { Plus, Trash2, X } from "lucide-react";
import { nanoid } from "nanoid";
import type { CargoItem, ContractStop } from "@/types/contracts";
import { stopTotalScu } from "@/lib/ocr-parser";
import { MissionItemInput } from "@/components/contracts/MissionItemInput";
import { LocationNameInput } from "@/components/locations/LocationNameInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatScu } from "@/lib/utils";

function StopLine({
  stop,
  index,
  type,
  onChange,
  onRemove,
}: {
  stop: ContractStop;
  index: number;
  type: "pickup" | "dropoff";
  onChange: (stop: ContractStop) => void;
  onRemove: () => void;
}) {
  const updateItem = (itemId: string, patch: Partial<CargoItem>) => {
    onChange({
      ...stop,
      items: stop.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
    });
  };

  const addItem = () => {
    onChange({
      ...stop,
      items: [...stop.items, { id: nanoid(6), name: "Item", scu: type === "dropoff" ? 1 : 0 }],
    });
  };

  const removeItem = (itemId: string) => {
    onChange({ ...stop, items: stop.items.filter((i) => i.id !== itemId) });
  };

  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-md border border-border/60 bg-muted/20 px-1.5 py-1">
      <span className="w-4 shrink-0 text-center text-[10px] tabular-nums text-muted-foreground">
        {index + 1}
      </span>
      <LocationNameInput
        value={stop.locationName}
        hint={stop.locationHint}
        onChange={(v) => onChange({ ...stop, locationName: v, locationHint: undefined })}
        placeholder="Location"
        className="w-[7.5rem] shrink-0 sm:w-[9rem]"
      />
      <div className="h-5 w-px shrink-0 bg-border/70" aria-hidden />
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overflow-y-visible">
        {stop.items.map((item) => (
          <div
            key={item.id}
            className="flex shrink-0 items-center gap-0.5 rounded border border-border/50 bg-background/80 pl-0.5"
          >
            <MissionItemInput
              value={item.name}
              hint={item.nameHint}
              onChange={(name) => updateItem(item.id, { name, nameHint: undefined })}
              placeholder="Cargo"
              className="w-[6.5rem]"
            />
            {type === "dropoff" && (
              <Input
                className="h-7 w-12 border-0 bg-transparent px-1 tabular-nums shadow-none focus-visible:ring-0"
                type="number"
                min={0}
                value={item.scu}
                onChange={(e) => updateItem(item.id, { scu: parseFloat(e.target.value) || 0 })}
                aria-label="SCU"
              />
            )}
            <button
              type="button"
              className="p-1 text-muted-foreground hover:text-destructive"
              onClick={() => removeItem(item.id)}
              aria-label="Remove item"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addItem}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-dashed border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
          aria-label="Add item"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {type === "dropoff" && (
        <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">
          {formatScu(stopTotalScu(stop, type))}
        </span>
      )}
      <button
        type="button"
        className="shrink-0 p-1 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
        aria-label={`Remove ${type} stop`}
        title="Remove stop"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function StopSection({
  type,
  stops,
  onUpdateStop,
  onAddStop,
  onRemoveStop,
}: {
  type: "pickup" | "dropoff";
  stops: ContractStop[];
  onUpdateStop: (idx: number, stop: ContractStop) => void;
  onAddStop: () => void;
  onRemoveStop: (idx: number) => void;
}) {
  const title = type === "pickup" ? "Pickups" : "Dropoffs";

  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-semibold">{title}</Label>
        <button
          type="button"
          onClick={onAddStop}
          className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          Stop
        </button>
      </div>
      <div className="space-y-1">
        {stops.map((s, i) => (
          <StopLine
            key={s.id}
            stop={s}
            index={i}
            type={type}
            onChange={(next) => onUpdateStop(i, next)}
            onRemove={() => onRemoveStop(i)}
          />
        ))}
      </div>
    </div>
  );
}
