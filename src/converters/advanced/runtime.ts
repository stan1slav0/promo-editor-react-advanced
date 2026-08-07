import { convertAdvancedDetailed } from './converter'
import { getAdvancedProfile } from './converter/profiles'
import { prepareAdvancedImageSources } from './imageSources'
import type { Converter } from '../types'

class AdvancedConverter implements Converter {
  categoryName = 'finance'
  hasMJML = false
  lastWarnings: string[] = []

  setCategory(category: string): void {
    this.categoryName = (category || 'finance').toLowerCase()
  }

  async exportHTML(rawEditorContent: string, promoName: string): Promise<string> {
    const preparedHtml = prepareAdvancedImageSources(
      rawEditorContent || '',
      promoName,
      this.categoryName,
    )
    const result = convertAdvancedDetailed(
      preparedHtml,
      getAdvancedProfile(this.categoryName),
    )

    this.lastWarnings = result.warnings
    if (result.warnings.length > 0) {
      console.warn('[AdvancedConverter]', ...result.warnings)
    }

    return result.html
  }

  async exportMJML(): Promise<string> {
    return ''
  }
}

export const advancedConverter = new AdvancedConverter()
