import React, { useState } from 'react'
import { Box, Text, Key } from 'ink'
import { useKeyboardHandler } from '../../hooks/key/useKeyBoardHandle.js'

interface SelectItem {
  label: string
  value: string
}

interface SelectInputProps {
  items: SelectItem[]
  onSelect: (item: SelectItem) => void
  isFocused?: boolean
  itemComponent?: React.ComponentType<SelectItem & { isSelected?: boolean }>
  onKeyPress?: (input: string, key: Key, selectedIndex: number) => boolean
}

export default function SelectInput({
  items,
  onSelect,
  isFocused = true,
  itemComponent: ItemComponent,
  onKeyPress,
}: SelectInputProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useKeyboardHandler((_input, key) => {
    if (!isFocused || items.length === 0) return false

    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1))
      return true
    }

    if (key.downArrow) {
      setSelectedIndex(prev => Math.min(items.length - 1, prev + 1))
      return true
    }

    if (key.return) {
      onSelect(items[selectedIndex])
      return true
    }

    // 剩余按键交给父组件，selectedIndex 让父组件知道当前高亮项
    if (onKeyPress) {
      return onKeyPress(_input, key, selectedIndex)
    }

    return false
  }, [isFocused, items.length, selectedIndex, onSelect, onKeyPress])

  return (
    <Box flexDirection="column">
      {items.map((item, index) => {
        const props = { ...item, isSelected: index === selectedIndex }
        return ItemComponent ? (
          <ItemComponent key={item.value} {...props} />
        ) : (
          <Box key={item.value}>
            <Text color={index === selectedIndex ? 'green' : undefined}>
              {item.label}
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}