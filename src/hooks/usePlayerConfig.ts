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
  skills = "skills",
  psychological = "psychological",
  wealth = "wealth",
}

export interface PlayerAttributeMeta {
  key: keyof PlayerConfigType;
  type: "string" | "number";
  min?: number;
  max?: number;
}

const ATTRIBUTE_META: Record<PlayerConfigCategory, PlayerAttributeMeta[]> = {
  [PlayerConfigCategory.basic]: [{ key: "playerName", type: "string" }],
  [PlayerConfigCategory.physical]: [
    { key: "age", type: "number", min: 0, max: 150 },
    { key: "health", type: "number", min: 0, max: 100 },
    { key: "height", type: "number", min: 0.5, max: 3 },
    { key: "weight", type: "number", min: 1, max: 500 },
  ],
  [PlayerConfigCategory.skills]: [
    { key: "intelligence", type: "number", min: 0, max: 100 },
    { key: "social", type: "number", min: 0, max: 100 },
    { key: "fitness", type: "number", min: 0, max: 100 },
    { key: "happiness", type: "number", min: 0, max: 100 },
    { key: "reputation", type: "number", min: 0, max: 100 },
  ],
  [PlayerConfigCategory.psychological]: [
    { key: "angerValue", type: "number", min: 0, max: 100 },
    { key: "excitationValue", type: "number", min: 0, max: 100 },
    { key: "depressionValue", type: "number", min: 0, max: 100 },
    { key: "weakValue", type: "number", min: 0, max: 100 },
  ],
  [PlayerConfigCategory.wealth]: [{ key: "money", type: "number", min: 0 }],
};

export interface CategoryMenuItem {
  label: string;
  value: PlayerConfigCategory;
}

export interface AttributeItem {
  label: string;
  value: string;
  currentValue: string;
}

export type FocusPanel = "left" | "right";

export interface PlayerConfigData {
  leftItems: CategoryMenuItem[];
  rightItems: AttributeItem[];
  focus: FocusPanel;
  activeCategory: PlayerConfigCategory | null;
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
  t: (key: string, params?: Record<string, string | number>) => string,
): { valid: true; value: string | number } | { valid: false; error: string } {
  if (meta.type === "string") {
    if (!raw.trim()) return { valid: false, error: t("playerConfig.error.empty") };
    return { valid: true, value: raw.trim() };
  }
  const num = Number(raw);
  if (isNaN(num) || raw.trim() === "") {
    return { valid: false, error: t("playerConfig.error.number") };
  }
  if (meta.min !== undefined && num < meta.min) {
    return { valid: false, error: t("playerConfig.error.min", { n: meta.min }) };
  }
  if (meta.max !== undefined && num > meta.max) {
    return { valid: false, error: t("playerConfig.error.max", { n: meta.max }) };
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

  const leftItems: CategoryMenuItem[] = useMemo(
    () =>
      Object.values(PlayerConfigCategory).map((cat) => ({
        label: t(`playerConfig.category.${cat}`),
        value: cat,
      })),
    [t],
  );

  const rightItems: AttributeItem[] = useMemo(() => {
    if (!activeCategory) return [];
    const metas = ATTRIBUTE_META[activeCategory] ?? [];
    return metas.map((meta) => ({
      label: t(`playerConfig.attr.${meta.key}`),
      value: meta.key,
      currentValue: String((player as any)[meta.key] ?? ""),
    }));
  }, [activeCategory, player, t]);

  const onSelectCategory = useCallback((item: CategoryMenuItem) => {
    setActiveCategory(item.value);
    setFocus("right");
    setIsEditing(false);
    setEditingKey(null);
    setValidationError(null);
  }, []);

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

  const onEditChange = useCallback((value: string) => {
    setEditValue(value);
    setValidationError(null);
  }, []);

  const onSubmitEdit = useCallback(async () => {
    if (!editingKey) return;
    const meta = getAttrMeta(editingKey);
    if (!meta) return;

    const result = validateValue(meta, editValue, t);
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
