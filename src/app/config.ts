export interface PageConfig {
  id: string
  title: string
  path: string
  categories: string[]
}

export const PAGES: PageConfig[] = [
  { id: 'finance', title: 'Finance', path: '/', categories: ['Finance', 'Health', 'Pets'] },
  { id: 'alpha', title: 'Alpha', path: '/alpha', categories: ['Alpha'] },
  { id: 'organic', title: 'Terra', path: '/terra', categories: ['Terra'] },
  { id: 'red', title: 'Red', path: '/red', categories: ['Red'] },
]

export function getBackgroundClass(pathname: string): string {
  const path = pathname.toLowerCase()
  if (path.includes('/alpha')) return 'bg-alpha'
  if (path.includes('/terra')) return 'bg-organic'
  if (path.includes('/red')) return 'bg-red'
  return 'bg-finance'
}

export function resolveCategory(
  pageConfig: PageConfig,
  activeCategory: string | null | undefined,
): string {
  const categories = pageConfig.categories.map((category) => category.toLowerCase())
  const normalizedActiveCategory = activeCategory?.toLowerCase()

  return normalizedActiveCategory && categories.includes(normalizedActiveCategory)
    ? normalizedActiveCategory
    : categories[0]
}
