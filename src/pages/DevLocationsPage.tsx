import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FolderTree, Search } from "lucide-react";
import {
  STAR_SYSTEMS,
  collectSubtreeIndices,
  getMapData,
} from "@/lib/map-data";
import type { MapData, MapTreeNode, PoiCategory, StarSystem } from "@/types/map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const POI_CATEGORIES: PoiCategory[] = [
  "star",
  "planet",
  "moon",
  "lagrangian_point",
  "station",
  "poi",
];

type CategoryFilter = PoiCategory;

function allCategoriesEnabled(): Record<CategoryFilter, boolean> {
  return Object.fromEntries(POI_CATEGORIES.map((c) => [c, true])) as Record<
    CategoryFilter,
    boolean
  >;
}

function formatCategory(category: string | undefined): string {
  if (!category) return "unknown";
  return category.replace(/_/g, " ");
}

function primaryPoi(data: MapData, node: MapTreeNode) {
  if (node.poiIndices.length > 0) return data.pois[node.poiIndices[0]];
  const idx = data.entityIndex[node.name];
  if (idx != null) return data.pois[idx];
  return undefined;
}

function nodeDisplayName(data: MapData, node: MapTreeNode): string {
  const poi = primaryPoi(data, node);
  if (poi?.n) return poi.n;
  return node.name.replace(/_/g, " ");
}

function nodeCategory(data: MapData, node: MapTreeNode): PoiCategory | "container" | "system" {
  if (node.path.length === 0) return "system";
  const poi = primaryPoi(data, node);
  if (poi?.category) return poi.category;
  if (node.poiIndices.length === 0 && node.children.length > 0) return "container";
  return "poi";
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px] font-medium capitalize">
      {formatCategory(category)}
    </Badge>
  );
}

function nodeMatchesQuery(data: MapData, node: MapTreeNode, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const label = nodeDisplayName(data, node).toLowerCase();
  const category = formatCategory(nodeCategory(data, node));
  if (label.includes(q) || node.name.toLowerCase().includes(q) || category.includes(q)) {
    return true;
  }
  for (const i of node.poiIndices) {
    const poi = data.pois[i];
    if (!poi) continue;
    if (poi.n.toLowerCase().includes(q)) return true;
    if (poi.en?.toLowerCase().includes(q)) return true;
    if (poi.category?.toLowerCase().includes(q)) return true;
  }
  return node.children.some((child) => nodeMatchesQuery(data, child, query));
}

function nodeHasEnabledCategory(
  data: MapData,
  node: MapTreeNode,
  enabled: Record<CategoryFilter, boolean>
): boolean {
  const category = nodeCategory(data, node);
  if (category === "system" || category === "container") {
    return node.children.some((child) => nodeHasEnabledCategory(data, child, enabled));
  }

  if (node.poiIndices.length > 0) {
    const anyEnabled = node.poiIndices.some((i) => {
      const cat = data.pois[i]?.category ?? "poi";
      return enabled[cat as CategoryFilter];
    });
    if (anyEnabled) return true;
  } else if (enabled[category as CategoryFilter]) {
    return true;
  }

  return node.children.some((child) => nodeHasEnabledCategory(data, child, enabled));
}

function nodeVisible(
  data: MapData,
  node: MapTreeNode,
  query: string,
  enabled: Record<CategoryFilter, boolean>
): boolean {
  return nodeMatchesQuery(data, node, query) && nodeHasEnabledCategory(data, node, enabled);
}

function countNodes(node: MapTreeNode): number {
  return 1 + node.children.reduce((sum, c) => sum + countNodes(c), 0);
}

function TreeNodeRow({
  data,
  node,
  depth,
  query,
  enabledCategories,
  defaultOpen,
}: {
  data: MapData;
  node: MapTreeNode;
  depth: number;
  query: string;
  enabledCategories: Record<CategoryFilter, boolean>;
  defaultOpen?: boolean;
}) {
  const hasChildren = node.children.length > 0;
  const [open, setOpen] = useState(Boolean(defaultOpen) || depth < 2);
  const label = nodeDisplayName(data, node);
  const category = nodeCategory(data, node);
  const subtreePois = collectSubtreeIndices(node).length;
  const showEntity = label !== node.name;
  const visibleChildren = useMemo(
    () =>
      node.children.filter((c) => nodeVisible(data, c, query, enabledCategories)),
    [data, node.children, query, enabledCategories]
  );

  if (!nodeVisible(data, node, query, enabledCategories)) return null;

  const filtering = Boolean(query) || POI_CATEGORIES.some((c) => !enabledCategories[c]);
  const forceOpen = filtering;

  const visiblePoiIndices = node.poiIndices.filter((i) => {
    const cat = (data.pois[i]?.category ?? "poi") as CategoryFilter;
    return enabledCategories[cat];
  });

  return (
    <div className="min-w-0">
      <div
        className={cn(
          "group flex min-w-0 items-start gap-1 rounded-md py-1 pr-2 text-sm hover:bg-accent/40",
          depth === 0 && "font-semibold"
        )}
        style={{ paddingLeft: `${Math.min(depth, 12) * 14 + 4}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={forceOpen || open}
            aria-label={open ? "Collapse" : "Expand"}
          >
            {forceOpen || open ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate font-medium text-foreground">{label}</span>
            <CategoryBadge category={category} />
            {showEntity && (
              <span className="truncate font-mono text-[11px] text-muted-foreground">
                {node.name}
              </span>
            )}
            <span className="tabular-nums text-[11px] text-muted-foreground">
              {hasChildren
                ? `${node.children.length} child${node.children.length === 1 ? "" : "ren"} · ${subtreePois} POI`
                : node.poiIndices.length
                  ? "leaf"
                  : "container"}
            </span>
          </div>
          {visiblePoiIndices.length > 1 && (
            <ul className="mt-0.5 space-y-0.5 pl-1">
              {visiblePoiIndices.map((i) => {
                const poi = data.pois[i];
                if (!poi) return null;
                return (
                  <li
                    key={`${node.name}-${i}`}
                    className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <span className="truncate">{poi.n}</span>
                    <CategoryBadge category={poi.category ?? "poi"} />
                    {poi.en && poi.en !== poi.n && (
                      <span className="truncate font-mono text-[10px] opacity-70">
                        {poi.en}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {(forceOpen || open) &&
        visibleChildren.map((child) => (
          <TreeNodeRow
            key={pathKey(child)}
            data={data}
            node={child}
            depth={depth + 1}
            query={query}
            enabledCategories={enabledCategories}
            defaultOpen={depth < 1}
          />
        ))}
    </div>
  );
}

function pathKey(node: MapTreeNode): string {
  return node.path.length ? node.path.join("/") : node.name;
}

function SystemTree({
  system,
  query,
  enabledCategories,
}: {
  system: StarSystem;
  query: string;
  enabledCategories: Record<CategoryFilter, boolean>;
}) {
  const data = useMemo(() => getMapData(system), [system]);
  const nodeTotal = useMemo(() => countNodes(data.tree), [data.tree]);
  const filteredPoiCount = useMemo(
    () =>
      data.pois.filter((p) => enabledCategories[(p.category ?? "poi") as CategoryFilter])
        .length,
    [data.pois, enabledCategories]
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="tabular-nums">
          {filteredPoiCount}/{data.count} POIs
        </Badge>
        <Badge variant="outline" className="tabular-nums">
          {nodeTotal} tree nodes
        </Badge>
      </div>
      <div className="rounded-lg border border-border/80 bg-card/60 py-1.5">
        <TreeNodeRow
          data={data}
          node={data.tree}
          depth={0}
          query={query.trim()}
          enabledCategories={enabledCategories}
          defaultOpen
        />
      </div>
    </div>
  );
}

/** Dev-only explorer for location hierarchies across star systems. */
export function DevLocationsPage() {
  const [query, setQuery] = useState("");
  const [system, setSystem] = useState<StarSystem>("stanton");
  const [enabledCategories, setEnabledCategories] = useState(allCategoriesEnabled);

  const data = useMemo(() => getMapData(system), [system]);
  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(POI_CATEGORIES.map((c) => [c, 0])) as Record<
      CategoryFilter,
      number
    >;
    for (const poi of data.pois) {
      const cat = (poi.category ?? "poi") as CategoryFilter;
      if (cat in counts) counts[cat] += 1;
    }
    return counts;
  }, [data.pois]);

  const allOn = POI_CATEGORIES.every((c) => enabledCategories[c]);
  const noneOn = POI_CATEGORIES.every((c) => !enabledCategories[c]);

  const toggleCategory = (category: CategoryFilter) => {
    setEnabledCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold tracking-tight">Location hierarchy</h1>
            <Badge variant="warning">Dev only</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse POI parent chains for each system. Internal entity names shown in mono.
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name or entity…"
            className="h-8 pl-8"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Categories
        </span>
        {POI_CATEGORIES.map((category) => {
          const on = enabledCategories[category];
          return (
            <button
              key={category}
              type="button"
              onClick={() => toggleCategory(category)}
              aria-pressed={on}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs capitalize transition-colors",
                on
                  ? "border-primary/40 bg-primary/15 text-foreground"
                  : "border-border/70 bg-muted/20 text-muted-foreground hover:text-foreground"
              )}
            >
              {formatCategory(category)}
              <span className="tabular-nums text-[10px] opacity-70">
                {categoryCounts[category]}
              </span>
            </button>
          );
        })}
        <div className="ml-1 flex items-center gap-1 border-l border-border/60 pl-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={allOn}
            onClick={() => setEnabledCategories(allCategoriesEnabled())}
          >
            All
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={noneOn}
            onClick={() =>
              setEnabledCategories(
                Object.fromEntries(POI_CATEGORIES.map((c) => [c, false])) as Record<
                  CategoryFilter,
                  boolean
                >
              )
            }
          >
            None
          </Button>
        </div>
      </div>

      <Tabs value={system} onValueChange={(v) => setSystem(v as StarSystem)}>
        <TabsList>
          {STAR_SYSTEMS.map((s) => (
            <TabsTrigger key={s.value} value={s.value}>
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {STAR_SYSTEMS.map((s) => (
          <TabsContent key={s.value} value={s.value} className="mt-3">
            <SystemTree
              system={s.value}
              query={query}
              enabledCategories={enabledCategories}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
