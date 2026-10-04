import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render } from "ink-testing-library";
import {
  CurrentScreen,
  KeyboardProvider,
  ScenarioManagementProvider,
  clearRegistry,
  registerComponent,
} from "ink-cartridge";
import { MenuList } from "../../ui/kit/MenuList.js";

const tick = () => new Promise((r) => setTimeout(r, 60));

let picks: string[] = [];
let highlights: string[] = [];

function Screen() {
  return (
    <MenuList
      focusId="test-menu"
      items={[
        { value: "a", label: "Alpha" },
        { value: "b", label: "Beta" },
        { value: "c", label: "Gamma" },
      ]}
      onSelect={(it) => picks.push(it.value)}
      onChange={(it) => highlights.push(it.value)}
    />
  );
}

function mount() {
  return render(
    <ScenarioManagementProvider defaultScreen={Screen}>
      <KeyboardProvider mouse>
        <CurrentScreen />
      </KeyboardProvider>
    </ScenarioManagementProvider>,
  );
}

describe("MenuList (ink-cartridge integration)", () => {
  beforeEach(() => {
    clearRegistry();
    registerComponent(Screen, {});
    picks = [];
    highlights = [];
  });

  it("auto-activates the first focus target so arrow keys move the highlight", async () => {
    const { lastFrame, stdin } = mount();
    await tick();
    expect(lastFrame()).toContain("❯");
    expect(lastFrame()).toContain("Alpha");

    stdin.write("\u001B[B"); // down arrow
    await tick();
    expect(lastFrame()).toContain("Beta");
  });

  it("Enter activates the highlighted row", async () => {
    const { stdin } = mount();
    await tick();
    stdin.write("\u001B[B"); // down -> Beta
    await tick();
    stdin.write("\r"); // enter
    await tick();
    expect(picks).toEqual(["b"]);
  });

  it("wraps from the first row up to the last", async () => {
    const { lastFrame, stdin } = mount();
    await tick();
    stdin.write("\u001B[A"); // up from Alpha wraps to Gamma
    await tick();
    expect(lastFrame()).toContain("Gamma");
  });

  it("reports highlight changes", async () => {
    const { stdin } = mount();
    await tick();
    stdin.write("\u001B[B");
    await tick();
    expect(highlights).toContain("b");
  });
});

describe("MenuList grid mode", () => {
  function GridScreen() {
    return (
      <MenuList
        focusId="grid-menu"
        columns={2}
        columnWidth={10}
        indicator={null}
        items={[
          { value: "a", label: "Alpha" },
          { value: "b", label: "Beta" },
          { value: "c", label: "Gamma" },
          { value: "d", label: "Delta" },
        ]}
        onSelect={(it) => picks.push(it.value)}
        onChange={(it) => highlights.push(it.value)}
      />
    );
  }

  function mountGrid() {
    return render(
      <ScenarioManagementProvider defaultScreen={GridScreen}>
        <KeyboardProvider mouse>
          <CurrentScreen />
        </KeyboardProvider>
      </ScenarioManagementProvider>,
    );
  }

  beforeEach(() => {
    clearRegistry();
    registerComponent(GridScreen, {});
    picks = [];
    highlights = [];
  });

  it("renders every label without the ❯ marker", async () => {
    const { lastFrame } = mountGrid();
    await tick();
    const frame = lastFrame() ?? "";
    for (const label of ["Alpha", "Beta", "Gamma", "Delta"]) {
      expect(frame).toContain(label);
    }
    expect(frame).not.toContain("❯");
  });

  it("right/left move by one, up/down move by a row", async () => {
    const { stdin } = mountGrid();
    await tick();
    stdin.write("\u001B[C"); // right -> b
    await tick();
    expect(highlights.at(-1)).toBe("b");
    stdin.write("\u001B[B"); // down -> d (b + 2)
    await tick();
    expect(highlights.at(-1)).toBe("d");
    stdin.write("\u001B[A"); // up -> b (d - 2)
    await tick();
    expect(highlights.at(-1)).toBe("b");
  });
});
