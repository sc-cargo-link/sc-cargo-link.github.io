import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Search } from "lucide-react";
import type { MapData } from "@/types/map";
import { searchMapLocations, type MapSearchResult } from "@/lib/location-lookup";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface LocationSearchProps {
  data: MapData;
  onSelect: (result: MapSearchResult) => void;
  className?: string;
}

export function LocationSearch({ data, onSelect, className }: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(
    () => (query.trim() ? searchMapLocations(data, query) : []),
    [data, query]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const select = (result: MapSearchResult) => {
    setQuery(result.name);
    setOpen(false);
    onSelect(result);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) {
      if (e.key === "ArrowDown" && results.length > 0) {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(results[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative min-w-[200px] flex-1 max-w-md", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="h-8 pl-8"
        placeholder="Search locations…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => query.trim() && setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-64 overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-lg">
          {results.map((result, i) => (
            <li key={`${result.poiIndex}-${result.name}`}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-start gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-accent",
                  i === activeIndex && "bg-accent"
                )}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => select(result)}
              >
                <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-popover-foreground">
                    {result.name}
                  </span>
                  {result.treePath.length > 0 && (
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {result.treePath.map((segment, idx) => (
                        <span key={`${segment}-${idx}`}>
                          {idx > 0 && (
                            <span className="mx-0.5 text-muted-foreground">→</span>
                          )}
                          <span
                            className={
                              idx === result.treePath.length - 1
                                ? "text-foreground"
                                : undefined
                            }
                          >
                            {segment}
                          </span>
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && query.trim() && results.length === 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 rounded-md border border-border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-lg">
          No locations found
        </div>
      )}
    </div>
  );
}
