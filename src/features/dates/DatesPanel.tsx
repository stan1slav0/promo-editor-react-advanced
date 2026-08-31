import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { toast } from 'react-toastify'
import {
  detectDates,
  getDateGroupName,
  normalizeDateKey,
  replaceDates,
  type DetectedDate,
} from './dateUtils'

interface SelectedFile {
  file: File
  relativePath: string
}

interface AnalyzedFile {
  id: string
  name: string
  relativePath: string
  sourceFolder: string
  groupName: string
  content: string
  dates: DetectedDate[]
}

interface AggregatedDate {
  key: string
  displayValue: string
  count: number
  fileIds: Set<string>
}

interface FileGroup {
  id: string
  name: string
  files: AnalyzedFile[]
  dates: AggregatedDate[]
}

const isHtmlFile = (file: File) => /\.html?$/i.test(file.name) || file.type === 'text/html'

const safeArchiveName = (value: string) => {
  const normalized = value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-')
  return normalized || 'updated-dates'
}

const safeZipPath = (value: string) => value
  .split(/[\\/]+/)
  .filter((part) => part && part !== '.' && part !== '..')
  .join('/')

const downloadArchiveBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const getVariantLabel = (fileName: string) => /(?:^|[_\-. ])mjml(?:\.html?)?$/i.test(fileName)
  ? 'MJML'
  : 'HTML'

const getSourceFolder = (relativePath: string) => {
  const parts = relativePath.split(/[\\/]+/).filter(Boolean)
  parts.pop()
  return parts.join('/') || 'Selected files'
}

const naturalCompare = (left: string, right: string) => left.localeCompare(
  right,
  undefined,
  { numeric: true, sensitivity: 'base' },
)

function aggregateDates(files: AnalyzedFile[]): AggregatedDate[] {
  const aggregated = new Map<string, AggregatedDate>()

  for (const file of files) {
    for (const date of file.dates) {
      const key = normalizeDateKey(date.value)
      const existing = aggregated.get(key)
      if (existing) {
        existing.count += date.count
        existing.fileIds.add(file.id)
      } else {
        aggregated.set(key, {
          key,
          displayValue: date.value,
          count: date.count,
          fileIds: new Set([file.id]),
        })
      }
    }
  }

  return [...aggregated.values()]
}

function readFileEntry(entry: FileSystemFileEntry): Promise<SelectedFile> {
  return new Promise((resolve, reject) => {
    entry.file(
      (file) => resolve({ file, relativePath: entry.fullPath.replace(/^\/+/, '') || file.name }),
      reject,
    )
  })
}

function readDirectoryBatch(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject))
}

async function readEntry(entry: FileSystemEntry): Promise<SelectedFile[]> {
  if (entry.isFile) return [await readFileEntry(entry as FileSystemFileEntry)]
  if (!entry.isDirectory) return []

  const reader = (entry as FileSystemDirectoryEntry).createReader()
  const entries: FileSystemEntry[] = []
  let batch: FileSystemEntry[]

  do {
    batch = await readDirectoryBatch(reader)
    entries.push(...batch)
  } while (batch.length > 0)

  return (await Promise.all(entries.map(readEntry))).flat()
}

export function DatesPanel() {
  const [files, setFiles] = useState<AnalyzedFile[]>([])
  const [replacements, setReplacements] = useState<Record<string, string>>({})
  const [groupOverrides, setGroupOverrides] = useState<Record<string, Record<string, string>>>({})
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [isDragging, setIsDragging] = useState(false)
  const [isPacking, setIsPacking] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (folderInputRef.current) folderInputRef.current.webkitdirectory = true
  }, [])

  const groups = useMemo<FileGroup[]>(() => {
    const grouped = new Map<string, Omit<FileGroup, 'dates'>>()

    for (const file of files) {
      const id = file.groupName.toLocaleLowerCase('en-US')
      const existing = grouped.get(id)
      if (existing) existing.files.push(file)
      else grouped.set(id, { id, name: file.groupName, files: [file] })
    }

    return [...grouped.values()]
      .map((group) => {
        const sortedFiles = [...group.files].sort((left, right) => naturalCompare(left.relativePath, right.relativePath))
        return {
          ...group,
          files: sortedFiles,
          dates: aggregateDates(sortedFiles),
        }
      })
      .sort((left, right) => naturalCompare(left.name, right.name))
  }, [files])

  const aggregatedDates = useMemo(() => aggregateDates(files), [files])

  const archiveBaseName = useMemo(() => {
    const firstFile = files[0]
    if (!firstFile) return 'date-changes'

    const groupName = getDateGroupName(firstFile.name)
    const nameWithoutTrailingNumber = groupName
      .replace(/[\s_-]*\d+$/u, '')
      .replace(/[\s_-]+$/u, '')
    const sourceName = nameWithoutTrailingNumber || groupName
    return safeArchiveName(`date-changes-${sourceName}`)
  }, [files])

  const analyzeFiles = useCallback(async (selectedFiles: SelectedFile[]) => {
    const htmlFiles = selectedFiles.filter(({ file }) => isHtmlFile(file))
    if (htmlFiles.length === 0) {
      toast.error('No HTML files found in the selected folders')
      return
    }

    try {
      const analyzed = await Promise.all(htmlFiles.map(async ({ file, relativePath }, index) => {
        const content = await file.text()
        const normalizedPath = safeZipPath(relativePath) || file.name
        return {
          id: `${normalizedPath}-${file.lastModified}-${file.size}-${index}`,
          name: file.name,
          relativePath: normalizedPath,
          sourceFolder: getSourceFolder(normalizedPath),
          groupName: getDateGroupName(file.name),
          content,
          dates: detectDates(content),
        }
      }))

      const initialReplacements: Record<string, string> = {}
      for (const file of analyzed) {
        for (const date of file.dates) {
          const key = normalizeDateKey(date.value)
          initialReplacements[key] ??= date.value
        }
      }

      setFiles(analyzed)
      setReplacements(initialReplacements)
      setGroupOverrides({})
      setExpandedGroups({})
      if (htmlFiles.length !== selectedFiles.length) {
        toast.info(`${selectedFiles.length - htmlFiles.length} non-HTML files skipped`)
      }
    } catch {
      toast.error('Could not read one or more folders')
    }
  }, [])

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []).map((file) => ({
      file,
      relativePath: file.webkitRelativePath || file.name,
    }))
    void analyzeFiles(selected)
    event.target.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)

    const entries = Array.from(event.dataTransfer.items)
      .map((item) => item.webkitGetAsEntry())
      .filter((entry): entry is FileSystemEntry => entry !== null)
    const fallbackFiles = Array.from(event.dataTransfer.files).map((file) => ({
      file,
      relativePath: file.name,
    }))

    void (async () => {
      try {
        const selected = entries.length
          ? (await Promise.all(entries.map(readEntry))).flat()
          : fallbackFiles
        await analyzeFiles(selected)
      } catch {
        toast.error('Could not read the dropped folders')
      }
    })()
  }

  const getUpdatedContent = useCallback((file: AnalyzedFile) => {
    const groupId = file.groupName.toLocaleLowerCase('en-US')
    return replaceDates(
      file.content,
      new Map(file.dates.map((date) => {
        const key = normalizeDateKey(date.value)
        const groupValue = groupOverrides[groupId]?.[key]
        return [date.value, groupValue || replacements[key] || date.value]
      })),
    )
  }, [groupOverrides, replacements])

  const downloadGroupFiles = (group: FileGroup) => {
    for (const file of group.files) {
      saveAs(
        new Blob([getUpdatedContent(file)], { type: 'text/html;charset=utf-8' }),
        file.name,
      )
    }
    toast.success(`${group.files.length} updated ${group.files.length === 1 ? 'file' : 'files'} downloaded`)
  }

  const downloadAllArchive = async () => {
    setIsPacking(true)
    try {
      const zip = new JSZip()
      const folderRoots = files.map((file) => file.relativePath.split('/')[0])
      const commonRoot = folderRoots.length > 0 && folderRoots.every((root) => root === folderRoots[0])
        ? folderRoots[0]
        : null

      for (const group of groups) {
        for (const file of group.files) {
          const hasFolderPath = file.relativePath.includes('/')
          const pathWithoutCommonRoot = commonRoot && file.relativePath.startsWith(`${commonRoot}/`)
            ? file.relativePath.slice(commonRoot.length + 1)
            : file.relativePath
          const archivePath = hasFolderPath
            ? pathWithoutCommonRoot
            : groups.length > 1
              ? `${safeArchiveName(group.name)}/${file.name}`
              : file.name
          zip.file(archivePath, getUpdatedContent(file))
        }
      }

      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      })
      downloadArchiveBlob(blob, `${archiveBaseName}.zip`)
      toast.success(`${files.length} updated ${files.length === 1 ? 'file' : 'files'} packed into ZIP`)
    } catch {
      toast.error('Could not create ZIP archive')
    } finally {
      setIsPacking(false)
    }
  }

  const updateGroupOverride = (groupId: string, dateKey: string, value: string) => {
    setGroupOverrides((current) => ({
      ...current,
      [groupId]: {
        ...current[groupId],
        [dateKey]: value,
      },
    }))
  }

  const clearFiles = useCallback(() => {
    setFiles([])
    setReplacements({})
    setGroupOverrides({})
    setExpandedGroups({})
  }, [])

  useEffect(() => {
    const handleResetShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.key.toLowerCase() !== 'r') return
      event.preventDefault()
      event.stopPropagation()
      clearFiles()
      toast.info('All date files and replacements cleared', {
        autoClose: 2000,
        hideProgressBar: true,
        closeButton: false,
      })
    }

    window.addEventListener('keydown', handleResetShortcut, true)
    return () => window.removeEventListener('keydown', handleResetShortcut, true)
  }, [clearFiles])

  const removeFile = (fileId: string) => {
    setFiles((current) => current.filter((file) => file.id !== fileId))
  }

  return (
    <div className="dates-workspace">
      <section className="dates-upload-panel">
        <div className="dates-panel-heading">
          <span className="dates-step">01</span>
          <div>
            <h2>HTML folders</h2>
            <p>Upload Lift 1, Lift 2, Lift 3 and other folders</p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          className="dates-file-input"
          type="file"
          accept=".html,.htm,text/html"
          multiple
          onChange={handleInputChange}
        />
        <input
          ref={folderInputRef}
          className="dates-file-input"
          type="file"
          multiple
          onChange={handleInputChange}
        />
        <div
          className={`dates-dropzone ${isDragging ? 'is-dragging' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => folderInputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') folderInputRef.current?.click()
          }}
          onDragEnter={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <span className="dates-dropzone__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></svg>
          </span>
          <strong>Drop folders here</strong>
          <span className="dates-picker-actions">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                folderInputRef.current?.click()
              }}
            >Choose folder</button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                fileInputRef.current?.click()
              }}
            >Choose files</button>
          </span>
        </div>

        {files.length > 0 && (
          <div className="dates-file-list">
            <div className="dates-file-list__summary">
              <span>{files.length} {files.length === 1 ? 'file' : 'files'} · {groups.length} {groups.length === 1 ? 'group' : 'groups'}</span>
              <button type="button" onClick={clearFiles}>Clear</button>
            </div>
            <div className="dates-sidebar-scroll">
              {groups.map((group) => (
                <div className="dates-sidebar-group" key={group.id}>
                  <div className="dates-sidebar-group__name">
                    <span>{group.name}</span>
                    <small>{group.files.length}</small>
                  </div>
                  {group.files.map((file) => (
                    <div className="dates-file-item" key={file.id}>
                      <span className={`dates-file-item__type dates-file-item__type_${getVariantLabel(file.name).toLowerCase()}`}>
                        {getVariantLabel(file.name)}
                      </span>
                      <span className="dates-file-item__copy">
                        <span className="dates-file-item__name" title={file.name}>{file.name}</span>
                        <small title={file.sourceFolder}>{file.sourceFolder}</small>
                      </span>
                      <span className="dates-file-item__count">{file.dates.length}</span>
                      <button
                        type="button"
                        className="dates-file-item__remove"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => removeFile(file.id)}
                      >×</button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="dates-results-panel">
        <div className="dates-results-header">
          <div className="dates-panel-heading">
            <span className="dates-step">02</span>
            <div>
              <h2>Date replacements</h2>
              <p>{files.length
                ? `${aggregatedDates.length} unique dates across ${files.length} files`
                : 'Upload folders to start analysis'}</p>
            </div>
          </div>
          {files.length > 0 && (
            <button
              type="button"
              className="main-btn dates-download-all"
              disabled={isPacking}
              title={`Download ${archiveBaseName}.zip`}
              onClick={() => void downloadAllArchive()}
            >
              <span>{isPacking ? 'Packing…' : 'Download all ZIP'}</span>
            </button>
          )}
        </div>

        {files.length === 0 ? (
          <div className="dates-empty-state">
            <span aria-hidden="true">Aa</span>
            <p>Grouped files, common replacements and group overrides will appear here.</p>
          </div>
        ) : (
          <div className="dates-results-content">
            <article className="dates-common-card">
              <header className="dates-common-card__header">
                <div>
                  <h3>Replace everywhere</h3>
                  <span>One value changes every occurrence in every uploaded file</span>
                </div>
                <span className="dates-common-card__scope">ALL FILES</span>
              </header>

              {aggregatedDates.length > 0 ? (
                <div className="dates-fields">
                  {aggregatedDates.map((date) => (
                    <label className="dates-field-row" key={date.key}>
                      <span className="dates-original">
                        <span>{date.displayValue}</span>
                        <small>×{date.count}</small>
                        <small>{date.fileIds.size} {date.fileIds.size === 1 ? 'file' : 'files'}</small>
                      </span>
                      <span className="dates-arrow" aria-hidden="true">→</span>
                      <input
                        type="text"
                        value={replacements[date.key] ?? date.displayValue}
                        aria-label={`Replace ${date.displayValue} everywhere`}
                        onChange={(event) => setReplacements((current) => ({
                          ...current,
                          [date.key]: event.target.value,
                        }))}
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <p className="dates-no-results">The uploaded folders do not contain a supported date format.</p>
              )}
            </article>

            <div className="dates-groups-heading">
              <span>Group overrides</span>
              <small>{groups.length}</small>
            </div>

            <div className="dates-groups-scroll">
              {groups.map((group) => (
                <article
                  className={`dates-result-card ${expandedGroups[group.id] ? 'is-expanded' : 'is-collapsed'}`}
                  key={group.id}
                >
                  <header className="dates-result-card__header">
                    <div>
                      <h3>{group.name}</h3>
                      <span>{group.files.length} linked {group.files.length === 1 ? 'file' : 'files'} · {group.dates.length} unique dates</span>
                    </div>
                    <div className="dates-result-card__actions">
                      <button
                        type="button"
                        className="dates-download-one"
                        onClick={() => downloadGroupFiles(group)}
                      >
                        Download files
                      </button>
                      <button
                        type="button"
                        className="dates-group-toggle"
                        aria-label={`${expandedGroups[group.id] ? 'Collapse' : 'Expand'} ${group.name}`}
                        aria-expanded={Boolean(expandedGroups[group.id])}
                        onClick={() => setExpandedGroups((current) => ({
                          ...current,
                          [group.id]: !current[group.id],
                        }))}
                      >
                        <svg viewBox="0 0 16 16" aria-hidden="true">
                          <path d="M3.5 6l4.5 4 4.5-4" />
                        </svg>
                      </button>
                    </div>
                  </header>

                  {expandedGroups[group.id] && (
                    <div className="dates-result-card__body">
                      {group.dates.length > 0 && (
                        <div className="dates-group-overrides">
                          <div className="dates-group-overrides__intro">
                            <span>Only for {group.name}</span>
                            <small>Leave blank to use the common replacement</small>
                          </div>
                          <div className="dates-fields">
                            {group.dates.map((date) => (
                              <label className="dates-field-row dates-field-row_group" key={date.key}>
                                <span className="dates-original">
                                  <span>{date.displayValue}</span>
                                  <small>×{date.count}</small>
                                </span>
                                <span className="dates-arrow" aria-hidden="true">→</span>
                                <input
                                  type="text"
                                  value={groupOverrides[group.id]?.[date.key] ?? ''}
                                  placeholder={`Common: ${replacements[date.key] ?? date.displayValue}`}
                                  aria-label={`Replace ${date.displayValue} in ${group.name} only`}
                                  onChange={(event) => updateGroupOverride(group.id, date.key, event.target.value)}
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="dates-group-files">
                        {group.files.map((file) => (
                          <div className="dates-group-file" key={file.id}>
                            <span className={`dates-group-file__type dates-group-file__type_${getVariantLabel(file.name).toLowerCase()}`}>
                              {getVariantLabel(file.name)}
                            </span>
                            <span className="dates-group-file__copy">
                              <span className="dates-group-file__name">{file.name}</span>
                              <small title={file.sourceFolder}>{file.sourceFolder}</small>
                            </span>
                            <span className="dates-group-file__dates">
                              {file.dates.length
                                ? file.dates.map((date) => <small key={date.value}>{date.value} ×{date.count}</small>)
                                : <small>No dates</small>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
