import { advancedConverter } from './advanced'
import { getBasicConverter } from './basic'
import type { ConversionMode, Converter } from './types'

export function getConverter(mode: ConversionMode, category: string): Converter {
  return mode === 'advanced' ? advancedConverter : getBasicConverter(category)
}

export { advancedConverter, getBasicConverter }
export type { ConversionMode, Converter }
