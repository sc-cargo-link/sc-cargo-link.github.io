import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { data as allEntitiesData, locationTypes, AllEntities } from '@/data/AllEntities';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Settings, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { loadFromStorage } from '@/lib/storage';
import { cleanStationNameForMatching, cleanLocationName } from '@/lib/locationUtils';
import Navbar from '@/components/layout/Navbar';
import RoutePlanner from '@/components/routes/RoutePlanner';
import { RouteStop } from '@/types/routePlanner';
import Record from '@/components/contracts/Record';

// Canvas constants
const POINT_RADIUS = 6;
const CANVAS_PADDING = 50;
const MIN_ZOOM = 0.001;
const MAX_ZOOM = Infinity;
const ZOOM_SPEED = 0.3;
const CLUSTER_DISTANCE = 50; // pixels

type ContractDisplay = {
  id: string;
  recordId: string;
  item: string;
  source: string;
  deliveries: Array<{ location: string; quantity: number }>;
  reward: number;
  contractName?: string;
  timestamp: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
};

type ContractRoute = {
  contract: ContractDisplay;
  sourceEntity: AllEntities | null;
  deliveryEntities: AllEntities[];
};

const RoutesPage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [flashLocation, setFlashLocation] = useState<{ x: number; y: number; timestamp: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [contracts, setContracts] = useState<ContractDisplay[]>([]);
  const lastContractsSigRef = useRef<string | null>(null);
  const [contractRoutes, setContractRoutes] = useState<ContractRoute[]>([]);
  const [contractStationIds, setContractStationIds] = useState<Set<number>>(new Set());
  const [contractLocationTypes, setContractLocationTypes] = useState<Map<number, 'pickup' | 'dropoff' | 'both'>>(new Map());
  const [locationError, setLocationError] = useState<string | null>(null);
  const [contractSearchQuery, setContractSearchQuery] = useState('');
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [startingLocationId, setStartingLocationId] = useState<number | null>(null);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [isContractsSidebarCollapsed, setIsContractsSidebarCollapsed] = useState(false);
  
  // Location type toggle states
  const [locationTypeToggles, setLocationTypeToggles] = useState({
    0: true, // star
    1: true, // planet
    2: true, // planet_moon
    4: true, // lagrangian_points
    6: true, // unknown type (4 entities)
    7: true, // unknown type (167 entities)
    8: true, // stations
    9: true, // unknown type (19 entities)
    10: true, // unknown type (402 entities)
    11: true, // unknown type (151 entities)
  });

  // Filter entities by location type toggles
  const stantonData = allEntitiesData.filter((entity) => {
    return locationTypeToggles[entity.location_type as keyof typeof locationTypeToggles] === true;
  });

  // Find Stanton star (center) from all entities
  const stantonStar = allEntitiesData.find((entity) => entity.location_type === 0);
  const starX = stantonStar ? stantonStar.g_coord_x : 0;
  const starY = stantonStar ? stantonStar.g_coord_y : 0;

  // Adjust coordinates relative to star for all entities
  const adjustedData = allEntitiesData.map((entity) => ({
    ...entity,
    g_coord_x: entity.g_coord_x - starX,
    g_coord_y: entity.g_coord_y - starY,
  }));

  // Separate by location types with toggle filtering
  const star = adjustedData.filter((entity) => entity.location_type === 0 && locationTypeToggles[0]);
  const planets = adjustedData.filter((entity) => entity.location_type === 1 && locationTypeToggles[1]);
  const planetMoons = adjustedData.filter((entity) => entity.location_type === 2 && locationTypeToggles[2]);
  const lagrangianPoints = adjustedData.filter((entity) => entity.location_type === 4 && locationTypeToggles[4]);
  const type6 = adjustedData.filter((entity) => entity.location_type === 6 && locationTypeToggles[6]);
  const type7 = adjustedData.filter((entity) => entity.location_type === 7 && locationTypeToggles[7]);
  const stations = adjustedData.filter((entity) => entity.location_type === 8 && locationTypeToggles[8]);
  const type9 = adjustedData.filter((entity) => entity.location_type === 9 && locationTypeToggles[9]);
  const type10 = adjustedData.filter((entity) => entity.location_type === 10 && locationTypeToggles[10]);
  const type11 = adjustedData.filter((entity) => entity.location_type === 11 && locationTypeToggles[11]);

  // Calculate scaling
  const allX = adjustedData.map((d) => d.g_coord_x);
  const allY = adjustedData.map((d) => d.g_coord_y);
  const xRange = { min: Math.min(...allX), max: Math.max(...allX) };
  const yRange = { min: Math.min(...allY), max: Math.max(...allY) };

  const scaleX = useCallback((x: number) => {
    if (xRange.max === xRange.min) return canvasSize.width / 2;
    return ((x - xRange.min) / (xRange.max - xRange.min)) * (canvasSize.width - 2 * CANVAS_PADDING) + CANVAS_PADDING;
  }, [xRange, canvasSize.width]);

  const scaleY = useCallback((y: number) => {
    if (yRange.max === yRange.min) return canvasSize.height / 2;
    return ((y - yRange.min) / (yRange.max - yRange.min)) * (canvasSize.height - 2 * CANVAS_PADDING) + CANVAS_PADDING;
  }, [yRange, canvasSize.height]);

  // Get clustered labels based on zoom level and proximity
  const getClusteredLabels = useCallback(() => {
    const allEntities = [...star, ...planets, ...planetMoons, ...lagrangianPoints, ...type6, ...type7, ...stations, ...type9, ...type10, ...type11];
    const labels: Array<{ entity: AllEntities; priority: number; screenX: number; screenY: number; contractLocations: string[] }> = [];
    
    // Define minimum zoom thresholds for different entity types
    const minZoomThresholds = {
      0: 0.1,  // stars
      1: 0.5,  // planets
      2: 1,    // moons
      4: 0.2,  // lagrangian
      6: 2,    // type 6
      7: 3,    // type 7
      8: 1,    // stations
      9: 2.5,  // type 9
      10: 4,   // type 10
      11: 3.5, // type 11
    };
    
    // Filter entities that should show labels at current zoom
    const visibleEntities = allEntities.filter(entity => 
      zoom >= (minZoomThresholds[entity.location_type as keyof typeof minZoomThresholds] || 0.1)
    );
    
    // Group nearby entities into clusters
    const clusters: Array<AllEntities[]> = [];
    const processed = new Set<number>();
    
    visibleEntities.forEach(entity => {
      if (processed.has(entity.id)) return;
      
      const px = scaleX(entity.g_coord_x) * zoom + pan.x;
      const py = scaleY(entity.g_coord_y) * zoom + pan.y;
      
      // Skip if not visible on screen
      if (px < 0 || px > canvasSize.width || py < 0 || py > canvasSize.height) return;
      
      const cluster = [entity];
      processed.add(entity.id);
      
      // Find nearby entities
      visibleEntities.forEach(other => {
        if (processed.has(other.id)) return;
        
        const otherPx = scaleX(other.g_coord_x) * zoom + pan.x;
        const otherPy = scaleY(other.g_coord_y) * zoom + pan.y;
        
        const distance = Math.sqrt(Math.pow(px - otherPx, 2) + Math.pow(py - otherPy, 2));
        
        if (distance < CLUSTER_DISTANCE) {
          cluster.push(other);
          processed.add(other.id);
        }
      });
      
      clusters.push(cluster);
    });
    
    // For each cluster, select the highest priority entity
    clusters.forEach(cluster => {
      const highestPriorityEntity = cluster.reduce((highest, current) => 
        current.location_type < highest.location_type ? current : highest
      );
      
      const px = scaleX(highestPriorityEntity.g_coord_x) * zoom + pan.x;
      const py = scaleY(highestPriorityEntity.g_coord_y) * zoom + pan.y;
      
      // Find contract locations for entities in this cluster
      const contractLocationNames = new Set<string>();
      cluster.forEach(entity => {
        const entityContracts = contractRoutes.filter(route => 
          route.sourceEntity?.id === entity.id || 
          route.deliveryEntities.some(delivery => delivery.id === entity.id)
        );
        
        entityContracts.forEach(route => {
          if (route.sourceEntity?.id === entity.id) {
            contractLocationNames.add(cleanLocationName(route.sourceEntity.name));
          }
          route.deliveryEntities.forEach(delivery => {
            if (delivery.id === entity.id) {
              contractLocationNames.add(cleanLocationName(delivery.name));
            }
          });
        });
      });
      
      const uniqueContractLocations = Array.from(contractLocationNames);
      
      labels.push({
        entity: highestPriorityEntity,
        priority: highestPriorityEntity.location_type,
        screenX: px,
        screenY: py,
        contractLocations: uniqueContractLocations
      });
    });
    
    return labels.sort((a, b) => a.priority - b.priority);
  }, [star, planets, planetMoons, lagrangianPoints, type6, type7, stations, type9, type10, type11, zoom, pan, scaleX, scaleY, canvasSize, contractRoutes]);

  // Handle canvas resize
  const handleResize = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCanvasSize({ width: rect.width, height: rect.height });
    }
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Add wheel event listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheelEvent = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const zoomFactor = e.deltaY > 0 ? 1 - ZOOM_SPEED : 1 + ZOOM_SPEED;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * zoomFactor));
      
      if (newZoom !== zoom) {
        const worldX = (mouseX - pan.x) / zoom;
        const worldY = (mouseY - pan.y) / zoom;
        
        const newPan = {
          x: mouseX - worldX * newZoom,
          y: mouseY - worldY * newZoom,
        };
        
        setZoom(newZoom);
        setPan(newPan);
      }
    };

    canvas.addEventListener('wheel', handleWheelEvent, { passive: false });
    
    return () => {
      canvas.removeEventListener('wheel', handleWheelEvent);
    };
  }, [zoom, pan]);

  // Load contracts from storage
  useEffect(() => {
    const loadContracts = () => {
      try {
        const records = loadFromStorage('extractedData', []);
        const statusMap = loadFromStorage('contractStatusMap', {});
        
        const contractList: ContractDisplay[] = [];
        records.forEach((rec: any) => {
          rec.objective.forEach((obj: any, objIdx: number) => {
            const id = `${rec.id}|${objIdx}`;
            const status = statusMap[id] ?? 'pending';
            contractList.push({
              id,
              recordId: rec.id,
              item: obj.item,
              source: obj.location,
              deliveries: obj.deliveries || [],
              reward: rec.reward,
              contractName: rec.contractName,
              timestamp: rec.timestamp,
              status,
            });
          });
        });
        
        // Only update if contracts have changed
        const sig = JSON.stringify(contractList.map(c => ({
          id: c.id,
          item: c.item,
          source: c.source,
          deliveries: c.deliveries,
          reward: c.reward,
          status: c.status,
          timestamp: c.timestamp,
          contractName: c.contractName
        })));
        if (sig !== lastContractsSigRef.current) {
          lastContractsSigRef.current = sig;
          setContracts(contractList);
        }
      } catch (error) {
        console.error('Error loading contracts:', error);
      }
    };

    loadContracts();
    const interval = setInterval(loadContracts, 1000);
    return () => clearInterval(interval);
  }, []);

  // Match contract locations with entities
  useEffect(() => {
    const matchContractRoutes = () => {
      const routes: ContractRoute[] = [];
      const stationIds = new Set<number>();
      const locationTypes = new Map<number, 'pickup' | 'dropoff' | 'both'>();
      
      contracts.forEach(contract => {
        const cleanedSource = cleanStationNameForMatching(contract.source);
        
        const sourceEntity = allEntitiesData.find(entity => 
          entity.name.toLowerCase().includes(cleanedSource.toLowerCase()) ||
          entity.key.toLowerCase().includes(cleanedSource.toLowerCase()) ||
          cleanedSource.toLowerCase().includes(entity.name.toLowerCase())
        ) || null;
        
        const deliveryEntities = contract.deliveries.map(delivery => {
          const cleanedDelivery = cleanStationNameForMatching(delivery.location);
          const entity = allEntitiesData.find(entity => 
            entity.name.toLowerCase().includes(cleanedDelivery.toLowerCase()) ||
            entity.key.toLowerCase().includes(cleanedDelivery.toLowerCase()) ||
            cleanedDelivery.toLowerCase().includes(entity.name.toLowerCase())
          );
          return entity;
        }).filter(Boolean) as AllEntities[];
        
        if (sourceEntity && sourceEntity.location_type === 8) {
          stationIds.add(sourceEntity.id);
          const currentType = locationTypes.get(sourceEntity.id);
          if (currentType === 'dropoff') {
            locationTypes.set(sourceEntity.id, 'both');
          } else {
            locationTypes.set(sourceEntity.id, 'pickup');
          }
        }
        
        deliveryEntities.forEach(entity => {
          if (entity.location_type === 8) {
            stationIds.add(entity.id);
            const currentType = locationTypes.get(entity.id);
            if (currentType === 'pickup') {
              locationTypes.set(entity.id, 'both');
            } else {
              locationTypes.set(entity.id, 'dropoff');
            }
          }
        });
        
        if (sourceEntity || deliveryEntities.length > 0) {
          routes.push({
            contract,
            sourceEntity,
            deliveryEntities
          });
        }
      });
      
      setContractRoutes(routes);
      setContractStationIds(stationIds);
      setContractLocationTypes(locationTypes);
    };

    matchContractRoutes();
  }, [contracts]);

  // Compute delivered quantities per item and location from current route stops
  const deliveredMap = useMemo(() => {
    const map = new Map<string, number>();
    routeStops.forEach(stop => {
      if (!stop.dropoffs || stop.dropoffs.length === 0) return;
      stop.dropoffs.forEach(drop => {
        const key = `${drop.itemName}|${stop.stationName}`.toLowerCase();
        const current = map.get(key) || 0;
        map.set(key, current + drop.quantity);
      });
    });
    return map;
  }, [routeStops]);

  // Compute picked-up quantities per item and source location from current route selections
  const pickedUpMap = useMemo(() => {
    const map = new Map<string, number>();
    routeStops.forEach(stop => {
      if (!stop.availablePickups || stop.availablePickups.length === 0) return;
      stop.availablePickups.forEach(pickup => {
        const isSelected = stop.pickupSelections?.get(pickup.itemName) || false;
        if (isSelected) {
          const key = `${pickup.itemName}|${stop.stationName}`.toLowerCase();
          const current = map.get(key) || 0;
          map.set(key, current + pickup.quantity);
        }
      });
    });
    return map;
  }, [routeStops]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    // Draw planet orbits
    if (zoom < 5) {
      const centerX = scaleX(0) * zoom + pan.x;
      const centerY = scaleY(0) * zoom + pan.y;
      
      planets.forEach((planet) => {
        const px = scaleX(planet.g_coord_x) * zoom + pan.x;
        const py = scaleY(planet.g_coord_y) * zoom + pan.y;
        const dx = px - centerX;
        const dy = py - centerY;
        const orbitRadius = Math.sqrt(dx * dx + dy * dy);
        
        if (orbitRadius > 0 && orbitRadius < Math.max(canvasSize.width, canvasSize.height)) {
          ctx.beginPath();
          ctx.arc(centerX, centerY, orbitRadius, 0, 2 * Math.PI);
          ctx.strokeStyle = '#3b82f64d';
          ctx.lineWidth = 1;
          ctx.setLineDash([8, 8]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
    }

    // Draw flash arrow if active
    if (flashLocation) {
      const timeSinceFlash = Date.now() - flashLocation.timestamp;
      const flashDuration = 2000;
      const alpha = Math.max(0, 1 - (timeSinceFlash / flashDuration));
      
      if (alpha > 0) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ff6b35';
        ctx.strokeStyle = '#ff6b35';
        ctx.lineWidth = 3;
        
        const arrowSize = 20;
        const x = flashLocation.x;
        const y = flashLocation.y;
        
        ctx.beginPath();
        ctx.moveTo(x, y - arrowSize);
        ctx.lineTo(x - arrowSize/2, y);
        ctx.lineTo(x + arrowSize/2, y);
        ctx.closePath();
        ctx.fill();
        
        const pulseRadius = arrowSize + (timeSinceFlash / flashDuration) * 30;
        ctx.beginPath();
        ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
      }
    }

    // Draw Stanton star
    star.forEach((entity) => {
      const px = scaleX(entity.g_coord_x) * zoom + pan.x;
      const py = scaleY(entity.g_coord_y) * zoom + pan.y;
      
      if (px >= 0 && px <= canvasSize.width && py >= 0 && py <= canvasSize.height) {
        const radius = POINT_RADIUS + 2;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#a8a19e';
        ctx.shadowColor = '#a8a19e';
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // Draw planets
    planets.forEach((entity) => {
      const px = scaleX(entity.g_coord_x) * zoom + pan.x;
      const py = scaleY(entity.g_coord_y) * zoom + pan.y;
      
      if (px >= 0 && px <= canvasSize.width && py >= 0 && py <= canvasSize.height) {
        ctx.beginPath();
        ctx.arc(px, py, POINT_RADIUS, 0, 2 * Math.PI);
        ctx.fillStyle = '#a8a19e';
        ctx.shadowColor = '#a8a19e';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // Draw moons
    planetMoons.forEach((entity) => {
      const px = scaleX(entity.g_coord_x) * zoom + pan.x;
      const py = scaleY(entity.g_coord_y) * zoom + pan.y;
      
      if (px >= 0 && px <= canvasSize.width && py >= 0 && py <= canvasSize.height) {
        ctx.beginPath();
        ctx.arc(px, py, POINT_RADIUS - 2, 0, 2 * Math.PI);
        ctx.fillStyle = '#a8a19e';
        ctx.shadowColor = '#a8a19e';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // Draw lagrangian points
    lagrangianPoints.forEach((entity) => {
      const px = scaleX(entity.g_coord_x) * zoom + pan.x;
      const py = scaleY(entity.g_coord_y) * zoom + pan.y;
      
      if (px >= 0 && px <= canvasSize.width && py >= 0 && py <= canvasSize.height) {
        ctx.beginPath();
        ctx.arc(px, py, POINT_RADIUS - 1, 0, 2 * Math.PI);
        ctx.fillStyle = '#a8a19e';
        ctx.shadowColor = '#a8a19e';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // Draw contract stations
    const contractStations = allEntitiesData.filter(entity => 
      entity.location_type === 8 && contractStationIds.has(entity.id)
    );
    
    contractStations.forEach((entity) => {
      const adjustedEntity = adjustedData.find(e => e.id === entity.id) || entity;
      const px = scaleX(adjustedEntity.g_coord_x) * zoom + pan.x;
      const py = scaleY(adjustedEntity.g_coord_y) * zoom + pan.y;
      
      if (px >= 0 && px <= canvasSize.width && py >= 0 && py <= canvasSize.height) {
        const contractType = contractLocationTypes.get(entity.id);
        const radius = POINT_RADIUS + 2;
        
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, 2 * Math.PI);
        
        if (contractType === 'both') {
          ctx.fillStyle = '#ef4444';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(px, py, radius, Math.PI / 2, (3 * Math.PI) / 2);
          ctx.fillStyle = '#10b981';
          ctx.fill();
        } else if (contractType === 'pickup') {
          ctx.fillStyle = '#10b981';
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 20;
          ctx.fill();
        } else if (contractType === 'dropoff') {
          ctx.fillStyle = '#ef4444';
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 20;
          ctx.fill();
        }
        ctx.shadowBlur = 0;
        
        if (contractType === 'both') {
          ctx.beginPath();
          ctx.arc(px, py, radius + 3, -Math.PI / 2, Math.PI / 2);
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 3;
          ctx.stroke();
          
          ctx.beginPath();
          ctx.arc(px, py, radius + 3, Math.PI / 2, (3 * Math.PI) / 2);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 3;
          ctx.stroke();
        } else if (contractType) {
          ctx.beginPath();
          ctx.arc(px, py, radius + 3, 0, 2 * Math.PI);
          ctx.strokeStyle = contractType === 'pickup' ? '#10b981' : '#ef4444';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }
    });

    // Draw regular stations
    stations.forEach((entity) => {
      if (contractStationIds.has(entity.id)) return;
      
      const px = scaleX(entity.g_coord_x) * zoom + pan.x;
      const py = scaleY(entity.g_coord_y) * zoom + pan.y;
      
      if (px >= 0 && px <= canvasSize.width && py >= 0 && py <= canvasSize.height) {
        ctx.beginPath();
        ctx.arc(px, py, POINT_RADIUS - 1, 0, 2 * Math.PI);
        ctx.fillStyle = '#a8a19e';
        ctx.shadowColor = '#a8a19e';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // Draw other entity types
    [type6, type7, type9, type10, type11].forEach(entityGroup => {
      entityGroup.forEach((entity) => {
        const px = scaleX(entity.g_coord_x) * zoom + pan.x;
        const py = scaleY(entity.g_coord_y) * zoom + pan.y;
        
        if (px >= 0 && px <= canvasSize.width && py >= 0 && py <= canvasSize.height) {
          ctx.beginPath();
          ctx.arc(px, py, POINT_RADIUS - 1, 0, 2 * Math.PI);
          ctx.fillStyle = '#a8a19e';
          ctx.shadowColor = '#a8a19e';
          ctx.shadowBlur = 6;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });
    });

    // Draw route path
    if (routeStops.length > 0) {
      ctx.save();
      
      // Build route with starting location
      const routePoints: { entity: AllEntities; stopNumber: number | null }[] = [];
      
      // Add starting location if set
      if (startingLocationId) {
        const startEntity = adjustedData.find(e => e.id === startingLocationId);
        if (startEntity) {
          routePoints.push({ entity: startEntity, stopNumber: null });
        }
      }
      
      // Add all route stops
      routeStops.forEach((stop, index) => {
        if (stop.isCustomStation || stop.stationId === null) {
          // For custom stations, we can't draw them on the map since they don't have coordinates
          // We'll skip them for now, but could add a visual indicator later
          return;
        }
        
        const entity = adjustedData.find(e => e.id === stop.stationId);
        if (entity) {
          routePoints.push({ entity, stopNumber: index + 1 });
        }
      });
      
      // Draw lines between all points
      if (routePoints.length > 1) {
        ctx.strokeStyle = '#3b82f680'; // Dimmed blue
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]);
        
        for (let i = 0; i < routePoints.length - 1; i++) {
          const current = routePoints[i];
          const next = routePoints[i + 1];
          
          const x1 = scaleX(current.entity.g_coord_x) * zoom + pan.x;
          const y1 = scaleY(current.entity.g_coord_y) * zoom + pan.y;
          const x2 = scaleX(next.entity.g_coord_x) * zoom + pan.x;
          const y2 = scaleY(next.entity.g_coord_y) * zoom + pan.y;
          
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          
          // Draw label in the middle of the line
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          
          // Create label text
          let labelText = '';
          if (i === 0 && startingLocationId) {
            labelText = current.stopNumber !== null ? `${current.stopNumber} → ${next.stopNumber}` : `Start → 1`;
          } else {
            labelText = `${current.stopNumber} → ${next.stopNumber}`;
          }
          
          // Draw label background
          ctx.font = 'bold 11px Arial';
          const textMetrics = ctx.measureText(labelText);
          const padding = 4;
          const bgWidth = textMetrics.width + padding * 2;
          const bgHeight = 16;
          
          ctx.fillStyle = '#1f2937e6'; // Dark background
          ctx.fillRect(midX - bgWidth / 2, midY - bgHeight / 2, bgWidth, bgHeight);
          
          // Draw label border
          ctx.strokeStyle = '#3b82f6cc';
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          ctx.strokeRect(midX - bgWidth / 2, midY - bgHeight / 2, bgWidth, bgHeight);
          
          // Draw label text
          ctx.fillStyle = '#3b82f6';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, midX, midY);
          
          // Reset line dash for next line segment
          ctx.setLineDash([10, 5]);
        }
      }
      
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Draw labels
    const clusteredLabels = getClusteredLabels();
    clusteredLabels.forEach(({ entity, screenX, screenY, contractLocations }) => {
      const radius = entity.location_type === 0 ? POINT_RADIUS + 2 : 
                   entity.location_type === 1 ? POINT_RADIUS :
                   entity.location_type === 2 ? POINT_RADIUS - 2 :
                   POINT_RADIUS - 1;
      
      const fontSize = entity.location_type === 0 ? '14px' :
                      entity.location_type === 1 ? '12px' :
                      entity.location_type === 2 ? '11px' :
                      '10px';
      
      const contractFontSize = '9px';
      const lineHeight = 14;
      
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      
      ctx.fillStyle = '#a8a19e';
      ctx.font = fontSize + ' Arial';
      ctx.fillText(cleanLocationName(entity.name), screenX, screenY + radius + 12);
      
      if (contractLocations.length > 0) {
        ctx.font = contractFontSize + ' Arial';
        ctx.fillStyle = '#a8a19e';
        
        contractLocations.forEach((contractLocation, index) => {
          const yOffset = screenY + radius + 12 + (parseInt(fontSize) + 6) + (index * lineHeight);
          ctx.fillText(contractLocation, screenX, yOffset);
        });
      }
    });

  }, [adjustedData, star, planets, planetMoons, lagrangianPoints, type6, type7, stations, type9, type10, type11, scaleX, scaleY, canvasSize, pan, zoom, contractStationIds, contractLocationTypes, flashLocation, getClusteredLabels, routeStops, startingLocationId]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    if (isDragging) {
      const deltaX = mouseX - lastMousePos.x;
      const deltaY = mouseY - lastMousePos.y;
      setPan(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));
      setLastMousePos({ x: mouseX, y: mouseY });
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) {
      setIsDragging(true);
      setLastMousePos({ x: e.clientX - e.currentTarget.getBoundingClientRect().left, y: e.clientY - e.currentTarget.getBoundingClientRect().top });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const flashLocationOnMap = (locationName: string) => {
    const cleanedLocation = cleanStationNameForMatching(locationName);
    
    const entity = stantonData.find(entity => 
      entity.name.toLowerCase().includes(cleanedLocation.toLowerCase()) ||
      entity.key.toLowerCase().includes(cleanedLocation.toLowerCase()) ||
      cleanedLocation.toLowerCase().includes(entity.name.toLowerCase())
    );
    
    if (entity) {
      const adjustedEntity = adjustedData.find(e => e.id === entity.id);
      if (adjustedEntity) {
        const px = scaleX(adjustedEntity.g_coord_x) * zoom + pan.x;
        const py = scaleY(adjustedEntity.g_coord_y) * zoom + pan.y;
        
        setFlashLocation({ x: px, y: py, timestamp: Date.now() });
        
        setTimeout(() => {
          setFlashLocation(null);
        }, 2000);
        
        setLocationError(null);
      }
    } else {
      setLocationError(`Location "${locationName}" not found in Stanton system`);
      
      setTimeout(() => {
        setLocationError(null);
      }, 5000);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex w-full h-[calc(100vh-5rem)] overflow-hidden">
        {/* Contracts Sidebar */}
        <div className={`bg-card/50 backdrop-blur-sm border-r border-border flex flex-col flex-shrink-0 transition-all duration-300 ${isContractsSidebarCollapsed ? 'w-12' : 'w-96'}`}>
          {isContractsSidebarCollapsed ? (
            <div className="flex flex-col items-center py-4">
              <Button
                onClick={() => setIsContractsSidebarCollapsed(false)}
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Expand Contracts"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
              <div 
                className="text-muted-foreground mt-4"
                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
              >
                Contracts ({contracts.length})
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-bold text-foreground">Contracts</h2>
                  <div className="flex items-center gap-2">
                    <Button 
                      onClick={() => setIsManageDialogOpen(true)}
                      variant="outline" 
                      size="sm"
                      className="border-primary/50 text-primary hover:bg-primary/10"
                    >
                      <Settings className="mr-2 h-3 w-3" />
                      Manage
                    </Button>
                    <Button
                      onClick={() => setIsContractsSidebarCollapsed(true)}
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground"
                      title="Collapse Contracts"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search locations or items..."
                value={contractSearchQuery}
                onChange={(e) => setContractSearchQuery(e.target.value)}
                className="pl-9 pr-9 bg-card border-border text-foreground placeholder:text-muted-foreground"
              />
              {contractSearchQuery && (
                <button
                  onClick={() => setContractSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {(() => {
                if (!contractSearchQuery.trim()) return contracts.length;
                const query = contractSearchQuery.toLowerCase();
                return contracts.filter(contract => 
                  contract.item.toLowerCase().includes(query) ||
                  contract.source.toLowerCase().includes(query) ||
                  contract.deliveries.some(d => d.location.toLowerCase().includes(query))
                ).length;
              })()} of {contracts.length} contracts
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {(() => {
              const groupedContracts = contracts.reduce((groups, contract) => {
                const recordId = contract.id.split('|')[0];
                if (!groups[recordId]) {
                  groups[recordId] = [];
                }
                groups[recordId].push(contract);
                return groups;
              }, {} as { [key: string]: typeof contracts });

              const filteredGroups = Object.entries(groupedContracts).reduce((filtered, [recordId, contractGroup]) => {
                if (!contractSearchQuery.trim()) {
                  filtered[recordId] = contractGroup;
                  return filtered;
                }
                
                const query = contractSearchQuery.toLowerCase();
                const matchingContracts = contractGroup.filter(contract =>
                  contract.item.toLowerCase().includes(query) ||
                  contract.source.toLowerCase().includes(query) ||
                  contract.deliveries.some(d => d.location.toLowerCase().includes(query))
                );
                
                if (matchingContracts.length > 0) {
                  filtered[recordId] = matchingContracts;
                }
                
                return filtered;
              }, {} as { [key: string]: typeof contracts });

              return Object.entries(filteredGroups).map(([recordId, contractGroup]) => {
                const firstContract = contractGroup[0];
                const totalReward = firstContract.reward;
                const totalSCU = contractGroup.reduce((total, contract) => {
                  const contractSCU = contract.deliveries.reduce((sum, delivery) => {
                    return sum + delivery.quantity;
                  }, 0);
                  return total + contractSCU;
                }, 0);

                return (
                  <div key={recordId} className="bg-card/50 rounded-lg p-3 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {firstContract.contractName && (
                          <span className="text-foreground font-medium text-xs">{firstContract.contractName}</span>
                        )}
                        <span className="text-green-400 font-semibold text-xs">
                          {totalReward >= 1000 ? `${Math.round(totalReward / 1000)}k` : totalReward} aUEC
                        </span>
                        <span className="text-blue-400 font-semibold text-xs">{totalSCU} SCU</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {contractGroup.map((contract) => {
                        const query = contractSearchQuery.toLowerCase().trim();
                        const showPickup = !query || 
                          contract.source.toLowerCase().includes(query) ||
                          contract.item.toLowerCase().includes(query);
                        
                        const filteredDeliveries = !query ? contract.deliveries : 
                          contract.deliveries.filter(delivery => 
                            delivery.location.toLowerCase().includes(query) ||
                            contract.item.toLowerCase().includes(query)
                          );
                        
                        return (
                          <div key={contract.id} className="text-xs text-muted-foreground">
                            {showPickup && (() => {
                              const requiredPickup = contract.deliveries.reduce((sum, d) => sum + d.quantity, 0);
                              const pickedKey = `${contract.item}|${contract.source}`.toLowerCase();
                              const pickedQty = pickedUpMap.get(pickedKey) || 0;
                              const pickupDone = pickedQty >= requiredPickup;
                              return (
                                <div className={pickupDone ? 'line-through opacity-60' : ''}>
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                    <span 
                                      className="cursor-pointer hover:text-emerald-400 transition-colors"
                                      onClick={() => flashLocationOnMap(contract.source)}
                                    >
                                      Pickup: {contract.source}
                                    </span>
                                  </div>
                                  <div className="ml-4 mb-1">
                                    <span className="text-emerald-400 font-medium">📦 {contract.item} ({requiredPickup} SCU)</span>
                                  </div>
                                </div>
                              );
                            })()}
                            {filteredDeliveries.map((delivery, idx) => {
                              const key = `${contract.item}|${delivery.location}`.toLowerCase();
                              const deliveredQty = deliveredMap.get(key) || 0;
                              const isDelivered = deliveredQty >= delivery.quantity;
                              return (
                                <div key={idx} className={isDelivered ? 'line-through opacity-60' : ''}>
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                    <span 
                                      className="cursor-pointer hover:text-red-400 transition-colors"
                                      onClick={() => flashLocationOnMap(delivery.location)}
                                    >
                                      Dropoff: {delivery.location}
                                    </span>
                                  </div>
                                  <div className="ml-4">
                                    <span className="text-red-400 font-medium">🚚 {contract.item} ({delivery.quantity} SCU)</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
            {contracts.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No contracts available
              </div>
            )}
            {contracts.length > 0 && Object.keys((() => {
              const groupedContracts = contracts.reduce((groups, contract) => {
                const recordId = contract.id.split('|')[0];
                if (!groups[recordId]) {
                  groups[recordId] = [];
                }
                groups[recordId].push(contract);
                return groups;
              }, {} as { [key: string]: typeof contracts });

              const filteredGroups = Object.entries(groupedContracts).reduce((filtered, [recordId, contractGroup]) => {
                if (!contractSearchQuery.trim()) {
                  filtered[recordId] = contractGroup;
                  return filtered;
                }
                
                const query = contractSearchQuery.toLowerCase();
                const matchingContracts = contractGroup.filter(contract =>
                  contract.item.toLowerCase().includes(query) ||
                  contract.source.toLowerCase().includes(query) ||
                  contract.deliveries.some(d => d.location.toLowerCase().includes(query))
                );
                
                if (matchingContracts.length > 0) {
                  filtered[recordId] = matchingContracts;
                }
                
                return filtered;
              }, {} as { [key: string]: typeof contracts });
              
              return filteredGroups;
            })()).length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No contracts match your search
              </div>
            )}
          </div>
            </>
          )}
        </div>
        
        {/* Main Map Area */}
        <div className="flex-1 flex flex-col">
          {/* Error Message */}
          {locationError && (
            <div className="flex-shrink-0 p-3 bg-destructive/90 backdrop-blur-sm border-b border-destructive">
              <div className="flex items-center justify-center">
                <div className="flex items-center gap-2 text-foreground">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">{locationError}</span>
                </div>
                <button
                  onClick={() => setLocationError(null)}
                  className="ml-4 text-destructive-foreground/80 hover:text-destructive-foreground transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          
          <div className="flex-shrink-0 p-4 text-center bg-card/50 backdrop-blur-sm">
            <h1 className="text-2xl font-bold text-foreground mb-2">Stanton System Map</h1>
            <div className="flex items-center justify-center gap-4 mb-2">
              <button
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className="px-3 py-1 rounded-lg bg-background border border-primary text-primary font-semibold text-xs transition-colors duration-200 hover:bg-primary hover:text-primary-foreground"
              >
                Reset View
              </button>
              <div className="text-xs text-muted-foreground">
                Zoom: {(zoom * 100).toFixed(0)}% | Pan: ({pan.x.toFixed(0)}, {pan.y.toFixed(0)})
              </div>
            </div>
            <div className="flex flex-wrap gap-4 justify-center text-xs text-muted-foreground">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={locationTypeToggles[0]}
                  onChange={() => setLocationTypeToggles(prev => ({ ...prev, 0: !prev[0] }))}
                  className="w-4 h-4 text-primary bg-card border-border rounded focus:ring-primary focus:ring-2"
                />
                <span>Star</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={locationTypeToggles[1]}
                  onChange={() => setLocationTypeToggles(prev => ({ ...prev, 1: !prev[1] }))}
                  className="w-4 h-4 text-primary bg-card border-border rounded focus:ring-primary focus:ring-2"
                />
                <span>Planets</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={locationTypeToggles[2]}
                  onChange={() => setLocationTypeToggles(prev => ({ ...prev, 2: !prev[2] }))}
                  className="w-4 h-4 text-primary bg-card border-border rounded focus:ring-primary focus:ring-2"
                />
                <span>Moons</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={locationTypeToggles[4]}
                  onChange={() => setLocationTypeToggles(prev => ({ ...prev, 4: !prev[4] }))}
                  className="w-4 h-4 text-primary bg-card border-border rounded focus:ring-primary focus:ring-2"
                />
                <span>Lagrangian</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={locationTypeToggles[8]}
                  onChange={() => setLocationTypeToggles(prev => ({ ...prev, 8: !prev[8] }))}
                  className="w-4 h-4 text-primary bg-card border-border rounded focus:ring-primary focus:ring-2"
                />
                <span>Stations</span>
              </label>
            </div>
          </div>
          
          <div 
            ref={containerRef}
            className="flex-1 relative w-full h-full overflow-hidden bg-background"
          >
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              className="block w-full h-full bg-card cursor-grab active:cursor-grabbing"
              onMouseMove={handleMouseMove}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
            />
          </div>
        </div>
        
        {/* Route Planner Sidebar */}
        <RoutePlanner 
          contracts={contracts}
          onRouteChange={(stops, startLocId) => {
            setRouteStops(stops);
            setStartingLocationId(startLocId);
          }}
        />
      </div>
      
      <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto bg-card border-primary/30">
          <DialogHeader>
            <DialogTitle className="text-2xl text-primary">Manage Contracts</DialogTitle>
          </DialogHeader>
          <Record />
        </DialogContent>
      </Dialog>
      
      <Toaster />
      <Sonner />
    </div>
  );
};

export default RoutesPage;
