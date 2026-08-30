import { decodeKeybindInput } from "@/lib/keybind-parser";
import type { CapturedBinding, KeybindDevice } from "@/types/keybinds";

export type CaptureDevice = "all" | "keyboard" | "mouse" | "joystick";

export interface InputCaptureOptions {
  device: CaptureDevice;
  joystickInstance?: string;
  onPending: (binding: CapturedBinding) => void;
  onComplete?: (binding: CapturedBinding) => void;
  onStatus?: (message: string) => void;
  shouldIgnoreEvent?: (event: Event) => boolean;
}

export interface DetectedInputDevice {
  id: string;
  label: string;
  detail: string;
  device: KeybindDevice;
}

interface AxisCaptureState {
  baseline: number | null;
  samples: number[];
  activeFrames: number;
}

const KEY_CODE_LABELS: Record<string, string> = {
  Space: "space",
  Enter: "enter",
  Escape: "esc",
  Backspace: "backspace",
  Tab: "tab",
  CapsLock: "capslock",
  PageUp: "pgup",
  PageDown: "pgdn",
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Insert: "insert",
  Delete: "delete",
  Home: "home",
  End: "end",
  NumpadAdd: "add",
  NumpadSubtract: "subtract",
  NumpadMultiply: "multiply",
  NumpadDivide: "divide",
  NumpadDecimal: "decimal",
  Minus: "minus",
  Equal: "equals",
  BracketLeft: "lbracket",
  BracketRight: "rbracket",
  Backslash: "backslash",
  Semicolon: "semicolon",
  Quote: "quote",
  Backquote: "tilde",
  Comma: "comma",
  Period: "period",
  Slash: "slash",
};

function gamepadBindingInfo(gamepad: Gamepad): {
  prefix: string;
  device: KeybindDevice;
  instance: string;
} {
  const isStandardGamepad = gamepad.mapping === "standard";
  const instance = isStandardGamepad
    ? String(gamepad.index + 1)
    : String(Math.min(gamepad.index + 1, 2));
  return {
    prefix: `${isStandardGamepad ? "gp" : "js"}${instance}`,
    device: isStandardGamepad ? "gamepad" : "joystick",
    instance,
  };
}

export function getDetectedInputDevices(): DetectedInputDevice[] {
  const devices: DetectedInputDevice[] = [
    {
      id: "keyboard",
      label: "Keyboard",
      detail: "Ready to capture",
      device: "keyboard",
    },
    {
      id: "mouse",
      label: "Mouse",
      detail: "Ready to capture",
      device: "mouse",
    },
  ];
  const gamepads = navigator.getGamepads?.() ?? [];
  gamepads.forEach((gamepad, index) => {
    if (!gamepad) return;
    const info = gamepadBindingInfo(gamepad);
    devices.push({
      id: `gamepad-${gamepad.index}`,
      label: gamepad.id || `Joystick ${index + 1}`,
      detail: `${info.device === "gamepad" ? "Gamepad" : "Joystick"} slot ${info.prefix}`,
      device: info.device,
    });
  });
  return devices;
}

function keyCodeToToken(code: string): string {
  if (KEY_CODE_LABELS[code]) return KEY_CODE_LABELS[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(-1).toLowerCase();
  if (/^Digit\d$/.test(code)) return code.slice(-1);
  if (/^Numpad\d$/.test(code)) return `num${code.slice(-1)}`;
  if (/^F\d{1,2}$/.test(code)) return code.toLowerCase();
  return code.replace(/Left|Right/g, "").toLowerCase();
}

function modifierTokens(event: KeyboardEvent): string[] {
  const modifiers: string[] = [];
  if (event.ctrlKey && !["ControlLeft", "ControlRight"].includes(event.code)) {
    modifiers.push("lctrl");
  }
  if (event.altKey && !["AltLeft", "AltRight"].includes(event.code)) {
    modifiers.push("lalt");
  }
  if (event.shiftKey && !["ShiftLeft", "ShiftRight"].includes(event.code)) {
    modifiers.push("lshift");
  }
  if (event.metaKey && !["MetaLeft", "MetaRight"].includes(event.code)) {
    modifiers.push("lwin");
  }
  return modifiers;
}

function keyboardBinding(event: KeyboardEvent): string {
  const modifier = {
    ControlLeft: "lctrl",
    ControlRight: "rctrl",
    AltLeft: "lalt",
    AltRight: "ralt",
    ShiftLeft: "lshift",
    ShiftRight: "rshift",
    MetaLeft: "lwin",
    MetaRight: "rwin",
  }[event.code];
  const tokens = [...modifierTokens(event)];
  if (modifier) tokens.push(modifier);
  else tokens.push(keyCodeToToken(event.code));
  return `kb1_${tokens.join("+")}`;
}

function captured(input: string, device: KeybindDevice, deviceInstance?: string): CapturedBinding {
  return {
    input,
    device,
    deviceInstance,
    display: decodeKeybindInput(input).display,
  };
}

function combineBindings(
  bindings: CapturedBinding[],
): CapturedBinding {
  const first = bindings[0];
  const input = bindings.reduce((combined, binding, index) => {
    if (index === 0) return binding.input;
    const firstPrefix = combined.match(/^(kb|mo|gp|js)\d+_/i)?.[0];
    const nextPrefix = binding.input.match(/^(kb|mo|gp|js)\d+_/i)?.[0];
    const nextInput =
      firstPrefix && nextPrefix?.toLowerCase() === firstPrefix.toLowerCase()
        ? binding.input.slice(nextPrefix.length)
        : binding.input;
    return `${combined}+${nextInput}`;
  }, "");
  return {
    input,
    device: first.device,
    deviceInstance: first.deviceInstance,
    display: bindings.map((binding) => binding.display).join(" + "),
  };
}

export function startInputCapture(options: InputCaptureOptions): () => void {
  let stopped = false;
  let frameId: number | undefined;
  const previousButtons = new Map<string, boolean>();
  const axisStates = new Map<string, AxisCaptureState>();
  const activeGamepadKeys = new Map<number, string>();
  const pendingBindings: CapturedBinding[] = [];
  let lastStatus = "";
  const reportStatus = (message: string) => {
    if (message === lastStatus) return;
    lastStatus = message;
    options.onStatus?.(message);
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("wheel", onWheel);
    if (frameId !== undefined) window.cancelAnimationFrame(frameId);
  };

  const stage = (binding: CapturedBinding) => {
    if (stopped || pendingBindings.some((pending) => pending.input === binding.input)) return;
    pendingBindings.push(binding);
    options.onPending(combineBindings(pendingBindings));
  };

  const complete = () => {
    if (stopped || pendingBindings.length === 0 || !options.onComplete) return;
    const binding = combineBindings(pendingBindings);
    stop();
    options.onComplete(binding);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (options.shouldIgnoreEvent?.(event)) return;
    if (event.repeat) return;
    if (
      ["ControlLeft", "ControlRight", "AltLeft", "AltRight", "ShiftLeft", "ShiftRight", "MetaLeft", "MetaRight"].includes(
        event.code,
      )
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    stage(captured(keyboardBinding(event), "keyboard", "1"));
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (options.shouldIgnoreEvent?.(event)) return;
    if (event.repeat) return;
    complete();
  };

  const onMouseDown = (event: MouseEvent) => {
    if (options.shouldIgnoreEvent?.(event)) return;
    event.preventDefault();
    event.stopPropagation();
    stage(captured(`mo1_mouse${event.button + 1}`, "mouse", "1"));
  };

  const onMouseUp = (event: MouseEvent) => {
    if (options.shouldIgnoreEvent?.(event)) return;
    complete();
  };

  const onWheel = (event: WheelEvent) => {
    if (options.shouldIgnoreEvent?.(event)) return;
    event.preventDefault();
    event.stopPropagation();
    stage(
      captured(`mo1_mwheel_${event.deltaY < 0 ? "up" : "down"}`, "mouse", "1"),
    );
  };

  const pollGamepad = () => {
    if (stopped) return;
    const gamepads = (navigator.getGamepads?.() ?? []).filter(
      (gamepad): gamepad is Gamepad => Boolean(gamepad),
    );
    if (gamepads.length === 0) {
      reportStatus("Keyboard and mouse are ready; no joystick or gamepad is detected.");
      frameId = window.requestAnimationFrame(pollGamepad);
      return;
    }

    const detected = gamepads
      .map((gamepad) => {
        const baseInfo = gamepadBindingInfo(gamepad);
        const info =
          baseInfo.device === "joystick" && options.joystickInstance
            ? {
                ...baseInfo,
                instance: options.joystickInstance,
                prefix: `js${options.joystickInstance}`,
              }
            : baseInfo;
        return `${gamepad.id || info.device} → ${info.prefix}`;
      })
      .join(", ");
    reportStatus(
      `Detected ${detected}. Axis input starts from a baseline; move it after listening begins.`,
    );

    for (const gamepad of gamepads) {
      const baseInfo = gamepadBindingInfo(gamepad);
      const info =
        baseInfo.device === "joystick" && options.joystickInstance
          ? {
              ...baseInfo,
              instance: options.joystickInstance,
              prefix: `js${options.joystickInstance}`,
            }
          : baseInfo;
      const gamepadKey = `${gamepad.index}:${gamepad.id}:${gamepad.mapping}`;
      if (gamepadKey !== activeGamepadKeys.get(gamepad.index)) {
        activeGamepadKeys.set(gamepad.index, gamepadKey);
        for (const key of previousButtons.keys()) {
          if (key.startsWith(`${gamepad.index}:`)) previousButtons.delete(key);
        }
        for (const key of axisStates.keys()) {
          if (key.startsWith(`${gamepad.index}:`)) axisStates.delete(key);
        }
      }

      gamepad.buttons.forEach((button, index) => {
        const key = `${gamepad.index}:button:${index}`;
        const wasPressed = previousButtons.get(key);
        previousButtons.set(key, button.pressed);
        if (wasPressed !== undefined && button.pressed && !wasPressed) {
          stage(
            captured(
              `${info.prefix}_button${index + 1}`,
              info.device,
              info.instance,
            ),
          );
        }
        if (wasPressed && !button.pressed) complete();
      });

      const axisNames = ["x", "y", "z", "rotx", "roty", "rotz"];
      gamepad.axes.forEach((value, index) => {
        const key = `${gamepad.index}:axis:${index}`;
        const state = axisStates.get(key) ?? {
          baseline: null,
          samples: [],
          activeFrames: 0,
        };
        if (state.baseline === null) {
          state.samples.push(value);
          if (state.samples.length >= 8) {
            state.baseline =
              state.samples.reduce((total, sample) => total + sample, 0) /
              state.samples.length;
          }
          axisStates.set(key, state);
          return;
        }

        const movedFromBaseline = Math.abs(value - state.baseline) > 0.28;
        const wasMoved = state.activeFrames > 0;
        state.activeFrames = movedFromBaseline ? state.activeFrames + 1 : 0;
        axisStates.set(key, state);
        if (wasMoved && !movedFromBaseline) complete();
        if (state.activeFrames >= 3) {
          const axisName = axisNames[index] ?? `axis${index}`;
          stage(captured(`${info.prefix}_${axisName}`, info.device, info.instance));
        }
      });
    }

    if (!stopped) frameId = window.requestAnimationFrame(pollGamepad);
  };

  if (options.device === "all" || options.device === "keyboard") {
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup", onKeyUp, { capture: true });
  }
  if (options.device === "all" || options.device === "mouse") {
    window.addEventListener("mousedown", onMouseDown, { capture: true });
    window.addEventListener("mouseup", onMouseUp, { capture: true });
    window.addEventListener("wheel", onWheel, { capture: true, passive: false });
  }
  if (options.device === "all") {
    reportStatus(
      navigator.getGamepads
      ? "Press a key, click the mouse, or move a connected joystick. Keep it held to chain another input."
        : "Keyboard and mouse are ready. This browser does not expose the Gamepad API.",
    );
  } else if (options.device === "keyboard") {
    reportStatus("Press a key or key combination.");
  } else if (options.device === "mouse") {
    reportStatus("Click a mouse button or scroll the wheel.");
  } else if (navigator.getGamepads) {
    reportStatus("Connect a joystick, then press a button or move an axis.");
  } else {
    reportStatus("This browser does not expose the Gamepad API.");
  }
  if ((options.device === "all" || options.device === "joystick") && navigator.getGamepads) {
    frameId = window.requestAnimationFrame(pollGamepad);
  }

  return stop;
}
