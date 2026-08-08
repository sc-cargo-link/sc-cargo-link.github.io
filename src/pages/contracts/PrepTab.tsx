import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useContracts } from "@/context/ContractsContext";
import type { CargoItem, Contract, ContractStop, ScanRegion } from "@/types/contracts";
import { contractTotalScu, scanContractScreenshot, stopTotalScu } from "@/lib/ocr-parser";
import { contractMatchesSearch } from "@/lib/contract-search";
import { compressImageFile } from "@/lib/image-compress";
import { ContractDetailsTooltip } from "@/components/contracts/ContractDetailsTooltip";
import { ObjectivePreviewIcon } from "@/components/contracts/ObjectivePreviewIcon";
import { ScanRegionSetup } from "@/components/contracts/ScanRegionSetup";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MissionItemInput } from "@/components/contracts/MissionItemInput";
import { LocationNameInput } from "@/components/locations/LocationNameInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn, formatAuec, formatScu } from "@/lib/utils";
import { nanoid } from "nanoid";

const panelClass =
  "border-0 bg-transparent shadow-none ring-0";

function StopEditor({
  stop,
  label,
  type,
  onChange,
}: {
  stop: ContractStop;
  label: string;
  type: "pickup" | "dropoff";
  onChange: (stop: ContractStop) => void;
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
    <div className="space-y-2 rounded-md border border-border/70 bg-muted/30 p-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-semibold">{label}</Label>
        {type === "dropoff" && <Badge variant="secondary">{formatScu(stopTotalScu(stop, type))}</Badge>}
      </div>
      <LocationNameInput
        value={stop.locationName}
        hint={stop.locationHint}
        onChange={(v) => onChange({ ...stop, locationName: v, locationHint: undefined })}
        placeholder="Location name"
      />
      <div className="space-y-1">
        {stop.items.map((item) => (
          <div key={item.id} className="flex gap-1">
            <MissionItemInput
              value={item.name}
              hint={item.nameHint}
              onChange={(name) => updateItem(item.id, { name, nameHint: undefined })}
              placeholder="Cargo"
            />
            {type === "dropoff" && (
              <Input
                className="h-8 w-16 tabular-nums"
                type="number"
                min={0}
                value={item.scu}
                onChange={(e) => updateItem(item.id, { scu: parseFloat(e.target.value) || 0 })}
              />
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:bg-transparent hover:text-destructive"
              onClick={() => removeItem(item.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addItem}>
        Add item
      </Button>
    </div>
  );
}

function ContractEditor({
  contract,
  objectiveRegion,
  onChange,
  onDelete,
}: {
  contract: Contract;
  objectiveRegion: ScanRegion;
  onChange: (c: Contract) => void;
  onDelete: () => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(contract.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [editingReward, setEditingReward] = useState(false);
  const [rewardDraft, setRewardDraft] = useState(
    contract.reward != null ? String(contract.reward) : ""
  );
  const rewardInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editingTitle) setTitleDraft(contract.title);
  }, [contract.title, editingTitle]);

  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [editingTitle]);

  useEffect(() => {
    if (!editingReward) {
      setRewardDraft(contract.reward != null ? String(contract.reward) : "");
    }
  }, [contract.reward, editingReward]);

  useEffect(() => {
    if (editingReward) {
      rewardInputRef.current?.focus();
      rewardInputRef.current?.select();
    }
  }, [editingReward]);

  const commitTitle = () => {
    const next = titleDraft.trim() || "Untitled contract";
    setTitleDraft(next);
    if (next !== contract.title) onChange({ ...contract, title: next });
    setEditingTitle(false);
  };

  const cancelTitleEdit = () => {
    setTitleDraft(contract.title);
    setEditingTitle(false);
  };

  const commitReward = () => {
    const raw = rewardDraft.trim();
    const next = raw === "" ? undefined : parseInt(raw, 10) || 0;
    if (next !== contract.reward) onChange({ ...contract, reward: next });
    setEditingReward(false);
  };

  const cancelRewardEdit = () => {
    setRewardDraft(contract.reward != null ? String(contract.reward) : "");
    setEditingReward(false);
  };

  const updatePickup = (idx: number, stop: ContractStop) => {
    const pickups = [...contract.pickups];
    pickups[idx] = stop;
    onChange({ ...contract, pickups });
  };

  const updateDropoff = (idx: number, stop: ContractStop) => {
    const dropoffs = [...contract.dropoffs];
    dropoffs[idx] = stop;
    onChange({ ...contract, dropoffs });
  };

  const addPickup = () => {
    onChange({
      ...contract,
      pickups: [
        ...contract.pickups,
        { id: nanoid(8), locationName: "Pickup", items: [{ id: nanoid(6), name: "Cargo", scu: 0 }] },
      ],
    });
  };

  const addDropoff = () => {
    onChange({
      ...contract,
      dropoffs: [
        ...contract.dropoffs,
        { id: nanoid(8), locationName: "Dropoff", items: [{ id: nanoid(6), name: "Cargo", scu: 1 }] },
      ],
    });
  };

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="flex min-w-0 items-center gap-3 md:col-span-2">
        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <Input
              ref={titleInputRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTitle();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelTitleEdit();
                }
              }}
              className="h-9 text-base font-semibold tracking-tight"
              placeholder="Contract name"
              aria-label="Contract name"
            />
          ) : (
            <ContractDetailsTooltip contract={contract}>
              <button
                type="button"
                onClick={() => setEditingTitle(true)}
                className="max-w-full truncate text-left text-lg font-semibold tracking-tight text-foreground transition-colors hover:text-primary"
                title="Click to edit name"
              >
                {contract.title || "Untitled contract"}
              </button>
            </ContractDetailsTooltip>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          {editingReward ? (
            <Input
              ref={rewardInputRef}
              type="number"
              min={0}
              value={rewardDraft}
              onChange={(e) => setRewardDraft(e.target.value)}
              onBlur={commitReward}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitReward();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelRewardEdit();
                }
              }}
              className="h-8 w-28 tabular-nums"
              placeholder="aUEC"
              aria-label="Reward (aUEC)"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingReward(true)}
              className="tabular-nums text-sm text-muted-foreground transition-colors hover:text-foreground"
              title="Click to edit reward"
            >
              {contract.reward != null ? formatAuec(contract.reward) : "Set reward"}
            </button>
          )}
          <span className="tabular-nums text-sm text-muted-foreground">
            {formatScu(contractTotalScu(contract))}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-transparent hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-1">
          <Label className="text-xs font-semibold">Pickups</Label>
          <ObjectivePreviewIcon
            screenshot={contract.screenshot}
            region={objectiveRegion}
          />
        </div>
        {contract.pickups.map((p, i) => (
          <StopEditor key={p.id} stop={p} label={`Pickup ${i + 1}`} type="pickup" onChange={(s) => updatePickup(i, s)} />
        ))}
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addPickup}>
          <Plus className="mr-1 h-3 w-3" /> Add
        </Button>
      </div>

      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-1">
          <Label className="text-xs font-semibold">Dropoffs</Label>
          <ObjectivePreviewIcon
            screenshot={contract.screenshot}
            region={objectiveRegion}
          />
        </div>
        {contract.dropoffs.map((d, i) => (
          <StopEditor key={d.id} stop={d} label={`Dropoff ${i + 1}`} type="dropoff" onChange={(s) => updateDropoff(i, s)} />
        ))}
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addDropoff}>
          <Plus className="mr-1 h-3 w-3" /> Add
        </Button>
      </div>
    </div>
  );
}

export function PrepTab() {
  const {
    contracts,
    scanRegions,
    scanCalibrationImage,
    setScanRegions,
    setScanCalibrationImage,
    addContract,
    updateContract,
    deleteContract,
    addEmptyContract,
    clearAllContracts,
    developerMode,
    setDeveloperMode,
  } = useContracts();
  const [scanning, setScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const orderedContracts = useMemo(
    () => [...contracts].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt),
    [contracts]
  );

  const totalReward = useMemo(
    () => orderedContracts.reduce((sum, c) => sum + (c.reward ?? 0), 0),
    [orderedContracts],
  );

  const filteredContracts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return orderedContracts;
    return orderedContracts.filter((contract) => contractMatchesSearch(contract, query));
  }, [orderedContracts, searchQuery]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!scanCalibrationImage) {
      toast.error("Set scan regions using a sample screenshot first");
      return;
    }
    setScanning(true);
    try {
      for (const file of Array.from(files)) {
        const { file: compressedFile, dataUrl } = await compressImageFile(file);
        const contract = await scanContractScreenshot(compressedFile, scanRegions, dataUrl);
        addContract(contract);
      }
      toast.success(`Scanned ${files.length} screenshot(s)`);
    } catch {
      toast.error("OCR scan failed");
    } finally {
      setScanning(false);
    }
  };

  const handleClearAll = () => {
    if (contracts.length === 0) return;
    if (!window.confirm("Clear all contracts?")) return;
    clearAllContracts();
    toast.success("Cleared all contracts");
  };

  return (
    <div className="space-y-2.5">
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-lg border border-border/80 bg-card/80 px-2.5 py-2 backdrop-blur-sm",
          "sm:gap-3"
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Value
          </span>
          <Badge variant="default" className="tabular-nums text-xs font-semibold">
            {formatAuec(totalReward)}
          </Badge>
          {contracts.length > 0 && (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {searchQuery.trim()
                ? `${filteredContracts.length}/${contracts.length}`
                : `${contracts.length}`}{" "}
              contract{contracts.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {contracts.length > 0 && (
          <div className="relative min-w-[160px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contracts…"
              className="h-8 pl-8"
            />
          </div>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button
            size="sm"
            className="h-8"
            disabled={scanning || !scanCalibrationImage}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {scanning ? "Scanning…" : "Upload"}
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={addEmptyContract}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={contracts.length === 0}
            onClick={handleClearAll}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Clear
          </Button>
          <div className="ml-1 flex items-center gap-1.5 border-l border-border/70 pl-2">
            <Label htmlFor="developer-mode" className="text-[11px] text-muted-foreground">
              Dev
            </Label>
            <Switch id="developer-mode" checked={developerMode} onCheckedChange={setDeveloperMode} />
          </div>
        </div>
      </div>

      <ScanRegionSetup
        calibrationImage={scanCalibrationImage}
        regions={scanRegions}
        onRegionsChange={setScanRegions}
        onCalibrationImageChange={setScanCalibrationImage}
      />

      {contracts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/80 px-4 py-10 text-center">
          <p className="text-sm font-medium">No contracts yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Configure scan regions, then upload screenshots.
          </p>
        </div>
      ) : filteredContracts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No contracts match your search.</p>
      ) : (
        <div className="space-y-3">
          <TooltipProvider delayDuration={200}>
            {filteredContracts.map((contract, index) => (
              <div key={contract.id} className="space-y-3">
                {index > 0 && (
                  <div
                    role="separator"
                    aria-hidden
                    className="h-[2px] w-full rounded-full bg-gradient-to-r from-transparent via-primary/75 to-transparent"
                  />
                )}
                <Card className={panelClass}>
                  <CardContent className="p-3">
                    <ContractEditor
                      contract={contract}
                      objectiveRegion={scanRegions.objective}
                      onChange={(c) => updateContract(contract.id, c)}
                      onDelete={() => deleteContract(contract.id)}
                    />
                  </CardContent>
                </Card>
              </div>
            ))}
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}
