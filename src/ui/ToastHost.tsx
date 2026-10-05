import React, { useEffect, useRef, useState } from "react";
import { Box, Text } from "ink";
import { useScreenSystem } from "ink-cartridge";
import { container } from "../Container.js";
import TypedEventBus from "../core/TypedEventBus.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useTerminalSize } from "./TerminalSizeContext.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";

interface ToastEntry {
  id: number;
  textKey: string;
  kind: "info" | "success" | "warn";
}

const TOAST_WIDTH = 34;
const MAX_TOASTS = 4;

function colorFor(
  kind: ToastEntry["kind"],
  colors: ReturnType<typeof useThemeColors>,
): string {
  switch (kind) {
    case "success":
      return colors.success;
    case "warn":
      return colors.warning;
    default:
      return colors.info;
  }
}

/**
 * Renders sliding toast notifications in the top-right corner. Lives on its
 * own regular layer (`crossPage` so it survives navigation) — a small
 * showcase of ink-cartridge layers.
 */
function Toasts() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { columns } = useTerminalSize();
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const counter = useRef(0);

  useEffect(() => {
    const bus = container.resolve(TypedEventBus);
    const push = (textKey: string, kind: ToastEntry["kind"]) => {
      const id = ++counter.current;
      setToasts((prev) => [...prev, { id, textKey, kind }].slice(-MAX_TOASTS));
      setTimeout(() => {
        setToasts((prev) => prev.filter((e) => e.id !== id));
      }, 3200);
    };
    const offToast = bus.on("toast", ({ textKey, kind }) =>
      push(textKey, kind ?? "info"),
    );
    const offAch = bus.on("achievement:unlocked", ({ remindKey }) =>
      push(remindKey, "success"),
    );
    return () => {
      offToast();
      offAch();
    };
  }, []);

  const left = Math.max(0, columns - TOAST_WIDTH - 1);

  return (
    <Box position="absolute" top={0} left={left} width={TOAST_WIDTH} flexDirection="column">
      {toasts.map((toast) => (
        <Box
          key={toast.id}
          borderStyle="bold"
          borderColor={colorFor(toast.kind, colors)}
          paddingX={1}
          marginBottom={0}
        >
          <Text color={colorFor(toast.kind, colors)}>
            {toast.kind === "success" ? "★ " : "• "}
            {t(toast.textKey)}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

/** Opens a persistent toast layer and mounts the toast renderer on it. */
export function ToastHost() {
  const { openLayer, applyElement, closeLayer } = useScreenSystem();

  useEffect(() => {
    openLayer("toast-host", 5000, {
      crossPage: true,
      automaticTakeoverKeyboard: false,
    });
    applyElement("toast-host", { elementId: "toasts", element: Toasts });
    return () => closeLayer("toast-host");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
