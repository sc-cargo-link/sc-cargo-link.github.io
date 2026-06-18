import { useCallback, useEffect, useRef, useState } from "react";
import type { LocationCategory, MapData, MapTransform, RouteMapLeg, RouteOverlayPoint } from "@/types/map";
import {
  collectSubtreeIndices,
  findTreeNodeByPath,
  fitToBounds,
  getVisiblePoiIndices,
  pathUsesPyro4MoonOrbit,
  resolveOrbitParentEntity,
} from "@/lib/map-data";
import { formatDistance } from "@/lib/utils";

interface LegLabel {
  x: number;
  y: number;
  text: string;
  perpX: number;
  perpY: number;
  offset: number;
}

interface POIMapCanvasProps {
  data: MapData;
  filters: Record<LocationCategory, boolean>;
  selectedPath: string[] | null;
  onSelectPath: (path: string[]) => void;
  routeOverlay?: RouteOverlayPoint[];
  routeLegs?: RouteMapLeg[];
  focusTarget?: { poiIndex: number; token: number } | null;
  className?: string;
}

export function POIMapCanvas({
  data,
  filters,
  selectedPath,
  onSelectPath,
  routeOverlay,
  routeLegs,
  focusTarget,
  className,
}: POIMapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<MapTransform>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

  const highlighted = useRef(new Set<number>());
  const parentIndices = useRef(new Set<number>());

  const applySelection = useCallback(
    (path: string[]) => {
      highlighted.current.clear();
      parentIndices.current.clear();
      const node = findTreeNodeByPath(data.tree, path);
      if (!node) return;
      const parentEntity = resolveOrbitParentEntity(data, path);
      if (parentEntity && data.entityIndex[parentEntity] !== undefined) {
        parentIndices.current.add(data.entityIndex[parentEntity]);
      }
      for (const idx of collectSubtreeIndices(node)) {
        highlighted.current.add(idx);
      }
    },
    [data]
  );

  useEffect(() => {
    if (selectedPath) applySelection(selectedPath);
    else {
      highlighted.current.clear();
      parentIndices.current.clear();
    }
  }, [selectedPath, applySelection]);

  const worldToScreen = useCallback(
    (x: number, y: number, width: number, height: number) => ({
      sx: x * transform.scale + transform.offsetX + width / 2,
      sy: -y * transform.scale + transform.offsetY + height / 2,
    }),
    [transform]
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, rect.width, rect.height);

    const highlightPyro5Orbit =
      data.system === "pyro" && selectedPath && pathUsesPyro4MoonOrbit(data, selectedPath);

    for (const orbit of data.orbits || []) {
      const isPyro5 = data.system === "pyro" && orbit.n === "Pyro V";
      const center = worldToScreen(orbit.cx, orbit.cy, rect.width, rect.height);
      const edge = worldToScreen(orbit.cx + orbit.r, orbit.cy, rect.width, rect.height);
      const screenR = Math.hypot(edge.sx - center.sx, edge.sy - center.sy);
      if (screenR < 2) continue;
      ctx.beginPath();
      ctx.arc(center.sx, center.sy, screenR, 0, Math.PI * 2);
      ctx.strokeStyle =
        highlightPyro5Orbit && isPyro5 ? "rgba(255, 179, 71, 0.75)" : "rgba(120, 170, 220, 0.35)";
      ctx.lineWidth = highlightPyro5Orbit && isPyro5 ? 2 : 1;
      ctx.stroke();
      if (screenR > 30 && orbit.px != null && orbit.py != null) {
        const planet = worldToScreen(orbit.px, orbit.py, rect.width, rect.height);
        ctx.fillStyle = "rgba(180, 210, 240, 0.75)";
        ctx.font = "11px Segoe UI, system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(orbit.n, planet.sx + 8, planet.sy - 6);
      }
    }

    if (routeOverlay && routeOverlay.length > 1) {
      ctx.strokeStyle = "rgba(255, 179, 71, 0.8)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      routeOverlay.forEach((pt, i) => {
        const { sx, sy } = worldToScreen(pt.x, pt.y, rect.width, rect.height);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      const legLabels: LegLabel[] = [];
      const legsToDraw = routeLegs ?? [];
      for (const leg of legsToDraw) {
        const p0 = worldToScreen(leg.fromX, leg.fromY, rect.width, rect.height);
        const p1 = worldToScreen(leg.toX, leg.toY, rect.width, rect.height);
        const t = 0.2;
        const lx = p0.sx + (p1.sx - p0.sx) * t;
        const ly = p0.sy + (p1.sy - p0.sy) * t;
        const dx = p1.sx - p0.sx;
        const dy = p1.sy - p0.sy;
        const len = Math.hypot(dx, dy) || 1;
        legLabels.push({
          x: lx,
          y: ly,
          text: `${leg.legNumber} · ${formatDistance(leg.distance)}`,
          perpX: -dy / len,
          perpY: dx / len,
          offset: 0,
        });
      }

      const labelSpacing = 14;
      const collisionRadius = 44;
      const groups: LegLabel[][] = [];
      for (const label of legLabels) {
        const group = groups.find((g) =>
          g.some((gLabel) => Math.hypot(gLabel.x - label.x, gLabel.y - label.y) < collisionRadius)
        );
        if (group) group.push(label);
        else groups.push([label]);
      }
      for (const group of groups) {
        const center = (group.length - 1) / 2;
        group.forEach((label, idx) => {
          label.offset = (idx - center) * labelSpacing;
        });
      }

      for (const label of legLabels) {
        const ox = label.x + label.perpX * label.offset;
        const oy = label.y + label.perpY * label.offset;
        ctx.font = "bold 10px Segoe UI, system-ui, sans-serif";
        const metrics = ctx.measureText(label.text);
        const padX = 5;
        const padY = 3;
        const bw = metrics.width + padX * 2;
        const bh = 14 + padY * 2;

        ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
        ctx.strokeStyle = "rgba(255, 179, 71, 0.65)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(ox - bw / 2, oy - bh / 2, bw, bh, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffb347";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label.text, ox, oy);
      }
    }

    const visible = new Set(getVisiblePoiIndices(data, filters));
    for (const i of highlighted.current) visible.add(i);
    for (const i of parentIndices.current) visible.add(i);
    if (hoverIndex !== null) visible.add(hoverIndex);
    if (focusTarget) visible.add(focusTarget.poiIndex);

    for (const i of visible) {
      const p = data.pois[i];
      if (!p) continue;
      const { sx, sy } = worldToScreen(p.x, p.y, rect.width, rect.height);
      if (sx < -20 || sy < -20 || sx > rect.width + 20 || sy > rect.height + 20) continue;

      let radius = 5;
      let color = "rgba(91, 141, 239, 0.9)";
      if (parentIndices.current.has(i)) {
        radius = 9;
        color = "#ffb347";
      } else if (highlighted.current.has(i)) {
        radius = 7;
        color = "#6ee7b7";
      } else if (hoverIndex === i) {
        radius = 8;
      }

      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    if (routeOverlay) {
      for (const pt of routeOverlay) {
        const { sx, sy } = worldToScreen(pt.x, pt.y, rect.width, rect.height);
        ctx.beginPath();
        ctx.fillStyle =
          pt.order === 0
            ? "#4da3ff"
            : pt.type === "pickup"
              ? "#6ee7b7"
              : pt.type === "stopover"
                ? "#fbbf24"
                : pt.type === "gateway"
                  ? "#c084fc"
                  : "#f87171";
        ctx.arc(sx, sy, pt.order === 0 ? 7 : 8, 0, Math.PI * 2);
        ctx.fill();
        if (pt.order > 0) {
          ctx.fillStyle = "#fff";
          ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(pt.order), sx, sy);
        }
      }
    }

    const origin = worldToScreen(0, 0, rect.width, rect.height);
    if (origin.sx >= 0 && origin.sx <= rect.width && origin.sy >= 0 && origin.sy <= rect.height) {
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(origin.sx - 8, origin.sy);
      ctx.lineTo(origin.sx + 8, origin.sy);
      ctx.moveTo(origin.sx, origin.sy - 8);
      ctx.lineTo(origin.sx, origin.sy + 8);
      ctx.stroke();
    }
  }, [data, filters, focusTarget, hoverIndex, routeLegs, routeOverlay, selectedPath, transform, worldToScreen]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }, [draw]);

  useEffect(() => {
    const t = fitToBounds(data.bounds, wrapRef.current?.clientWidth || 800, wrapRef.current?.clientHeight || 600);
    setTransform(t);
  }, [data]);

  useEffect(() => {
    if (!focusTarget) return;
    const poi = data.pois[focusTarget.poiIndex];
    const wrap = wrapRef.current;
    if (!poi || !wrap) return;

    const rect = wrap.getBoundingClientRect();
    const base = fitToBounds(data.bounds, rect.width, rect.height);
    const focusScale = Math.min(base.scale * 12, 5e-4);

    setTransform({
      scale: focusScale,
      offsetX: -poi.x * focusScale,
      offsetY: poi.y * focusScale,
    });
    setHoverIndex(focusTarget.poiIndex);
    if (poi.pc?.length) applySelection(poi.pc);
  }, [focusTarget, data, applySelection]);

  useEffect(() => {
    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    if (wrapRef.current) observer.observe(wrapRef.current);
    return () => observer.disconnect();
  }, [resizeCanvas]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const blockPageScroll = (e: WheelEvent) => {
      e.preventDefault();
    };
    el.addEventListener("wheel", blockPageScroll, { passive: false });
    return () => el.removeEventListener("wheel", blockPageScroll);
  }, []);

  const pickPoi = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return null;
    const rect = wrap.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const candidates = new Set(getVisiblePoiIndices(data, filters));
    for (const i of highlighted.current) candidates.add(i);
    for (const i of parentIndices.current) candidates.add(i);

    let best: number | null = null;
    let bestDist = Infinity;
    for (const i of candidates) {
      const p = data.pois[i];
      const screen = worldToScreen(p.x, p.y, rect.width, rect.height);
      const radius = (parentIndices.current.has(i) ? 9 : highlighted.current.has(i) ? 7 : 5) + 4;
      const d = Math.hypot(screen.sx - sx, screen.sy - sy);
      if (d <= radius && d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  };

  return (
    <div
      ref={wrapRef}
      className={`relative overflow-hidden overscroll-contain bg-slate-100 dark:bg-[#070a0f] ${className || ""}`}
      style={{
        background:
          "radial-gradient(circle at 50% 50%, rgba(30, 60, 100, 0.12), transparent 60%)",
        touchAction: "none",
      }}
    >
      <canvas
        ref={canvasRef}
        className={`block h-full w-full ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        onMouseDown={(e) => {
          setDragging(true);
          dragStart.current = {
            x: e.clientX,
            y: e.clientY,
            offsetX: transform.offsetX,
            offsetY: transform.offsetY,
          };
        }}
        onMouseMove={(e) => {
          const wrap = wrapRef.current;
          if (wrap) {
            const rect = wrap.getBoundingClientRect();
            setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }
          const start = dragStart.current;
          if (start) {
            const { clientX, clientY } = e;
            setTransform((t) => ({
              ...t,
              offsetX: start.offsetX + (clientX - start.x),
              offsetY: start.offsetY + (clientY - start.y),
            }));
            return;
          }
          const idx = pickPoi(e.clientX, e.clientY);
          setHoverIndex(idx);
        }}
        onMouseUp={() => {
          setDragging(false);
          dragStart.current = null;
        }}
        onMouseLeave={() => {
          setDragging(false);
          dragStart.current = null;
          setHoverIndex(null);
          setHoverPos(null);
        }}
        onClick={(e) => {
          const idx = pickPoi(e.clientX, e.clientY);
          if (idx === null) return;
          const poi = data.pois[idx];
          onSelectPath(poi.pc || []);
        }}
        onWheel={(e) => {
          const wrap = wrapRef.current;
          if (!wrap) return;
          const rect = wrap.getBoundingClientRect();
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;
          setTransform((t) => {
            const wx = (sx - rect.width / 2 - t.offsetX) / t.scale;
            const wy = -(sy - rect.height / 2 - t.offsetY) / t.scale;
            const factor = e.deltaY < 0 ? 1.15 : 0.87;
            let scale = t.scale * factor;
            scale = Math.max(scale, 1e-15);
            scale = Math.min(scale, 1e-3);
            return {
              scale,
              offsetX: sx - rect.width / 2 - wx * scale,
              offsetY: sy - rect.height / 2 + wy * scale,
            };
          });
        }}
      />
      {hoverIndex !== null && hoverPos && data.pois[hoverIndex] && (
        <div
          className="pointer-events-none absolute z-10 max-w-[240px] rounded-md border border-border bg-popover px-2 py-1.5 text-xs shadow-md"
          style={{ left: hoverPos.x + 14, top: hoverPos.y + 14 }}
        >
          <div className="font-semibold text-popover-foreground">{data.pois[hoverIndex].n}</div>
          {data.pois[hoverIndex].en && (
            <div className="text-muted-foreground">{data.pois[hoverIndex].en}</div>
          )}
          {data.pois[hoverIndex].category && (
            <div className="mt-0.5 capitalize text-muted-foreground">
              {data.pois[hoverIndex].category?.replace(/_/g, " ")}
            </div>
          )}
          {data.pois[hoverIndex].description && (
            <div className="mt-1 line-clamp-3 text-[10px] text-muted-foreground">
              {data.pois[hoverIndex].description}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
