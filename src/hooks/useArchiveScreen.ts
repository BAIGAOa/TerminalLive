import { useState, useCallback } from "react";
import { container } from "../Container.js";
import { ArchiveStore } from "../core/archive/ArchiveStore.js";
import { SaveMeta } from "../core/archive/SaveSchema.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useTerminalSize } from "../ui/TerminalSizeContext.js";

export interface ArchiveScreenData {
  saves: SaveMeta[];
  selectedIndex: number;
  setSelectedIndex: (fn: (i: number) => number) => void;
  message: string | null;
  confirmDelete: boolean;
  rows: number;
  t: (key: string, params?: Record<string, string | number>) => string;
  handleSave: () => void;
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

  const refresh = useCallback(() => {
    setSaves(store.listSaves());
    setSelectedIndex(0);
    setConfirmDelete(false);
  }, [store]);

  const handleSave = useCallback(() => {
    try {
      store.save();
      setMessage(t("archive.saveSuccess"));
      refresh();
    } catch (err) {
      setMessage((err as Error).message);
    }
    setTimeout(() => setMessage(null), 3000);
  }, [store, t, refresh]);

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
    if (confirmDelete) {
      setConfirmDelete(false);
    } else {
      onBack?.();
    }
  }, [confirmDelete, onBack]);

  return {
    saves,
    selectedIndex,
    setSelectedIndex,
    message,
    confirmDelete,
    rows,
    t,
    handleSave,
    handleLoad,
    handleDelete,
    handleCancel,
  };
}