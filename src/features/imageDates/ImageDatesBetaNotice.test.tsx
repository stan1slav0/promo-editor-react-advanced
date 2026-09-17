import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ImageDatesBetaNotice } from './ImageDatesBetaNotice'

describe('image editing beta notice', () => {
  let host: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    localStorage.clear()
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    HTMLDialogElement.prototype.showModal = function () { this.open = true }
    HTMLDialogElement.prototype.close = function () { this.open = false }
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  it('keeps the tool locked after closing and unlocks only after agreement', () => {
    act(() => root.render(<ImageDatesBetaNotice><div data-testid="tool">Editor</div></ImageDatesBetaNotice>))
    const dialog = host.querySelector('dialog')!
    const checkbox = host.querySelector('input[type="checkbox"]') as HTMLInputElement
    const agreeButton = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Agree and continue')!
    const closeButton = host.querySelector('[aria-label="Close instructions"]') as HTMLButtonElement
    const openButton = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Open instructions')!

    expect(dialog.open).toBe(true)
    expect(agreeButton.disabled).toBe(true)
    expect(host.querySelector('[data-testid="tool"]')).toBeNull()

    act(() => closeButton.click())
    expect(dialog.open).toBe(false)
    expect(host.querySelector('.image-dates-locked')).not.toBeNull()
    expect(host.querySelector('[data-testid="tool"]')).toBeNull()
    expect(localStorage.getItem('promo-editor:image-dates-beta-read')).toBeNull()

    act(() => openButton.click())
    expect(dialog.open).toBe(true)

    const cancel = new Event('cancel', { cancelable: true })
    act(() => dialog.dispatchEvent(cancel))
    expect(cancel.defaultPrevented).toBe(true)
    expect(dialog.open).toBe(false)
    expect(host.querySelector('[data-testid="tool"]')).toBeNull()

    act(() => openButton.click())

    act(() => checkbox.click())
    expect(agreeButton.disabled).toBe(false)
    act(() => agreeButton.click())
    expect(dialog.open).toBe(false)
    expect(localStorage.getItem('promo-editor:image-dates-beta-read')).toBe('true')
    expect(host.querySelector('[data-testid="tool"]')).not.toBeNull()
    expect(host.querySelector('.image-dates-locked')).toBeNull()
  })

  it('does not reopen after a fresh mount when already acknowledged', () => {
    localStorage.setItem('promo-editor:image-dates-beta-read', 'true')
    act(() => root.render(<ImageDatesBetaNotice><div data-testid="tool">Editor</div></ImageDatesBetaNotice>))
    expect(host.querySelector('dialog')?.open).toBe(false)
    expect(host.querySelector('[data-testid="tool"]')).not.toBeNull()
  })
})
