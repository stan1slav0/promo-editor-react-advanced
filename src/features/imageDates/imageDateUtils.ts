import { getDateGroupName } from '../dates/dateUtils'

export interface HtmlImageReference {
  src: string
  alt: string
}

export interface ImageHtmlFile {
  path: string
  name: string
  group: string
  content: string
  images: HtmlImageReference[]
}

export function extractHtmlImages(content: string): HtmlImageReference[] {
  const document = new DOMParser().parseFromString(content, 'text/html')
  return [...document.querySelectorAll('img[src], mj-image[src]')]
    .map((element) => ({ src: element.getAttribute('src')?.trim() || '', alt: element.getAttribute('alt') || '' }))
    .filter(({ src }) => Boolean(src) && !src.startsWith('data:'))
}

export function makeImageHtmlFile(path: string, content: string): ImageHtmlFile | null {
  const images = extractHtmlImages(content)
  if (!images.length) return null
  const name = path.split('/').pop() || path
  return { path, name, group: getDateGroupName(name), content, images }
}

export function nextImageName(src: string, used: Iterable<string>, outputExtension?: string): string {
  const name = decodeURIComponent(src.split(/[?#]/)[0].split('/').pop() || 'img-1.jpg')
  const match = name.match(/^(.*?)(\d+)(\.[a-z0-9]+)$/i)
  const base = match?.[1] || 'img-'
  const extension = outputExtension || match?.[3] || '.jpg'
  const usedNames = new Set([...used].map((value) => value.toLowerCase()))
  let index = (match ? Number(match[2]) : 1) + 1
  while (usedNames.has(`${base}${index}${extension}`.toLowerCase())) index++
  return `${base}${index}${extension}`
}

export function storageFolderUrl(imageUrl: string): string | null {
  try {
    const url = new URL(imageUrl)
    const buckets: Record<string, string> = {
      'storage.5th-elementagency.com': 'files',
      'alphaonest.com': 'alphaone',
      'ogfinstorage.com': 'organic',
      'reagstr.com': 'redeagle',
    }
    const browserMatch = url.hostname === 's3-browser.epcnetwork.dev'
      ? url.pathname.match(/^\/bucket\/(files|alphaone|organic|redeagle)\/(.+)\/[^/]+$/i)
      : null
    const publicMatch = url.pathname.match(/^\/files\/(.+)\/[^/]+$/i)
    const bucket = browserMatch?.[1].toLowerCase() || buckets[url.hostname.toLowerCase()]
    const folder = browserMatch?.[2] || publicMatch?.[1]
    if (!bucket || !folder) return null
    const encodedFolder = folder.split('/').map((part) => encodeURIComponent(decodeURIComponent(part))).join('/')
    return `https://s3-browser.epcnetwork.dev/bucket/${bucket}/${encodedFolder}/`
  } catch { return null }
}

function escapePattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escapeAttribute(value: string, quote: string): string {
  return value.replace(/&/g, '&amp;').replace(quote === '"' ? /"/g : /'/g, quote === '"' ? '&quot;' : '&#39;')
}

function decodeAttribute(value: string): string {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = value
  return textarea.value
}

export function replaceImageReference(content: string, oldSrc: string, newSrc: string, oldDate: string, newDate: string): string {
  return content.replace(/<(?:img|mj-image)\b[^>]*>/gi, (tag) => {
    const srcMatch = tag.match(/\bsrc\s*=\s*(["'])(.*?)\1/i)
    if (!srcMatch || decodeAttribute(srcMatch[2]) !== oldSrc) return tag
    let updated = tag.replace(srcMatch[0], srcMatch[0].replace(srcMatch[2], escapeAttribute(newSrc, srcMatch[1])))
    const altMatch = updated.match(/\balt\s*=\s*(["'])(.*?)\1/i)
    if (altMatch && newDate) {
      const datePattern = new RegExp(`(?<![A-Za-z0-9])${escapePattern(oldDate)}(?![A-Za-z0-9])`, 'gi')
      const originalAlt = decodeAttribute(altMatch[2])
      const nextAlt = oldDate && datePattern.test(originalAlt)
        ? originalAlt.replace(datePattern, newDate)
        : [originalAlt.trim(), newDate].filter(Boolean).join(' — ')
      updated = updated.replace(altMatch[0], altMatch[0].replace(altMatch[2], escapeAttribute(nextAlt, altMatch[1])))
    } else if (newDate) {
      updated = updated.replace(/\s*\/?\>$/, (end) => ` alt="${escapeAttribute(newDate, '"')}"${end}`)
    }
    return updated
  })
}

export function safePath(path: string): string {
  return path.split(/[\\/]+/).filter((part) => part && part !== '.' && part !== '..').join('/')
}
