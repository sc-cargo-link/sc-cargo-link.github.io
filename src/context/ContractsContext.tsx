import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { nanoid } from "nanoid";
import type { Contract, RoutePlan, RoutingSettings, ScanRegions } from "@/types/contracts";
import {
  loadDeveloperMode,
  loadContracts,
  loadRoute,
  loadRoutingSettings,
  loadScanCalibrationImage,
  loadScanRegions,
  saveContracts,
  saveDeveloperMode,
  saveRoute,
  saveRoutingSettings,
  saveScanCalibrationImage,
  saveScanRegions,
} from "@/lib/contracts-storage";

interface ContractsContextValue {
  contracts: Contract[];
  route: RoutePlan | null;
  routingSettings: RoutingSettings;
  scanRegions: ScanRegions;
  scanCalibrationImage: string | null;
  developerMode: boolean;
  setRoute: (route: RoutePlan | null) => void;
  setRoutingSettings: (settings: RoutingSettings) => void;
  setScanRegions: (regions: ScanRegions) => void;
  setScanCalibrationImage: (dataUrl: string | null) => void;
  setDeveloperMode: (enabled: boolean) => void;
  addContract: (contract: Contract) => void;
  updateContract: (id: string, patch: Partial<Contract>) => void;
  deleteContract: (id: string) => void;
  addEmptyContract: () => void;
  clearAllContracts: () => void;
  toggleContractSelection: (id: string, selected: boolean) => void;
}

const ContractsContext = createContext<ContractsContextValue | null>(null);

export function ContractsProvider({ children }: { children: ReactNode }) {
  const [contracts, setContracts] = useState<Contract[]>(() => loadContracts());
  const [route, setRouteState] = useState<RoutePlan | null>(() => loadRoute());
  const [routingSettings, setRoutingSettingsState] = useState<RoutingSettings>(() =>
    loadRoutingSettings()
  );
  const [scanRegions, setScanRegionsState] = useState<ScanRegions>(() => loadScanRegions());
  const [scanCalibrationImage, setScanCalibrationImageState] = useState<string | null>(() =>
    loadScanCalibrationImage()
  );
  const [developerMode, setDeveloperModeState] = useState(() => loadDeveloperMode());

  useEffect(() => {
    saveContracts(contracts);
  }, [contracts]);

  useEffect(() => {
    saveRoute(route);
  }, [route]);

  useEffect(() => {
    saveRoutingSettings(routingSettings);
  }, [routingSettings]);

  useEffect(() => {
    saveScanRegions(scanRegions);
  }, [scanRegions]);

  useEffect(() => {
    saveScanCalibrationImage(scanCalibrationImage);
  }, [scanCalibrationImage]);

  useEffect(() => {
    saveDeveloperMode(developerMode);
  }, [developerMode]);

  const setRoute = useCallback((r: RoutePlan | null) => setRouteState(r), []);
  const setRoutingSettings = useCallback((s: RoutingSettings) => setRoutingSettingsState(s), []);
  const setScanRegions = useCallback((r: ScanRegions) => setScanRegionsState(r), []);
  const setScanCalibrationImage = useCallback(
    (url: string | null) => setScanCalibrationImageState(url),
    []
  );
  const setDeveloperMode = useCallback((enabled: boolean) => setDeveloperModeState(enabled), []);

  const addContract = useCallback((contract: Contract) => {
    setContracts((prev) => [...prev, { ...contract, order: prev.length }]);
  }, []);

  const updateContract = useCallback((id: string, patch: Partial<Contract>) => {
    setContracts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const deleteContract = useCallback((id: string) => {
    setContracts((prev) => prev.filter((c) => c.id !== id).map((c, i) => ({ ...c, order: i })));
  }, []);

  const addEmptyContract = useCallback(() => {
    const contract: Contract = {
      id: nanoid(10),
      title: "Manual Contract",
      pickups: [
        {
          id: nanoid(8),
          locationName: "Pickup Location",
          items: [{ id: nanoid(6), name: "Cargo", scu: 0 }],
          completed: false,
        },
      ],
      dropoffs: [
        {
          id: nanoid(8),
          locationName: "Dropoff Location",
          items: [{ id: nanoid(6), name: "Cargo", scu: 1 }],
          completed: false,
        },
      ],
      completed: false,
      order: contracts.length,
      selectedForRoute: true,
      createdAt: Date.now(),
    };
    setContracts((prev) => [...prev, contract]);
  }, [contracts.length]);

  const toggleContractSelection = useCallback((id: string, selected: boolean) => {
    setContracts((prev) => prev.map((c) => (c.id === id ? { ...c, selectedForRoute: selected } : c)));
  }, []);

  const clearAllContracts = useCallback(() => {
    setContracts([]);
    setRouteState(null);
  }, []);

  const value = useMemo(
    () => ({
      contracts,
      route,
      routingSettings,
      scanRegions,
      scanCalibrationImage,
      developerMode,
      setRoute,
      setRoutingSettings,
      setScanRegions,
      setScanCalibrationImage,
      setDeveloperMode,
      addContract,
      updateContract,
      deleteContract,
      addEmptyContract,
      clearAllContracts,
      toggleContractSelection,
    }),
    [
      contracts,
      route,
      routingSettings,
      scanRegions,
      scanCalibrationImage,
      developerMode,
      setRoute,
      setRoutingSettings,
      setScanRegions,
      setScanCalibrationImage,
      setDeveloperMode,
      addContract,
      updateContract,
      deleteContract,
      addEmptyContract,
      clearAllContracts,
      toggleContractSelection,
    ]
  );

  return <ContractsContext.Provider value={value}>{children}</ContractsContext.Provider>;
}

export function useContracts() {
  const ctx = useContext(ContractsContext);
  if (!ctx) throw new Error("useContracts must be used within ContractsProvider");
  return ctx;
}
