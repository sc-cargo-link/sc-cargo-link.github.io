import sampleXml from "../../../samples/keybind.xml?raw";
import {
  addKeybind,
  decodeKeybindInput,
  createEmptyKeybindProfile,
  getBindingConflicts,
  getKeybindActionMaps,
  getKeybindActions,
  keybindIncludesInput,
  moveKeybind,
  parseKeybindXml,
  removeKeybind,
  searchKeybindActions,
  serializeKeybindXml,
  updateKeybind,
} from "@/lib/keybind-parser";

describe("keybind parser", () => {
  it("creates an empty profile without bundled actions", () => {
    const profile = createEmptyKeybindProfile();

    expect(profile.profileName).toBe("New profile");
    expect(getKeybindActionMaps(profile)).toEqual([]);
    expect(serializeKeybindXml(profile)).toContain('profileName="New profile"');
  });

  it("parses the bundled ActionMaps profile", () => {
    const profile = parseKeybindXml(sampleXml, "keybind.xml");
    const maps = getKeybindActionMaps(profile);

    expect(profile.profileName).toBe("0my-duel");
    expect(profile.sourceName).toBe("keybind.xml");
    expect(maps.length).toBeGreaterThan(20);
    expect(getKeybindActions(profile).length).toBeGreaterThan(80);
    expect(maps[0].actions[0].bindings[0].display).toContain("Joystick 2");
  });

  it("keeps whitespace-sensitive unassigned values and unknown attributes", () => {
    const profile = parseKeybindXml(
      '<ActionMaps profileName="test"><custom data-value="keep"><child/></custom><actionmap name="test_map"><action name="test_action"><rebind input="gp1_ " future="yes"/></action></actionmap></ActionMaps>',
    );
    const action = getKeybindActions(profile)[0];

    expect(action.bindings[0].input).toBe("gp1_ ");
    expect(action.bindings[0].isUnassigned).toBe(true);
    expect(serializeKeybindXml(profile)).toContain('future="yes"');
    expect(serializeKeybindXml(profile)).toContain('input="gp1_ "');
  });

  it("rejects malformed or unrelated XML", () => {
    expect(() => parseKeybindXml("<ActionMaps>")).toThrow();
    expect(() => parseKeybindXml("<OtherRoot />")).toThrow();
  });

  it("round-trips and edits individual bindings without changing other bindings", () => {
    const profile = parseKeybindXml(
      '<ActionMaps profileName="test"><actionmap name="flight"><action name="boost"><rebind input="kb1_space"/><rebind input="js1_button1" activationMode="double_tap"/></action></actionmap></ActionMaps>',
    );
    const updated = updateKeybind(profile, "flight", "boost", 0, {
      input: "mo1_mouse1",
      attributes: { activationMode: "press" },
    });
    const added = addKeybind(updated, "flight", "boost", "kb1_lshift");
    const moved = moveKeybind(added, "flight", "boost", 2, "up");
    const removed = removeKeybind(moved, "flight", "boost", 2);
    const action = getKeybindActions(removed)[0];

    expect(action.bindings.map((binding) => binding.input)).toEqual([
      "mo1_mouse1",
      "kb1_lshift",
    ]);
    expect(action.bindings[0].attributes.activationMode).toBe("press");
    expect(getKeybindActions(parseKeybindXml(serializeKeybindXml(removed)))[0].bindings)
      .toHaveLength(2);
  });

  it("decodes common devices and ranks fuzzy matches", () => {
    expect(decodeKeybindInput("kb1_lalt+pgup").display).toBe(
      "Keyboard 1 · Left Alt + Page Up",
    );
    expect(decodeKeybindInput("mo1_ ").display).toBe("Unassigned");

    const actions = getKeybindActions(
      parseKeybindXml(
        '<ActionMaps><actionmap name="spaceship_movement"><action name="v_afterburner"><rebind input="js2_button1"/></action><action name="v_autoland"><rebind input="kb1_l"/></action></actionmap></ActionMaps>',
      ),
    );
    expect(searchKeybindActions(actions, "after").map((action) => action.name)).toEqual([
      "v_afterburner",
    ]);
  });

  it("matches a captured input inside a combination", () => {
    expect(keybindIncludesInput("js1_rctrl+button22", "js1_button22")).toBe(true);
    expect(keybindIncludesInput("kb1_lalt+pgup", "kb1_pgup")).toBe(true);
    expect(keybindIncludesInput("js1_rctrl+button22", "js1_button1")).toBe(false);
    expect(keybindIncludesInput("kb1_lalt+pgup", "kb1_lalt+pgup")).toBe(true);
  });

  it("finds duplicate assigned inputs while ignoring unassigned placeholders", () => {
    const actions = getKeybindActions(
      parseKeybindXml(
        '<ActionMaps><actionmap name="flight"><action name="one"><rebind input="js1_button1"/></action><action name="two"><rebind input="js1_button1"/></action><action name="three"><rebind input="gp1_ "/></action></actionmap></ActionMaps>',
      ),
    );
    expect(getBindingConflicts(actions)).toEqual(new Set(["js1_button1"]));
  });
});
