import { startInputCapture } from "@/lib/keybind-capture";

describe("keybind input capture", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "getGamepads");
    vi.restoreAllMocks();
  });

  it("captures keyboard combinations as Star Citizen tokens", () => {
    const onPending = vi.fn();
    const stop = startInputCapture({
      device: "keyboard",
      onPending,
    });

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        code: "KeyQ",
        ctrlKey: true,
      }),
    );
    stop();

    expect(onPending).toHaveBeenCalledWith(
      expect.objectContaining({
        input: "kb1_lctrl+q",
        display: "Keyboard 1 · Left Ctrl + Q",
      }),
    );
  });

  it("captures mouse buttons and wheel directions", () => {
    const onPending = vi.fn();
    const stop = startInputCapture({
      device: "mouse",
      onPending,
    });

    window.dispatchEvent(new MouseEvent("mousedown", { button: 2 }));
    expect(onPending).toHaveBeenCalledWith(
      expect.objectContaining({ input: "mo1_mouse3" }),
    );

    const secondPending = vi.fn();
    const secondStop = startInputCapture({
      device: "mouse",
      onPending: secondPending,
    });
    window.dispatchEvent(new WheelEvent("wheel", { deltaY: -1 }));
    secondStop();
    stop();

    expect(secondPending).toHaveBeenCalledWith(
      expect.objectContaining({ input: "mo1_mwheel_up" }),
    );
  });

  it("chains inputs across devices while keeping the first candidate staged", () => {
    const onPending = vi.fn();
    const onComplete = vi.fn();
    const stop = startInputCapture({
      device: "all",
      onPending,
      onComplete,
    });

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyQ" }));
    window.dispatchEvent(new MouseEvent("mousedown", { button: 1 }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyQ" }));
    stop();

    expect(onPending).toHaveBeenLastCalledWith(
      expect.objectContaining({
        input: "kb1_q+mo1_mouse2",
        display: "Keyboard 1 · Q + Mouse 1 · Mouse 2",
      }),
    );
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ input: "kb1_q+mo1_mouse2" }),
    );
  });

  it("ignores an already-active joystick axis until it moves from its baseline", () => {
    const onPending = vi.fn();
    const gamepad = {
      id: "Test Stick",
      index: 0,
      buttons: [],
      axes: [1],
    } as unknown as Gamepad;
    let frame: FrameRequestCallback | undefined;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frame = callback;
      return 1;
    });
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [gamepad],
    });

    const stop = startInputCapture({
      device: "joystick",
      joystickInstance: "2",
      onPending,
    });
    for (let index = 0; index < 8; index += 1) frame?.(0);
    expect(onPending).not.toHaveBeenCalled();

    gamepad.axes[0] = 0.5;
    for (let index = 0; index < 3; index += 1) frame?.(0);
    stop();

    expect(onPending).toHaveBeenCalledWith(
      expect.objectContaining({ input: "js2_x" }),
    );
  });
});
