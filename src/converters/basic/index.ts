import alphaProcessor from './processors/alphaProcessor'
import financeProcessor from './processors/financeProcessor'
import organicProcessor from './processors/organicProcessor'
import redProcessor from './processors/redProcessor'
import type { Converter } from '../types'

const processors: Record<string, Converter> = {
  alpha: alphaProcessor,
  finance: financeProcessor,
  health: financeProcessor,
  pets: financeProcessor,
  red: redProcessor,
  terra: organicProcessor,
}

export function getBasicConverter(category?: string): Converter {
  return processors[category?.toLowerCase() || 'finance'] ?? financeProcessor
}
