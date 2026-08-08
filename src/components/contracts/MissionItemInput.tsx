import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const searchText = value || hint || "";
  const exact = useMemo(() => (value.trim() ? findMissionItem(value) : null), [value]);
  const suggestions = useMemo(
    () => (searchText.trim().length >= 1 ? searchMissionItems(searchText, 8) : []),
    [searchText]
  );

  const updateMenuPos = () => {
    const el = inputRef.current ?? wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(rect.width, 220);
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

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const showSuggestions = open && suggestions.length > 0 && menuPos != null;
  const needsReview = (!!value.trim() && !exact) || (!!hint?.trim() && !value.trim());

  return (
    <div ref={wrapRef} className={cn("relative min-w-0 flex-1", className)}>
      <Input
        ref={inputRef}
        value={value || hint || ""}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (searchText.trim()) setOpen(true);
        }}
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
            className="z-[200] max-h-48 overflow-y-auto rounded-md border border-border/80 bg-popover shadow-md"
          >
            {suggestions.map((name, idx) => (
              <button
                key={name}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent",
                  idx === activeIndex && "bg-accent"
                )}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(name)}
              >
                <Package className="h-3 w-3 shrink-0 text-primary" />
                <span className="truncate">{name}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
