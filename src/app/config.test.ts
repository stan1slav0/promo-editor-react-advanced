import { describe, expect, it } from 'vitest'
import { PAGES, getBackgroundClass, resolveCategory } from './config'

describe('app config', () => {
  it.each([
    ['/', 'bg-finance'],
    ['/alpha', 'bg-alpha'],
    ['/terra', 'bg-organic'],
    ['/red', 'bg-red'],
    ['/unknown', 'bg-finance'],
  ])('maps %s to %s', (pathname, expectedClass) => {
    expect(getBackgroundClass(pathname)).toBe(expectedClass)
  })

  it('keeps a saved category when it belongs to the current page', () => {
    expect(resolveCategory(PAGES[0], 'HEALTH')).toBe('health')
    expect(resolveCategory(PAGES[0], 'pets')).toBe('pets')
  })

  it('falls back to the page default for an incompatible category', () => {
    expect(resolveCategory(PAGES[1], 'finance')).toBe('alpha')
    expect(resolveCategory(PAGES[2], null)).toBe('terra')
  })
})
