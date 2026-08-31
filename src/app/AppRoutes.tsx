import { Navigate, Route, Routes } from 'react-router-dom'
import { PAGES } from './config'
import { FormatterPage } from './pages/FormatterPage'
import type { FormatterMode } from '../features/formatter/model/types'

interface AppRoutesProps {
  activeCategory: string
  onCategoryChange: (category: string) => void
  isS3Enabled: boolean
  formatterMode: FormatterMode
  onFormatterModeChange: (mode: FormatterMode) => void
}

export function AppRoutes({
  activeCategory,
  onCategoryChange,
  isS3Enabled,
  formatterMode,
  onFormatterModeChange,
}: AppRoutesProps) {
  return (
    <Routes>
      {PAGES.map((pageConfig) => (
        <Route
          key={pageConfig.id}
          path={pageConfig.path}
          element={
            <FormatterPage
              pageConfig={pageConfig}
              activeCategory={activeCategory}
              onCategoryChange={onCategoryChange}
              isS3Enabled={isS3Enabled}
              formatterMode={formatterMode}
              onFormatterModeChange={onFormatterModeChange}
            />
          }
        />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
