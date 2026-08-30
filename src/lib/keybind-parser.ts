import type {
  BindingPatch,
  KeybindAction,
  KeybindActionMap,
  KeybindBinding,
  KeybindDevice,
  KeybindProfile,
  XmlElementNode,
  XmlNode,
} from "@/types/keybinds";

const DEVICE_LABELS: Record<string, string> = {
  kb: "Keyboard",
  mo: "Mouse",
  gp: "Gamepad",
  js: "Joystick",
};

const CONTROL_LABELS: Record<string, string> = {
  lalt: "Left Alt",
  ralt: "Right Alt",
  lctrl: "Left Ctrl",
  rctrl: "Right Ctrl",
  lshift: "Left Shift",
  rshift: "Right Shift",
  space: "Space",
  enter: "Enter",
  esc: "Escape",
  backspace: "Backspace",
  tab: "Tab",
  capslock: "Caps Lock",
  pgup: "Page Up",
  pgdn: "Page Down",
  mwheel_up: "Mouse Wheel Up",
  mwheel_down: "Mouse Wheel Down",
  mouse1: "Mouse 1",
  mouse2: "Mouse 2",
  mouse3: "Mouse 3",
  button1: "Button 1",
  button2: "Button 2",
  button3: "Button 3",
  rotx: "Rotate X",
  roty: "Rotate Y",
  rotz: "Rotate Z",
  x: "X Axis",
  y: "Y Axis",
  z: "Z Axis",
};

function humanize(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim();
}

function humanizeControl(value: string): string {
  const normalized = value.trim().toLowerCase();
  return CONTROL_LABELS[normalized] ?? humanize(normalized);
}

function elementChildren(node: XmlElementNode, name?: string): XmlElementNode[] {
  return node.children.filter(
    (child): child is XmlElementNode =>
      child.type === "element" && (!name || child.name === name),
  );
}

function findChild(
  node: XmlElementNode,
  name: string,
  attribute: string,
  value: string,
): XmlElementNode | undefined {
  return elementChildren(node, name).find(
    (child) => child.attributes[attribute] === value,
  );
}

function domNodeToXmlNode(node: Node): XmlNode | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return { type: "text", value: node.nodeValue ?? "" };
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const element = node as Element;
  const attributes: Record<string, string> = {};
  for (const attribute of Array.from(element.attributes)) {
    attributes[attribute.name] = attribute.value;
  }

  return {
    type: "element",
    name: element.tagName,
    attributes,
    children: Array.from(element.childNodes)
      .map(domNodeToXmlNode)
      .filter((child): child is XmlNode => child !== null),
  };
}

export function parseKeybindXml(xml: string, sourceName?: string): KeybindProfile {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (
    document.getElementsByTagName("parsererror").length > 0 ||
    !document.documentElement ||
    document.documentElement.tagName !== "ActionMaps"
  ) {
    throw new Error("This file is not a valid Star Citizen ActionMaps profile.");
  }

  const root = domNodeToXmlNode(document.documentElement);
  if (!root || root.type !== "element") {
    throw new Error("The keybind profile has no readable root element.");
  }

  return {
    root,
    profileName: root.attributes.profileName ?? "Imported profile",
    sourceName,
  };
}

export function createEmptyKeybindProfile(): KeybindProfile {
  return {
    profileName: "New profile",
    root: {
      type: "element",
      name: "ActionMaps",
      attributes: {
        version: "1",
        optionsVersion: "2",
        rebindVersion: "2",
        profileName: "New profile",
      },
      children: [],
    },
  };
}

export function cloneKeybindProfile(profile: KeybindProfile): KeybindProfile {
  return {
    profileName: profile.profileName,
    sourceName: profile.sourceName,
    root: cloneXmlNode(profile.root) as XmlElementNode,
  };
}

function cloneXmlNode(node: XmlNode): XmlNode {
  if (node.type === "text") return { ...node };
  return {
    type: "element",
    name: node.name,
    attributes: { ...node.attributes },
    children: node.children.map(cloneXmlNode),
  };
}

export function serializeKeybindXml(profile: KeybindProfile): string {
  return serializeXmlNode(profile.root);
}

function escapeXml(value: string, attribute = false): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(attribute ? /"/g : /$^/g, "&quot;")
    .replace(attribute ? /'/g : /$^/g, "&apos;");
}

function serializeXmlNode(node: XmlNode): string {
  if (node.type === "text") return escapeXml(node.value);

  const attributes = Object.entries(node.attributes)
    .map(([name, value]) => ` ${name}="${escapeXml(value, true)}"`)
    .join("");
  if (node.children.length === 0) return `<${node.name}${attributes}/>`;

  return `<${node.name}${attributes}>${node.children
    .map(serializeXmlNode)
    .join("")}</${node.name}>`;
}

function parseInputToken(input: string): {
  device: KeybindDevice;
  deviceInstance?: string;
  display: string;
  isUnassigned: boolean;
} {
  const parts = input.split("+");
  const firstPart = parts[0]?.trim() ?? "";
  const match = firstPart.match(/^(kb|mo|gp|js)(\d*)_(.*)$/i);

  if (!match) {
    return {
      device: "unknown",
      display: input.trim() ? humanize(input) : "Unassigned",
      isUnassigned: !input.trim(),
    };
  }

  const [, prefix, instance, firstControl] = match;
  const device = prefix.toLowerCase() as KeybindDevice;
  const deviceLabel = DEVICE_LABELS[prefix.toLowerCase()] ?? "Device";
  const instanceLabel = instance ? ` ${instance}` : "";
  const isUnassigned = !firstControl.trim();
  const controls = [
    firstControl,
    ...parts.slice(1),
  ].map((part) => humanizeControl(part));
  const display = isUnassigned
    ? "Unassigned"
    : `${deviceLabel}${instanceLabel} · ${controls.join(" + ")}`;

  return {
    device: device as KeybindDevice,
    deviceInstance: instance || undefined,
    display,
    isUnassigned,
  };
}

export function decodeKeybindInput(input: string): Omit<KeybindBinding, "index" | "attributes" | "activationMode" | "multiTap"> {
  return {
    input,
    ...parseInputToken(input),
  };
}

function toBinding(node: XmlElementNode, index: number): KeybindBinding {
  const input = node.attributes.input ?? "";
  const decoded = decodeKeybindInput(input);
  return {
    index,
    input,
    attributes: { ...node.attributes },
    ...decoded,
    activationMode: node.attributes.activationMode,
    multiTap: node.attributes.multiTap,
  };
}

function toAction(mapName: string, node: XmlElementNode): KeybindAction {
  const name = node.attributes.name ?? "Unnamed action";
  return {
    mapName,
    name,
    label: humanize(name.replace(/^v_/, "")),
    bindings: elementChildren(node, "rebind").map(toBinding),
  };
}

export function getKeybindActionMaps(profile: KeybindProfile): KeybindActionMap[] {
  return elementChildren(profile.root, "actionmap").map((mapNode) => {
    const name = mapNode.attributes.name ?? "unnamed_map";
    return {
      name,
      label: humanize(name),
      actions: elementChildren(mapNode, "action").map((action) =>
        toAction(name, action),
      ),
    };
  });
}

export function getKeybindActions(profile: KeybindProfile): KeybindAction[] {
  return getKeybindActionMaps(profile).flatMap((map) => map.actions);
}

export function getKeybindCategories(profile: KeybindProfile): string[] {
  const categories = elementChildren(profile.root, "CustomisationUIHeader")
    .flatMap((header) => elementChildren(header, "categories"))
    .flatMap((container) => elementChildren(container, "category"));
  return categories
    .map((category) => category.attributes.label)
    .filter((label): label is string => Boolean(label));
}

function getActionNode(
  profile: KeybindProfile,
  mapName: string,
  actionName: string,
): XmlElementNode {
  const mapNode = findChild(profile.root, "actionmap", "name", mapName);
  const actionNode = mapNode && findChild(mapNode, "action", "name", actionName);
  if (!mapNode || !actionNode) {
    throw new Error(`Could not find action ${mapName}/${actionName}.`);
  }
  return actionNode;
}

function getRebindNodes(actionNode: XmlElementNode): XmlElementNode[] {
  return elementChildren(actionNode, "rebind");
}

export function updateKeybind(
  profile: KeybindProfile,
  mapName: string,
  actionName: string,
  bindingIndex: number,
  patch: BindingPatch,
): KeybindProfile {
  const next = cloneKeybindProfile(profile);
  const actionNode = getActionNode(next, mapName, actionName);
  const bindingNode = getRebindNodes(actionNode)[bindingIndex];
  if (!bindingNode) throw new Error("Could not find the selected binding.");

  if (patch.input !== undefined) bindingNode.attributes.input = patch.input;
  for (const [name, value] of Object.entries(patch.attributes ?? {})) {
    if (value === undefined) delete bindingNode.attributes[name];
    else bindingNode.attributes[name] = value;
  }
  return next;
}

export function addKeybind(
  profile: KeybindProfile,
  mapName: string,
  actionName: string,
  input: string,
  attributes: Record<string, string> = {},
): KeybindProfile {
  const next = cloneKeybindProfile(profile);
  const actionNode = getActionNode(next, mapName, actionName);
  actionNode.children.push({
    type: "element",
    name: "rebind",
    attributes: { input, ...attributes },
    children: [],
  });
  return next;
}

export function removeKeybind(
  profile: KeybindProfile,
  mapName: string,
  actionName: string,
  bindingIndex: number,
): KeybindProfile {
  const next = cloneKeybindProfile(profile);
  const actionNode = getActionNode(next, mapName, actionName);
  let seen = 0;
  const childIndex = actionNode.children.findIndex(
    (child) =>
      child.type === "element" &&
      child.name === "rebind" &&
      seen++ === bindingIndex,
  );
  if (childIndex < 0) throw new Error("Could not find the selected binding.");
  actionNode.children.splice(childIndex, 1);
  return next;
}

export function moveKeybind(
  profile: KeybindProfile,
  mapName: string,
  actionName: string,
  bindingIndex: number,
  direction: "up" | "down",
): KeybindProfile {
  const next = cloneKeybindProfile(profile);
  const actionNode = getActionNode(next, mapName, actionName);
  const bindingNodes = getRebindNodes(actionNode);
  const targetIndex = direction === "up" ? bindingIndex - 1 : bindingIndex + 1;
  if (!bindingNodes[bindingIndex] || !bindingNodes[targetIndex]) return next;

  const first = actionNode.children.indexOf(bindingNodes[bindingIndex]);
  const second = actionNode.children.indexOf(bindingNodes[targetIndex]);
  [actionNode.children[first], actionNode.children[second]] = [
    actionNode.children[second],
    actionNode.children[first],
  ];
  return next;
}

function fuzzyScore(query: string, candidate: string): number {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedCandidate = candidate.toLowerCase();
  if (!normalizedQuery) return 1;
  if (normalizedCandidate === normalizedQuery) return 1;
  if (normalizedCandidate.includes(normalizedQuery)) {
    return 0.8 + normalizedQuery.length / (normalizedCandidate.length * 10);
  }

  let cursor = 0;
  let score = 0;
  for (const character of normalizedQuery) {
    const found = normalizedCandidate.indexOf(character, cursor);
    if (found < 0) return 0;
    score += found === cursor ? 2 : 1 / (found - cursor + 1);
    cursor = found + 1;
  }
  return score / (normalizedQuery.length * 2);
}

export function searchKeybindActions(
  actions: KeybindAction[],
  query: string,
): KeybindAction[] {
  if (!query.trim()) return actions;

  return actions
    .map((action) => {
      const candidates = [
        [action.label, 1.2],
        [action.name, 1],
        [action.mapName, 0.8],
        ...action.bindings.flatMap((binding) => [
          [binding.display, 1.1] as const,
          [binding.input, 0.9] as const,
        ]),
      ] as Array<[string, number]>;
      const score = Math.max(
        ...candidates.map(([candidate, weight]) => fuzzyScore(query, candidate) * weight),
      );
      return { action, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .map(({ action }) => action);
}

export function keybindIncludesInput(
  bindingInput: string,
  capturedInput: string,
): boolean {
  const normalizedBinding = bindingInput.trim().toLowerCase();
  const normalizedCaptured = capturedInput.trim().toLowerCase();
  if (!normalizedBinding || !normalizedCaptured) return false;
  if (normalizedCaptured.includes("+")) {
    return normalizedBinding === normalizedCaptured;
  }

  const parts = normalizedBinding.split("+");
  const prefix = parts[0].match(/^(kb|mo|gp|js)\d+_/i)?.[0];
  return parts.some((part) => {
    const expandedPart =
      prefix && !part.match(/^(kb|mo|gp|js)\d+_/i)
        ? `${prefix}${part}`
        : part;
    return expandedPart === normalizedCaptured;
  });
}

export function getBindingConflicts(actions: KeybindAction[]): Set<string> {
  const counts = new Map<string, number>();
  for (const action of actions) {
    for (const binding of action.bindings) {
      if (!binding.isUnassigned) {
        counts.set(binding.input, (counts.get(binding.input) ?? 0) + 1);
      }
    }
  }
  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([input]) => input),
  );
}
