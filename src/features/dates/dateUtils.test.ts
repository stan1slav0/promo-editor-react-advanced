import { describe, expect, it } from 'vitest'
import {
  detectDates,
  getDateContexts,
  getDateGroupName,
  normalizeDateKey,
  replaceDates,
  toReadableDateValue,
} from './dateUtils'

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

  it('groups HTML non-breaking spaces with regular spaces', () => {
    expect(normalizeDateKey('September&nbsp;19')).toBe(normalizeDateKey('September 19'))
    expect(toReadableDateValue('September&#xA0;19')).toBe('September 19')
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

  it('detects written dates separated by HTML space entities', () => {
    expect(detectDates('September&nbsp;19 / September&#160;19 / September&#xA0;19')).toEqual([
      { value: 'September&nbsp;19', count: 1 },
      { value: 'September&#160;19', count: 1 },
      { value: 'September&#xA0;19', count: 1 },
    ])
  })

  it('detects month and year dates without a day', () => {
    expect(detectDates('August 2026 / Aug. 2026 / August, 2026 / August&nbsp;2026')).toEqual([
      { value: 'August 2026', count: 1 },
      { value: 'Aug. 2026', count: 1 },
      { value: 'August, 2026', count: 1 },
      { value: 'August&nbsp;2026', count: 1 },
    ])
  })

  it('does not double-detect the month and year inside a full date', () => {
    expect(detectDates('August 19, 2026')).toEqual([
      { value: 'August 19, 2026', count: 1 },
    ])
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

  it('returns readable context for a date containing an HTML entity', () => {
    expect(getDateContexts('<p>Offer ends September&nbsp;19.</p>', 'September&nbsp;19')).toEqual([{
      before: 'Offer ends ',
      match: 'September 19',
      after: '.',
    }])
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

  it('preserves an HTML non-breaking space when replacing a date', () => {
    const replacements = new Map([['September&nbsp;19', 'October 3']])

    expect(replaceDates('<p>September&nbsp;19</p>', replacements))
      .toBe('<p>October&nbsp;3</p>')
  })
})
