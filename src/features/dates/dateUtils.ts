export interface DetectedDate {
  value: string
  count: number
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

  const escapedOriginals = originals.map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(escapedOriginals.join('|'), 'g')
  return html.replace(pattern, (original) => replacements.get(original) ?? original)
}
