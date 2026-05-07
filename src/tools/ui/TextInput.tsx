import React from 'react'
import { Box, Text } from 'ink'
import { useKeyboardHandler } from '../../hooks/key/useKeyBoardHandle.js'

interface TextInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: (value: string) => void
  onCancel?: () => void
  isFocused?: boolean
  placeholder?: string
}

export default function TextInput({
  value,
  onChange,
  onSubmit,
  onCancel,
  isFocused = true,
  placeholder = '',
}: TextInputProps) {
  useKeyboardHandler((input, key) => {
    if (!isFocused) return false

    if (key.escape) {
      onCancel?.()
      return true
    }
    if (key.return) {
      onSubmit?.(value)
      return true
    }
    if (key.backspace || key.delete) {
      onChange(value.slice(0, -1))
      return true
    }
    // 过滤控制字符 仅单字符有效
    if (input && input.length === 1 && !key.ctrl && !key.meta) {
      onChange(value + input)
      return true
    }
    return false
  }, [isFocused, value, onChange, onSubmit, onCancel])

  return (
    <Box>
      <Text>{value || placeholder}</Text>
      {isFocused && <Text color="gray">█</Text>}
    </Box>
  )
}
