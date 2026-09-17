import { useEffect, useRef, useState, type ReactNode } from 'react'

const ACKNOWLEDGED_KEY = 'promo-editor:image-dates-beta-read'

function wasAcknowledged(): boolean {
  try { return window.localStorage.getItem(ACKNOWLEDGED_KEY) === 'true' }
  catch { return false }
}

export function ImageDatesBetaNotice({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [acknowledged, setAcknowledged] = useState(wasAcknowledged)
  const [hasRead, setHasRead] = useState(false)
  const [showInstructions, setShowInstructions] = useState(true)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!acknowledged && showInstructions && !dialog.open) dialog.showModal()
    if ((acknowledged || !showInstructions) && dialog.open) dialog.close()
  }, [acknowledged, showInstructions])

  function closeInstructions() {
    setShowInstructions(false)
  }

  function confirm() {
    if (!hasRead) return
    try { window.localStorage.setItem(ACKNOWLEDGED_KEY, 'true') }
    catch { /* still dismiss for this session if browser storage is unavailable */ }
    setAcknowledged(true)
  }

  return <>
    {acknowledged ? children : <div className="image-dates-locked" role="region" aria-labelledby="image-dates-locked-title">
      <div className="image-dates-locked__card">
        <span className="image-dates-beta-dialog__eyebrow">Text on images <span>Beta</span></span>
        <h2 id="image-dates-locked-title">Read the instructions to unlock this tool</h2>
        <p>Before using this beta service, please read the instructions and agree to them. The tool will remain unavailable until you do.</p>
        <button type="button" className="image-dates-beta-dialog__continue" onClick={() => setShowInstructions(true)}>Open instructions</button>
      </div>
    </div>}
    <dialog ref={dialogRef} className="image-dates-beta-dialog" aria-labelledby="image-dates-beta-title" aria-describedby="image-dates-beta-description" onCancel={(event) => { event.preventDefault(); closeInstructions() }}>
    <div className="image-dates-beta-dialog__body">
      <button type="button" className="image-dates-beta-dialog__close" aria-label="Close instructions" onClick={closeInstructions}>×</button>
      <span className="image-dates-beta-dialog__eyebrow">Text on images <span>Beta</span></span>
      <h2 id="image-dates-beta-title">Before you begin</h2>
      <p id="image-dates-beta-description">This tool uses AI to replace text on images. Results can vary, so always review the new image before uploading it.</p>
      <ol>
        <li>Add folders with HTML files; include local images if the HTML references them.</li>
        <li>Drag over the text on an image, check what AI read, and enter the replacement.</li>
        <li>Select <strong>Change image</strong>, review the preview, then select <strong>Upload to server</strong>.</li>
        <li>Download the updated HTML files and check them before use.</li>
      </ol>
      <p className="image-dates-beta-dialog__note">Some images may be rejected by Cloudflare. Nothing is uploaded until you choose <strong>Upload to server</strong>.</p>
      <label className="image-dates-beta-dialog__acknowledge"><input type="checkbox" checked={hasRead} onChange={(event) => setHasRead(event.target.checked)} /><span>I have read and agree to the instructions</span></label>
      <button type="button" className="image-dates-beta-dialog__continue" disabled={!hasRead} onClick={confirm}>Agree and continue</button>
    </div>
    </dialog>
  </>
}
