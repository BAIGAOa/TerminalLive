/**
 * Compares a plain useMouseRegion box against MenuList, side by side.
 *   node scripts/mouse-probe.mjs
 */
import React from "react";
import { Box, Text, render } from "ink";
import {
  CurrentScreen,
  KeyboardProvider,
  ScenarioManagementProvider,
  registerComponent,
  useMouseRegion,
} from "ink-cartridge";
import { MenuList } from "../dist/ui/kit/MenuList.js";

const h = React.createElement;
let chosen = "none";
let plain = "none";

function PlainButton() {
  const [hover, setHover] = React.useState(false);
  const ref = useMouseRegion(
    {
      onClick: () => {
        plain = "CLICKED";
      },
      onEnter: () => setHover(true),
      onLeave: () => setHover(false),
    },
    { priority: 1 },
  );
  return h(
    Box,
    { ref, borderStyle: "round", borderColor: hover ? "green" : "gray" },
    h(Text, null, "PLAIN-BUTTON"),
  );
}

function Screen() {
  const [, force] = React.useState(0);
  return h(
    Box,
    { flexDirection: "column", padding: 2 },
    h(Text, null, `PLAIN=${plain} CHOSEN=${chosen}`),
    h(PlainButton),
    h(MenuList, {
      focusId: "probe",
      items: [
        { value: "a", label: "AAAA" },
        { value: "b", label: "BBBB" },
      ],
      onSelect: (item) => {
        chosen = item.value;
        force((n) => n + 1);
      },
    }),
  );
}
registerComponent(Screen, {});

render(
  h(
    ScenarioManagementProvider,
    { defaultScreen: Screen, fullScreen: true },
    h(KeyboardProvider, { mouse: true }, h(CurrentScreen)),
  ),
);
