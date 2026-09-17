// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { extractHtmlImages, makeImageHtmlFile, nextImageName, replaceImageReference, storageFolderUrl } from './imageDateUtils'

describe('image date HTML handling', () => {
  it('finds images in HTML and MJML, including decoded URLs', () => {
    const html = '<img src="https://example.com/img-1.jpg?a=1&amp;b=2" alt="Sale September 19"><mj-image src="photo.jpg" />'
    expect(extractHtmlImages(html)).toEqual([
      { src: 'https://example.com/img-1.jpg?a=1&b=2', alt: 'Sale September 19' },
      { src: 'photo.jpg', alt: '' },
    ])
    expect(makeImageHtmlFile('Lift 1/ABC_mjml.html', html)?.group).toBe('ABC')
  })

  it('updates only matching image src and alt without rewriting other markup', () => {
    const html = '<img src="https://example.com/img-1.jpg?a=1&amp;b=2" alt="Sale September 19 &amp; more"><img src="other.jpg" alt="September 19">'
    expect(replaceImageReference(html, 'https://example.com/img-1.jpg?a=1&b=2', 'https://example.com/img-2.jpg', 'September 19', 'April 30'))
      .toBe('<img src="https://example.com/img-2.jpg" alt="Sale April 30 &amp; more"><img src="other.jpg" alt="September 19">')
  })

  it('increments names past a local collision', () => {
    expect(nextImageName('https://example.com/files/img-1.jpg', ['img-2.jpg'])).toBe('img-3.jpg')
  })

  it('opens the S3 folder containing the uploaded public image', () => {
    expect(storageFolderUrl('https://storage.5th-elementagency.com/files/Promo/finance/ab/lift-12/img-2.jpg'))
      .toBe('https://s3-browser.epcnetwork.dev/bucket/files/Promo/finance/ab/lift-12/')
    expect(storageFolderUrl('https://alphaonest.com/files/promo/ab/lift-12/img-2.jpg'))
      .toBe('https://s3-browser.epcnetwork.dev/bucket/alphaone/promo/ab/lift-12/')
    expect(storageFolderUrl('https://unrelated.example/files/a/img-2.jpg')).toBeNull()
  })

  it('adds the replacement date to an alt that had no date', () => {
    expect(replaceImageReference('<mj-image src="img-1.jpg" alt="Summer sale" />', 'img-1.jpg', 'img-2.jpg', 'September 19', 'April 30'))
      .toBe('<mj-image src="img-2.jpg" alt="Summer sale — April 30" />')
  })

  it('replaces arbitrary text in the matching image alt', () => {
    expect(replaceImageReference('<img src="img-1.jpg" alt="IRAN HAS ONE ANSWER LEFT.">', 'img-1.jpg', 'img-2.jpg', 'ONE ANSWER LEFT', 'A NEW CHOICE'))
      .toBe('<img src="img-2.jpg" alt="IRAN HAS A NEW CHOICE.">')
  })
})
