import { useState, useCallback, useEffect } from "react";
import { container } from "../Container.js";
import { ArchiveStore } from "../core/archive/ArchiveStore.js";
import { SaveMeta } from "../core/archive/SaveSchema.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useTerminalSize } from "../ui/TerminalSizeContext.js";
import KeyboardMonitor from "../core/keys/KeyboardMonitor.js";

export interface ArchiveScreenData {
  saves: SaveMeta[];
  selectedIndex: number;
  setSelectedIndex: (fn: (i: number) => number) => void;
  message: string | null;
  confirmDelete: boolean;
  saveMode: boolean;
  saveName: string;
  setSaveName: (name: string) => void;
  rows: number;
  t: (key: string, params?: Record<string, string | number>) => string;
  handleStartSave: () => void;
  handleSubmitSave: () => void;
  handleCancelSave: () => void;
  handleLoad: () => void;
  handleDelete: () => void;
  handleCancel: () => void;
}

export function useArchiveScreen(onBack?: () => void): ArchiveScreenData {
  const { t } = useI18n();
  const { rows } = useTerminalSize();
  const store = container.resolve(ArchiveStore);

  const [saves, setSaves] = useState<SaveMeta[]>(() => store.listSaves());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveMode, setSaveMode] = useState(false);
  const [saveName, setSaveName] = useState("");

  /** 命名模式下挂起全局键盘监听 */
  useEffect(() => {
    KeyboardMonitor.isSuspended = saveMode;
    return () => {
      KeyboardMonitor.isSuspended = false;
    };
  }, [saveMode]);

  const refresh = useCallback(() => {
    setSaves(store.listSaves());
    setSelectedIndex(0);
    setConfirmDelete(false);
    setSaveMode(false);
    setSaveName("");
  }, [store]);

  const handleStartSave = useCallback(() => {
    setSaveMode(true);
    setSaveName("");
  }, []);

  const handleSubmitSave = useCallback(() => {
    const trimmed = saveName.trim();
    if (!trimmed) {
      setMessage(t("archive.emptyNameError"));
      return;
    }
    try {
      store.save(trimmed);
      setMessage(t("archive.saveSuccess"));
      refresh();
    } catch (err) {
      setMessage((err as Error).message);
    }
    setTimeout(() => setMessage(null), 3000);
  }, [saveName, store, t, refresh]);

  const handleCancelSave = useCallback(() => {
    setSaveMode(false);
    setSaveName("");
  }, []);

  const handleLoad = useCallback(() => {
    if (saves.length === 0) return;
    const name = saves[selectedIndex].name;
    store
      .load(name)
      .then(() => {
        setMessage(t("archive.loadSuccess"));
        setTimeout(() => process.exit(0), 1500);
      })
      .catch((err) => {
        setMessage((err as Error).message);
        setTimeout(() => setMessage(null), 3000);
      });
  }, [saves, selectedIndex, store, t]);

  const handleDelete = useCallback(() => {
    if (saves.length === 0) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    store.delete(saves[selectedIndex].name);
    refresh();
  }, [saves, selectedIndex, confirmDelete, store, refresh]);

  const handleCancel = useCallback(() => {
    if (saveMode) {
      handleCancelSave();
    } else if (confirmDelete) {
      setConfirmDelete(false);
    } else {
      onBack?.();
    }
  }, [saveMode, confirmDelete, handleCancelSave, onBack]);

  return {
    saves,
    selectedIndex,
    setSelectedIndex,
    message,
    confirmDelete,
    saveMode,
    saveName,
    setSaveName,
    rows,
    t,
    handleStartSave,
    handleSubmitSave,
    handleCancelSave,
    handleLoad,
    handleDelete,
    handleCancel,
  };
}