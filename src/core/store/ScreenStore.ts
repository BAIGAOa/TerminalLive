import { Scope, Scoped } from "di-wise";
import { Scenes } from '../../types/Scenes.js';

type Listener = () => void;


@Scoped(Scope.Container)
export default class ScreenStore {
    private currentScene: Scenes = Scenes.menu;
    private listeners = new Set<Listener>();

    public subscribe = (listener: Listener) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    public getSnapshot = () => this.currentScene;

    // 切换场景的方法
    public setScene = (scene: Scenes) => {
        this.currentScene = scene;
        this.listeners.forEach(fn => fn());
    };
}
