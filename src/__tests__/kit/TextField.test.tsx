import React, { useState } from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render } from "ink-testing-library";
import {
  CurrentScreen,
  KeyboardProvider,
  ScenarioManagementProvider,
  clearRegistry,
  registerComponent,
} from "ink-cartridge";
import { TextField } from "../../ui/kit/TextField.js";

const tick = () => new Promise((r) => setTimeout(r, 60));

let submitted: string[] = [];

function Screen() {
  const [value, setValue] = useState("");
  return (
    <TextField
      value={value}
      onChange={setValue}
      onSubmit={(v) => submitted.push(v)}
      focusId="field"
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

describe("TextField (ink-cartridge integration)", () => {
  beforeEach(() => {
    clearRegistry();
    registerComponent(Screen, {});
    submitted = [];
  });

  it("appends typed characters", async () => {
    const { lastFrame, stdin } = mount();
    await tick();
    stdin.write("h");
    await tick();
    stdin.write("i");
    await tick();
    expect(lastFrame()).toContain("hi");
  });

  it("backspace removes the last character", async () => {
    const { lastFrame, stdin } = mount();
    await tick();
    stdin.write("a");
    await tick();
    stdin.write("b");
    await tick();
    stdin.write("\u007F"); // backspace
    await tick();
    expect(lastFrame()).toContain("a");
    expect(lastFrame()).not.toContain("ab");
  });

  it("submits on Enter", async () => {
    const { stdin } = mount();
    await tick();
    stdin.write("ok");
    await tick();
    stdin.write("\r");
    await tick();
    expect(submitted).toEqual(["ok"]);
  });
});
