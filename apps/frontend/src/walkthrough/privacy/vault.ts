/*
 * The on-device vault: real values live only here, encrypted with AES-GCM. The key is generated as
 * non-extractable (JavaScript can use it but never read its bytes) and stored as a CryptoKey object in
 * IndexedDB. Records are stored as { iv, data } ciphertext. Nothing in this file talks to a network.
 */

/** A tiny async key-value store. IndexedDB in the browser, a Map in tests. Values must be structured-cloneable. */
export interface VaultStore {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
}

export class MemoryVaultStore implements VaultStore {
  /** Exposed so tests can inspect exactly what would be written to disk. */
  readonly data = new Map<string, unknown>()
  get(key: string): Promise<unknown> {
    return Promise.resolve(this.data.get(key))
  }
  set(key: string, value: unknown): Promise<void> {
    this.data.set(key, value)
    return Promise.resolve()
  }
  delete(key: string): Promise<void> {
    this.data.delete(key)
    return Promise.resolve()
  }
  clear(): Promise<void> {
    this.data.clear()
    return Promise.resolve()
  }
}

export class IndexedDbVaultStore implements VaultStore {
  private db: Promise<IDBDatabase> | null = null
  private readonly name: string

  constructor(name = 'ask-ray-privacy') {
    this.name = name
  }

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, 1)
      request.onupgradeneeded = () => request.result.createObjectStore('kv')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(new Error('The on-device vault could not be opened.'))
    })
    return this.db
  }

  private async run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open()
    return new Promise<T>((resolve, reject) => {
      const request = action(db.transaction('kv', mode).objectStore('kv'))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(new Error('The on-device vault could not be used.'))
    })
  }

  get(key: string): Promise<unknown> {
    return this.run('readonly', (s) => s.get(key))
  }
  async set(key: string, value: unknown): Promise<void> {
    await this.run('readwrite', (s) => s.put(value, key))
  }
  async delete(key: string): Promise<void> {
    await this.run('readwrite', (s) => s.delete(key))
  }
  async clear(): Promise<void> {
    await this.run('readwrite', (s) => s.clear())
  }
}

/** What the patient types into the intake form. Fake data only. */
export type Intake = { firstName: string; lastName: string; dob: string; ssn: string }

type EncryptedRecord = { iv: Uint8Array<ArrayBuffer>; data: ArrayBuffer }

const KEY_NAME = 'key'
const recordName = (name: string) => `rec:${name}`

export class EncryptedVault {
  private key: Promise<CryptoKey> | null = null

  private readonly store: VaultStore
  private readonly subtle: SubtleCrypto

  constructor(store: VaultStore, subtle: SubtleCrypto = globalThis.crypto?.subtle) {
    this.store = store
    this.subtle = subtle
  }

  /** Whether WebCrypto is available at all. */
  get supported(): boolean {
    return this.subtle !== undefined
  }

  private getKey(): Promise<CryptoKey> {
    this.key ??= (async () => {
      const existing = await this.store.get(KEY_NAME)
      if (existing instanceof CryptoKey) return existing
      const created = await this.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
      await this.store.set(KEY_NAME, created)
      return created
    })()
    this.key.catch(() => {
      this.key = null
    })
    return this.key
  }

  /** Encrypts `value` (any JSON value) and stores it. The record name is bound to the ciphertext. */
  async putRecord(name: string, value: unknown): Promise<void> {
    const key = await this.getKey()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const plain = new TextEncoder().encode(JSON.stringify(value))
    const data = await this.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(name) }, key, plain)
    await this.store.set(recordName(name), { iv, data } satisfies EncryptedRecord)
  }

  /** Decrypts a record, or returns undefined when there is none (or it cannot be decrypted). */
  async getRecord<T = unknown>(name: string): Promise<T | undefined> {
    const stored = (await this.store.get(recordName(name))) as EncryptedRecord | undefined
    if (!stored) return undefined
    try {
      const key = await this.getKey()
      const plain = await this.subtle.decrypt(
        { name: 'AES-GCM', iv: stored.iv, additionalData: new TextEncoder().encode(name) },
        key,
        stored.data,
      )
      return JSON.parse(new TextDecoder().decode(plain)) as T
    } catch {
      return undefined
    }
  }

  async saveIntake(intake: Intake): Promise<void> {
    await this.putRecord('intake', intake)
  }

  async loadIntake(): Promise<Intake | null> {
    const intake = await this.getRecord<Partial<Intake>>('intake')
    if (!intake) return null
    const { firstName, lastName, dob, ssn } = intake
    if ([firstName, lastName, dob, ssn].some((v) => typeof v !== 'string')) return null
    return { firstName: firstName!, lastName: lastName!, dob: dob!, ssn: ssn! }
  }

  /** Deletes every record and the key. */
  async clear(): Promise<void> {
    this.key = null
    await this.store.clear()
  }
}
