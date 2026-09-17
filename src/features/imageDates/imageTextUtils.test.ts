import { describe, expect, it } from 'vitest'
import { imageChangeErrorMessage, recognizedTextFromAnalysis } from './imageTextUtils'

describe('selected-image text response', () => {
  it('uses the text returned by the updated Worker', () => {
    expect(recognizedTextFromAnalysis({ text: 'ONE ANSWER LEFT.', ocrText: 'October 15' })).toBe('ONE ANSWER LEFT.')
  })

  it('uses a date detected by an older Worker instead of reporting no text', () => {
    expect(recognizedTextFromAnalysis({ dates: [{ text: 'October 15' }], ocrText: 'October 15' })).toBe('October 15')
  })

  it('can use plain OCR output from an older Worker', () => {
    expect(recognizedTextFromAnalysis({ dates: [], ocrText: '"October 15"' })).toBe('October 15')
    expect(recognizedTextFromAnalysis({ dates: [], ocrText: 'NONE' })).toBe('')
  })
})

describe('image change errors', () => {
  it('explains provider output flagging without suggesting an automatic retry', () => {
    expect(imageChangeErrorMessage(new Error('3030: Your output has been flagged. Please choose another prompt / input image combination')))
      .toContain('model safety decision')
  })

  it('explains a slow generation timeout without claiming an upload happened', () => {
    expect(imageChangeErrorMessage(new Error('No response from the server after 120 seconds. Please try again.')))
      .toContain('No image was uploaded')
  })
})
