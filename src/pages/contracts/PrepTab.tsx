import { useMemo, useRef, useState } from "react";
import { Plus, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useContracts } from "@/context/ContractsContext";
import type { CargoItem, Contract, ContractStop } from "@/types/contracts";
import { contractTotalScu, scanContractScreenshot, stopTotalScu } from "@/lib/ocr-parser";
import { contractMatchesSearch } from "@/lib/contract-search";
import { compressImageFile } from "@/lib/image-compress";
import { ContractDetailsTooltip } from "@/components/contracts/ContractDetailsTooltip";
import { ScanRegionSetup } from "@/components/contracts/ScanRegionSetup";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MissionItemInput } from "@/components/contracts/MissionItemInput";
import { ScreenshotHoverZoom } from "@/components/contracts/ScreenshotHoverZoom";
import { OcrRawPanel } from "@/components/contracts/OcrRawPanel";
import { LocationNameInput } from "@/components/locations/LocationNameInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { formatAuec, formatScu } from "@/lib/utils";
import { nanoid } from "nanoid";

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
    <div className="space-y-2 rounded-md border border-border p-2">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
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
                className="h-8 w-16"
                type="number"
                min={0}
                value={item.scu}
                onChange={(e) => updateItem(item.id, { scu: parseFloat(e.target.value) || 0 })}
              />
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(item.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={addItem}>
        Add item
      </Button>
    </div>
  );
}

function ContractEditor({
  contract,
  developerMode,
  onChange,
  onDelete,
}: {
  contract: Contract;
  developerMode: boolean;
  onChange: (c: Contract) => void;
  onDelete: () => void;
}) {
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
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
      {contract.screenshot && (
        <div className="min-w-0 w-full">
          {developerMode && contract.ocrRaw && <OcrRawPanel ocrRaw={contract.ocrRaw} />}
          <ScreenshotHoverZoom src={contract.screenshot} alt={contract.title} />
        </div>
      )}
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={contract.title}
            onChange={(e) => onChange({ ...contract, title: e.target.value })}
            className="h-8 min-w-[100px] flex-1 font-medium"
          />
          <Input
            type="number"
            min={0}
            placeholder="Reward"
            value={contract.reward ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              onChange({
                ...contract,
                reward: raw === "" ? undefined : parseInt(raw, 10) || 0,
              });
            }}
            className="h-8 w-24"
            title="Reward (aUEC)"
          />
          <Badge>{formatScu(contractTotalScu(contract))}</Badge>
          <Button variant="destructive" size="icon" className="h-8 w-8 shrink-0" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Pickups</Label>
            <Button variant="ghost" size="sm" onClick={addPickup}>
              <Plus className="mr-1 h-3 w-3" /> Add
            </Button>
          </div>
          {contract.pickups.map((p, i) => (
            <StopEditor key={p.id} stop={p} label={`Pickup ${i + 1}`} type="pickup" onChange={(s) => updatePickup(i, s)} />
          ))}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Dropoffs</Label>
            <Button variant="ghost" size="sm" onClick={addDropoff}>
              <Plus className="mr-1 h-3 w-3" /> Add
            </Button>
          </div>
          {contract.dropoffs.map((d, i) => (
            <StopEditor key={d.id} stop={d} label={`Dropoff ${i + 1}`} type="dropoff" onChange={(s) => updateDropoff(i, s)} />
          ))}
        </div>
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Total contract value</span>
          <Badge variant="default" className="tabular-nums text-sm font-semibold">
            {formatAuec(totalReward)}
          </Badge>
          {contracts.length > 0 && (
            <span className="text-xs text-muted-foreground">
              across {contracts.length} contract{contracts.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="developer-mode" className="text-xs text-muted-foreground">
            Developer mode
          </Label>
          <Switch id="developer-mode" checked={developerMode} onCheckedChange={setDeveloperMode} />
        </div>
      </div>

      {contracts.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pickups, dropoffs, cargo…"
            className="h-8 pl-8"
          />
        </div>
      )}

      <ScanRegionSetup
        calibrationImage={scanCalibrationImage}
        regions={scanRegions}
        onRegionsChange={setScanRegions}
        onCalibrationImageChange={setScanCalibrationImage}
      />

      <div className="flex flex-wrap items-center gap-2">
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
          disabled={scanning || !scanCalibrationImage}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {scanning ? "Scanning…" : "Upload screenshots"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={contracts.length === 0}
          onClick={handleClearAll}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Clear all
        </Button>
        <Button variant="outline" size="sm" onClick={addEmptyContract}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add contract
        </Button>
        <span className="text-xs text-muted-foreground">
          {searchQuery.trim()
            ? `${filteredContracts.length} of ${contracts.length} contract(s)`
            : `${contracts.length} contract(s)`}
        </span>
      </div>

      {contracts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No contracts yet. Configure scan regions, then upload screenshots.
        </p>
      ) : filteredContracts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No contracts match your search.</p>
      ) : (
        <div className="space-y-4">
          <TooltipProvider delayDuration={200}>
            {filteredContracts.map((contract) => (
              <Card key={contract.id}>
                <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                  <ContractDetailsTooltip contract={contract}>
                    <CardTitle className="min-w-0 flex-1 cursor-help truncate text-sm">
                      {contract.title}
                    </CardTitle>
                  </ContractDetailsTooltip>
                <Badge variant="secondary" className="shrink-0">
                  {formatScu(contractTotalScu(contract))}
                </Badge>
              </CardHeader>
              <CardContent>
                <ContractEditor
                  contract={contract}
                  developerMode={developerMode}
                  onChange={(c) => updateContract(contract.id, c)}
                  onDelete={() => deleteContract(contract.id)}
                />
              </CardContent>
            </Card>
            ))}
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}
