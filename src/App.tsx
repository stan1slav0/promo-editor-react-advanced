import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from './app/AppRoutes'
import AppHeader from './app/components/AppHeader'
import { AppLayout } from './app/components/AppLayout'
import { AppToasts } from './app/components/AppToasts'
import { useAppSettings } from './app/useAppSettings'

export default function App() {
  const {
    activeCategory,
    isS3Enabled,
    changeCategory,
    changeS3Enabled,
  } = useAppSettings()

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <AppLayout>
        <AppHeader
          isS3Enabled={isS3Enabled}
          onS3ToggleChange={changeS3Enabled}
        />
        <AppRoutes
          activeCategory={activeCategory}
          onCategoryChange={changeCategory}
          isS3Enabled={isS3Enabled}
        />
        <AppToasts />
      </AppLayout>
    </BrowserRouter>
  )
}
