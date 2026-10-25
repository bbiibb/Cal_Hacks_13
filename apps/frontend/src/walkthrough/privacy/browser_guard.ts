import { TransformersFuzzyDetector } from './fuzzy'
import { createPiiGuard } from './guard'
import type { PiiGuard } from './guard'
import { EncryptedVault, IndexedDbVaultStore } from './vault'

/**
 * The guard as the app uses it: IndexedDB vault plus the on-device model (not downloaded until
 * `guard.startFuzzy()` is called, so call it when the chat opens or after consent).
 */
export function createBrowserPiiGuard(): PiiGuard {
  return createPiiGuard({
    vault: new EncryptedVault(new IndexedDbVaultStore()),
    fuzzy: new TransformersFuzzyDetector(),
  })
}
