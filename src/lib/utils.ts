import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDistance(meters: number): string {
  const gm = meters / 1e9;
  if (gm >= 1) return `${gm.toFixed(2)} GM`;
  const km = meters / 1000;
  if (km >= 1) return `${km.toFixed(1)} km`;
  return `${meters.toFixed(0)} m`;
}

export function formatScu(scu: number): string {
  return `${scu.toLocaleString()} SCU`;
}

export function formatAuec(amount: number): string {
  return `${amount.toLocaleString()} aUEC`;
}

/** Resolve a theme HSL token (e.g. `--primary`) for canvas / inline styles. */
export function themeColor(cssVar: string, alpha?: number): string {
  if (typeof document === "undefined") {
    return alpha != null ? `hsl(24 60% 50% / ${alpha})` : "hsl(24 60% 50%)";
  }
  const raw = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  if (!raw) {
    return alpha != null ? `hsl(24 60% 50% / ${alpha})` : "hsl(24 60% 50%)";
  }
  return alpha != null ? `hsl(${raw} / ${alpha})` : `hsl(${raw})`;
}
