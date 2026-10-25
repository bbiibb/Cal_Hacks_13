import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pickMimeType, VoiceError, VoiceRecorder, type RecorderEnvironment } from './voice_recorder'

class FakeRecorder {
  state: 'inactive' | 'recording' = 'inactive'
  mimeType = 'audio/webm'
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null
  private readonly bytes: string
  constructor(bytes: string) {
    this.bytes = bytes
  }
  start() {
    this.state = 'recording'
  }
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob([this.bytes], { type: this.mimeType }) })
    this.onstop?.()
  }
}

function setup(options: { bytes?: string; getUserMediaError?: Error } = {}) {
  const track = { stop: vi.fn() }
  const stream = { getTracks: () => [track] } as unknown as MediaStream
  const fake = new FakeRecorder(options.bytes ?? 'audio')
  const env: RecorderEnvironment = {
    getUserMedia: vi.fn(async () => {
      if (options.getUserMediaError) throw options.getUserMediaError
      return stream
    }),
    createRecorder: () => fake as unknown as MediaRecorder,
    isTypeSupported: () => true,
  }
  return { env, track, fake }
}

const named = (name: string) => Object.assign(new Error(name), { name })

describe('pickMimeType', () => {
  it('prefers webm/opus and falls back to mp4 for Safari', () => {
    expect(pickMimeType(() => true)).toBe('audio/webm;codecs=opus')
    expect(pickMimeType((t) => t === 'audio/mp4')).toBe('audio/mp4')
    expect(pickMimeType(() => false)).toBeUndefined()
  })
})

describe('VoiceRecorder', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('records, resolves with the audio, and releases the microphone', async () => {
    const { env, track } = setup()
    const recorder = new VoiceRecorder(() => {}, 30_000, env)
    await recorder.start()
    expect(recorder.isRecording).toBe(true)
    const audio = await recorder.stop()
    expect(audio.size).toBeGreaterThan(0)
    expect(audio.type).toBe('audio/webm')
    expect(track.stop).toHaveBeenCalledTimes(1)
    expect(recorder.isRecording).toBe(false)
  })

  it('stops by itself after the maximum length and reports the audio', async () => {
    const { env, track } = setup()
    const onAutoStop = vi.fn()
    const recorder = new VoiceRecorder(onAutoStop, 1_000, env)
    await recorder.start()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(onAutoStop).toHaveBeenCalledTimes(1)
    expect(onAutoStop.mock.calls[0][0]).toBeInstanceOf(Blob)
    expect(track.stop).toHaveBeenCalled()
  })

  it('cancel releases the microphone and drops the audio', async () => {
    const { env, track } = setup()
    const recorder = new VoiceRecorder(() => {}, 30_000, env)
    await recorder.start()
    recorder.cancel()
    expect(track.stop).toHaveBeenCalledTimes(1)
    expect(recorder.isRecording).toBe(false)
    await expect(recorder.stop()).rejects.toBeInstanceOf(VoiceError)
  })

  it('rejects an empty recording', async () => {
    const { env, track } = setup({ bytes: '' })
    const recorder = new VoiceRecorder(() => {}, 30_000, env)
    await recorder.start()
    await expect(recorder.stop()).rejects.toMatchObject({ code: 'recording_failed' })
    expect(track.stop).toHaveBeenCalled()
  })

  it.each([
    ['NotAllowedError', 'permission_denied'],
    ['NotFoundError', 'no_microphone'],
    ['AbortError', 'recording_failed'],
  ])('maps %s to %s', async (name, code) => {
    const { env } = setup({ getUserMediaError: named(name) })
    await expect(new VoiceRecorder(() => {}, 30_000, env).start()).rejects.toMatchObject({ code })
  })

  it('reports an unsupported browser', async () => {
    await expect(new VoiceRecorder(() => {}, 30_000, null).start()).rejects.toMatchObject({ code: 'unsupported' })
  })
})
