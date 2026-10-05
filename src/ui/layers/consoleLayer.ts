import { container } from "../../Container.js";
import ConsoleStore from "../../core/console/ConsoleStore.js";
import ControlConsole from "../ControlConsole.js";
import { dismissModal, presentModal } from "./modalBus.js";
import { CONSOLE_LAYER_ID } from "./layerIds.js";

export function openConsole(): void {
  presentModal(CONSOLE_LAYER_ID, ControlConsole, { onClose: closeConsole }, 1200);
  const store = container.resolve(ConsoleStore);
  if (!store.getSnapshot().visible) store.toggle();
}

export function closeConsole(): void {
  dismissModal(CONSOLE_LAYER_ID);
  const store = container.resolve(ConsoleStore);
  if (store.getSnapshot().visible) store.toggle();
}

export function toggleConsole(): void {
  const store = container.resolve(ConsoleStore);
  if (store.getSnapshot().visible) closeConsole();
  else openConsole();
}
