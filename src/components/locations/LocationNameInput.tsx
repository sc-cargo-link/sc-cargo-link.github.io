import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin } from "lucide-react";
import {
  getLocationDisplayName,
  getLocationStorageKey,
  getSystemLabel,
  isExactStoredLocation,
  searchLocations,
  type ResolvedLocation,
} from "@/lib/location-lookup";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function LocationNameInput({
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
  const [draft, setDraft] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const searchText =
    draft ??
    (isExactStoredLocation(value) ? getLocationDisplayName(value) : value || hint || "");

  const suggestions = useMemo(
    () => (searchText.trim().length >= 1 ? searchLocations(searchText, 8) : []),
    [searchText]
  );

  const updateMenuPos = () => {
    const el = inputRef.current ?? wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(rect.width, 280);
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8);
    }
    setMenuPos({
      top: rect.bottom + 4,
      left,
      width,
    });
  };

  useEffect(() => {
    setActiveIndex(0);
  }, [suggestions.length, searchText]);

  useLayoutEffect(() => {
    if (!open || suggestions.length === 0) {
      setMenuPos(null);
      return;
    }
    updateMenuPos();
    const onReposition = () => updateMenuPos();
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open, suggestions.length, searchText]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const pick = (loc: ResolvedLocation) => {
    onChange(getLocationStorageKey(loc));
    setDraft(null);
    setOpen(false);
  };

  const showSuggestions = open && suggestions.length > 0 && menuPos != null;
  const needsReview =
    (!!value.trim() && !isExactStoredLocation(value)) || (!!hint?.trim() && !value.trim());

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <Input
        ref={inputRef}
        value={searchText}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (searchText.trim()) setOpen(true);
        }}
        onBlur={() => setDraft(null)}
        placeholder={placeholder}
        className={cn(
          "h-8",
          needsReview && "border-destructive/70 bg-destructive/5 focus-visible:ring-destructive/40"
        )}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (!open || suggestions.length === 0) return;
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

      {showSuggestions &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
            }}
            className="z-[200] max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-lg"
          >
            {suggestions.map((s, idx) => (
              <button
                key={`${s.system}-${s.name}-${s.x}`}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent",
                  idx === activeIndex && "bg-accent"
                )}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
              >
                <MapPin className="h-3 w-3 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {getSystemLabel(s.system)}
                </span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
