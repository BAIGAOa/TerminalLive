import { useState, useCallback, useMemo } from "react";
import { container } from "../Container.js";
import Player from "../world/Player.js";
import ConfigStore from "../core/store/ConfigStore.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useTerminalSize } from "../ui/TerminalSizeContext.js";
import { PlayerConfigType } from "../types/ConfigType.js";



export enum PlayerConfigCategory {
  basic = "basic",
  physical = "physical",
  psychological = "psychological",
  wealth = "wealth",
}


export interface PlayerAttributeMeta {
  key: keyof PlayerConfigType; // 对应 PlayerConfigType 中的字段名
  type: "string" | "number"; // 字段名的类型
  min?: number; 
  max?: number;
}

// 所有分类与其包含属性的映射表
// 用于后续的输入验证和生成右侧属性列表
const ATTRIBUTE_META: Record<PlayerConfigCategory, PlayerAttributeMeta[]> = {
  [PlayerConfigCategory.basic]: [{ key: "playerName", type: "string" }],
  [PlayerConfigCategory.physical]: [
    { key: "age", type: "number", min: 0, max: 150 },
    { key: "health", type: "number", min: 0, max: 100 },
    { key: "height", type: "number", min: 0.5, max: 3 },
    { key: "weight", type: "number", min: 1, max: 500 },
  ],
  [PlayerConfigCategory.psychological]: [
    { key: "angerValue", type: "number", min: 0, max: 100 },
    { key: "excitationValue", type: "number", min: 0, max: 100 },
    { key: "depressionValue", type: "number", min: 0, max: 100 },
    { key: "weakValue", type: "number", min: 0, max: 100 },
  ],
  [PlayerConfigCategory.wealth]: [{ key: "fortune", type: "number", min: 0 }],
};


export interface CategoryMenuItem {
  label: string;
  value: PlayerConfigCategory;
}


export interface AttributeItem {
  label: string; //属性的本地化名称
  value: string; // 属性的键，也就是PlayerConfig的属性
  currentValue: string; //当前值的字符串表示
}

export type FocusPanel = "left" | "right";

export interface PlayerConfigData {
  leftItems: CategoryMenuItem[]; 
  rightItems: AttributeItem[];
  focus: FocusPanel;
  activeCategory: PlayerConfigCategory | null;
  isLeftFocused: boolean;
  isRightFocused: boolean;
  isEditing: boolean;
  editingKey: string | null;
  editingLabel: string;
  editValue: string;
  validationError: string | null;
  successMessage: string | null;
  rows: number;
  t: (key: string, params?: Record<string, string | number>) => string;
  onSelectCategory: (item: CategoryMenuItem) => void;
  onSelectAttribute: (item: AttributeItem) => void;
  onEditChange: (value: string) => void;
  onSubmitEdit: () => void;
  onCancelEdit: () => void;
}



function getAttrMeta(key: string): PlayerAttributeMeta | undefined {
  for (const list of Object.values(ATTRIBUTE_META)) {
    const found = list.find((m) => m.key === key);
    if (found) return found;
  }
  return undefined;
}

function validateValue(
  meta: PlayerAttributeMeta,
  raw: string,
): { valid: true; value: string | number } | { valid: false; error: string } {
  if (meta.type === "string") {
    if (!raw.trim()) return { valid: false, error: "不能为空" };
    return { valid: true, value: raw.trim() };
  }

  // number
  const num = Number(raw);
  if (isNaN(num) || raw.trim() === "") {
    return { valid: false, error: "请输入有效数字" };
  }
  if (meta.min !== undefined && num < meta.min) {
    return { valid: false, error: `最小值为 ${meta.min}` };
  }
  if (meta.max !== undefined && num > meta.max) {
    return { valid: false, error: `最大值为 ${meta.max}` };
  }
  return { valid: true, value: num };
}



export function usePlayerConfig(
  player: Player,
  onBack?: () => void,
): PlayerConfigData {
  const { t } = useI18n();
  const { rows } = useTerminalSize();
  const configStore = container.resolve(ConfigStore);

  const [focus, setFocus] = useState<FocusPanel>("left");
  const [activeCategory, setActiveCategory] =
    useState<PlayerConfigCategory | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 左侧分类菜单
  const leftItems: CategoryMenuItem[] = useMemo(
    () =>
      Object.values(PlayerConfigCategory).map((cat) => ({
        label: t(`playerConfig.category.${cat}`),
        value: cat,
      })),
    [t],
  );

  // 右侧属性列表
  const rightItems: AttributeItem[] = useMemo(() => {
    if (!activeCategory) return [];
    const metas = ATTRIBUTE_META[activeCategory] ?? [];
    return metas.map((meta) => ({
      label: t(`playerConfig.attr.${meta.key}`),
      value: meta.key,
      currentValue: String((player as any)[meta.key] ?? ""),
    }));
  }, [activeCategory, player, t]);

  // 切换分类
  const onSelectCategory = useCallback((item: CategoryMenuItem) => {
    setActiveCategory(item.value);
    setFocus("right");
    setIsEditing(false);
    setEditingKey(null);
    setValidationError(null);
  }, []);

  // 选择属性进入编辑
  const onSelectAttribute = useCallback(
    (item: AttributeItem) => {
      const meta = getAttrMeta(item.value);
      if (!meta) return;
      setEditingKey(item.value);
      setEditValue(String((player as any)[item.value] ?? ""));
      setIsEditing(true);
      setValidationError(null);
      setSuccessMessage(null);
    },
    [player],
  );

  // 编辑值变化
  const onEditChange = useCallback((value: string) => {
    setEditValue(value);
    setValidationError(null);
  }, []);

  // 提交编辑
  const onSubmitEdit = useCallback(async () => {
    if (!editingKey) return;
    const meta = getAttrMeta(editingKey);
    if (!meta) return;

    const result = validateValue(meta, editValue);
    if (!result.valid) {
      setValidationError(result.error);
      return;
    }

    
    const partial: Partial<PlayerConfigType> = { [editingKey]: result.value };
    player.applyAttributes(partial as any);

    
    try {
      await configStore.setPlayerConfig(partial);
    } catch (err) {
      console.error("玩家配置持久化失败:", err);
    }

    setSuccessMessage(t("playerConfig.saveSuccess"));
    setIsEditing(false);
    setEditingKey(null);
    setValidationError(null);

    
    setTimeout(() => setSuccessMessage(null), 3000);
  }, [editingKey, editValue, player, configStore, t]);

  
  const onCancelEdit = useCallback(() => {
    if (isEditing) {
      setIsEditing(false);
      setEditingKey(null);
      setValidationError(null);
    } else if (focus === "right") {
      setFocus("left");
    } else {
      onBack?.();
    }
  }, [isEditing, focus, onBack]);

  const editingLabel = editingKey ? t(`playerConfig.attr.${editingKey}`) : "";

  return {
    leftItems,
    rightItems,
    focus,
    activeCategory,
    isLeftFocused: focus === "left",
    isRightFocused: focus === "right" && !isEditing,
    isEditing,
    editingKey,
    editingLabel,
    editValue,
    validationError,
    successMessage,
    rows,
    t,
    onSelectCategory,
    onSelectAttribute,
    onEditChange,
    onSubmitEdit,
    onCancelEdit,
  };
}
