import { describe, expect, it } from 'vitest'
import { advancedConverter, getBasicConverter, getConverter } from '.'
import { buildAdvancedImageSource } from './advanced'

describe('converter registry', () => {
  it('selects an isolated converter for each mode', () => {
    expect(getConverter('advanced', 'finance')).toBe(advancedConverter)
    expect(getConverter('basic', 'alpha')).toBe(getBasicConverter('alpha'))
    expect(getConverter('basic', 'health')).toBe(getBasicConverter('finance'))
  })

  it.each([
    ['finance', 'https://storage.5th-elementagency.com/files/Promo/finance/ab/lift-12/img-2.jpg'],
    ['health', 'https://storage.5th-elementagency.com/files/Promo/health/ab/lift-12/img-2.jpg'],
    ['alpha', 'https://alphaonest.com/files/promo/ab/lift-12/img-2.jpg'],
    ['terra', 'https://ogfinstorage.com/files/creatives/ab/creative-12/img-2.jpg'],
    ['red', 'https://reagstr.com/files/promo/ab/lift-12/img-2.jpg'],
  ])('builds the %s image source inside advanced', (category, expectedSource) => {
    expect(buildAdvancedImageSource(category, 'AB12', 2)).toBe(expectedSource)
  })
})
