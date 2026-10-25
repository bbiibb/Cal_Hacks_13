import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChatError } from './chat_types'
import { ConvexChatClient } from './convex_chat_client'

const context = { procedure_slug: 'tavi', step_index: 1, selected_structure_id: null }
const audio = new Blob(['x'], { type: 'audio/webm' })
const ok = (value: unknown) => ({ status: 'success', value })
const json = (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), init)
const answer = { message: 'Hello', scene_actions: [{ type: 'goto_step', step_index: 3 }], side_panel: null, sources: [] }

type Call = { url: string; body: { path?: string; args?: Record<string, unknown> } | Blob | undefined }

function mockFetch(handler: (url: string, body: Call['body']) => Response | Promise<Response>) {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const body = typeof init.body === 'string' ? (JSON.parse(init.body) as Call['body']) : (init.body as Blob)
      calls.push({ url, body })
      return handler(url, body)
    }),
  )
  return calls
}

function happyPath(url: string, body: Call['body']): Response {
  if (url.startsWith('https://upload.test')) return json({ storageId: 'sid1' })
  const path = (body as { path: string }).path
  if (path === 'speech:generateUploadUrl') return json(ok('https://upload.test/u'))
  if (path === 'chat:createSession') return json(ok('sess1'))
  return json(ok({ transcript: ' what is a valve ', language: 'en', response: answer }))
}

afterEach(() => vi.unstubAllGlobals())

describe('ConvexChatClient.askByVoice', () => {
  it('uploads the audio, then asks by voice with the storage id, context, and session', async () => {
    const calls = mockFetch(happyPath)
    const reply = await new ConvexChatClient('https://x.convex.cloud/', 'tavi').askByVoice(audio, context)

    expect(reply.transcript).toBe('what is a valve')
    expect(reply.response.message).toBe('Hello')
    expect(reply.followUps.length).toBeGreaterThan(0) // follow-ups for the goto_step target
    const upload = calls.find((c) => c.url === 'https://upload.test/u')
    expect(upload?.body).toBe(audio)
    const voiceCall = calls[calls.length - 1].body as { path: string; args: Record<string, unknown> }
    expect(voiceCall.path).toBe('chat:askByVoice')
    expect(voiceCall.args).toEqual({ storageId: 'sid1', context, sessionId: 'sess1' })
  })

  it('still asks when the session cannot be created', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const calls = mockFetch((url, body) =>
      (body as { path?: string } | undefined)?.path === 'chat:createSession'
        ? json({ status: 'error', errorMessage: 'nope' })
        : happyPath(url, body),
    )
    await new ConvexChatClient('https://x.convex.cloud', 'tavi').askByVoice(audio, context)
    expect((calls[calls.length - 1].body as { args: object }).args).not.toHaveProperty('sessionId')
  })

  it('passes through the backend error code when no speech is detected', async () => {
    mockFetch((url, body) =>
      (body as { path?: string } | undefined)?.path === 'chat:askByVoice'
        ? json({ status: 'error', errorData: { code: 'no_speech_detected', message: 'Nothing heard' } })
        : happyPath(url, body),
    )
    await expect(new ConvexChatClient('https://x.convex.cloud', 'tavi').askByVoice(audio, context)).rejects.toMatchObject({
      name: 'ChatError',
      code: 'no_speech_detected',
    })
  })

  it('fails with upload_failed when the upload is rejected or has no storage id', async () => {
    for (const upload of [json({}, { status: 500 }), json({ nothing: true })]) {
      mockFetch((url, body) => (url.startsWith('https://upload.test') ? upload : happyPath(url, body)))
      const error = await new ConvexChatClient('https://x.convex.cloud', 'tavi').askByVoice(audio, context).catch((e) => e)
      expect(error).toBeInstanceOf(ChatError)
      expect(error.code).toBe('upload_failed')
    }
  })

  it('reports a network error when the upload cannot be reached', async () => {
    mockFetch((url, body) => {
      if (url.startsWith('https://upload.test')) throw new TypeError('offline')
      return happyPath(url, body)
    })
    await expect(new ConvexChatClient('https://x.convex.cloud', 'tavi').askByVoice(audio, context)).rejects.toMatchObject({
      code: 'network',
    })
  })

  it('treats an empty transcript as no speech', async () => {
    mockFetch((url, body) =>
      (body as { path?: string } | undefined)?.path === 'chat:askByVoice'
        ? json(ok({ transcript: '  ', response: answer }))
        : happyPath(url, body),
    )
    await expect(new ConvexChatClient('https://x.convex.cloud', 'tavi').askByVoice(audio, context)).rejects.toMatchObject({
      code: 'no_speech_detected',
    })
  })
})

describe('ConvexChatClient.close', () => {
  it('deletes the conversation with a request that survives the page closing', async () => {
    const calls = mockFetch(happyPath)
    const client = new ConvexChatClient('https://x.convex.cloud/', 'tavi')
    await client.ask({ message: 'Hi', context })
    client.close()

    const last = calls[calls.length - 1]
    expect(last.url).toBe('https://x.convex.cloud/api/mutation')
    expect(last.body).toEqual({ path: 'chat:deleteSession', args: { sessionId: 'sess1' }, format: 'json' })
    const init = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls.at(-1)![1]
    expect(init.keepalive).toBe(true)
  })

  it('does nothing when no conversation was started', () => {
    const calls = mockFetch(happyPath)
    new ConvexChatClient('https://x.convex.cloud', 'tavi').close()
    expect(calls).toHaveLength(0)
  })

  it('sends the deletion only once, and a later question starts a new conversation', async () => {
    const calls = mockFetch(happyPath)
    const client = new ConvexChatClient('https://x.convex.cloud', 'tavi')
    await client.ask({ message: 'Hi', context })
    client.close()
    client.close()
    expect(calls.filter((c) => (c.body as { path?: string }).path === 'chat:deleteSession')).toHaveLength(1)

    await client.ask({ message: 'Hello again', context })
    expect(calls.filter((c) => (c.body as { path?: string }).path === 'chat:createSession')).toHaveLength(2)
  })

  it('never throws, even when the request cannot be sent', async () => {
    const client = new ConvexChatClient('https://x.convex.cloud', 'tavi')
    mockFetch(happyPath)
    await client.ask({ message: 'Hi', context })
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
    expect(() => client.close()).not.toThrow()
  })
})

describe('ConvexChatClient.ask speed', () => {
  it('sends the speed the patient chose, and nothing when they did not choose', async () => {
    const calls = mockFetch(happyPath)
    const client = new ConvexChatClient('https://x.convex.cloud', 'tavi')
    await client.ask({ message: 'hi', context, speed: 'fast' })
    await client.ask({ message: 'hi', context })
    const asks = calls.filter((c) => (c.body as { path?: string }).path === 'chat:ask').map((c) => (c.body as { args: Record<string, unknown> }).args)
    expect(asks[0]).toMatchObject({ speed: 'fast' })
    expect(asks[1]).not.toHaveProperty('speed')
  })

  it('sends the speed with a voice question too', async () => {
    const calls = mockFetch(happyPath)
    await new ConvexChatClient('https://x.convex.cloud', 'tavi').askByVoice(audio, context, 'slow')
    expect((calls[calls.length - 1].body as { args: Record<string, unknown> }).args).toMatchObject({ speed: 'slow' })
  })
})
