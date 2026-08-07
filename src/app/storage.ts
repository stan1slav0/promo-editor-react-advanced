const CATEGORY_KEY = 'selectedCategory'
const S3_TOGGLE_KEY = 's3_test_toggle_enabled'

export function readStoredCategory(): string {
  return localStorage.getItem(CATEGORY_KEY)?.toLowerCase() || 'finance'
}

export function saveStoredCategory(category: string): void {
  localStorage.setItem(CATEGORY_KEY, category.toLowerCase())
}

export function readStoredS3Toggle(): boolean {
  return localStorage.getItem(S3_TOGGLE_KEY) === 'true'
}

export function saveStoredS3Toggle(enabled: boolean): void {
  localStorage.setItem(S3_TOGGLE_KEY, String(enabled))
}
