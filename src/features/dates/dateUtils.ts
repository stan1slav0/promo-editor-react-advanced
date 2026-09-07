export interface DetectedDate {
  value: string
  count: number
}

export interface DateContext {
  before: string
  match: string
  after: string
}

const HTML_SPACE_ENTITY_SOURCE = '&(?:nbsp|#0*(?:32|160)|#x0*(?:20|a0));'
const HTML_SPACE = `(?:\\s|${HTML_SPACE_ENTITY_SOURCE})`
const DATE_SPACE = `${HTML_SPACE}+`
const OPTIONAL_DATE_SPACE = `${HTML_SPACE}*`

export function getDateGroupName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.html?$/i, '')
  const withoutVariant = withoutExtension.replace(/(?:[_.\- ]+(?:html|mjml))$/i, '')
  return withoutVariant || withoutExtension || fileName
}

export function normalizeDateKey(value: string): string {
  return toReadableDateValue(value).toLocaleLowerCase('en-US')
}

export function toReadableDateValue(value: string): string {
  return value
    .replace(/<sup\b[^>]*>\s*(st|nd|rd|th)\s*<\/sup>/gi, '$1')
    .replace(/&(?:nbsp|#0*(?:32|160)|#x0*(?:20|a0));/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

const MONTH = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?'
const STANDALONE_MONTH = '(?:January|February|March|April|June|July|August|September|October|November|December|Jan\\.?|Feb\\.?|Mar\\.?|Apr\\.?|Jun\\.?|Jul\\.?|Aug\\.?|Sept?\\.?|Oct\\.?|Nov\\.?|Dec\\.?)'
const ORDINAL_SUFFIX = '(?:st|nd|rd|th|<sup\\b[^>]*>\\s*(?:st|nd|rd|th)\\s*</sup>)'
const DAY = `(?:0?[1-9]|[12]\\d|3[01])${ORDINAL_SUFFIX}?`
const YEAR = '(?:(?:19|20)\\d{2})'
const STANDALONE_MAY_PATTERN = /\b(?:May|MAY)\b/g
const MONTH_NUMBER_BY_PREFIX: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

const DATE_PATTERNS = [
  new RegExp(`\\b${MONTH}${DATE_SPACE}${DAY}(?:${OPTIONAL_DATE_SPACE},?${OPTIONAL_DATE_SPACE}${YEAR})?(?![A-Za-z0-9])`, 'gi'),
  new RegExp(`\\b${DAY}${DATE_SPACE}(?:of${DATE_SPACE})?${MONTH}(?:${OPTIONAL_DATE_SPACE},?${OPTIONAL_DATE_SPACE}${YEAR})?\\b`, 'gi'),
  new RegExp(`\\b${MONTH}(?:${DATE_SPACE}|${OPTIONAL_DATE_SPACE},${OPTIONAL_DATE_SPACE})${YEAR}\\b`, 'gi'),
  new RegExp(`\\b${YEAR}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\\d|3[01])\\b`, 'g'),
  new RegExp(`\\b(?:0?[1-9]|[12]\\d|3[01])[-/.](?:0?[1-9]|1[0-2])[-/.]${YEAR}\\b`, 'g'),
  new RegExp(`\\b${STANDALONE_MONTH}(?![A-Za-z])`, 'gi'),
  STANDALONE_MAY_PATTERN,
  new RegExp(`(?<!\\d[-/.])\\b${YEAR}\\b(?![-/.]\\d)`, 'g'),
]

const HTML_IMAGE_PATTERN = /<(?:img|mj-image)\b/gi

export function countHtmlImages(html: string): number {
  return [...html.matchAll(HTML_IMAGE_PATTERN)].length
}

interface DateSortParts {
  month: number
  day: number
  year: number
}

function getDateSortParts(value: string): DateSortParts {
  const readable = toReadableDateValue(value)
  const namedMonth = readable.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\b/i)

  if (namedMonth) {
    const month = MONTH_NUMBER_BY_PREFIX[namedMonth[1].slice(0, 3).toLocaleLowerCase('en-US')] ?? 13
    const beforeMonth = readable.slice(0, namedMonth.index).trim()
    const afterMonth = readable.slice((namedMonth.index ?? 0) + namedMonth[0].length).trim()
    const dayBefore = beforeMonth.match(/(?:^|\D)(\d{1,2})(?:st|nd|rd|th)?$/i)
    const dayAfter = afterMonth.match(/^(\d{1,2})(?:st|nd|rd|th)?\b/i)
    const yearMatch = readable.match(/\b((?:19|20)\d{2})\b/)

    return {
      month,
      day: Number(dayBefore?.[1] ?? dayAfter?.[1] ?? 0),
      year: Number(yearMatch?.[1] ?? 0),
    }
  }

  const yearFirst = readable.match(/^((?:19|20)\d{2})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (yearFirst) {
    return { month: Number(yearFirst[2]), day: Number(yearFirst[3]), year: Number(yearFirst[1]) }
  }

  const dayFirst = readable.match(/^(\d{1,2})[-/.](\d{1,2})[-/.]((?:19|20)\d{2})$/)
  if (dayFirst) {
    return { month: Number(dayFirst[2]), day: Number(dayFirst[1]), year: Number(dayFirst[3]) }
  }

  const standaloneYear = readable.match(/^((?:19|20)\d{2})$/)
  return { month: 13, day: 0, year: Number(standaloneYear?.[1] ?? 0) }
}

export function compareDateValues(left: string, right: string): number {
  const leftParts = getDateSortParts(left)
  const rightParts = getDateSortParts(right)

  return leftParts.month - rightParts.month
    || leftParts.day - rightParts.day
    || leftParts.year - rightParts.year
    || left.localeCompare(right, 'en-US', { numeric: true, sensitivity: 'base' })
}

interface MatchRange {
  start: number
  end: number
  value: string
}

function isLikelyStandaloneMay(html: string, start: number, end: number): boolean {
  const before = htmlToReadableText(html.slice(Math.max(0, start - 160), start))
  const afterSource = html.slice(end, end + 160)
  const after = htmlToReadableText(afterSource)
  const hasMonthCueBefore = /(?:^|\b)(?:in|by|until|through|during|since|from|for|this|next|last)\s*$/i.test(before)
  const hasMonthCueAfter = /^(?:through|to)\b/i.test(after)
  const endsAsValue = after.length === 0 || /^[,.;:!?()[\]–—-]/.test(after)
  const closesStandaloneBlock = /^\s*<\/(?:p|div|h[1-6]|td|th|li)\b/i.test(afterSource)

  return hasMonthCueBefore || hasMonthCueAfter || endsAsValue || closesStandaloneBlock
}

function findDateRanges(html: string): MatchRange[] {
  const ranges: MatchRange[] = []

  for (const pattern of DATE_PATTERNS) {
    pattern.lastIndex = 0
    for (const match of html.matchAll(pattern)) {
      const start = match.index
      const end = start + match[0].length
      if (pattern === STANDALONE_MAY_PATTERN && !isLikelyStandaloneMay(html, start, end)) continue
      if (ranges.some((range) => start < range.end && end > range.start)) continue
      ranges.push({ start, end, value: match[0] })
    }
  }

  return ranges.sort((left, right) => left.start - right.start)
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const decodeHtmlEntities = (value: string) => value
  .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const htmlToReadableText = (html: string) => decodeHtmlEntities(html
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<\/?(?:address|article|aside|blockquote|br|div|footer|h[1-6]|header|li|main|nav|p|section|table|td|th|tr)\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ''))
  .replace(/[\t\f\v ]+/g, ' ')
  .replace(/ *\n */g, '\n')
  .replace(/\n{2,}/g, '\n')
  .trim()

export function getDateContexts(html: string, dateValue: string): DateContext[] {
  const readableDateValue = toReadableDateValue(dateValue)
  if (!readableDateValue) return []

  const text = htmlToReadableText(html)
  const pattern = new RegExp(escapeRegExp(readableDateValue).replace(/\s+/g, '[\\s\\u00a0]+'), 'gi')
  const contexts: DateContext[] = []

  for (const match of text.matchAll(pattern)) {
    const matchStart = match.index
    const matchEnd = matchStart + match[0].length
    const leftBoundary = Math.max(
      text.lastIndexOf('.', matchStart - 1),
      text.lastIndexOf('!', matchStart - 1),
      text.lastIndexOf('?', matchStart - 1),
      text.lastIndexOf('\n', matchStart - 1),
    ) + 1
    const followingText = text.slice(matchEnd)
    const rightBoundaryMatch = followingText.search(/[.!?\n]/)
    const sentenceEnd = rightBoundaryMatch === -1
      ? text.length
      : matchEnd + rightBoundaryMatch + 1

    let contextStart = leftBoundary
    let contextEnd = sentenceEnd
    if (contextEnd - contextStart > 190) {
      contextStart = Math.max(contextStart, matchStart - 72)
      contextEnd = Math.min(contextEnd, matchEnd + 104)
    }

    const clippedStart = contextStart > leftBoundary
    const clippedEnd = contextEnd < sentenceEnd
    const before = text.slice(contextStart, matchStart).trimStart()
    const after = text.slice(matchEnd, contextEnd).trimEnd()

    contexts.push({
      before: `${clippedStart ? '…' : ''}${before}`,
      match: match[0],
      after: `${after}${clippedEnd ? '…' : ''}`,
    })
  }

  return contexts
}

export function detectDates(html: string): DetectedDate[] {
  const detected = new Map<string, DetectedDate>()

  for (const range of findDateRanges(html)) {
    const existing = detected.get(range.value)
    if (existing) existing.count += 1
    else detected.set(range.value, { value: range.value, count: 1 })
  }

  return [...detected.values()]
}

export function replaceDates(html: string, replacements: ReadonlyMap<string, string>): string {
  const ranges = findDateRanges(html)
  if (ranges.length === 0) return html

  let result = ''
  let cursor = 0

  for (const range of ranges) {
    result += html.slice(cursor, range.start)
    const replacement = replacements.get(range.value)

    if (replacement === undefined || replacement === range.value) {
      result += range.value
    } else {
      const htmlSpace = range.value.match(new RegExp(HTML_SPACE_ENTITY_SOURCE, 'i'))?.[0]
      const replacementWithOriginalSpacing = htmlSpace ? replacement.replace(/\s+/g, htmlSpace) : replacement
      const ordinalSup = range.value.match(/(<sup\b[^>]*>)(\s*)(st|nd|rd|th)(\s*)(<\/sup>)/i)

      if (ordinalSup && !/<sup\b/i.test(replacementWithOriginalSpacing)) {
        result += replacementWithOriginalSpacing.replace(
          /(\b(?:0?[1-9]|[12]\d|3[01]))(st|nd|rd|th)\b/i,
          (_, day: string, suffix: string) => `${day}${ordinalSup[1]}${ordinalSup[2]}${suffix}${ordinalSup[4]}${ordinalSup[5]}`,
        )
      } else {
        result += replacementWithOriginalSpacing
      }
    }

    cursor = range.end
  }

  return result + html.slice(cursor)
}
