import { describe, expect, it } from 'vitest'
import { advancedConverter } from './advanced'
import alphaProcessor from './basic/processors/alphaProcessor'
import financeProcessor from './basic/processors/financeProcessor'
import organicProcessor from './basic/processors/organicProcessor'
import redProcessor from './basic/processors/redProcessor'

const EDITOR_FIXTURE = `
  <p><span style="font-size: 28px; font-weight: bold;">Campaign headline</span></p>
  <p><span>Body copy with a price of $42 and a short explanation.</span></p>
  <p><span style="color: #0000FF;">Call to action</span></p>
  <p><img src="data:image/png;base64,iVBORw0KGgo=" alt="Dashboard preview"></p>
`

describe('legacy processor golden output', () => {
  it('keeps Finance HTML output stable', async () => {
    await expect(financeProcessor.exportHTML(EDITOR_FIXTURE, 'AB12')).resolves.toMatchSnapshot()
  })

  it('keeps Finance MJML output stable', async () => {
    await expect(financeProcessor.exportMJML(EDITOR_FIXTURE, 'AB12')).resolves.toMatchSnapshot()
  })

  it('keeps Alpha HTML output stable', async () => {
    await expect(alphaProcessor.exportHTML(EDITOR_FIXTURE, 'AB12')).resolves.toMatchSnapshot()
  })

  it('keeps Terra HTML output stable', async () => {
    await expect(organicProcessor.exportHTML(EDITOR_FIXTURE, 'AB12')).resolves.toMatchSnapshot()
  })

  it('keeps Red HTML output stable', async () => {
    await expect(redProcessor.exportHTML(EDITOR_FIXTURE, 'AB12')).resolves.toMatchSnapshot()
  })
})

describe('advanced processor golden output', () => {
  it('keeps Advanced Finance HTML output stable', async () => {
    advancedConverter.setCategory('finance')
    await expect(advancedConverter.exportHTML(EDITOR_FIXTURE, 'AB12')).resolves.toMatchSnapshot()
  })
})
