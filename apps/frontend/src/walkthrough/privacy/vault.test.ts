import { describe, expect, it } from 'vitest'
import { EncryptedVault, MemoryVaultStore } from './vault'

const intake = { firstName: 'Jane', lastName: 'Doe', dob: '03/03/1985', ssn: '123-45-6789' }

describe('EncryptedVault', () => {
  it('round-trips an intake through encryption', async () => {
    const store = new MemoryVaultStore()
    const vault = new EncryptedVault(store, crypto.subtle)
    expect(await vault.loadIntake()).toBeNull()
    await vault.saveIntake(intake)
    expect(await vault.loadIntake()).toEqual(intake)
    // A second vault over the same store reuses the stored key.
    expect(await new EncryptedVault(store, crypto.subtle).loadIntake()).toEqual(intake)
  })

  it('stores no plaintext and a non-extractable key', async () => {
    const store = new MemoryVaultStore()
    const vault = new EncryptedVault(store, crypto.subtle)
    await vault.saveIntake(intake)
    const key = store.data.get('key') as CryptoKey
    expect(key.extractable).toBe(false)
    const record = store.data.get('rec:intake') as { iv: Uint8Array; data: ArrayBuffer }
    const bytes = new TextDecoder('latin1').decode(record.data)
    for (const secret of ['Jane', 'Doe', '123-45-6789', '1985']) expect(bytes).not.toContain(secret)
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow()
  })

  it('cannot decrypt a record moved to another name or tampered with', async () => {
    const store = new MemoryVaultStore()
    const vault = new EncryptedVault(store, crypto.subtle)
    await vault.putRecord('a', { secret: 1 })
    store.data.set('rec:b', store.data.get('rec:a'))
    expect(await vault.getRecord('b')).toBeUndefined()
    expect(await vault.getRecord('a')).toEqual({ secret: 1 })
  })

  it('clear removes the records and the key', async () => {
    const store = new MemoryVaultStore()
    const vault = new EncryptedVault(store, crypto.subtle)
    await vault.saveIntake(intake)
    await vault.clear()
    expect(store.data.size).toBe(0)
    expect(await vault.loadIntake()).toBeNull()
  })
})
