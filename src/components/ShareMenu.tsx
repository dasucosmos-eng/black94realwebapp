'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface ShareMenuProps {
  open: boolean
  onClose: () => void
  onRepost: () => void
  onQuote: () => void
  isReposted?: boolean
  anchorRef?: HTMLButtonElement | null
  postId?: string
}

export function ShareMenu({
  open,
  onClose,
  onRepost,
  onQuote,
  isReposted = false,
  anchorRef,
  postId,
}: ShareMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [position, setPosition] = useState<{ top: number; right: number }>({ top: 0, right: 0 })

  // Calculate position relative to anchor
  useEffect(() => {
    if (open && anchorRef) {
      const rect = anchorRef.getBoundingClientRect()
      const menuHeight = 320
      const viewHeight = window.innerHeight
      const spaceBelow = viewHeight - rect.bottom

      setPosition({
        top: spaceBelow > menuHeight ? rect.bottom + 8 : rect.top - menuHeight - 8,
        right: window.innerWidth - rect.right,
      })
    }
  }, [open, anchorRef])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && anchorRef && !anchorRef.contains(e.target as Node)) {
        onClose()
      }
    }
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 10)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler) }
  }, [open, onClose, anchorRef])

  // Escape key close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`https://black94.web.app/post/${postId || '0'}`)
      setCopied(true)
      setTimeout(() => { setCopied(false); onClose() }, 1500)
    } catch {
      setCopied(true)
      setTimeout(() => { setCopied(false); onClose() }, 1500)
    }
  }, [onClose])

  if (!open) return null

  const menuItems = [
    {
      icon: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M17 1l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M3 11V9a4 4 0 014-4h14" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M7 23l-4-4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M21 13v2a4 4 0 01-4 4H3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      label: isReposted ? 'Undo Repost' : 'Repost',
      sublabel: isReposted ? 'Remove from your profile' : 'Share on your timeline',
      onClick: () => { onRepost(); onClose() },
      color: isReposted ? '#10b981' : '#e7e9ea',
    },
    {
      icon: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      label: 'Quote Post',
      sublabel: 'Add your thoughts to this post',
      onClick: () => { onQuote(); onClose() },
      color: '#e7e9ea',
    },
    {
      icon: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
      ),
      label: 'Send via Private Message',
      sublabel: 'Share privately with someone',
      onClick: () => { onClose() },
      color: '#e7e9ea',
    },
    {
      icon: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="16 6 12 2 8 6" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="12" y1="2" x2="12" y2="15" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      label: 'Copy Link',
      sublabel: copied ? 'Link copied to clipboard' : 'Copy post link to clipboard',
      onClick: handleCopyLink,
      color: copied ? '#10b981' : '#e7e9ea',
    },
  ]

  return (
    <div
      ref={menuRef}
      className={cn(
        'fixed z-[90] w-[280px] rounded-2xl overflow-hidden animate-share-menu-in',
        'bg-[#000000] border border-white/[0.08]',
        'shadow-xl shadow-black/60'
      )}
      style={{
        top: `${position.top}px`,
        right: `${position.right}px`,
      }}
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-white/[0.06]">
        <h4 className="text-[15px] font-bold text-[#e7e9ea]">Share</h4>
      </div>

      {/* Menu items */}
      <div className="py-1.5">
        {menuItems.map((item, i) => (
          <button
            key={i}
            onClick={item.onClick}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.06] transition-colors text-left group"
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ color: item.color }}
            >
              {item.icon}
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold" style={{ color: item.color }}>
                {item.label}
              </div>
              <div className="text-[12px] text-[#64748b] truncate">{item.sublabel}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Repost Toast Notification ── */

export function RepostToast({ show, message }: { show: boolean; message: string }) {
  if (!show) return null

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[95] animate-toast-in">
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#10b981] text-black shadow-lg shadow-[#10b981]/20">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-[13px] font-bold">{message}</span>
      </div>
    </div>
  )
}
