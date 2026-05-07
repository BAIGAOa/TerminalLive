import { useState, useCallback, useMemo } from "react"
import { container } from "../Container.js"
import ModRegistry from "../core/mod/ModRegistry.js"
import ConfigStore from "../core/store/ConfigStore.js"
import { useI18n } from "../core/language/LanguageContext.js"
import { useTerminalSize } from "../ui/TerminalSizeContext.js"

export interface ModItem {
  name: string
  enabled: boolean
}

export interface ModScreenData {
  mods: ModItem[]
  selectedIndex: number
  setSelectedIndex: (index: number) => void
  toggleMod: (modName: string) => void
  rows: number
  t: (key: string, params?: Record<string, string | number>) => string
}

export function useModScreen(): ModScreenData {
  const { t } = useI18n()
  const { rows } = useTerminalSize()
  const modRegistry = container.resolve(ModRegistry)
  const configStore = container.resolve(ConfigStore)

  const [enabledSet, setEnabledSet] = useState<Set<string>>(
    () => new Set(configStore.getEnabledMods()),
  )
  const [selectedIndex, setSelectedIndex] = useState(0)

  const allNames = modRegistry.getAllMods()

  const mods: ModItem[] = useMemo(
    () =>
      allNames.map((name) => ({
        name,
        enabled: enabledSet.has(name),
      })),
    [allNames, enabledSet],
  )

  const toggleMod = useCallback(
    (modName: string) => {
      setEnabledSet((prev) => {
        const next = new Set(prev)
        if (next.has(modName)) {
          next.delete(modName)
        } else {
          next.add(modName)
        }
        configStore.setEnabledMods(Array.from(next))
        return next
      })
    },
    [configStore],
  )

  return {
    mods,
    selectedIndex,
    setSelectedIndex,
    toggleMod,
    rows,
    t,
  }
}