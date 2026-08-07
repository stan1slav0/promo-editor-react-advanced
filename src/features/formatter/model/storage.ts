import type { FormatterMode } from './types'

const STORAGE_KEY_MODE = 'conversionMode'

export function getSavedMode(): FormatterMode {
  const savedMode = localStorage.getItem(STORAGE_KEY_MODE)
  return savedMode === 'advanced' || savedMode === 'basic' ? savedMode : 'basic'
}

export function saveMode(mode: FormatterMode): void {
  localStorage.setItem(STORAGE_KEY_MODE, mode)
}
