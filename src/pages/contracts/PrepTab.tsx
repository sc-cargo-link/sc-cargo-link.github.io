import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, MapPin, Plus, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useContracts } from "@/context/ContractsContext";
import type { Contract, ContractStop, ScanRegion } from "@/types/contracts";
import { contractTotalScu, scanContractScreenshot } from "@/lib/ocr-parser";
import { consolidateStops, mergeCargoItems } from "@/lib/contract-stops";
import { contractMatchesSearch } from "@/lib/contract-search";
import { compressImageFile } from "@/lib/image-compress";
import { loadScreenshotZoom, saveScreenshotZoom } from "@/lib/contracts-storage";
import { ContractDetailsTooltip } from "@/components/contracts/ContractDetailsTooltip";
import { ScreenshotPanViewer } from "@/components/contracts/ScreenshotPanViewer";
import { ScanRegionSetup } from "@/components/contracts/ScanRegionSetup";
import { StopSection } from "@/components/contracts/StopEditor";
import { findLocation } from "@/lib/location-lookup";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

/** Shared height for screenshot strip. */
const STOP_ROW_HEIGHT = "min-h-[180px] h-[180px]";

function ContractEditor({
  contract,
  screenshotZoom,
  onScreenshotZoomChange,
  objectiveRegion,
  onChange,
  onDelete,
}: {
  contract: Contract;
  screenshotZoom: number;
  onScreenshotZoomChange: (zoom: number) => void;
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

  const pickups = useMemo(
    () => consolidateStops(contract.pickups, "pickup"),
    [contract.pickups]
  );
  const dropoffs = useMemo(
    () => consolidateStops(contract.dropoffs, "dropoff"),
    [contract.dropoffs]
  );

  const updatePickup = (idx: number, stop: ContractStop) => {
    const next = [...pickups];
    next[idx] = {
      ...stop,
      items: mergeCargoItems(stop.items, "pickup"),
    };
    onChange({ ...contract, pickups: consolidateStops(next, "pickup") });
  };

  const updateDropoff = (idx: number, stop: ContractStop) => {
    const next = [...dropoffs];
    next[idx] = {
      ...stop,
      items: mergeCargoItems(stop.items, "dropoff"),
    };
    onChange({ ...contract, dropoffs: consolidateStops(next, "dropoff") });
  };

  const addPickup = () => {
    onChange({
      ...contract,
      pickups: consolidateStops(
        [
          ...pickups,
          { id: nanoid(8), locationName: "Pickup", items: [{ id: nanoid(6), name: "Cargo", scu: 0 }] },
        ],
        "pickup"
      ),
    });
  };

  const addDropoff = () => {
    onChange({
      ...contract,
      dropoffs: consolidateStops(
        [
          ...dropoffs,
          { id: nanoid(8), locationName: "Dropoff", items: [{ id: nanoid(6), name: "Cargo", scu: 1 }] },
        ],
        "dropoff"
      ),
    });
  };

  const removePickup = (idx: number) => {
    const next = pickups.filter((_, i) => i !== idx);
    onChange({ ...contract, pickups: consolidateStops(next, "pickup") });
  };

  const removeDropoff = (idx: number) => {
    const next = dropoffs.filter((_, i) => i !== idx);
    onChange({ ...contract, dropoffs: consolidateStops(next, "dropoff") });
  };

  return (
    <div className="space-y-4">
      <div className="grid min-w-0 grid-cols-1 items-center gap-2 md:grid-cols-[1fr_minmax(0,2fr)_1fr]">
        <div className="hidden md:block" aria-hidden />
        <div className="flex min-w-0 items-center justify-center justify-self-center">
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
              className="h-9 text-center text-base font-semibold tracking-tight"
              placeholder="Contract name"
              aria-label="Contract name"
            />
          ) : (
            <ContractDetailsTooltip contract={contract}>
              <button
                type="button"
                onClick={() => setEditingTitle(true)}
                className="max-w-full truncate text-center text-lg font-semibold tracking-tight text-foreground transition-colors hover:text-primary"
                title="Click to edit name"
              >
                {contract.title || "Untitled contract"}
              </button>
            </ContractDetailsTooltip>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-center gap-2.5 md:justify-end">
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

      {contract.screenshot && (
        <div className="min-w-0 space-y-2">
          <Label className="text-xs font-semibold">Screenshot</Label>
          <ScreenshotPanViewer
            src={contract.screenshot}
            alt={contract.title}
            zoom={screenshotZoom}
            onZoomChange={onScreenshotZoomChange}
            focusRegion={objectiveRegion}
            className={cn("w-full", STOP_ROW_HEIGHT)}
          />
        </div>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <StopSection
          type="pickup"
          stops={pickups}
          onUpdateStop={updatePickup}
          onAddStop={addPickup}
          onRemoveStop={removePickup}
        />
        <StopSection
          type="dropoff"
          stops={dropoffs}
          onUpdateStop={updateDropoff}
          onAddStop={addDropoff}
          onRemoveStop={removeDropoff}
        />
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
  const [screenshotZoom, setScreenshotZoom] = useState(() => loadScreenshotZoom());

  const handleScreenshotZoomChange = (zoom: number) => {
    setScreenshotZoom(zoom);
    saveScreenshotZoom(zoom);
  };
  const fileRef = useRef<HTMLInputElement>(null);

  const orderedContracts = useMemo(
    () => [...contracts].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt),
    [contracts]
  );

  const totalReward = useMemo(
    () => orderedContracts.reduce((sum, c) => sum + (c.reward ?? 0), 0),
    [orderedContracts],
  );

  const totalScu = useMemo(
    () => orderedContracts.reduce((sum, c) => sum + contractTotalScu(c), 0),
    [orderedContracts],
  );

  const filteredContracts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return orderedContracts;
    return orderedContracts.filter((contract) => contractMatchesSearch(contract, query));
  }, [orderedContracts, searchQuery]);

  const locationStats = useMemo(() => {
    const stats = new Map<string, { key: string; name: string; count: number }>();

    for (const contract of contracts) {
      for (const stop of [...contract.pickups, ...contract.dropoffs]) {
        const rawName = (stop.locationName || stop.locationHint || "").trim();
        if (!rawName || /^(?:pickup|dropoff)(?: location)?$/i.test(rawName)) continue;

        const resolved = findLocation(rawName);
        const key = resolved
          ? `${resolved.system}:${resolved.poi.en ?? resolved.name}`
          : `unresolved:${rawName.toLowerCase().replace(/\s+/g, " ")}`;
        const existing = stats.get(key);

        if (existing) {
          existing.count += 1;
        } else {
          stats.set(key, {
            key,
            name: resolved?.name ?? rawName,
            count: 1,
          });
        }
      }
    }

    return [...stats.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name)
    );
  }, [contracts]);

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
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    size="sm"
                    className="h-8"
                    disabled={scanning || !scanCalibrationImage}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    {scanning ? "Scanning…" : "Upload"}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs space-y-1.5 p-3 text-left">
                <p>Press Print Screen on each accepted contract in-game.</p>
                <p className="text-muted-foreground">
                  Screenshots land in{" "}
                  <span className="font-mono text-[11px] text-foreground">
                    Roberts Space Industries\StarCitizen\LIVE\Screenshots
                  </span>
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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

      <div className="rounded-lg border border-border/80 bg-card/60 px-2.5 py-2 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold">Stats</span>
            {locationStats.length > 0 && (
              <span className="text-[11px] text-muted-foreground">
                — {locationStats.reduce((sum, location) => sum + location.count, 0)} visits
              </span>
            )}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-muted-foreground">Total SCU</span>
            <Badge variant="secondary" className="tabular-nums">
              {formatScu(totalScu)}
            </Badge>
            <span className="ml-1 text-muted-foreground">Total money</span>
            <Badge variant="default" className="tabular-nums">
              {formatAuec(totalReward)}
            </Badge>
          </div>
        </div>
        {locationStats.length > 0 ? (
          <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {locationStats.map((location) => (
              <div
                key={location.key}
                className="flex min-w-0 items-center gap-1.5 rounded-md border border-border/60 bg-muted/20 px-2 py-1.5 text-xs"
              >
                <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate" title={location.name}>
                  {location.name}
                </span>
                <span className="shrink-0 font-medium tabular-nums text-muted-foreground">
                  ({location.count})
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Add contract stops to see location visit counts.
          </p>
        )}
      </div>

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
                      screenshotZoom={screenshotZoom}
                      onScreenshotZoomChange={handleScreenshotZoomChange}
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
