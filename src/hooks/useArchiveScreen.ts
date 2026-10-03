import { useState, useCallback } from "react";
import { container } from "../Container.js";
import { ArchiveManager } from "../core/archive/ArchiveManager.js";
import { SaveMeta } from "../core/archive/SaveSchema.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useTerminalSize } from "../ui/TerminalSizeContext.js";

export interface ArchiveScreenData {
  saves: SaveMeta[];
  selectedIndex: number;
  setSelectedIndex: (i: number) => void;
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
  loadByName: (name: string) => void;
  handleDelete: () => void;
  handleCancel: () => void;
}

export function useArchiveScreen(onBack?: () => void): ArchiveScreenData {
  const { t } = useI18n();
  const { rows } = useTerminalSize();
  const store = container.resolve(ArchiveManager);

  const [saves, setSaves] = useState<SaveMeta[]>(() => store.listSaves());
  const [selectedIndex, setSelectedIndexState] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveMode, setSaveMode] = useState(false);
  const [saveName, setSaveName] = useState("");

  const refresh = useCallback(() => {
    setSaves(store.listSaves());
    setSelectedIndexState(0);
    setConfirmDelete(false);
    setSaveMode(false);
    setSaveName("");
  }, [store]);

  const flash = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  }, []);

  const handleStartSave = useCallback(() => {
    setSaveMode(true);
    setSaveName("");
  }, []);

  const handleSubmitSave = useCallback(() => {
    const trimmed = saveName.trim();
    if (!trimmed) {
      flash(t("archive.emptyNameError"));
      return;
    }
    try {
      store.save(trimmed);
      flash(t("archive.saveSuccess"));
      refresh();
    } catch (err) {
      flash((err as Error).message);
    }
  }, [saveName, store, t, refresh, flash]);

  const handleCancelSave = useCallback(() => {
    setSaveMode(false);
    setSaveName("");
  }, []);

  const loadByName = useCallback(
    (name: string) => {
      try {
        store.load(name);
        setMessage(t("archive.loadSuccess"));
      } catch {
        flash(t("archive.incompatible"));
      }
    },
    [store, t, flash],
  );

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

  const setSelectedIndex = useCallback((i: number) => {
    setSelectedIndexState(i);
    setConfirmDelete(false);
  }, []);

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
    loadByName,
    handleDelete,
    handleCancel,
  };
}
