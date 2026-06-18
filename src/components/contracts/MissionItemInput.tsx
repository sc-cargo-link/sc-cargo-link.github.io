import { useEffect, useMemo, useRef, useState } from "react";
import { Package } from "lucide-react";
import { findMissionItem, searchMissionItems } from "@/lib/mission-item-lookup";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function MissionItemInput({
  value,
  hint,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  hint?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const searchText = value || hint || "";
  const exact = useMemo(() => (value.trim() ? findMissionItem(value) : null), [value]);
  const suggestions = useMemo(
    () => (searchText.trim().length > 1 ? searchMissionItems(searchText, 6) : []),
    [searchText]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [suggestions.length, searchText]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const showSuggestions = open && suggestions.length > 0;
  const needsReview = (!!value.trim() && !exact) || (!!hint?.trim() && !value.trim());
  const chipQuery = searchText.trim();

  return (
    <div ref={wrapRef} className={cn("relative min-w-0 flex-1", className)}>
      <Input
        value={value || hint || ""}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => searchText.trim() && setOpen(true)}
        placeholder={placeholder}
        className={cn(
          "h-8",
          needsReview && "border-destructive/70 bg-destructive/5 focus-visible:ring-destructive/40"
        )}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (!showSuggestions) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => (i + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(suggestions[activeIndex]);
          }
        }}
      />

      {showSuggestions && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-40 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          {suggestions.map((name, idx) => (
            <button
              key={name}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent",
                idx === activeIndex && "bg-accent"
              )}
              onMouseEnter={() => setActiveIndex(idx)}
              onClick={() => pick(name)}
            >
              <Package className="h-3 w-3 shrink-0 text-primary" />
              <span className="truncate">{name}</span>
            </button>
          ))}
        </div>
      )}

      {!exact && chipQuery.length > 2 && suggestions.length > 0 && !showSuggestions && (
        <div className="mt-1 flex flex-wrap gap-1">
          {suggestions.slice(0, 3).map((name) => (
            <button
              key={`chip-${name}`}
              type="button"
              className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
              onClick={() => pick(name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
