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

describe('processed image dimensions', () => {
  const imageHtml = '<p><img src="data:image/png;base64,iVBORw0KGgo=" alt="Preview" data-export-width="320"></p>'

  it.each([
    ['finance', getBasicConverter('finance')],
    ['alpha', getBasicConverter('alpha')],
    ['terra', getBasicConverter('terra')],
    ['red', getBasicConverter('red')],
  ])('uses processed dimensions in the %s basic HTML', async (_category, converter) => {
    const html = await converter.exportHTML(imageHtml, 'AB12')
    expect(html).toMatch(/<img[^>]+height="auto"[^>]+width="320"/s)
    expect(html).toMatch(/max-width:\s*320px/)
  })

  it('uses processed dimensions in advanced HTML', async () => {
    advancedConverter.setCategory('finance')
    const html = await advancedConverter.exportHTML(imageHtml, 'AB12')
    expect(html).toMatch(/<img[^>]+height="auto"[^>]+width="320"/s)
    expect(html).toMatch(/max-width:\s*320px/)
  })

  it.each([
    ['finance', 560],
    ['terra', 560],
    ['alpha', 562],
    ['red', 564],
  ])('applies the %s project maximum in basic HTML', async (category, width) => {
    const oversizedImage = '<p><img src="data:image/png;base64,iVBORw0KGgo=" data-export-width="600"></p>'
    const html = await getBasicConverter(category).exportHTML(oversizedImage, 'AB12')
    expect(html).toMatch(new RegExp(`<img[^>]+height="auto"[^>]+width="${width}"`, 's'))
  })

  it('limits Finance MJML images to 550px while keeping height auto', async () => {
    const oversizedImage = '<p><img src="data:image/png;base64,iVBORw0KGgo=" data-export-width="560"></p>'
    const mjml = await getBasicConverter('finance').exportMJML?.(oversizedImage, 'AB12')
    expect(mjml).toMatch(/<img[^>]+width="550" height="auto"/s)
    expect(mjml).toMatch(/<td style="width:\s*550px;?">/)
  })

  it.each([
    ['finance', 560],
    ['terra', 560],
    ['alpha', 562],
    ['red', 564],
  ])('applies the %s project maximum in advanced HTML', async (category, width) => {
    const oversizedImage = '<p><img src="data:image/png;base64,iVBORw0KGgo=" data-export-width="600"></p>'
    advancedConverter.setCategory(category)
    const html = await advancedConverter.exportHTML(oversizedImage, 'AB12')
    expect(html).toMatch(new RegExp(`<img[^>]+height="auto"[^>]+width="${width}"`, 's'))
  })
})
