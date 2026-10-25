/** Longest recording, in milliseconds. The recorder stops by itself at this point. */
export const MAX_RECORDING_MS = 30_000

export type VoiceErrorCode = 'unsupported' | 'no_microphone' | 'permission_denied' | 'recording_failed'

/** An error with a stable code, so the panel can show a friendly message. */
export class VoiceError extends Error {
  readonly code: VoiceErrorCode

  constructor(code: VoiceErrorCode, message: string) {
    super(message)
    this.name = 'VoiceError'
    this.code = code
  }
}

/** Formats are tried in this order; Safari only does mp4, Chrome and Firefox do webm or ogg. */
const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']

export function pickMimeType(isSupported: (type: string) => boolean): string | undefined {
  return MIME_TYPES.find((type) => isSupported(type))
}

/** Browser pieces the recorder needs. Replaced in tests. */
export type RecorderEnvironment = {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>
  createRecorder: (stream: MediaStream, mimeType: string | undefined) => MediaRecorder
  isTypeSupported: (type: string) => boolean
}

function browserEnvironment(): RecorderEnvironment | null {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    return null
  }
  return {
    getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
    createRecorder: (stream, mimeType) => new MediaRecorder(stream, mimeType ? { mimeType } : undefined),
    isTypeSupported: (type) => MediaRecorder.isTypeSupported(type),
  }
}

/** True when this browser can record audio (it also needs a secure page: https or localhost). */
export function canRecordVoice(): boolean {
  return browserEnvironment() !== null
}

function startError(error: unknown): VoiceError {
  const name = error instanceof Error ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new VoiceError('permission_denied', 'Microphone access was blocked. Allow it in your browser settings to ask by voice.')
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return new VoiceError('no_microphone', 'No microphone was found. Connect one, or type your question.')
  }
  return new VoiceError('recording_failed', 'The microphone could not be started. Please try again.')
}

/**
 * Records one spoken question with the microphone.
 * `start()` asks for the microphone; `stop()` resolves with the audio; `cancel()` throws the audio away.
 * The microphone is always released when the recording ends, however it ends.
 */
export class VoiceRecorder {
  private stream: MediaStream | null = null
  private recorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private finish: { resolve: (audio: Blob) => void; reject: (error: Error) => void } | null = null
  private discard = false
  private starting = false
  private stopping: Promise<Blob> | null = null

  /** Called with the audio when the maximum length is reached. Can be replaced while recording. */
  onAutoStop: (audio: Blob) => void
  private readonly maxMs: number
  private readonly environment: RecorderEnvironment | null

  constructor(
    onAutoStop: (audio: Blob) => void = () => {},
    maxMs: number = MAX_RECORDING_MS,
    environment: RecorderEnvironment | null = browserEnvironment(),
  ) {
    this.onAutoStop = onAutoStop
    this.maxMs = maxMs
    this.environment = environment
  }

  get isRecording(): boolean {
    return this.recorder !== null
  }

  async start(): Promise<void> {
    const env = this.environment
    if (!env) throw new VoiceError('unsupported', 'Voice questions are not supported in this browser. Please type instead.')
    if (this.recorder || this.starting) return
    this.starting = true

    let stream: MediaStream
    try {
      stream = await env.getUserMedia({ audio: true })
    } catch (error) {
      throw startError(error)
    } finally {
      this.starting = false
    }

    try {
      this.stream = stream
      this.chunks = []
      this.discard = false
      const recorder = env.createRecorder(stream, pickMimeType(env.isTypeSupported))
      this.recorder = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.chunks.push(event.data)
      }
      recorder.onerror = () => this.end(new VoiceError('recording_failed', 'The recording failed. Please try again.'))
      recorder.onstop = () => this.end(null)
      recorder.start()
      this.timer = setTimeout(() => void this.stop().then(this.onAutoStop, () => {}), this.maxMs)
    } catch {
      this.release()
      throw new VoiceError('recording_failed', 'The microphone could not be started. Please try again.')
    }
  }

  /** Ends the recording and resolves with the audio. */
  stop(): Promise<Blob> {
    const recorder = this.recorder
    if (!recorder) return Promise.reject(new VoiceError('recording_failed', 'Nothing is being recorded.'))
    if (this.stopping) return this.stopping
    const stopping = new Promise<Blob>((resolve, reject) => {
      this.finish = { resolve, reject }
      try {
        if (recorder.state === 'inactive') this.end(null)
        else recorder.stop()
      } catch {
        this.end(new VoiceError('recording_failed', 'The recording failed. Please try again.'))
      }
    })
    this.stopping = stopping
    return stopping
  }

  /** Ends the recording and drops the audio. Safe to call at any time. */
  cancel(): void {
    this.discard = true
    const recorder = this.recorder
    if (!recorder) return
    try {
      if (recorder.state !== 'inactive') recorder.stop()
    } catch {
      // The microphone is released below either way
    }
    this.end(null)
  }

  private end(error: Error | null): void {
    const recorder = this.recorder
    const type = recorder?.mimeType || this.chunks[0]?.type || ''
    const audio = new Blob(this.chunks, type ? { type } : undefined)
    const finish = this.finish
    const discard = this.discard
    this.release()
    this.finish = null
    this.stopping = null
    if (!finish) return
    if (error) finish.reject(error)
    else if (discard || audio.size === 0) finish.reject(new VoiceError('recording_failed', 'No audio was recorded. Please try again.'))
    else finish.resolve(audio)
  }

  private release(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    if (this.recorder) {
      this.recorder.ondataavailable = null
      this.recorder.onstop = null
      this.recorder.onerror = null
    }
    this.recorder = null
    this.chunks = []
  }
}
