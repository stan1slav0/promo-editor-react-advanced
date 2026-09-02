import { describe, expect, it } from 'vitest'
import {
  getCategoryImageMaxWidth,
  getExportImageWidthFromTag,
  getTargetImageDimensions,
} from './imageProcessor'

describe('getTargetImageDimensions', () => {
  it.each([
    [100, 50, 200, 100],
    [200, 100, 200, 100],
    [450, 300, 450, 300],
    [560, 400, 560, 400],
    [1200, 800, 560, 373],
  ])(
    'resizes %sx%s to %sx%s',
    (sourceWidth, sourceHeight, expectedWidth, expectedHeight) => {
      expect(getTargetImageDimensions(sourceWidth, sourceHeight)).toEqual({
        width: expectedWidth,
        height: expectedHeight,
      })
    },
  )
})

describe('getCategoryImageMaxWidth', () => {
  it.each([
    ['finance', 560],
    ['health', 560],
    ['pets', 560],
    ['terra', 560],
    ['alpha', 562],
    ['red', 564],
  ])('returns the project width for %s', (category, expectedWidth) => {
    expect(getCategoryImageMaxWidth(category)).toBe(expectedWidth)
  })
})

describe('getExportImageWidthFromTag', () => {
  it('reads the width saved by the image processor', () => {
    expect(getExportImageWidthFromTag(
      '<img data-export-width="320">',
      560,
    )).toBe(320)
  })

  it('uses the template width when processed dimensions are absent', () => {
    expect(getExportImageWidthFromTag('<img src="image.png">', 560))
      .toBe(560)
  })

  it('applies the project maximum to the stored width', () => {
    expect(getExportImageWidthFromTag(
      '<img data-export-width="600">',
      550,
      560,
    )).toBe(560)
  })
})
