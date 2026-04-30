import { Scope, Scoped } from "di-wise";
import { GameViveModes } from "../../types/GameViveModeType.js";

type Listener = () => void;

@Scoped(Scope.Container)
export default class GameViewStore {
    private view: GameViveModes = GameViveModes.attributes;
    private listeners: Set<Listener> = new Set()

    public subscribe = (listener: Listener) => {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    public getSnapshot = () => this.view;

    public setView = (view: GameViveModes) => {
        this.view = view;
        this.listeners.forEach(fn => fn());
    }

}
