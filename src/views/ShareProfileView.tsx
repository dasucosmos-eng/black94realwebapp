'use client'

import { useState, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app'
import {
  generateShareLink,
  generateExpiryTime,
  isLinkExpired,
  formatCountdown,
  generateQRPlaceholder,
} from '@/lib/privacy'
import { PAvatar, VerifiedBadge } from '@/components/PAvatar'
import { toast } from 'sonner'

/* ── QR Code placeholder (CSS grid of squares) ────────────────────────── */

function QRCodePlaceholder({ seed }: { seed: string }) {
  // Use seed to create a deterministic 16×16 grid pattern
  const cells = useMemo(() => {
    const grid: boolean[][] = []
    for (let row = 0; row < 16; row++) {
      const rowCells: boolean[] = []
      for (let col = 0; col < 16; col++) {
        // Corner markers (QR-style)
        const inTopLeft = row < 4 && col < 4
        const inTopRight = row < 4 && col >= 12
        const inBottomLeft = row >= 12 && col < 4

        if (inTopLeft || inTopRight || inBottomLeft) {
          const isBorder =
            row === 0 || row === 3 || col === 0 || col === 3 ||
            col === 12 || col === 15 || row === 12 || row === 15
          const isCenter =
            (inTopLeft && row >= 1 && row <= 2 && col >= 1 && col <= 2) ||
            (inTopRight && row >= 1 && row <= 2 && col >= 13 && col <= 14) ||
            (inBottomLeft && row >= 13 && row <= 14 && col >= 1 && col <= 2)
          rowCells.push(isBorder || isCenter)
        } else {
          // Pseudo-random based on seed + position
          const charCode = seed.charCodeAt((row * 16 + col) % seed.length)
          rowCells.push(charCode % 3 !== 0)
        }
      }
      grid.push(rowCells)
    }
    return grid
  }, [seed])

  return (
    <div className="inline-grid grid-cols-16 gap-0 bg-white p-3 rounded-xl">
      {cells.flat().map((filled, i) => (
        <div
          key={i}
          className={cn('w-[5px] h-[5px]', filled ? 'bg-[#000000]' : 'bg-transparent')}
          style={{ width: 5, height: 5 }}
        />
      ))}
    </div>
  )
}

/* ── Share icons row ──────────────────────────────────────────────────── */

function ShareRow({ shareUrl, onCopy }: { shareUrl: string; onCopy: () => void }) {
  return (
    <div className="flex items-center justify-center gap-4 py-2">
      <button
        onClick={onCopy}
        className="flex flex-col items-center gap-1.5 group"
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-[15px] font-bold text-white transition-transform group-hover:scale-110 group-active:scale-95"
          style={{ backgroundColor: '#FFFFFF' }}
        >
          C
        </div>
        <span className="text-[11px] text-[#94a3b8]">Copy</span>
      </button>
    </div>
  )
}

/* ── ShareProfileView ─────────────────────────────────────────────────── */

export function ShareProfileView() {
  const user = useAppStore((s) => s.user)
  const navigate = useAppStore((s) => s.navigate)

  // Compute initial values eagerly from user
  const initialLink = user ? generateShareLink(user.id) : ''
  const initialExpiry = user ? generateExpiryTime() : 0
  const initialSeed = user ? generateQRPlaceholder() : ''

  const [shareUrl, setShareUrl] = useState(initialLink)
  const [expiryTime, setExpiryTime] = useState(initialExpiry)
  const [remaining, setRemaining] = useState(300)
  const [qrSeed, setQrSeed] = useState(initialSeed)
  const [linkCopied, setLinkCopied] = useState(false)

  const expired = expiryTime > 0 ? isLinkExpired(expiryTime) : false

  const generateNewLink = () => {
    if (!user) return
    const url = generateShareLink(user.id)
    const expiry = generateExpiryTime()
    const seed = generateQRPlaceholder()
    setShareUrl(url)
    setExpiryTime(expiry)
    setRemaining(300)
    setQrSeed(seed)
    setLinkCopied(false)
  }

  // Countdown timer
  useEffect(() => {
    if (expiryTime === 0) return

    const tick = () => {
      const left = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0) {
        setRemaining(0)
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [expiryTime])

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setLinkCopied(true)
      toast.success('Link copied to clipboard')
      setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      // Fallback for insecure contexts
      const textarea = document.createElement('textarea')
      textarea.value = shareUrl
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setLinkCopied(true)
      toast.success('Link copied to clipboard')
      setTimeout(() => setLinkCopied(false), 2000)
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-[#000000]">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-[#000000]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate('profile')}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors"
            aria-label="Go back"
          >
            <svg
              className="w-5 h-5 text-[#e7e9ea]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-[#e7e9ea]">Share Profile</h1>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className="px-4 pt-6 pb-32 flex flex-col items-center">
        {/* Profile Card */}
        <div className="bg-[#000000] border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm mb-6">
          <div className="flex flex-col items-center text-center">
            <PAvatar
              src={user.profileImage}
              name={user.displayName || user.username}
              size={80}
              verified={user.isVerified}
              badge={user.badge}
            />
            <h2 className="text-lg font-bold text-[#e7e9ea] mt-3 flex items-center gap-1.5 justify-center">
              {user.displayName || user.username}
              {(user.isVerified || !!user.badge) && <VerifiedBadge size={16} badge={user.badge} />}
            </h2>
            <p className="text-[14px] text-[#94a3b8] mt-0.5">@{user.username}</p>
            {user.bio && (
              <p className="text-[14px] text-[#e7e9ea]/80 mt-2 leading-relaxed line-clamp-3">
                {user.bio}
              </p>
            )}
          </div>
        </div>

        {/* QR Code */}
        {!expired ? (
          <div className="animate-fade-in flex flex-col items-center mb-6">
            <p className="text-[13px] text-[#94a3b8] mb-3">Scan QR code to view profile</p>
            <QRCodePlaceholder seed={qrSeed} />
          </div>
        ) : (
          <div className="flex flex-col items-center mb-6 py-6">
            <div className="w-20 h-20 rounded-full bg-white/[0.04] flex items-center justify-center mb-3">
              <svg className="w-10 h-10 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M4.93 4.93l14.14 14.14" />
              </svg>
            </div>
            <p className="text-[15px] font-bold text-red-400">Link Expired</p>
            <p className="text-[13px] text-[#94a3b8] mt-1">This shareable link is no longer active.</p>
          </div>
        )}

        {/* Shareable Link */}
        <div className="w-full max-w-sm bg-[#000000] border border-white/[0.08] rounded-2xl p-4 mb-4">
          <p className="text-[13px] text-[#94a3b8] mb-2">Shareable link</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white/[0.04] rounded-lg px-3 py-2.5 overflow-hidden">
              <p className="text-[13px] text-[#e7e9ea] truncate font-mono">
                {shareUrl || 'Generating...'}
              </p>
            </div>
            <button
              onClick={handleCopyLink}
              disabled={expired}
              className={cn(
                'shrink-0 px-3.5 py-2.5 rounded-lg text-[13px] font-bold transition-colors',
                expired
                  ? 'bg-white/[0.04] text-[#64748b] cursor-not-allowed'
                  : linkCopied
                    ? 'bg-[#FFFFFF]/20 text-[#FFFFFF]'
                    : 'bg-[#FFFFFF]/15 text-[#FFFFFF] hover:bg-[#FFFFFF]/25'
              )}
            >
              {linkCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Expiry status */}
        <div className="w-full max-w-sm flex items-center justify-center gap-2 mb-6">
          {expired ? (
            <>
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-[14px] font-semibold text-red-400">Link expired</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-[#FFFFFF] animate-pulse" />
              <span className="text-[14px] text-[#94a3b8]">
                Link expires in{' '}
                <span className="text-[#e7e9ea] font-semibold font-mono">
                  {formatCountdown(remaining)}
                </span>
              </span>
            </>
          )}
        </div>

        {/* Share via row */}
        {!expired && <ShareRow shareUrl={shareUrl} onCopy={handleCopyLink} />}

        {/* Generate new link button */}
        {expired && (
          <button
            onClick={generateNewLink}
            className="mt-4 px-6 py-2.5 rounded-full bg-gradient-to-r from-[#FFFFFF] to-[#D1D5DB] text-black text-[14px] font-bold hover:opacity-90 active:scale-95 transition-all shadow-md shadow-[#FFFFFF]/20"
          >
            Generate New Link
          </button>
        )}
      </div>
    </div>
  )
}
