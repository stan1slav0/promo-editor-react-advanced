import { Navigate, Route, Routes } from 'react-router-dom'
import { PAGES } from './config'
import { FormatterPage } from './pages/FormatterPage'

interface AppRoutesProps {
  activeCategory: string
  onCategoryChange: (category: string) => void
  isS3Enabled: boolean
}

export function AppRoutes({
  activeCategory,
  onCategoryChange,
  isS3Enabled,
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
            />
          }
        />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
