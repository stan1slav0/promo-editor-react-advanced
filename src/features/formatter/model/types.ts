import type { RefObject } from 'react'
import type { ConversionMode, Converter } from '../../../converters/types'

export type FormatterMode = ConversionMode | 'dates'
export type FormatterConverter = Converter

export interface FormatterProps {
  activeCategory: string
  onCategoryChange: (category: string) => void
  availableCategories?: string[]
  isS3Enabled: boolean
  mode: FormatterMode
  onModeChange: (mode: FormatterMode) => void
}

export type ScrollableElement = HTMLDivElement | HTMLTextAreaElement
export type ScrollableRef = RefObject<ScrollableElement | null>
