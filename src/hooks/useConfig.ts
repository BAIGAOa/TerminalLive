import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { container } from "../Container.js";
import JSONparsing from "../core/json/JSONparsing.js";
import {
  KeysConfig,
  keysConfigScheme,
} from "../types/KeyboardMappingFormat.js";
import KeyboardMonitor from "../core/keys/KeyboardMonitor.js";
import KeysCenter from "../core/keys/KeysCenter.js";
import { useI18n } from "../core/language/LanguageContext.js";

// ============================================================
// 类型定义
// ============================================================

export type ConfigStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; config: KeysConfig }
  | { kind: "recording"; config: KeysConfig; editingOperate: string }
  | { kind: "saving"; config: KeysConfig }
  | { kind: "error"; config: KeysConfig; message: string };

export type FocusPanel = "left" | "right";

export interface SceneMenuItem {
  label: string;
  value: string;
}

export interface ConfigItem {
  label: string;
  value: string;
  title: string;
  text: string;
  width: string | number;
  borderColor: string;
  highLightColor: string;
  keyName: string;
  operate: string;
  isBack?: boolean;
}

export interface ConfigData {
  status: ConfigStatus;
  leftItems: SceneMenuItem[];
  rightItems: ConfigItem[];
  focus: FocusPanel;
  activeScene: string | null;
  isLeftFocused: boolean;
  isRightFocused: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  onSelectScene: (item: SceneMenuItem) => void;
  onSelectBinding: (item: ConfigItem) => void;
  onKeyPress: (
    input: string,
    key: {
      return?: boolean;
      escape?: boolean;
      backspace?: boolean;
      upArrow?: boolean;
      downArrow?: boolean;
      leftArrow?: boolean;
      rightArrow?: boolean;
      ctrl?: boolean;
      shift?: boolean;
      meta?: boolean;
    },
  ) => void;
}

// ============================================================
// 工具函数
// ============================================================

function normalizeKey(
  input: string,
  key: {
    return?: boolean;
    escape?: boolean;
    backspace?: boolean;
    upArrow?: boolean;
    downArrow?: boolean;
    leftArrow?: boolean;
    rightArrow?: boolean;
    ctrl?: boolean;
    shift?: boolean;
    meta?: boolean;
  },
): string {
  if (key.return) return "return";
  if (key.escape) return "escape";
  if (key.backspace) return "backspace";
  if (key.upArrow) return "up";
  if (key.downArrow) return "down";
  if (key.leftArrow) return "left";
  if (key.rightArrow) return "right";

  if (!input) return "";

  if (key.ctrl) return `ctrl+${input}`;
  if (key.shift && input.length > 1) return `shift+${input}`;
  if (key.meta) return `meta+${input}`;

  return input;
}

/** 场景名翻译——回退到枚举值 */
function translateScene(
  scene: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const key = `scene.${scene}`;
  const translated = t(key);
  // 如果翻译 key 没命中，返回枚举值首字母大写
  return translated === key
    ? scene.charAt(0).toUpperCase() + scene.slice(1)
    : translated;
}

/** 从 KeysConfig 提取所有不重复的场景 */
function buildSceneMenu(config: KeysConfig): string[] {
  const set = new Set<string>();
  for (const item of config.keys) {
    const categories: string[] = Array.isArray(item.category)
      ? item.category
      : [item.category];
    for (const cat of categories) {
      set.add(cat);
    }
  }
  return Array.from(set);
}

/** 从 KeysConfig 构建指定场景的 UI 列表 */
function buildFilteredItems(
  config: KeysConfig,
  scene: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): ConfigItem[] {
  const filtered = config.keys.filter((item) => {
    const categories: string[] = Array.isArray(item.category)
      ? item.category
      : [item.category];
    return categories.includes(scene);
  });

  const items: ConfigItem[] = filtered.map((item) => ({
    label: item.operate,
    value: item.operate,
    title: t(`key-${item.operate}`, {}),
    text: item.keyName,
    width: "100%" as const,
    borderColor: "yellow",
    highLightColor: "green",
    keyName: item.keyName,
    operate: item.operate,
  }));

  return items;
}

// ============================================================
// Hook
// ============================================================

export function useConfig(
  onConfigChange?: (newMonitor: KeyboardMonitor) => void,
  onBack?: () => void,
): ConfigData {
  const { t } = useI18n();
  const [status, setStatus] = useState<ConfigStatus>({ kind: "loading" });
  const [focus, setFocus] = useState<FocusPanel>("left");
  const [activeScene, setActiveScene] = useState<string | null>(null);
  const jsonParser = useRef(new JSONparsing("keys.json"));

  // 加载配置
  useEffect(() => {
    jsonParser.current
      .loadingConfig(keysConfigScheme)
      .then((config) => setStatus({ kind: "ready", config }))
      .catch((err) =>
        setStatus({
          kind: "error",
          config: { keys: [] },
          message: err.message,
        }),
      );
  }, []);

  // 录制时挂起全局键盘监听
  useEffect(() => {
    KeyboardMonitor.isSuspended = status.kind === "recording";
    return () => {
      KeyboardMonitor.isSuspended = false;
    };
  }, [status.kind]);

  // 左侧场景列表
  const leftItems: SceneMenuItem[] = useMemo(() => {
    if (
      status.kind === "ready" ||
      status.kind === "recording" ||
      status.kind === "saving" ||
      status.kind === "error"
    ) {
      const scenes = buildSceneMenu(status.config);
      return scenes.map((scene) => ({
        label: translateScene(scene, t),
        value: scene,
      }));
    }
    return [];
  }, [status, t]);

  // 右侧绑定列表
  const rightItems: ConfigItem[] = useMemo(() => {
    if (
      activeScene &&
      (status.kind === "ready" ||
        status.kind === "recording" ||
        status.kind === "saving" ||
        status.kind === "error")
    ) {
      return buildFilteredItems(status.config, activeScene, t);
    }
    return [];
  }, [status, activeScene, t]);

  // 事件处理

  /** 左侧选择场景切换到右侧 */
  const onSelectScene = useCallback((item: SceneMenuItem) => {
    setActiveScene(item.value);
    setFocus("right");
  }, []);

  /** 右侧选择绑定进入录制 */
  const onSelectBinding = useCallback(
    (item: ConfigItem) => {
      if (status.kind !== "ready" && status.kind !== "error") return;

      setStatus((prev) =>
        prev.kind === "ready" || prev.kind === "error"
          ? {
              kind: "recording",
              config: prev.config,
              editingOperate: item.value,
            }
          : prev,
      );
    },
    [status.kind],
  );

  /** 全局录制ESC切换焦点 */
  const onKeyPress = useCallback(
    async (input: string, key: Parameters<typeof normalizeKey>[1]) => {
      //录制模式
      if (status.kind === "recording") {
        const newKeyName = normalizeKey(input, key);
        if (!newKeyName) return;

        const currentConfig = status.config;
        const editingOperate = status.editingOperate;

        setStatus({ kind: "saving", config: currentConfig });

        const newKeys = currentConfig.keys.map((item) =>
          item.operate === editingOperate
            ? { ...item, keyName: newKeyName }
            : item,
        );
        const newConfig: KeysConfig = { keys: newKeys };

        try {
          await jsonParser.current.saveConfig(newConfig, keysConfigScheme);

          const keysCenter = container.resolve(KeysCenter);
          const monitor = await KeyboardMonitor.create("keys.json", keysCenter);
          onConfigChange?.(monitor);

          setStatus({ kind: "ready", config: newConfig });
        } catch (err: any) {
          try {
            await jsonParser.current.saveConfig(
              currentConfig,
              keysConfigScheme,
            );
          } catch {
            console.error("磁盘回退失败");
          }
          setStatus({
            kind: "error",
            config: currentConfig,
            message: (err as Error).message,
          });
        }
        return;
      }

      // 非录制模式
      if (key.escape) {
        if (focus === "right") {
          setFocus("left");
        } else if (focus === "left") {
          onBack?.();
        }
      }
    },
    [status, focus, onConfigChange, onBack],
  );

  // 派生
  const isRecording = status.kind === "recording" || status.kind === "saving";

  return {
    status,
    leftItems,
    rightItems,
    focus,
    activeScene,
    isLeftFocused: focus === "left" && !isRecording,
    isRightFocused: focus === "right" && !isRecording,
    t,
    onSelectScene,
    onSelectBinding,
    onKeyPress,
  };
}
