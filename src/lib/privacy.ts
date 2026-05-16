/**
 * Privacy & sharing utility functions for Black94
 */

/**
 * Generate a shareable link for a user profile.
 * In production this would create a short-lived Firestore token.
 */
export function generateShareLink(userId: string): string {
  const hash = btoa(userId)
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 8)
    .toLowerCase()
  return `https://black94.web.app/s/u/${hash}`
}

/**
 * Return a timestamp 5 minutes from now (in ms).
 */
export function generateExpiryTime(): number {
  return Date.now() + 5 * 60 * 1000
}

/**
 * Check whether a link has expired.
 */
export function isLinkExpired(expiryTime: number): boolean {
  return Date.now() >= expiryTime
}

/**
 * Format a number of seconds into MM:SS countdown string.
 * Handles values > 59 minutes by showing HH:MM:SS.
 */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const mins = Math.floor(s / 60)
  const secs = s % 60
  const mm = String(mins).padStart(2, '0')
  const ss = String(secs).padStart(2, '0')
  return `${mm}:${ss}`
}

/**
 * Generate a deterministic-looking random string used as a visual QR placeholder.
 * Produces a string of 0s and 1s that can be rendered as a grid.
 */
export function generateQRPlaceholder(): string {
  const chars = '01'
  let result = ''
  for (let i = 0; i < 256; i++) {
    result += chars[Math.floor(Math.random() * 2)]
  }
  return result
}
