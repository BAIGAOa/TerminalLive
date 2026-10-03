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
