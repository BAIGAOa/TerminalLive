import { Scope, Scoped } from "di-wise";
import { SCENES } from "../../types/Scenes.js";

type Listener = () => void;


@Scoped(Scope.Container)
export default class ScreenStore {
  private currentScene: string = SCENES.menu;
  private listeners = new Set<Listener>();

  public subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public getSnapshot = () => this.currentScene;

  public setScene = (scene: string) => {
    this.currentScene = scene;
    this.listeners.forEach((fn) => fn());
  };
}