const LICENSE_STORAGE_KEY = 'license_key'

export function getLicenseKey(): string {
  return (localStorage.getItem(LICENSE_STORAGE_KEY) || '').trim()
}

export function saveLicenseKey(value: string): void {
  localStorage.setItem(LICENSE_STORAGE_KEY, value.trim())
}
