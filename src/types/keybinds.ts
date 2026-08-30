export type KeybindDevice = "keyboard" | "mouse" | "gamepad" | "joystick" | "unknown";

export interface XmlTextNode {
  type: "text";
  value: string;
}

export interface XmlElementNode {
  type: "element";
  name: string;
  attributes: Record<string, string>;
  children: XmlNode[];
}

export type XmlNode = XmlTextNode | XmlElementNode;

export interface KeybindProfile {
  root: XmlElementNode;
  profileName: string;
  sourceName?: string;
}

export interface KeybindBinding {
  index: number;
  input: string;
  attributes: Record<string, string>;
  device: KeybindDevice;
  deviceInstance?: string;
  display: string;
  isUnassigned: boolean;
  activationMode?: string;
  multiTap?: string;
}

export interface KeybindAction {
  mapName: string;
  name: string;
  label: string;
  bindings: KeybindBinding[];
}

export interface KeybindActionMap {
  name: string;
  label: string;
  actions: KeybindAction[];
}

export interface BindingPatch {
  input?: string;
  attributes?: Record<string, string | undefined>;
}

export interface CapturedBinding {
  input: string;
  device: KeybindDevice;
  deviceInstance?: string;
  display: string;
}
