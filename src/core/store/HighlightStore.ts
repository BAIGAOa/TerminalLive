import { Scope, Scoped } from "di-wise";

type Listener = () => void

@Scoped(Scope.Container)
export default class HighlightStore {
    
    private activeId: string | null = null; 
    private listeners = new Set<Listener>();

    public subscribe = (listener: Listener) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    
    public getSnapshot = () => this.activeId;

    
    public setActive = (id: string) => {
        // 如果点击的是已经亮的，就关掉它；否则切换到新的 ID
        this.activeId = (this.activeId === id) ? null : id;
        this.listeners.forEach(fn => fn());
    };
}
