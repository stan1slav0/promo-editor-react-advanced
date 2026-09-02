import { toast } from 'react-toastify'
import type { Id, TypeOptions } from 'react-toastify'
import { mapWithConcurrency } from './asyncPool'
import { API_PROXY_URL, DEFAULT_IMAGE_CONCURRENCY } from './config'
import { isAbortError } from './errors'
import {
  getBlobFromSrc,
  getCategoryImageMaxWidth,
  processImageForEmail,
  setExportImageWidth,
} from './imageProcessor'
import { getLicenseKey } from './licenseStorage'

interface PreparedImage {
  fileName: string
  blob: Blob
}

interface UploadDestination {
  parent: string
  folder: string
  browserUrl: string
}

export interface S3UploadOptions {
  signal?: AbortSignal
  concurrency?: number
}

export interface S3UploadResult {
  uploadedCount: number
  existsCount: number
  failedCount: number
  browserUrl: string
}

function getDestination(
  category: string,
  letters: string,
  digits: string,
): UploadDestination {
  switch (category.toLowerCase()) {
    case 'alpha':
      return {
        parent: 'alpha',
        folder: `promo/${letters}/lift-${digits}`,
        browserUrl: `https://s3-browser.epcnetwork.dev/bucket/alphaone/promo/${letters}/lift-${digits}/`,
      }
    case 'terra':
      return {
        parent: 'organic',
        folder: `creatives/${letters}/creative-${digits}`,
        browserUrl: `https://s3-browser.epcnetwork.dev/bucket/organic/creatives/${letters}/creative-${digits}/`,
      }
    case 'red':
      return {
        parent: 'redeagle',
        folder: `promo/${letters}/lift-${digits}`,
        browserUrl: `https://s3-browser.epcnetwork.dev/bucket/redeagle/promo/${letters}/lift-${digits}/`,
      }
    default: {
      const normalizedCategory = category.toLowerCase() || 'finance'
      return {
        parent: 'global',
        folder: `Promo/${normalizedCategory}/${letters}/lift-${digits}`,
        browserUrl: `https://s3-browser.epcnetwork.dev/bucket/files/Promo/${encodeURIComponent(normalizedCategory)}/${letters}/lift-${digits}/`,
      }
    }
  }
}

function updateLoadingToast(toastId: Id | undefined, message: string): void {
  if (toastId === undefined) return
  toast.update(toastId, { render: message, type: 'info', isLoading: true })
}

export async function uploadImagesToS3(
  images: Iterable<HTMLImageElement>,
  folderName: string,
  activeCategory: string,
  toastId?: Id,
  { signal, concurrency = DEFAULT_IMAGE_CONCURRENCY }: S3UploadOptions = {},
): Promise<S3UploadResult | null> {
  const letters = folderName.replace(/[^a-zA-Z]/g, '').toLowerCase()
  const digits = folderName.replace(/[^0-9]/g, '')

  if (!letters || !digits) {
    if (toastId !== undefined) {
      toast.update(toastId, {
        render: '❌ Invalid folder format (e.g. AA10)',
        type: 'error',
        isLoading: false,
        autoClose: 5000,
      })
    }
    return null
  }

  const licenseKey = getLicenseKey()
  if (!licenseKey) {
    if (toastId !== undefined) {
      toast.update(toastId, {
        render: '❌ Missing License Key S3',
        type: 'error',
        isLoading: false,
        autoClose: 4000,
      })
    }
    return null
  }

  const imageList = Array.from(images)
  const maxImageWidth = getCategoryImageMaxWidth(activeCategory)
  const imageWord = imageList.length === 1 ? 'image' : 'images'
  const destination = getDestination(activeCategory, letters, digits)
  updateLoadingToast(toastId, `⚙️ Preparing ${imageList.length} ${imageWord}...`)

  try {
    const prepared = await mapWithConcurrency(
      imageList,
      concurrency,
      async (image, index): Promise<PreparedImage | null> => {
        const src = image.getAttribute('src')
        if (!src) return null

        try {
          const sourceBlob = await getBlobFromSrc(src, signal)
          if (!sourceBlob) return null
          const { outBlob, targetW } = await processImageForEmail(
            sourceBlob,
            maxImageWidth,
            '#ffffff',
          )
          setExportImageWidth(image, targetW)
          return { fileName: `img-${index + 1}.jpg`, blob: outBlob }
        } catch (error) {
          if (isAbortError(error)) throw error
          console.error(`Image preparation failed [${index + 1}]:`, error)
          return null
        }
      },
      signal,
    )
    const preparedImages = prepared.filter(
      (image): image is PreparedImage => image !== null,
    )

    if (preparedImages.length === 0) {
      if (toastId !== undefined) toast.dismiss(toastId)
      return null
    }

    updateLoadingToast(toastId, `🚀 Uploading ${preparedImages.length} ${imageWord} to S3...`)

    const statuses = await mapWithConcurrency(
      preparedImages,
      concurrency,
      async (image): Promise<'uploaded' | 'exists' | 'failed'> => {
        const apiPath = `${destination.folder}/${image.fileName}`
        const originalUrl = `https://public.epcnetwork.dev/upload?parent=${destination.parent}&path=${apiPath}&overwrite=0`
        const apiUrl = `${API_PROXY_URL}/?url=${encodeURIComponent(originalUrl)}`

        try {
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'image/jpeg',
              Authorization: `License ${licenseKey}`,
            },
            body: image.blob,
            signal,
          })
          const responseText = await response.text()

          if (response.ok) return 'uploaded'
          if (response.status === 409 || responseText.includes('already exists')) {
            return 'exists'
          }
          return 'failed'
        } catch (error) {
          if (isAbortError(error)) throw error
          console.error(`S3 Upload error [${image.fileName}]:`, error)
          return 'failed'
        }
      },
      signal,
    )

    const result: S3UploadResult = {
      uploadedCount: statuses.filter((status) => status === 'uploaded').length,
      existsCount: statuses.filter((status) => status === 'exists').length,
      failedCount: statuses.filter((status) => status === 'failed').length,
      browserUrl: destination.browserUrl,
    }

    let statusType: TypeOptions = 'success'
    const parts: string[] = []
    if (result.uploadedCount) parts.push(`Uploaded ${result.uploadedCount} ${result.uploadedCount === 1 ? 'image' : 'images'} to S3 Server`)
    if (result.existsCount) parts.push(`${result.existsCount} ${result.existsCount === 1 ? 'image' : 'images'} already exist`)
    if (result.failedCount) parts.push(`Failed: ${result.failedCount}`)
    if (result.failedCount) statusType = result.uploadedCount ? 'warning' : 'error'
    else if (!result.uploadedCount && result.existsCount) statusType = 'warning'

    if (toastId !== undefined) {
      toast.update(toastId, {
        render: () => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center', width: '100%' }}>
            <span>{parts.join(' | ') || '❌ S3 Upload failed.'}</span>
            <a
              href={destination.browserUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="s3-toast-button"
            >
              📂 Open S3 Folder
            </a>
          </div>
        ),
        type: statusType,
        isLoading: false,
        autoClose: false,
        closeOnClick: false,
        closeButton: true,
      })
    }

    return result
  } catch (error) {
    if (isAbortError(error) && toastId !== undefined) toast.dismiss(toastId)
    throw error
  }
}
