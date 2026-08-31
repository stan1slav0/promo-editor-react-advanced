import { useEffect, useState } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from './app/AppRoutes'
import AppHeader from './app/components/AppHeader'
import { AppLayout } from './app/components/AppLayout'
import { AppToasts } from './app/components/AppToasts'
import { useAppSettings } from './app/useAppSettings'
import { getSavedMode, saveMode } from './features/formatter/model/storage'

export default function App() {
  const [formatterMode, setFormatterMode] = useState(getSavedMode)
  const {
    activeCategory,
    isS3Enabled,
    changeCategory,
    changeS3Enabled,
  } = useAppSettings()

  useEffect(() => saveMode(formatterMode), [formatterMode])

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <AppLayout>
        <AppHeader
          isS3Enabled={isS3Enabled}
          onS3ToggleChange={changeS3Enabled}
          hideStorageMode={formatterMode === 'dates'}
        />
        <AppRoutes
          activeCategory={activeCategory}
          onCategoryChange={changeCategory}
          isS3Enabled={isS3Enabled}
          formatterMode={formatterMode}
          onFormatterModeChange={setFormatterMode}
        />
        <AppToasts />
      </AppLayout>
    </BrowserRouter>
  )
}
