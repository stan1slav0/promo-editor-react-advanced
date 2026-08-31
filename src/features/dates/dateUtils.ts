export interface DetectedDate {
  value: string
  count: number
}

export interface DateContext {
  before: string
  match: string
  after: string
}

export function getDateGroupName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.html?$/i, '')
  const withoutVariant = withoutExtension.replace(/(?:[_.\- ]+(?:html|mjml))$/i, '')
  return withoutVariant || withoutExtension || fileName
}

export function normalizeDateKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US')
}

const MONTH = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?'
const DAY = '(?:0?[1-9]|[12]\\d|3[01])(?:st|nd|rd|th)?'
const YEAR = '(?:(?:19|20)\\d{2})'

const DATE_PATTERNS = [
  new RegExp(`\\b${MONTH}\\s+${DAY}(?:\\s*,?\\s*${YEAR})?\\b`, 'gi'),
  new RegExp(`\\b${DAY}\\s+(?:of\\s+)?${MONTH}(?:\\s*,?\\s*${YEAR})?\\b`, 'gi'),
  new RegExp(`\\b${YEAR}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\\d|3[01])\\b`, 'g'),
  new RegExp(`\\b(?:0?[1-9]|[12]\\d|3[01])[-/.](?:0?[1-9]|1[0-2])[-/.]${YEAR}\\b`, 'g'),
]

interface MatchRange {
  start: number
  end: number
  value: string
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
  if (!dateValue.trim()) return []

  const text = htmlToReadableText(html)
  const pattern = new RegExp(escapeRegExp(dateValue).replace(/\s+/g, '[\\s\\u00a0]+'), 'gi')
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
  const ranges: MatchRange[] = []

  for (const pattern of DATE_PATTERNS) {
    pattern.lastIndex = 0
    for (const match of html.matchAll(pattern)) {
      const start = match.index
      const end = start + match[0].length
      if (ranges.some((range) => start < range.end && end > range.start)) continue
      ranges.push({ start, end, value: match[0] })
    }
  }

  ranges.sort((left, right) => left.start - right.start)
  const detected = new Map<string, DetectedDate>()

  for (const range of ranges) {
    const existing = detected.get(range.value)
    if (existing) existing.count += 1
    else detected.set(range.value, { value: range.value, count: 1 })
  }

  return [...detected.values()]
}

export function replaceDates(html: string, replacements: ReadonlyMap<string, string>): string {
  const originals = [...replacements]
    .filter(([original, replacement]) => original && replacement !== original)
    .map(([original]) => original)
    .sort((left, right) => right.length - left.length)

  if (originals.length === 0) return html

  const escapedOriginals = originals.map(escapeRegExp)
  const pattern = new RegExp(escapedOriginals.join('|'), 'g')
  return html.replace(pattern, (original) => replacements.get(original) ?? original)
}
