import { useCallback, useEffect, useState } from 'react'
import { getLicenseKey, saveLicenseKey } from '../utils/licenseStorage'
import {
  readStoredCategory,
  readStoredS3Toggle,
  saveStoredCategory,
  saveStoredS3Toggle,
} from './storage'

export function useAppSettings() {
  const [activeCategory, setActiveCategory] = useState(readStoredCategory)
  const [isS3Enabled, setIsS3Enabled] = useState(readStoredS3Toggle)

  useEffect(() => {
    if (getLicenseKey()) return

    const key = window.prompt('🔑 Enter S3 License Key:')?.trim()
    if (key) saveLicenseKey(key)
  }, [])

  const changeCategory = useCallback((category: string) => {
    const normalizedCategory = category.trim().toLowerCase()
    if (!normalizedCategory) return

    setActiveCategory(normalizedCategory)
    saveStoredCategory(normalizedCategory)
  }, [])

  const changeS3Enabled = useCallback((enabled: boolean) => {
    setIsS3Enabled(enabled)
    saveStoredS3Toggle(enabled)
  }, [])

  return {
    activeCategory,
    isS3Enabled,
    changeCategory,
    changeS3Enabled,
  }
}
