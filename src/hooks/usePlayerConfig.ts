import { useCallback, useMemo, useState } from "react";
import { container } from "../Container.js";
import Player from "../world/Player.js";
import ConfigStore from "../core/store/ConfigStore.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useWindowSize } from "ink";
import { PlayerConfigType } from "../types/ConfigType.js";
import {
  ATTRIBUTE_META,
  getAttrMeta,
  PlayerConfigCategory,
  validateValue,
} from "../world/playerConfig.js";
import { useFlash } from "./useFlash.js";

export { PlayerConfigCategory } from "../world/playerConfig.js";
export type { PlayerAttributeMeta } from "../world/playerConfig.js";

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

export function usePlayerConfig(
  player: Player,
  onBack?: () => void,
): PlayerConfigData {
  const { t } = useI18n();
  const { rows } = useWindowSize();
  const configStore = container.resolve(ConfigStore);

  const [focus, setFocus] = useState<FocusPanel>("left");
  const [activeCategory, setActiveCategory] =
    useState<PlayerConfigCategory | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const {
    value: successMessage,
    flash: flashSuccess,
    reset: resetSuccess,
  } = useFlash<string>(3000);

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
      resetSuccess();
    },
    [player, resetSuccess],
  );

  const onEditChange = useCallback((value: string) => {
    setEditValue(value);
    setValidationError(null);
  }, []);

  const onSubmitEdit = useCallback(async () => {
    if (!editingKey) return;
    if (!getAttrMeta(editingKey)) return;

    const result = validateValue(editingKey, editValue);
    if (!result.valid) {
      setValidationError(t(result.errorKey, result.params));
      return;
    }

    const partial: Partial<PlayerConfigType> = { [editingKey]: result.value };
    player.applyAttributes(partial as any);
    try {
      await configStore.setPlayerConfig(partial);
    } catch (err) {
      console.error("玩家配置持久化失败:", err);
    }

    flashSuccess(t("playerConfig.saveSuccess"));
    setIsEditing(false);
    setEditingKey(null);
    setValidationError(null);
  }, [editingKey, editValue, player, configStore, t, flashSuccess]);

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
