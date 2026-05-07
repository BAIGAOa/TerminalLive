import { useEffect, useRef } from "react";
import {
  KeyboardManager,
  KeyHandler,
} from "../../core/keys/KeyBoardManager.js";
import { container } from "../../Container.js";

// deps 变化时重新注册 保证处理器内部引用的状态最新
export function useKeyboardHandler(handler: KeyHandler, deps: any[] = []) {
  const manager = container.resolve(KeyboardManager);
  const handlerRef = useRef(handler);
  handlerRef.current = handler; // 保持最新引用

  useEffect(() => {
    // 每次包装一个新的函数 这样 push/remove 可以正确匹配
    const wrapped: KeyHandler = (input, key) => handlerRef.current(input, key);
    manager.push(wrapped);
    return () => manager.remove(wrapped);
  }, [manager, ...deps]);
}
