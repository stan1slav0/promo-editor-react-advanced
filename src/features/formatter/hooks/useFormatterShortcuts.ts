import { useEffect, useRef } from 'react'

interface FormatterShortcutsOptions {
  activeCategory: string
  isAnalyzing: boolean
  onDownloadAll: () => void
  onDownloadHtml: () => void
  onReset: () => void
}

export function useFormatterShortcuts(options: FormatterShortcutsOptions): void {
  const optionsRef = useRef(options)
  optionsRef.current = options

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifierPressed = event.metaKey || event.ctrlKey
      if (!isModifierPressed) return

      const key = event.key.toLowerCase()
      const current = optionsRef.current

      if (key === 's' && !event.shiftKey) {
        event.preventDefault()
        event.stopPropagation()
        if (current.isAnalyzing) return

        if (['finance', 'health', 'pets'].includes(current.activeCategory.toLowerCase())) {
          current.onDownloadAll()
        } else {
          current.onDownloadHtml()
        }
      }

      if (key === 'r' && !event.shiftKey) {
        event.preventDefault()
        event.stopPropagation()
        current.onReset()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [])
}
