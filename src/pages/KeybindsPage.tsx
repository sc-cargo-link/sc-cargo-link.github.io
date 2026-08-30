import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  FileUp,
  Gamepad2,
  Keyboard,
  Mouse,
  Plus,
  Radio,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addKeybind,
  cloneKeybindProfile,
  createEmptyKeybindProfile,
  decodeKeybindInput,
  getBindingConflicts,
  getKeybindActionMaps,
  getKeybindActions,
  keybindIncludesInput,
  moveKeybind,
  parseKeybindXml,
  removeKeybind,
  searchKeybindActions,
  serializeKeybindXml,
  updateKeybind,
} from "@/lib/keybind-parser";
import {
  clearKeybindDraft,
  downloadKeybindProfile,
  loadKeybindDraft,
  saveKeybindDraft,
} from "@/lib/keybind-storage";
import {
  getDetectedInputDevices,
  startInputCapture,
} from "@/lib/keybind-capture";
import type {
  CapturedBinding,
  KeybindAction,
  KeybindDevice,
  KeybindProfile,
} from "@/types/keybinds";

type DeviceFilter = "all" | KeybindDevice;

const DEVICE_FILTERS: Array<{ value: DeviceFilter; label: string }> = [
  { value: "all", label: "All devices" },
  { value: "keyboard", label: "Keyboard" },
  { value: "mouse", label: "Mouse" },
  { value: "joystick", label: "Joysticks" },
  { value: "gamepad", label: "Gamepad" },
];

function initialProfile(): KeybindProfile {
  return loadKeybindDraft() ?? createEmptyKeybindProfile();
}

function deviceIcon(device: KeybindDevice) {
  if (device === "keyboard") return Keyboard;
  if (device === "mouse") return Mouse;
  return Gamepad2;
}

function deviceTone(device: KeybindDevice): string {
  if (device === "keyboard") return "border-info/30 bg-info/10 text-info";
  if (device === "mouse") return "border-warning/30 bg-warning/10 text-warning";
  if (device === "joystick") return "border-success/30 bg-success/10 text-success";
  return "border-primary/30 bg-primary/10 text-primary";
}

function actionKey(action: KeybindAction): string {
  return `${action.mapName}::${action.name}`;
}

export function KeybindsPage() {
  const [profile, setProfile] = useState<KeybindProfile>(initialProfile);
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    serializeKeybindXml(initialProfile()),
  );
  const [query, setQuery] = useState("");
  const [capturedSearchInput, setCapturedSearchInput] = useState("");
  const [deviceFilter, setDeviceFilter] = useState<DeviceFilter>("all");
  const [selectedActionKey, setSelectedActionKey] = useState("");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [editingBindingIndex, setEditingBindingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [capturePurpose, setCapturePurpose] = useState<"binding" | "search">("binding");
  const [captureTargetIndex, setCaptureTargetIndex] = useState<number | null>(null);
  const [captureStatus, setCaptureStatus] = useState("");
  const [pendingCapture, setPendingCapture] = useState<CapturedBinding | null>(null);
  const [detectedDevices, setDetectedDevices] = useState(getDetectedInputDevices);
  const [manualInput, setManualInput] = useState("");
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maps = useMemo(() => getKeybindActionMaps(profile), [profile]);
  const allActions = useMemo(() => getKeybindActions(profile), [profile]);
  const conflicts = useMemo(() => getBindingConflicts(allActions), [allActions]);
  const fuzzyActions = useMemo(
    () => searchKeybindActions(allActions, query),
    [allActions, query],
  );
  const actions = useMemo(
    () =>
      fuzzyActions.filter((action) => {
        const deviceMatches =
          deviceFilter === "all" ||
          action.bindings.some((binding) => binding.device === deviceFilter);
        const inputMatches =
          !capturedSearchInput ||
          action.bindings.some((binding) =>
            keybindIncludesInput(binding.input, capturedSearchInput),
          );
        return deviceMatches && inputMatches;
      }),
    [capturedSearchInput, deviceFilter, fuzzyActions],
  );
  const selectedAction = allActions.find((action) => actionKey(action) === selectedActionKey) ?? null;
  const isDirty = serializeKeybindXml(profile) !== savedSnapshot;

  const commitProfile = useCallback((next: KeybindProfile) => {
    setProfile(next);
    saveKeybindDraft(next);
  }, []);

  const importProfile = async (file: File) => {
    try {
      const next = parseKeybindXml(await file.text(), file.name);
      commitProfile(next);
      setSavedSnapshot(serializeKeybindXml(next));
      setImportError("");
      setDeviceFilter("all");
      toast.success(`Loaded ${next.profileName}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not read that keybind file.";
      setImportError(message);
      toast.error(message);
    }
  };

  const resetProfile = () => {
    const next = createEmptyKeybindProfile();
    commitProfile(next);
    setSavedSnapshot(serializeKeybindXml(next));
    clearKeybindDraft();
    setImportError("");
    setSelectedActionKey("");
    setInspectorOpen(false);
    toast.success("Cleared the active profile.");
  };

  const updateBinding = (index: number, input: string) => {
    if (!selectedAction) return;
    commitProfile(
      updateKeybind(profile, selectedAction.mapName, selectedAction.name, index, {
        input,
      }),
    );
    setEditingBindingIndex(null);
  };

  const updateBindingAttribute = (
    index: number,
    name: string,
    value: string | undefined,
  ) => {
    if (!selectedAction) return;
    commitProfile(
      updateKeybind(profile, selectedAction.mapName, selectedAction.name, index, {
        attributes: { [name]: value },
      }),
    );
  };

  const addBinding = (input = "kb1_ ") => {
    if (!selectedAction) return;
    commitProfile(
      addKeybind(profile, selectedAction.mapName, selectedAction.name, input),
    );
  };

  const removeBinding = (index: number) => {
    if (!selectedAction) return;
    commitProfile(
      removeKeybind(profile, selectedAction.mapName, selectedAction.name, index),
    );
  };

  const moveBinding = (index: number, direction: "up" | "down") => {
    if (!selectedAction) return;
    commitProfile(
      moveKeybind(profile, selectedAction.mapName, selectedAction.name, index, direction),
    );
  };

  const openCapture = (index: number | null) => {
    setCapturePurpose("binding");
    setCaptureTargetIndex(index);
    setManualInput("");
    setCaptureStatus("");
    setPendingCapture(null);
    setCaptureOpen(true);
  };

  const openSearchCapture = () => {
    setCapturePurpose("search");
    setCaptureTargetIndex(null);
    setManualInput("");
    setCaptureStatus("");
    setPendingCapture(null);
    setCaptureOpen(true);
  };

  const applyCapturedBinding = useCallback(
    (capturedBinding: CapturedBinding) => {
      if (capturePurpose === "search") {
        setCapturedSearchInput(capturedBinding.input);
        setQuery("");
        setCaptureOpen(false);
        toast.success(`Showing actions using ${capturedBinding.display}`);
        return;
      }
      if (!selectedAction) return;
      const next =
        captureTargetIndex === null
          ? addKeybind(profile, selectedAction.mapName, selectedAction.name, capturedBinding.input)
          : updateKeybind(
              profile,
              selectedAction.mapName,
              selectedAction.name,
              captureTargetIndex,
              { input: capturedBinding.input },
            );
      commitProfile(next);
      setCaptureOpen(false);
      toast.success(`Captured ${capturedBinding.display}`);
    },
    [capturePurpose, captureTargetIndex, commitProfile, profile, selectedAction],
  );

  useEffect(() => {
    if (!captureOpen) return;
    const refreshDevices = () => setDetectedDevices(getDetectedInputDevices());
    refreshDevices();
    window.addEventListener("gamepadconnected", refreshDevices);
    window.addEventListener("gamepaddisconnected", refreshDevices);
    const refreshInterval = window.setInterval(refreshDevices, 1000);
    const stopCapture = startInputCapture({
      device: "all",
      onStatus: setCaptureStatus,
      onPending: setPendingCapture,
      onComplete: capturePurpose === "search" ? applyCapturedBinding : undefined,
      shouldIgnoreEvent: (event) => {
        if (!(event.target instanceof Element)) return false;
        const selector =
          event.type === "keydown" || event.type === "keyup"
            ? "input, select, textarea"
            : "button, input, select, textarea";
        return Boolean(event.target.closest(selector));
      },
    });
    return () => {
      window.removeEventListener("gamepadconnected", refreshDevices);
      window.removeEventListener("gamepaddisconnected", refreshDevices);
      window.clearInterval(refreshInterval);
      stopCapture();
    };
  }, [applyCapturedBinding, captureOpen, capturePurpose]);

  const openEdit = (index: number) => {
    if (!selectedAction) return;
    setEditingBindingIndex(index);
    setEditingValue(selectedAction.bindings[index]?.input ?? "");
  };

  const handleProfileName = (profileName: string) => {
    const next = cloneKeybindProfile(profile);
    next.profileName = profileName;
    next.root.attributes.profileName = profileName;
    commitProfile(next);
  };

  return (
    <div className="-m-[50px] min-h-[calc(100dvh-3rem)] px-3 py-4 sm:px-5 sm:py-5">
      <div className="relative mx-auto max-w-[1800px] space-y-3 before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-atmosphere">
        <Card className="overflow-hidden border-primary/20 bg-card/80 backdrop-blur">
          <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
                    Keybind Organizer
                  </h1>
                  {isDirty && <Badge variant="warning">Unsaved changes</Badge>}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {allActions.length > 0
                    ? `${allActions.length} actions across ${maps.length} action maps · ${
                        profile.sourceName ?? "local draft"
                      }`
                    : "No configuration loaded · upload an actionmaps.xml file to begin"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml,application/xml,text/xml"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importProfile(file);
                  event.target.value = "";
                }}
              />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <FileUp className="h-3.5 w-3.5" />
                Import XML
              </Button>
              {import.meta.env.DEV && (
                <Button
                  size="sm"
                  disabled={allActions.length === 0}
                  onClick={() => downloadKeybindProfile(profile)}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export XML
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={resetProfile}>
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
            </div>
          </div>
          <div className="grid gap-2 border-t border-border/70 p-3 md:grid-cols-[minmax(15rem,1fr)_12rem_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Fuzzy search actions, devices, or bindings…"
                className="pl-9 pr-28"
                aria-label="Search keybinds"
                disabled={allActions.length === 0}
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-7 px-2 text-[11px]"
                onClick={openSearchCapture}
                title="Press a key, mouse button, or joystick input to find matching bindings"
                disabled={allActions.length === 0}
              >
                <Radio className="h-3 w-3" />
                Find input
              </Button>
              {capturedSearchInput && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span>Input filter:</span>
                  <Badge variant="outline">{decodeKeybindInput(capturedSearchInput).display}</Badge>
                  <button
                    className="rounded p-0.5 hover:bg-accent hover:text-foreground"
                    onClick={() => setCapturedSearchInput("")}
                    aria-label="Clear captured input filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
            <select
              value={deviceFilter}
              onChange={(event) => setDeviceFilter(event.target.value as DeviceFilter)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Filter by device"
              disabled={allActions.length === 0}
            >
              {DEVICE_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
            <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
              <span className="tabular-nums">{actions.length} matching actions</span>
              {conflicts.size > 0 && (
                <Badge variant="warning">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  {conflicts.size} conflicts
                </Badge>
              )}
            </div>
          </div>
        </Card>

        {importError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{importError}</span>
            <button className="ml-auto" onClick={() => setImportError("")} aria-label="Dismiss error">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="grid min-h-[calc(100dvh-13rem)] grid-cols-1 gap-3">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="border-b border-border/70">
              <CardTitle className="flex items-center justify-between">
                <span>Bindings explorer</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Click an action to open its inspector
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 lg:h-[calc(100dvh-16rem)] lg:overflow-y-auto lg:overscroll-contain">
              {actions.length === 0 ? (
                <div className="rounded-md border border-dashed border-border px-4 py-10 text-center">
                  {allActions.length === 0 ? (
                    <>
                      <FileUp className="mx-auto mb-2 h-6 w-6 text-primary" />
                      <p className="text-sm font-medium">Upload your Star Citizen configuration</p>
                      <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">
                        Choose <span className="font-medium text-foreground">Import XML</span> above,
                        then select{" "}
                        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                          actionmaps.xml
                        </code>
                        . It is usually in your Star Citizen install folder at{" "}
                        <code className="mt-1 inline-block rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                        Roberts Space Industries\StarCitizen\LIVE\user\client\0\controls\mappings\*.xml
                        </code>
                        . For PTU profiles, use the equivalent PTU folder.
                      </p>
                      <Button className="mt-4" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <FileUp className="h-3.5 w-3.5" />
                        Choose actionmaps.xml
                      </Button>
                    </>
                  ) : (
                    <>
                      <Search className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                      <p className="text-sm font-medium">No keybinds found</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Try a shorter search or reset the device filter.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[48rem] border-collapse text-left">
                    <thead className="sticky top-0 z-10 bg-card text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr className="border-b border-border/70">
                        <th className="px-3 py-2 font-medium">Action</th>
                        <th className="px-3 py-2 font-medium">Action map</th>
                        <th className="px-3 py-2 font-medium">Current bindings</th>
                        <th className="w-16 px-3 py-2 text-right font-medium">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {actions.map((action) => (
                        <ActionRow
                          key={actionKey(action)}
                          action={action}
                          isSelected={selectedAction ? actionKey(selectedAction) === actionKey(action) : false}
                          conflicts={conflicts}
                          onSelect={() => {
                            setSelectedActionKey(actionKey(action));
                            setInspectorOpen(true);
                          }}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {inspectorOpen && selectedAction && (
        <ActionInspector
          action={selectedAction}
          conflicts={conflicts}
          editingBindingIndex={editingBindingIndex}
          editingValue={editingValue}
          onClose={() => {
            setInspectorOpen(false);
            setEditingBindingIndex(null);
          }}
          onAdd={() => addBinding()}
          onEdit={openEdit}
          onEditValue={setEditingValue}
          onSave={updateBinding}
          onCapture={openCapture}
          onMove={moveBinding}
          onRemove={removeBinding}
          onUpdateAttribute={updateBindingAttribute}
        />
      )}

      {captureOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCaptureOpen(false);
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) setCaptureOpen(false);
          }}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-primary/25 bg-card p-4 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="capture-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p id="capture-title" className="font-display text-lg font-semibold">
                  {capturePurpose === "search" ? "Find by input" : "Capture binding"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {capturePurpose === "search"
                    ? "Press the input you want to find in this profile."
                    : `${captureTargetIndex === null ? "Add a new binding to" : "Replace a binding on"} ${
                        selectedAction?.label ?? "the selected action"
                      }.`}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setCaptureOpen(false)} aria-label="Close capture">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Detected devices</Label>
                <span className="text-[10px] text-muted-foreground">Listening to all devices</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {detectedDevices.map((device) => {
                  const Icon = deviceIcon(device.device);
                  return (
                    <div
                      key={device.id}
                      className={`flex min-w-0 items-center gap-2 rounded-md border px-2 py-1.5 ${deviceTone(device.device)}`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-medium">{device.label}</p>
                        <p className="truncate text-[10px] opacity-75">{device.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-primary/25 bg-primary/10 p-4 text-center">
              {pendingCapture ? (
                <>
                  <Check className="mx-auto h-6 w-6 text-success" />
                  <p className="mt-2 text-sm font-medium">Input captured</p>
                  <p className="mt-1 break-words text-sm text-primary">{pendingCapture.display}</p>
                  <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                    {pendingCapture.input}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {capturePurpose === "search"
                      ? "Keep inputs held to chain them. Release any captured input to start the search."
                      : "Keep the first button pressed and press another input to chain it."}
                  </p>
                </>
              ) : (
                <>
                  <Radio className="mx-auto h-6 w-6 animate-pulse text-primary" />
                  <p className="mt-2 text-sm font-medium">Listening for input…</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {captureStatus || "Press a key, mouse button, or joystick input."}
                  </p>
                </>
              )}
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="manual-binding">Manual Star Citizen token</Label>
              <div className="flex gap-2">
                <Input
                  id="manual-binding"
                  value={manualInput}
                  onChange={(event) => setManualInput(event.target.value)}
                  placeholder="e.g. js1_button1 or kb1_lalt+f"
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  disabled={!manualInput.trim()}
                  onClick={() =>
                    applyCapturedBinding({
                      input: manualInput,
                      device: decodeKeybindInput(manualInput).device,
                      display: decodeKeybindInput(manualInput).display,
                    })
                  }
                >
                  Use token
                </Button>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={!pendingCapture}
                onClick={() => pendingCapture && applyCapturedBinding(pendingCapture)}
              >
                <Check className="h-3.5 w-3.5" />
                {capturePurpose === "search" ? "Search now" : "Use this binding"}
              </Button>
              <Button variant="ghost" onClick={() => setCaptureOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionInspector({
  action,
  conflicts,
  editingBindingIndex,
  editingValue,
  onClose,
  onAdd,
  onEdit,
  onEditValue,
  onSave,
  onCapture,
  onMove,
  onRemove,
  onUpdateAttribute,
}: {
  action: KeybindAction;
  conflicts: Set<string>;
  editingBindingIndex: number | null;
  editingValue: string;
  onClose: () => void;
  onAdd: () => void;
  onEdit: (index: number) => void;
  onEditValue: (value: string) => void;
  onSave: (index: number, input: string) => void;
  onCapture: (index: number) => void;
  onMove: (index: number, direction: "up" | "down") => void;
  onRemove: (index: number) => void;
  onUpdateAttribute: (index: number, name: string, value: string | undefined) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-3 sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Card
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden border-primary/25 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-inspector-title"
      >
        <CardHeader className="border-b border-border/70">
          <CardTitle className="flex items-center justify-between gap-3">
            <span id="action-inspector-title">Action inspector</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{action.bindings.length} bindings</Badge>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close action inspector">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 overflow-y-auto p-3">
          <div>
            <p className="font-display text-lg font-semibold">{action.label}</p>
            <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
              {action.mapName} / {action.name}
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Current bindings</Label>
              <Button variant="outline" size="sm" onClick={onAdd}>
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
            {action.bindings.map((binding, index) => {
              const Icon = deviceIcon(binding.device);
              const isEditing = editingBindingIndex === index;
              return (
                <div
                  key={`${binding.input}-${index}`}
                  className="space-y-2 rounded-md border border-border/80 bg-background/60 p-2.5"
                >
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 rounded-md border p-1.5 ${deviceTone(binding.device)}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <Input
                            value={editingValue}
                            onChange={(event) => onEditValue(event.target.value)}
                            className="h-8 font-mono text-xs"
                            autoFocus
                          />
                          <Button
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => onSave(index, editingValue)}
                            aria-label="Save binding"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <p className="truncate text-sm font-medium">{binding.display}</p>
                          <p className="truncate font-mono text-[10px] text-muted-foreground">
                            {binding.input || "empty input"}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => onEdit(index)}>
                        Change
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => onCapture(index)}>
                        <Radio className="h-3.5 w-3.5" />
                        Capture
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pl-9">
                    {binding.activationMode && (
                      <Badge variant="secondary">{binding.activationMode}</Badge>
                    )}
                    {binding.multiTap && <Badge variant="secondary">{binding.multiTap} taps</Badge>}
                    {conflicts.has(binding.input) && (
                      <Badge variant="warning">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        Shared input
                      </Badge>
                    )}
                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={index === 0}
                        onClick={() => onMove(index, "up")}
                        aria-label="Move binding up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={index === action.bindings.length - 1}
                        onClick={() => onMove(index, "down")}
                        aria-label="Move binding down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => onRemove(index)}
                        aria-label="Remove binding"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-2 pl-9">
                    <Label className="text-[10px]">Activation</Label>
                    <select
                      value={binding.activationMode ?? "press"}
                      onChange={(event) =>
                        onUpdateAttribute(
                          index,
                          "activationMode",
                          event.target.value === "press" ? undefined : event.target.value,
                        )
                      }
                      className="h-7 rounded border border-input bg-background px-2 text-[11px]"
                    >
                      <option value="press">Press</option>
                      <option value="double_tap">Double tap</option>
                    </select>
                    <Input
                      value={binding.multiTap ?? ""}
                      onChange={(event) =>
                        onUpdateAttribute(index, "multiTap", event.target.value || undefined)
                      }
                      placeholder="Multi-tap"
                      className="h-7 w-24 text-[11px]"
                      aria-label="Multi-tap count"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="rounded-md border border-dashed border-border bg-muted/30 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">Capture tips</p>
            Keyboard and mouse capture works while this page is focused. Joystick capture uses the
            browser Gamepad API; verify the detected device mapping before exporting.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ActionRow({
  action,
  isSelected,
  conflicts,
  onSelect,
}: {
  action: KeybindAction;
  isSelected: boolean | null;
  conflicts: Set<string>;
  onSelect: () => void;
}) {
  return (
    <tr
      role="button"
      tabIndex={0}
      className={`cursor-pointer border-b border-border/60 text-foreground transition-colors ${
        isSelected
          ? "bg-primary/10"
          : "hover:bg-accent/60"
      }`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <td className="max-w-[15rem] truncate px-3 py-2 text-xs font-medium">{action.label}</td>
      <td className="max-w-[14rem] truncate px-3 py-2 font-mono text-[10px] text-muted-foreground">
        {action.mapName}
      </td>
      <td className="max-w-[34rem] px-3 py-2">
        <div className="flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap">
          {action.bindings.slice(0, 4).map((binding) => {
            const Icon = deviceIcon(binding.device);
            return (
              <span
                key={`${binding.input}-${binding.index}`}
                className={`inline-flex max-w-[15rem] shrink-0 items-center gap-1 overflow-hidden rounded border px-1.5 py-0.5 text-[10px] ${deviceTone(binding.device)} ${
                  conflicts.has(binding.input) ? "ring-1 ring-warning" : ""
                }`}
              >
                <Icon className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{binding.display}</span>
              </span>
            );
          })}
          {action.bindings.length > 4 && (
            <span className="shrink-0 px-1 py-0.5 text-[10px] text-muted-foreground">
              +{action.bindings.length - 4} more
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-right">
        <Badge variant="secondary">{action.bindings.length}</Badge>
      </td>
    </tr>
  );
}
