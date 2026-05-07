import React, { useState } from 'react'
import { Box, Text } from 'ink'
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
}

export default function SelectInput({
  items,
  onSelect,
  isFocused = true,
  itemComponent: ItemComponent,
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
    return false
  }, [isFocused, items.length, selectedIndex, onSelect])

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
