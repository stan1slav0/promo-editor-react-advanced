export type ConversionMode = 'basic' | 'advanced'

export interface Converter {
  hasMJML?: boolean
  categoryName?: string
  setCategory?: (category: string) => void
  exportHTML: (rawEditorContent: string, promoName: string) => Promise<string>
  exportMJML?: (rawEditorContent: string, promoName: string) => Promise<string>
}
