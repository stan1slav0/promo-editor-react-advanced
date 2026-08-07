import type { RefObject } from 'react'
import type { ConversionMode, Converter } from '../../../converters/types'

export type FormatterMode = ConversionMode
export type FormatterConverter = Converter

export interface FormatterProps {
  activeCategory: string
  onCategoryChange: (category: string) => void
  availableCategories?: string[]
  isS3Enabled: boolean
}

export type ScrollableElement = HTMLDivElement | HTMLTextAreaElement
export type ScrollableRef = RefObject<ScrollableElement | null>
