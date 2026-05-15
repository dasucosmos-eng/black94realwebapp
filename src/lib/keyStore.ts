/**
 * keyStore.ts — Persistent encryption key storage using IndexedDB
 *
 * Private keys are stored LOCALLY ONLY — never sent to any server.
 * This is the foundation of end-to-end encryption:
 * - Only the device that generated the keypair can decrypt messages
 * - Server (Firestore) only ever sees public keys + ciphertext
 */

const DB_NAME = 'black94_e2e'
const DB_VERSION = 1
const STORE_NAME = 'keys'

interface KeyRecord {
  userId: string
  keyType: 'keypair'
  publicKey: Uint8Array
  privateKey: Uint8Array
  createdAt: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'userId' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Save a keypair for a user (called once on first login / key generation) */
export async function saveKeypair(
  userId: string,
  publicKey: Uint8Array,
  privateKey: Uint8Array,
): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const record: KeyRecord = {
      userId,
      keyType: 'keypair',
      publicKey,
      privateKey,
      createdAt: Date.now(),
    }
    store.put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Retrieve the stored keypair for a user */
export async function getKeypair(
  userId: string,
): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array } | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(userId)
    request.onsuccess = () => {
      const record = request.result as KeyRecord | undefined
      if (!record) return resolve(null)
      resolve({ publicKey: record.publicKey, privateKey: record.privateKey })
    }
    request.onerror = () => reject(request.error)
  })
}

/** Check if a user already has a stored keypair */
export async function hasKeypair(userId: string): Promise<boolean> {
  const kp = await getKeypair(userId)
  return kp !== null
}

/** Delete a user's keypair (e.g., on sign-out or account deletion) */
export async function deleteKeypair(userId: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.delete(userId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
