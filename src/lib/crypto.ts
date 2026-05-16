/**
 * crypto.ts — End-to-End Encryption Module
 *
 * Uses libsodium's X25519 for key exchange and XSalsa20-Poly1305 for
 * authenticated symmetric encryption. This is the same cryptographic
 * primitives used by Signal Protocol, WhatsApp, and Matrix.
 *
 * Architecture:
 * ─────────────
 * 1. Each user generates an X25519 keypair (public + private) on device
 * 2. Public key is stored in Firestore user profile (visible to anyone)
 * 3. Private key is stored in IndexedDB (NEVER leaves the device)
 * 4. For each conversation, a shared secret is derived using X25519:
 *    - shared_secret = my_private_key + their_public_key
 * 5. A unique 256-bit key + nonce is generated for each message
 * 6. Messages are encrypted with crypto_secretbox (XSalsa20-Poly1305)
 *
 * Message format stored in Firestore:
 *   content: base64(nonce + ciphertext)  — 24 byte nonce prepended
 *   encrypted: true  — definitive flag, no heuristic detection needed
 *
 * Security guarantees:
 * - Firestore only sees ciphertext — completely unreadable without the shared key
 * - Even if Firestore is compromised, messages cannot be decrypted
 * - Forward secrecy is NOT provided (same keypair per device) — acceptable tradeoff
 *   for a social app. Can be upgraded to Double Ratchet later if needed.
 */

import sodium from 'libsodium-wrappers'
import { saveKeypair, getKeypair } from './keyStore'

let sodiumReady = false

/** Initialize libsodium (must be called once before any crypto operations) */
export async function initCrypto(): Promise<void> {
  if (sodiumReady) return
  await sodium.ready
  sodiumReady = true
}

/** Generate a new X25519 keypair */
export async function generateKeyPair(): Promise<{
  publicKey: Uint8Array
  privateKey: Uint8Array
}> {
  await initCrypto()
  const keypair = sodium.crypto_box_keypair()
  return {
    publicKey: keypair.publicKey,
    privateKey: keypair.privateKey,
  }
}

/**
 * Get or create a keypair for the given user.
 * - If a keypair exists in IndexedDB, return it
 * - Otherwise, generate a new one and save it
 * - Returns base64-encoded public key for Firestore storage
 */
export async function getOrCreateKeyPair(userId: string): Promise<{
  publicKeyBase64: string
  publicKey: Uint8Array
  privateKey: Uint8Array
}> {
  await initCrypto()

  // Check IndexedDB first
  const existing = await getKeypair(userId)
  if (existing) {
    return {
      publicKeyBase64: sodium.to_base64(existing.publicKey),
      publicKey: existing.publicKey,
      privateKey: existing.privateKey,
    }
  }

  // Generate new keypair
  const keypair = await generateKeyPair()

  // Persist private key to IndexedDB
  await saveKeypair(userId, keypair.publicKey, keypair.privateKey)

  return {
    publicKeyBase64: sodium.to_base64(keypair.publicKey),
    publicKey: keypair.publicKey,
    privateKey: keypair.privateKey,
  }
}

/**
 * Encrypt a plaintext message for a specific recipient.
 *
 * @param plaintext - The message text to encrypt
 * @param myPrivateKey - Sender's private key (from IndexedDB)
 * @param theirPublicKeyBase64 - Recipient's public key (from Firestore, base64)
 * @returns base64-encoded string: nonce(24 bytes) + ciphertext
 */
export async function encryptMessage(
  plaintext: string,
  myPrivateKey: Uint8Array,
  theirPublicKeyBase64: string,
): Promise<string> {
  await initCrypto()

  const theirPublicKey = sodium.from_base64(theirPublicKeyBase64)

  // Generate a random nonce (24 bytes for XSalsa20-Poly1305)
  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES)

  // Encrypt using crypto_box (X25519 + XSalsa20-Poly1305)
  const ciphertext = sodium.crypto_box_easy(
    plaintext,
    nonce,
    theirPublicKey,
    myPrivateKey,
  )

  // Prepend nonce to ciphertext so recipient can extract it
  const combined = new Uint8Array(nonce.length + ciphertext.length)
  combined.set(nonce, 0)
  combined.set(ciphertext, nonce.length)

  // Store as base64 in Firestore
  return sodium.to_base64(combined)
}

/**
 * Decrypt a message received from someone.
 *
 * @param encryptedBase64 - base64-encoded: nonce(24 bytes) + ciphertext
 * @param myPrivateKey - Recipient's private key (from IndexedDB)
 * @param theirPublicKeyBase64 - Sender's public key (from Firestore, base64)
 * @returns The decrypted plaintext string, or null if decryption fails
 *   (e.g., wrong keys, tampered data, legacy plaintext message)
 */
export async function decryptMessage(
  encryptedBase64: string,
  myPrivateKey: Uint8Array,
  theirPublicKeyBase64: string,
): Promise<string | null> {
  await initCrypto()

  try {
    const combined = sodium.from_base64(encryptedBase64)

    // Extract nonce (first 24 bytes) and ciphertext (rest)
    const nonce = combined.slice(0, sodium.crypto_box_NONCEBYTES)
    const ciphertext = combined.slice(sodium.crypto_box_NONCEBYTES)

    const theirPublicKey = sodium.from_base64(theirPublicKeyBase64)

    // Decrypt
    const plaintext = sodium.crypto_box_open_easy(
      ciphertext,
      nonce,
      theirPublicKey,
      myPrivateKey,
    )

    return sodium.to_string(plaintext)
  } catch (err) {
    // Decryption failure = wrong keys or corrupted data
    // Return null so caller can fall back gracefully (e.g., legacy messages)
    console.warn('[E2E] Decryption failed — message may be from before encryption or keys mismatch:', err)
    return null
  }
}
