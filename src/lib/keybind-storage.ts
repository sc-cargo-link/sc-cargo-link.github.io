import {
  parseKeybindXml,
  serializeKeybindXml,
} from "@/lib/keybind-parser";
import type { KeybindProfile } from "@/types/keybinds";

const KEYBINDS_DRAFT_KEY = "cargolink-keybinds-draft";

interface StoredKeybindDraft {
  xml: string;
  profileName: string;
  sourceName?: string;
}

export function loadKeybindDraft(): KeybindProfile | null {
  try {
    const raw = localStorage.getItem(KEYBINDS_DRAFT_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredKeybindDraft;
    const profile = parseKeybindXml(stored.xml, stored.sourceName);
    profile.profileName = stored.profileName || profile.profileName;
    return profile;
  } catch {
    return null;
  }
}

export function saveKeybindDraft(profile: KeybindProfile): void {
  const draft: StoredKeybindDraft = {
    xml: serializeKeybindXml(profile),
    profileName: profile.profileName,
    sourceName: profile.sourceName,
  };
  localStorage.setItem(KEYBINDS_DRAFT_KEY, JSON.stringify(draft));
}

export function clearKeybindDraft(): void {
  localStorage.removeItem(KEYBINDS_DRAFT_KEY);
}

export function downloadKeybindProfile(profile: KeybindProfile): void {
  const blob = new Blob([serializeKeybindXml(profile)], {
    type: "application/xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${profile.profileName || "keybind-profile"}.xml`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
