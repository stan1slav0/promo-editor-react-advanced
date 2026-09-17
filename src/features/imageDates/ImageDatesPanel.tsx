import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, PointerEvent as ReactPointerEvent } from 'react'
import JSZip from 'jszip'
import { toast } from 'react-toastify'
import { API_PROXY_URL } from '../../utils/config'
import { getLicenseKey } from '../../utils/licenseStorage'
import { type ImageHtmlFile, makeImageHtmlFile, nextImageName, replaceImageReference, safePath, storageFolderUrl } from './imageDateUtils'
import { getTextAnalysisRegion, type ImageRegion } from './imageCropUtils'
import { getEditPatch, selectedImageRegion, type PixelRect } from './imageEditUtils'
import { imageChangeErrorMessage, recognizedTextFromAnalysis, type TextAnalysisResponse } from './imageTextUtils'
import { withAbortTimeout } from './withAbortTimeout'

interface SelectedFile { file: File; path: string }
interface NeuronQuota { configured: boolean; limit: number; used?: number; remaining?: number; asOf?: string }
interface ImageItem {
  id: string
  src: string
  preview: string
  localFile?: File
  files: string[]
  recognizedText?: string
  ocrText?: string
  replacement: string
  selectedText: string
  generated?: string
  uploadedUrl?: string
  busy?: 'analyze' | 'change' | 'upload'
  changeStartedAt?: number
  progress?: string
  selection?: ImageRegion
  selecting?: boolean
  error?: string
}

const isHtml = (file: File) => /\.html?$/i.test(file.name)
const isImage = (file: File) => /\.(?:jpe?g|png|webp)$/i.test(file.name)
const fileVariant = (name: string) => /(?:^|[_\-. ])mjml(?:\.html?)?$/i.test(name) ? 'MJML' : 'HTML'
const fileFolder = (path: string) => path.split('/').slice(0, -1).join('/') || 'Selected files'

function readEntry(entry: FileSystemEntry): Promise<SelectedFile[]> {
  if (entry.isFile) return new Promise((resolve, reject) => {
    (entry as FileSystemFileEntry).file(
      (file) => resolve([{ file, path: safePath(entry.fullPath) || file.name }]), reject,
    )
  })
  if (!entry.isDirectory) return Promise.resolve([])
  const reader = (entry as FileSystemDirectoryEntry).createReader()
  return (async () => {
    const entries: FileSystemEntry[] = []
    let batch: FileSystemEntry[]
    do {
      batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject))
      entries.push(...batch)
    } while (batch.length)
    return (await Promise.all(entries.map(readEntry))).flat()
  })()
}

function localImagePath(htmlPath: string, src: string): string {
  try {
    const base = new URL(`https://local.invalid/${htmlPath}`)
    const resolved = new URL(src, base)
    return resolved.hostname === 'local.invalid' ? decodeURIComponent(resolved.pathname.slice(1)) : ''
  } catch { return '' }
}

async function loadPicture(src: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  const picture = new Image()
  await new Promise<void>((resolve, reject) => {
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      picture.onload = null
      picture.onerror = null
      if (error) reject(error)
      else resolve()
    }
    const onAbort = () => { finish(new Error('Operation canceled')); picture.src = '' }
    const timer = window.setTimeout(() => finish(new Error('Image loading timed out. Try again.')), 30_000)
    picture.onload = () => finish()
    picture.onerror = () => finish(new Error('Could not load the image'))
    signal?.addEventListener('abort', onAbort, { once: true })
    if (signal?.aborted) { onAbort(); return }
    picture.src = src
  })
  return picture
}

function cropPicture(picture: HTMLImageElement, region: ImageRegion): string {
  const canvas = document.createElement('canvas')
  const width = Math.round(picture.naturalWidth * region.width)
  const height = Math.round(picture.naturalHeight * region.height)
  const scale = Math.max(1, Math.min(4, 512 / Math.max(width, height)))
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable for image analysis')
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    picture,
    picture.naturalWidth * region.x, picture.naturalHeight * region.y,
    picture.naturalWidth * region.width, picture.naturalHeight * region.height,
    0, 0, canvas.width, canvas.height,
  )
  return canvas.toDataURL('image/jpeg', 0.95).split(',')[1]
}

function drawSourceCrop(picture: HTMLImageElement, crop: PixelRect): string {
  const canvas = document.createElement('canvas')
  canvas.width = crop.width
  canvas.height = crop.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable for image editing')
  context.drawImage(picture, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height)
  return canvas.toDataURL('image/jpeg', 0.95).split(',')[1]
}

function composeEditedImage(original: HTMLImageElement, edited: HTMLImageElement, crop: PixelRect, blend: PixelRect): string {
  const result = document.createElement('canvas')
  result.width = original.naturalWidth
  result.height = original.naturalHeight
  const resultContext = result.getContext('2d')
  if (!resultContext) throw new Error('Canvas is unavailable for image editing')
  resultContext.drawImage(original, 0, 0)

  const local = document.createElement('canvas')
  local.width = blend.width
  local.height = blend.height
  const context = local.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable for image editing')
  context.drawImage(
    edited,
    (blend.x - crop.x) / crop.width * edited.naturalWidth,
    (blend.y - crop.y) / crop.height * edited.naturalHeight,
    blend.width / crop.width * edited.naturalWidth,
    blend.height / crop.height * edited.naturalHeight,
    0, 0, blend.width, blend.height,
  )
  const pixels = context.getImageData(0, 0, blend.width, blend.height)
  const feather = Math.min(12, Math.floor(Math.min(blend.width, blend.height) / 4))
  for (let y = 0; y < blend.height; y++) {
    for (let x = 0; x < blend.width; x++) {
      const edge = Math.min(x, y, blend.width - 1 - x, blend.height - 1 - y)
      const index = (y * blend.width + x) * 4 + 3
      pixels.data[index] = Math.round(pixels.data[index] * Math.min(1, edge / Math.max(1, feather)))
    }
  }
  context.putImageData(pixels, 0, 0)
  resultContext.drawImage(local, blend.x, blend.y)
  return result.toDataURL('image/jpeg', 0.94)
}

async function callWorker<T>(path: string, payload: unknown, timeoutMs = 45_000, externalSignal?: AbortSignal): Promise<T> {
  const license = getLicenseKey()
  if (!license) throw new Error('Add your license key first')
  return withAbortTimeout(async (signal) => {
    const response = await fetch(`${API_PROXY_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `License ${license}` },
      body: JSON.stringify(payload),
      signal,
    })
    const data = await response.json().catch(() => ({})) as T & { error?: string }
    if (!response.ok) throw new Error(data.error || `Worker returned ${response.status}`)
    return data
  }, timeoutMs, externalSignal)
}

async function fetchNeuronQuota(): Promise<NeuronQuota> {
  const license = getLicenseKey()
  if (!license) throw new Error('Add your license key first')
  const response = await fetch(`${API_PROXY_URL}/image-dates/quota`, {
    headers: { Authorization: `License ${license}` },
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({})) as NeuronQuota & { error?: string }
  if (!response.ok) throw new Error(data.error || `Worker returned ${response.status}`)
  return data
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function ImageDatesPanel() {
  const [files, setFiles] = useState<ImageHtmlFile[]>([])
  const [images, setImages] = useState<ImageItem[]>([])
  const [dragging, setDragging] = useState(false)
  const [packing, setPacking] = useState(false)
  const [quota, setQuota] = useState<NeuronQuota | null>(null)
  const [quotaLoading, setQuotaLoading] = useState(false)
  const [quotaError, setQuotaError] = useState('')
  const [generationClock, setGenerationClock] = useState(Date.now())
  const quotaRequestId = useRef(0)
  const [expandedSidebarGroups, setExpandedSidebarGroups] = useState<Record<string, boolean>>({})
  const folderInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const previews = useRef<string[]>([])
  const selectionStart = useRef<{ id: string; x: number; y: number; previous?: ImageRegion } | null>(null)
  const changeControllers = useRef(new Map<string, AbortController>())

  useEffect(() => { if (folderInput.current) folderInput.current.webkitdirectory = true }, [])
  useEffect(() => () => previews.current.forEach(URL.revokeObjectURL), [])
  const isGenerating = images.some((image) => image.busy === 'change')
  useEffect(() => {
    if (!isGenerating) return
    const timer = window.setInterval(() => setGenerationClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [isGenerating])

  const refreshQuota = useCallback(async () => {
    const requestId = ++quotaRequestId.current
    setQuotaLoading(true)
    try {
      const result = await fetchNeuronQuota()
      if (requestId !== quotaRequestId.current) return
      setQuota(result)
      setQuotaError('')
    } catch (error) {
      if (requestId !== quotaRequestId.current) return
      setQuota(null)
      setQuotaError(String(error instanceof Error ? error.message : error))
    } finally { if (requestId === quotaRequestId.current) setQuotaLoading(false) }
  }, [])

  useEffect(() => {
    const requestIdRef = quotaRequestId
    void refreshQuota()
    const timer = window.setInterval(() => void refreshQuota(), 5 * 60_000)
    let midnightTimer: number
    const scheduleMidnightRefresh = () => {
      const nextMidnight = new Date()
      nextMidnight.setUTCHours(24, 0, 0, 0)
      midnightTimer = window.setTimeout(() => {
        void refreshQuota()
        scheduleMidnightRefresh()
      }, nextMidnight.getTime() - Date.now() + 1000)
    }
    scheduleMidnightRefresh()
    return () => { window.clearInterval(timer); window.clearTimeout(midnightTimer); requestIdRef.current++ }
  }, [refreshQuota])

  const groups = useMemo(() => {
    const grouped = new Map<string, ImageHtmlFile[]>()
    files.forEach((file) => grouped.set(file.group, [...(grouped.get(file.group) || []), file]))
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  }, [files])

  const updateImage = (id: string, patch: Partial<ImageItem>) => setImages((current) => current.map((image) => image.id === id ? { ...image, ...patch } : image))

  async function getSourcePicture(image: ImageItem, signal?: AbortSignal): Promise<HTMLImageElement> {
    if (image.localFile) return loadPicture(image.preview, signal)
    const data = await callWorker<{ imageBase64: string; mimeType: string }>('/image-dates/source', { imageUrl: image.src }, 45_000, signal)
    return loadPicture(`data:${data.mimeType};base64,${data.imageBase64}`, signal)
  }

  function pointInPreview(event: ReactPointerEvent<HTMLDivElement>): { x: number; y: number } {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    }
  }

  function onSelectionStart(event: ReactPointerEvent<HTMLDivElement>, image: ImageItem) {
    if (image.busy) return
    const point = pointInPreview(event)
    selectionStart.current = { id: image.id, ...point, previous: image.selection }
    event.currentTarget.setPointerCapture(event.pointerId)
    updateImage(image.id, { selection: selectedImageRegion(point.x, point.y, point.x, point.y), selecting: true })
  }

  function onSelectionMove(event: ReactPointerEvent<HTMLDivElement>, image: ImageItem) {
    if (image.busy) return
    const start = selectionStart.current
    if (!start || start.id !== image.id) return
    const point = pointInPreview(event)
    updateImage(image.id, { selection: selectedImageRegion(start.x, start.y, point.x, point.y) })
  }

  function onSelectionEnd(event: ReactPointerEvent<HTMLDivElement>, image: ImageItem) {
    if (image.busy) return
    const start = selectionStart.current
    if (!start || start.id !== image.id) return
    const point = pointInPreview(event)
    const selection = selectedImageRegion(start.x, start.y, point.x, point.y)
    selectionStart.current = null
    if (selection.width <= 0.005 || selection.height <= 0.005) {
      updateImage(image.id, { selection: start.previous, selecting: false })
      return
    }
    updateImage(image.id, { selecting: false })
    void analyzeArea(image, selection)
  }

  async function loadSelected(selected: SelectedFile[]) {
    try {
      previews.current.forEach(URL.revokeObjectURL)
      previews.current = []
      const htmlFiles = (await Promise.all(selected.filter(({ file }) => isHtml(file)).map(async ({ file, path }) =>
        makeImageHtmlFile(safePath(path), await file.text()),
      ))).filter((file): file is ImageHtmlFile => file !== null)
      if (!htmlFiles.length) {
        setFiles([])
        setImages([])
        toast.info('No HTML files with images found')
        return
      }
      const assets = new Map(selected.filter(({ file }) => isImage(file)).map(({ file, path }) => [safePath(path).toLowerCase(), file]))
      const found = new Map<string, ImageItem>()
      for (const htmlFile of htmlFiles) {
        for (const reference of htmlFile.images) {
          const localPath = localImagePath(htmlFile.path, reference.src)
          const localFile = assets.get(localPath.toLowerCase())
          const id = localFile ? `local:${localPath}` : reference.src
          const existing = found.get(id)
          if (existing) { if (!existing.files.includes(htmlFile.path)) existing.files.push(htmlFile.path); continue }
          const preview = localFile ? URL.createObjectURL(localFile) : reference.src
          if (localFile) previews.current.push(preview)
          found.set(id, { id, src: reference.src, preview, localFile, files: [htmlFile.path], replacement: '', selectedText: '' })
        }
      }
      setFiles(htmlFiles)
      setImages([...found.values()])
      setExpandedSidebarGroups({})
      toast.success(`${htmlFiles.length} HTML files with images loaded`)
    } catch { toast.error('Could not read selected folders') }
  }

  function onInput(event: ChangeEvent<HTMLInputElement>) {
    void loadSelected([...event.target.files || []].map((file) => ({ file, path: file.webkitRelativePath || file.name })))
    event.target.value = ''
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    const entries = [...event.dataTransfer.items].map((item) => item.webkitGetAsEntry()).filter((entry): entry is FileSystemEntry => Boolean(entry))
    void (entries.length ? Promise.all(entries.map(readEntry)).then((parts) => parts.flat()) : Promise.resolve([...event.dataTransfer.files].map((file) => ({ file, path: file.name }))))
      .then(loadSelected).catch(() => toast.error('Could not read dropped folders'))
  }

  async function analyzeArea(image: ImageItem, selection: ImageRegion) {
    const toastId = toast.loading('Analyzing text in the selected area…')
    updateImage(image.id, { busy: 'analyze', progress: undefined, selection, recognizedText: undefined, selectedText: '', ocrText: undefined, error: undefined, generated: undefined, uploadedUrl: undefined })
    try {
      const picture = await getSourcePicture(image)
      const region = getTextAnalysisRegion(selection, picture.naturalWidth, picture.naturalHeight)
      const result = await callWorker<TextAnalysisResponse>('/image-dates/analyze', {
        imageBase64: cropPicture(picture, region),
        mode: 'text',
      })
      const text = recognizedTextFromAnalysis(result)
      updateImage(image.id, { busy: undefined, progress: undefined, recognizedText: text, ocrText: result.ocrText, selectedText: text })
      const legacyResponse = result.text === undefined && result.dates !== undefined
      toast.update(toastId, { render: text ? legacyResponse ? 'Text found. Update the Worker to recognize non-date text too.' : 'Text recognized. Check it before replacing.' : 'No text recognized. You can enter it manually.', type: text ? 'success' : 'info', isLoading: false, autoClose: 5000 })
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error)
      updateImage(image.id, { busy: undefined, progress: undefined, recognizedText: '', error: message })
      toast.update(toastId, { render: `Text analysis failed: ${message}`, type: 'error', isLoading: false, autoClose: 8000 })
    } finally { void refreshQuota() }
  }

  async function change(image: ImageItem) {
    if (changeControllers.current.has(image.id)) return
    if (!image.selectedText.trim() || !image.replacement.trim()) return
    if (!image.selection) { updateImage(image.id, { error: 'Select the text area on the image first' }); return }
    const controller = new AbortController()
    changeControllers.current.set(image.id, controller)
    const toastId = toast.loading('Preparing image for text replacement…')
    const startedAt = Date.now()
    setGenerationClock(startedAt)
    updateImage(image.id, { busy: 'change', changeStartedAt: startedAt, progress: 'Loading the original image…', error: undefined, generated: undefined, uploadedUrl: undefined })
    try {
      const original = await getSourcePicture(image, controller.signal)
      if (controller.signal.aborted) throw new Error('Operation canceled')
      const patch = getEditPatch(image.selection, original.naturalWidth, original.naturalHeight)
      updateImage(image.id, { progress: 'AI is replacing the selected text… This may take up to 2 minutes.' })
      toast.update(toastId, { render: 'AI is replacing the selected text…', isLoading: true })
      const result = await callWorker<{ imageBase64: string; mimeType: string }>('/image-dates/change', {
        imageBase64: drawSourceCrop(original, patch.crop),
        from: image.selectedText.trim(),
        to: image.replacement.trim(),
      }, 120_000, controller.signal)
      if (controller.signal.aborted) throw new Error('Operation canceled')
      updateImage(image.id, { progress: 'Preparing the preview…' })
      const edited = await loadPicture(`data:${result.mimeType || 'image/png'};base64,${result.imageBase64}`, controller.signal)
      if (controller.signal.aborted) throw new Error('Operation canceled')
      const generated = composeEditedImage(original, edited, patch.crop, patch.blend)
      updateImage(image.id, { busy: undefined, progress: undefined, generated })
      toast.update(toastId, { render: 'New image is ready. Check the text before uploading.', type: 'success', isLoading: false, autoClose: 5000 })
    } catch (error) {
      if (controller.signal.aborted) {
        updateImage(image.id, { busy: undefined, progress: undefined })
        toast.update(toastId, { render: 'Generation canceled. No image was uploaded.', type: 'info', isLoading: false, autoClose: 5000 })
      } else {
        const message = imageChangeErrorMessage(error)
        updateImage(image.id, { busy: undefined, progress: undefined, error: message })
        toast.update(toastId, { render: `Image replacement failed: ${message}`, type: 'error', isLoading: false, autoClose: 8000 })
      }
    } finally { changeControllers.current.delete(image.id); void refreshQuota() }
  }

  function cancelChange(id: string) {
    const controller = changeControllers.current.get(id)
    if (!controller) return
    controller.abort()
  }

  async function upload(image: ImageItem) {
    if (!image.generated) return
    if (!/^https:\/\//i.test(image.src)) {
      const message = 'A public source URL is required to determine the upload folder.'
      updateImage(image.id, { error: message })
      toast.error(message)
      return
    }
    const toastId = toast.loading('Uploading the new image to S3…')
    updateImage(image.id, { busy: 'upload', error: undefined })
    try {
      const used = images.map((item) => decodeURIComponent(item.src.split(/[?#]/)[0].split('/').pop() || ''))
      let result: { url: string } | undefined
      let filename = ''
      for (let attempt = 0; attempt < 10; attempt++) {
        filename = nextImageName(image.src, used, '.jpg')
        try {
          result = await callWorker<{ url: string }>('/image-dates/upload', {
            imageBase64: image.generated.split(',')[1], originalUrl: image.src, filename,
          })
          break
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes('already exists')) throw error
          used.push(filename)
        }
      }
      if (!result) throw new Error('No free image filename found after 10 attempts')
      updateImage(image.id, { busy: undefined, uploadedUrl: result.url })
      const folderUrl = storageFolderUrl(result.url) || storageFolderUrl(image.src)
      toast.update(toastId, {
        render: () => <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center', width: '100%' }}>
          <span>{filename} Uploaded.</span>
          <a href={folderUrl || result.url} target="_blank" rel="noopener noreferrer" className="s3-toast-button">📂 {folderUrl ? 'Open S3 Folder' : 'Open uploaded image'}</a>
        </div>,
        type: 'success', isLoading: false, autoClose: false, closeOnClick: false, closeButton: true,
      })
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error)
      updateImage(image.id, { busy: undefined, error: message })
      toast.update(toastId, { render: `Image upload failed: ${message}`, type: 'error', isLoading: false, autoClose: 8000 })
    }
  }

  function updatedHtml(file: ImageHtmlFile): string {
    let content = file.content
    for (const image of images) if (image.uploadedUrl) {
      content = replaceImageReference(content, image.src, image.uploadedUrl, image.selectedText, image.replacement.trim())
    }
    return content
  }

  function previewFile(file: ImageHtmlFile) {
    const url = URL.createObjectURL(new Blob([updatedHtml(file)], { type: 'text/html;charset=utf-8' }))
    const previewWindow = window.open(url, '_blank')
    if (previewWindow) {
      previewWindow.opener = null
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } else {
      URL.revokeObjectURL(url)
      toast.error('Allow pop-ups to open the HTML preview')
    }
  }

  function linkedFiles(image: ImageItem): ImageHtmlFile[] {
    return image.files
      .map((path) => files.find((file) => file.path === path))
      .filter((file): file is ImageHtmlFile => Boolean(file))
      .sort((left, right) => (fileVariant(left.name) === 'HTML' ? 0 : 1) - (fileVariant(right.name) === 'HTML' ? 0 : 1)
        || left.path.localeCompare(right.path, undefined, { numeric: true }))
  }

  async function downloadUpdatedFiles(image: ImageItem) {
    if (!image.uploadedUrl) return
    const affected = files.filter((file) => image.files.includes(file.path))
    if (!affected.length) return
    setPacking(true)
    try {
      if (affected.length === 1) {
        const file = affected[0]
        downloadBlob(new Blob([updatedHtml(file)], { type: 'text/html;charset=utf-8' }), file.name)
      } else {
        const zip = new JSZip()
        affected.forEach((file) => zip.file(safePath(file.path), updatedHtml(file)))
        const blob = await zip.generateAsync({ type: 'blob' })
        const imageName = decodeURIComponent(image.src.split(/[?#]/)[0].split('/').pop() || 'image').replace(/\.[^.]+$/, '')
        downloadBlob(blob, `image-text-changes-${imageName}.zip`)
      }
    } catch { toast.error('Could not download updated HTML files') }
    finally { setPacking(false) }
  }

  return <div className="dates-workspace image-dates-workspace">
    <section className="dates-upload-panel">
      <div className="dates-panel-heading"><span className="dates-step">01</span><div><h2>HTML folders & images</h2><p>Drop Lift folders with HTML and image files</p></div></div>
      <input ref={folderInput} className="dates-file-input" type="file" multiple onChange={onInput} />
      <input ref={fileInput} className="dates-file-input" type="file" multiple accept=".html,.htm,.jpg,.jpeg,.png,.webp" onChange={onInput} />
      <div className={`dates-dropzone ${dragging ? 'is-dragging' : ''}`} role="button" tabIndex={0}
        onClick={() => folderInput.current?.click()} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') folderInput.current?.click() }}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
        <span className="dates-dropzone__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></svg></span><strong>Drop folders here</strong>
        <span className="dates-picker-actions"><button type="button" onClick={(event) => { event.stopPropagation(); folderInput.current?.click() }}>Choose folder</button><button type="button" onClick={(event) => { event.stopPropagation(); fileInput.current?.click() }}>Choose files</button></span>
      </div>
      {files.length > 0 && <div className="dates-file-list"><div className="dates-file-list__summary"><span className="dates-file-list__stats"><span>{files.length} {files.length === 1 ? 'file' : 'files'} · {groups.length} {groups.length === 1 ? 'group' : 'groups'}</span></span><button type="button" onClick={() => { previews.current.forEach(URL.revokeObjectURL); previews.current = []; setFiles([]); setImages([]); setExpandedSidebarGroups({}) }}>Clear</button></div>
        <div className="dates-sidebar-scroll">{groups.map(([name, groupFiles]) => <div className={`dates-sidebar-group ${expandedSidebarGroups[name] ? 'is-expanded' : 'is-collapsed'}`} key={name}>
          <div className="dates-sidebar-group__name" role="button" tabIndex={0} aria-expanded={Boolean(expandedSidebarGroups[name])}
            onClick={() => setExpandedSidebarGroups((current) => ({ ...current, [name]: !current[name] }))}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setExpandedSidebarGroups((current) => ({ ...current, [name]: !current[name] })) } }}>
            <span>{name}</span><span className="dates-sidebar-group__meta"><small>{groupFiles.length}</small><span className="dates-sidebar-group__toggle" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 6l4.5 4 4.5-4" /></svg></span></span>
          </div>
          {expandedSidebarGroups[name] && <div className="dates-sidebar-group__files">{groupFiles.map((file) => <div className="dates-file-item" key={file.path} role="button" tabIndex={0} title="Open HTML preview in a new tab"
            onClick={() => previewFile(file)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); previewFile(file) } }}>
            <span className={`dates-file-item__type dates-file-item__type_${fileVariant(file.name).toLowerCase()}`}>{fileVariant(file.name)}</span>
            <span className="dates-file-item__copy"><span className="dates-file-item__name" title={file.name}>{file.name}</span><small title={fileFolder(file.path)}>{fileFolder(file.path)}</small></span>
            <span className="dates-file-item__count" title="Images in HTML">{file.images.length}</span>
          </div>)}</div>}
        </div>)}</div></div>}
    </section>
    <section className="dates-results-panel image-dates-results">
      <div className="image-dates-heading"><div className="dates-panel-heading"><span className="dates-step">02</span><div><h2>Text on images</h2><p>Select, read and replace any text</p></div></div><div className="image-dates-quota" title={quotaError || (quota?.configured ? `Analytics snapshot: ${quota.asOf || 'just now'}. Approximate, not a billing balance.` : 'Configure CF_ACCOUNT_ID and CF_ANALYTICS_TOKEN in the Worker to show the estimated balance.')}>
        <div className="image-dates-quota__copy"><strong>{quota?.configured && typeof quota.remaining === 'number' ? `≈ ${Math.round(quota.remaining).toLocaleString('en-US')} Neurons left` : quotaLoading ? 'Checking usage…' : quota?.configured === false ? 'Connect Analytics in Worker' : 'Usage unavailable'}</strong><span>Resets at 00:00 UTC</span></div>
        <button type="button" className={`image-dates-quota__refresh ${quotaLoading ? 'is-loading' : ''}`} aria-label="Refresh Neuron usage" title="Refresh Neuron usage" disabled={quotaLoading} onClick={() => void refreshQuota()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.5 5.8M20 4v7h-7" /></svg></button>
      </div></div>
      <div className="image-dates-scroll">{images.length ? images.map((image) => <article className="image-dates-card" key={image.id}>
        <div className="image-dates-card-head"><strong>{decodeURIComponent(image.src.split(/[?#]/)[0].split('/').pop() || image.src)}</strong><div className="image-dates-card-head__actions"><span>{image.files.length} files</span>{image.uploadedUrl && <button type="button" className="image-dates-download-button" disabled={packing} onClick={() => void downloadUpdatedFiles(image)}>{packing ? 'Preparing…' : `Download HTML files${image.files.length > 1 ? ` (${image.files.length})` : ''}`}</button>}</div></div>
        <div className={`image-dates-comparison ${image.generated || image.busy === 'change' ? 'has-generated' : ''}`}>
          <div className="image-dates-image-column"><span className="image-dates-image-label">Original · drag over the text</span>
            <div className="image-dates-preview">
              <img src={image.preview} alt="Original image; drag to select text" draggable={false} />
              {image.selection && <span className="image-dates-selection-box" style={{ left: `${image.selection.x * 100}%`, top: `${image.selection.y * 100}%`, width: `${image.selection.width * 100}%`, height: `${image.selection.height * 100}%` }} />}
              <div className={`image-dates-selection-layer ${image.busy ? 'is-busy' : ''}`} aria-label={image.busy ? 'Image is being processed; selection is temporarily unavailable' : 'Drag around the text on this image'}
                onPointerDown={(event) => onSelectionStart(event, image)} onPointerMove={(event) => onSelectionMove(event, image)} onPointerUp={(event) => onSelectionEnd(event, image)}
                onPointerCancel={() => { const previous = selectionStart.current?.previous; selectionStart.current = null; updateImage(image.id, { selection: previous, selecting: false }) }} />
            </div>
          </div>
          {image.generated && <div className="image-dates-generated image-dates-image-column"><span className="image-dates-image-label">New image · review before uploading</span><img src={image.generated} alt="Image with the replaced text" /></div>}
          {image.busy === 'change' && <div className="image-dates-generating image-dates-image-column" role="status" aria-live="polite"><span className="image-dates-image-label">New image</span><div className="image-dates-generating-placeholder"><span className="image-dates-spinner" aria-hidden="true" /><strong>{image.progress || 'Generating image…'}</strong><small>{Math.max(0, Math.floor((generationClock - (image.changeStartedAt || generationClock)) / 1000))}s elapsed · AI request times out after 2 minutes</small><button type="button" onClick={() => cancelChange(image.id)}>Cancel generation</button></div></div>}
        </div>
        <details className="image-dates-linked-files"><summary>Used in {image.files.length} {image.files.length === 1 ? 'HTML file' : 'HTML files'}<span className="image-dates-linked-files__chevron" aria-hidden="true" /></summary><div className="image-dates-linked-files__list">{linkedFiles(image).map((file) => <button type="button" className="image-dates-linked-file" key={file.path} title={`Open ${file.path} in a new tab`} onClick={() => previewFile(file)}>
          <span className={`dates-file-item__type dates-file-item__type_${fileVariant(file.name).toLowerCase()}`}>{fileVariant(file.name)}</span><span className="dates-file-item__copy"><span className="dates-file-item__name">{file.name}</span><small>{fileFolder(file.path)}</small></span>
        </button>)}</div></details>
        {!image.selecting && image.busy !== 'analyze' && image.recognizedText === '' && !image.error && <p className="image-dates-no-text">No text recognized in this area. Enter it manually or select another area.</p>}
        {!image.selecting && image.busy !== 'analyze' && image.recognizedText === '' && image.ocrText && <details className="image-dates-ocr"><summary>What AI read</summary><p>{image.ocrText}</p></details>}
        {image.selection && !image.selecting && image.busy !== 'analyze' && image.recognizedText !== undefined && <div className="image-dates-actions">
          <div className="image-dates-fields"><label className="image-dates-text-field">Text found in selection<textarea aria-label="Text found in selected area" placeholder="Original text" rows={2} maxLength={300} value={image.selectedText} onChange={(event) => updateImage(image.id, { selectedText: event.target.value, generated: undefined, uploadedUrl: undefined })} /></label><label className="image-dates-text-field">Replace with<textarea aria-label="Replacement text" placeholder="Enter new text" rows={2} maxLength={300} value={image.replacement} onChange={(event) => updateImage(image.id, { replacement: event.target.value, generated: undefined, uploadedUrl: undefined })} /></label><button type="button" className="image-dates-change-button" disabled={Boolean(image.busy) || !image.selectedText.trim() || !image.replacement.trim()} onClick={() => void change(image)}>{image.busy === 'change' ? 'Changing…' : 'Change image'}</button></div>
          <div className="image-dates-card-toolbar"><span className="image-dates-card-status">{image.uploadedUrl ? 'Image uploaded · HTML ready' : image.generated ? 'Preview ready · check the new text' : image.busy === 'change' ? 'Generating new image…' : 'Edit the text, then generate a preview'}</span>{image.generated && !image.uploadedUrl && <div className="image-dates-card-buttons"><button type="button" disabled={Boolean(image.busy)} onClick={() => void upload(image)}>{image.busy === 'upload' ? 'Uploading…' : 'Upload to server'}</button></div>}</div>
        </div>}
        {image.error && <p className="image-dates-error">{image.error}</p>}
      </article>) : <p className="dates-no-results">Add folders to see HTML files containing images.</p>}</div>
    </section>
  </div>
}
