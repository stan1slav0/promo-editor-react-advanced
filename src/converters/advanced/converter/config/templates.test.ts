import { describe, expect, it } from 'vitest'
import { convertAdvanced } from '..'

describe('record row template', () => {
  it('keeps a single four-column row below a band as regular table cells', () => {
    const html = convertAdvanced(`
      <table>
        <tr><td colspan="4"><p>Summary</p></td></tr>
        <tr>
          <td><p>One</p></td>
          <td><p>Two</p></td>
          <td><p>Three</p></td>
          <td><p>Four</p></td>
        </tr>
      </table>
    `)

    expect(html).not.toContain('class="d-i-b"')
    expect(html).not.toContain('display:inline-block')
  })

  it('keeps multi-row records as regular table cells', () => {
    const html = convertAdvanced(`
      <table>
        <tr><td colspan="4"><p>Summary</p></td></tr>
        <tr>
          <td><p>One</p></td>
          <td><p>Two</p></td>
          <td><p>Three</p></td>
          <td><p>Four</p></td>
        </tr>
        <tr>
          <td><p>Five</p></td>
          <td><p>Six</p></td>
          <td><p>Seven</p></td>
          <td><p>Eight</p></td>
        </tr>
      </table>
    `)

    expect(html).not.toContain('class="d-i-b"')
  })
})

describe('stats grid template', () => {
  it('uses the configured side padding to calculate integer pixel widths', () => {
    const html = convertAdvanced(
      `
        <table>
          <tr>
            <td><p>One</p></td>
            <td><p>Two</p></td>
            <td><p>Three</p></td>
            <td><p>Four</p></td>
          </tr>
        </table>
      `,
      { layout: { sidePadding: 21 } },
    )

    expect(html.match(/class="d-i-b" width="139"/g)).toHaveLength(4)
    expect(html.match(/display:inline-block;width:139px/g)).toHaveLength(4)
  })

  it('uses pixel widths for a standalone stats grid', () => {
    const html = convertAdvanced(`
      <table>
        <tr>
          <td><p>One</p></td>
          <td><p>Two</p></td>
          <td><p>Three</p></td>
          <td><p>Four</p></td>
        </tr>
      </table>
    `)

    expect(html.match(/class="d-i-b" width="140"/g)).toHaveLength(4)
    expect(html.match(/display:inline-block;width:140px/g)).toHaveLength(4)
  })
})
