// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
// The deployment file is plain JavaScript and intentionally has no build dependency.
import worker from '../../../cloudflare/image-dates-worker.js'

afterEach(() => vi.unstubAllGlobals())

const env = {
  LICENSES_DB: { get: async () => 'storage-token' },
  AI: {
    run: async (_model: string, input: { task?: string }) => input.task === 'query'
      ? { answer: '["September 19"]' }
      : { objects: [{ x_min: 0.1, y_min: 0.2, x_max: 0.5, y_max: 0.3 }] },
  },
}

describe('image dates Worker redirects', () => {
  it('reports an unconfigured quota without exposing analytics credentials', async () => {
    const response = await worker.fetch(new Request('https://example.workers.dev/image-dates/quota', {
      headers: { Authorization: 'License test' },
    }), env)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ configured: false, limit: 10000 })
  })

  it('reads today’s account-wide Neuron usage through the Worker', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { viewer: { accounts: [{ aiInferenceAdaptiveGroups: [{ sum: { totalNeurons: 1250.5 } }] }] } } }), { headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const response = await worker.fetch(new Request('https://example.workers.dev/image-dates/quota', {
      headers: { Authorization: 'License test' },
    }), { ...env, CF_ACCOUNT_ID: 'a'.repeat(32), CF_ANALYTICS_TOKEN: 'private-analytics-token' })
    expect(response.status).toBe(200)
    const result = await response.json() as { configured: boolean; used: number; remaining: number; asOf: string }
    expect(result).toMatchObject({ configured: true, used: 1250.5, remaining: 8749.5 })
    expect(result.asOf).toMatch(/Z$/)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.cloudflare.com/client/v4/graphql')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer private-analytics-token')
    expect(JSON.parse(init.body as string).query).toContain('totalNeurons')
    expect(JSON.stringify(result)).not.toContain('private-analytics-token')
  })

  it('does not report a made-up balance when Analytics returns an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: [{ message: 'Permission denied' }] }), { headers: { 'Content-Type': 'application/json' } })))
    const response = await worker.fetch(new Request('https://example.workers.dev/image-dates/quota', {
      headers: { Authorization: 'License test' },
    }), { ...env, CF_ACCOUNT_ID: 'a'.repeat(32), CF_ANALYTICS_TOKEN: 'private-analytics-token' })
    expect(response.status).toBe(502)
    expect((await response.json() as { error: string }).error).toContain('could not provide')
  })

  it('edits only a supplied crop with the Cloudflare-hosted free-tier model', async () => {
    let receivedModel = ''
    let receivedForm: FormData | undefined
    const request = new Request('https://example.workers.dev/image-dates/change', {
      method: 'POST', headers: { Authorization: 'License test' },
      body: JSON.stringify({ imageBase64: '/9j/', from: 'AUGUST 15', to: 'AUGUST 19' }),
    })
    const response = await worker.fetch(request, {
      ...env,
      AI: { run: async (model: string, input: { multipart: { body: ReadableStream; contentType: string } }) => {
        receivedModel = model
        receivedForm = await new Response(input.multipart.body, { headers: { 'Content-Type': input.multipart.contentType } }).formData()
        return { image: '/9j/' }
      } },
    })
    expect(response.status, await response.clone().text()).toBe(200)
    expect(receivedModel).toBe('@cf/black-forest-labs/flux-2-klein-4b')
    expect(receivedForm?.get('prompt')).toContain('AUGUST 19')
    expect(receivedForm?.get('input_image_0')).toBeInstanceOf(File)
    expect(await response.json()).toEqual({ imageBase64: '/9j/', mimeType: 'image/jpeg' })
  })

  it('returns bytes for detailed browser-side scans without changing the source image', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([0xff, 0xd8, 0xff]), { headers: { 'Content-Type': 'image/jpeg' } })))
    const request = new Request('https://example.workers.dev/image-dates/source', {
      method: 'POST', headers: { Authorization: 'License test' },
      body: JSON.stringify({ imageUrl: 'https://alphaonest.com/files/a/img-1.jpg' }),
    })
    const response = await worker.fetch(request, env)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ imageBase64: '/9j/', mimeType: 'image/jpeg' })
  })

  it('extracts visible dates from a prose answer instead of requiring JSON', async () => {
    const request = new Request('https://example.workers.dev/image-dates/analyze', {
      method: 'POST', headers: { Authorization: 'License test' },
      body: JSON.stringify({ imageBase64: '/9j/' }),
    })
    const response = await worker.fetch(request, {
      ...env,
      AI: { run: async (_model: string, input: { task?: string }) => input.task === 'query'
        ? { answer: 'The image says September 19th, 2026.' }
        : { objects: [] } },
    })
    expect(response.status).toBe(200)
    const data = await response.json() as { dates: Array<{ text: string }>; ocrText: string }
    expect(data.dates.map((date) => date.text)).toEqual(['September 19th, 2026'])
    expect(data.ocrText).toContain('September 19th, 2026')
  })

  it('transcribes non-date text from the selected image crop', async () => {
    const request = new Request('https://example.workers.dev/image-dates/analyze', {
      method: 'POST', headers: { Authorization: 'License test' },
      body: JSON.stringify({ imageBase64: '/9j/', mode: 'text' }),
    })
    const response = await worker.fetch(request, {
      ...env,
      AI: { run: async () => ({ answer: '"IRAN HAS ONE ANSWER LEFT."' }) },
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ text: 'IRAN HAS ONE ANSWER LEFT.', ocrText: '"IRAN HAS ONE ANSWER LEFT."' })
  })

  it('falls back to Llama for non-date text when the first model sees none', async () => {
    const request = new Request('https://example.workers.dev/image-dates/analyze', {
      method: 'POST', headers: { Authorization: 'License test' },
      body: JSON.stringify({ imageBase64: '/9j/', mode: 'text' }),
    })
    const response = await worker.fetch(request, {
      ...env,
      AI: { run: async (model: string) => model.includes('llama') ? { response: 'SEE WHAT HAPPENS NEXT' } : { answer: '"NONE"' } },
    })
    expect(response.status).toBe(200)
    expect((await response.json() as { text: string }).text).toBe('SEE WHAT HAPPENS NEXT')
  })

  it('uses the existing Llama vision model if Moondream finds nothing', async () => {
    const calls: string[] = []
    const request = new Request('https://example.workers.dev/image-dates/analyze', {
      method: 'POST', headers: { Authorization: 'License test' },
      body: JSON.stringify({ imageBase64: '/9j/' }),
    })
    const response = await worker.fetch(request, {
      ...env,
      AI: { run: async (model: string, input: { task?: string }) => {
        calls.push(model)
        if (input.task === 'query') return { answer: '[]' }
        return model.includes('llama') ? { response: 'August 2026' } : { objects: [] }
      } },
    })
    expect(response.status).toBe(200)
    const data = await response.json() as { dates: Array<{ text: string }> }
    expect(data.dates.map((date) => date.text)).toEqual(['August 2026'])
    expect(calls.some((model) => model.includes('llama'))).toBe(true)
  })

  it('follows allowed source-image redirects manually', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: 'https://storage.5th-elementagency.com/files/a/img-1.jpg' } }))
      .mockResolvedValueOnce(new Response(new Uint8Array([0xff, 0xd8, 0xff]), { headers: { 'Content-Type': 'image/jpeg' } }))
    vi.stubGlobal('fetch', fetchMock)
    const request = new Request('https://example.workers.dev/image-dates/analyze', {
      method: 'POST', headers: { Authorization: 'License test' },
      body: JSON.stringify({ imageUrl: 'https://alphaonest.com/files/a/img-1.jpg' }),
    })
    const response = await worker.fetch(request, env)
    expect(response.status).toBe(200)
    const data = await response.json() as { dates: Array<{ text: string; box: { x: number; y: number; width: number; height: number } }> }
    expect(data.dates[0].text).toBe('September 19')
    expect(data.dates[0].box.width).toBeCloseTo(0.4)
    expect(fetchMock.mock.calls.every(([, options]) => options.redirect === 'manual')).toBe(true)
  })

  it('rejects redirects to a source host that is not allowlisted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { Location: 'https://unknown.example/private' } })))
    const request = new Request('https://example.workers.dev/image-dates/analyze', {
      method: 'POST', headers: { Authorization: 'License test' },
      body: JSON.stringify({ imageUrl: 'https://alphaonest.com/files/a/img-1.jpg' }),
    })
    const response = await worker.fetch(request, env)
    expect(response.status).toBe(500)
    expect((await response.json() as { error: string }).error).toContain('Image host not allowed')
  })

  it('follows generated-image redirects manually', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: 'https://images.cloudflare.com/generated.jpg' } }))
      .mockResolvedValueOnce(new Response(new Uint8Array([0xff, 0xd8, 0xff]), { headers: { 'Content-Type': 'image/jpeg' } }))
    vi.stubGlobal('fetch', fetchMock)
    const request = new Request('https://example.workers.dev/image-dates/change', {
      method: 'POST', headers: { Authorization: 'License test' },
      body: JSON.stringify({ imageBase64: '/9j/', from: 'September 19', to: 'April 30' }),
    })
    const response = await worker.fetch(request, {
      ...env,
      AI: { run: async () => ({ image: 'https://ai.cloudflare.com/output' }) },
    })
    expect(response.status).toBe(200)
    expect((await response.json() as { imageBase64: string }).imageBase64).toBe('/9j/')
    expect(fetchMock.mock.calls.every(([, options]) => options.redirect === 'manual')).toBe(true)
  })
})
