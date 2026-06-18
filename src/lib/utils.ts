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
