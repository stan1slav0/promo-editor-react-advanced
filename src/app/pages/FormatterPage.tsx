import { useEffect } from 'react'
import { resolveCategory, type PageConfig } from '../config'
import { Formatter } from '../../features/formatter'

interface FormatterPageProps {
  pageConfig: PageConfig
  activeCategory: string
  onCategoryChange: (category: string) => void
  isS3Enabled: boolean
}

export function FormatterPage({
  pageConfig,
  activeCategory,
  onCategoryChange,
  isS3Enabled,
}: FormatterPageProps) {
  const effectiveCategory = resolveCategory(pageConfig, activeCategory)

  useEffect(() => {
    if (effectiveCategory !== activeCategory.toLowerCase()) {
      onCategoryChange(effectiveCategory)
    }
  }, [activeCategory, effectiveCategory, onCategoryChange])

  return (
    <Formatter
      activeCategory={effectiveCategory}
      onCategoryChange={onCategoryChange}
      availableCategories={pageConfig.categories}
      isS3Enabled={isS3Enabled}
    />
  )
}
