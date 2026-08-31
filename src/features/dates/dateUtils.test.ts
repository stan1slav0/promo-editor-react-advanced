import { describe, expect, it } from 'vitest'
import { detectDates, getDateContexts, getDateGroupName, normalizeDateKey, replaceDates } from './dateUtils'

describe('getDateGroupName', () => {
  it('groups HTML and MJML variants under the same promo name', () => {
    expect(getDateGroupName('ASASS12_html.html')).toBe('ASASS12')
    expect(getDateGroupName('ASASS12_mjml.html')).toBe('ASASS12')
    expect(getDateGroupName('promo-name.HTML')).toBe('promo-name')
  })
})

describe('normalizeDateKey', () => {
  it('treats casing and repeated whitespace as the same date', () => {
    expect(normalizeDateKey('  December   23th ')).toBe(normalizeDateKey('december 23th'))
  })
})

describe('detectDates', () => {
  it('detects common written and numeric dates and counts duplicates', () => {
    const html = '<p>September 18th</p><p>September 18th</p><p>18 Sep 2026</p><time>2026-09-18</time>'

    expect(detectDates(html)).toEqual([
      { value: 'September 18th', count: 2 },
      { value: '18 Sep 2026', count: 1 },
      { value: '2026-09-18', count: 1 },
    ])
  })

  it('does not treat invalid month and day numbers as dates', () => {
    expect(detectDates('2026-19-44 and 44/19/2026')).toEqual([])
  })
})

describe('getDateContexts', () => {
  it('returns readable sentences and removes HTML tags around a date', () => {
    const html = '<p>Your access remains active until <strong>September 19</strong>. Renew it today.</p>'

    expect(getDateContexts(html, 'September 19')).toEqual([{
      before: 'Your access remains active until ',
      match: 'September 19',
      after: '.',
    }])
  })

  it('returns every visible occurrence separately', () => {
    const html = '<div>Sale ends September 19.</div><div>Do not wait until September 19!</div>'

    expect(getDateContexts(html, 'September 19')).toHaveLength(2)
  })
})

describe('replaceDates', () => {
  it('replaces every occurrence while keeping the rest of the HTML intact', () => {
    const html = '<p title="September 18th">September 18th</p>'
    const replacements = new Map([['September 18th', 'October 2nd']])

    expect(replaceDates(html, replacements)).toBe('<p title="October 2nd">October 2nd</p>')
  })

  it('does not replace the result of an earlier replacement a second time', () => {
    const replacements = new Map([
      ['September 18th', 'October 2nd'],
      ['October 2nd', 'November 4th'],
    ])

    expect(replaceDates('September 18th / October 2nd', replacements))
      .toBe('October 2nd / November 4th')
  })
})
