'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useDualPaneChat, type ChatMsg, type MessageReaction } from '@/stores/dualPaneChat'
import { useAppStore } from '@/stores/app'
import { PAvatar, VerifiedBadge } from '@/components/PAvatar'
import { getUser } from '@/lib/db'
import type { Chat as FbChat } from '@/lib/db'
import { onSnapshot, collection, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { toast } from 'sonner'
import { ChatInputBar } from '@/components/ChatInputBar'

/* ── Helper: Firestore Timestamp → ISO string ──────────────────────────── */
function tsToISO(value: unknown): string {
  if (value && typeof value === 'object' && 'seconds' in value) {
    const ts = value as { seconds: number; nanoseconds: number }
    return new Date(ts.seconds * 1000 + ts.nanoseconds / 1_000_000).toISOString()
  }
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  return new Date().toISOString()
}

/* ── Helpers ───────────────────────────────────────────────────────── */

function timeAgo(ts: number | string | undefined): string {
  if (!ts) return ''
  const date = typeof ts === 'string' ? new Date(ts).getTime() : ts
  const diff = Date.now() - date
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTime(ts: number | string): string {
  const date = typeof ts === 'string' ? new Date(ts) : new Date(ts)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

const REACTION_EMOJIS = ['❤️', '😂', '🔥', '😍', '😮', '😢', '💯', '👎']

/* ── Verified Badge ─────────────────────────────────────────────────── */

/* ── E2EE Shield Badge ────────────────────────────────────────────── */

function E2EEBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FFFFFF]/10 border border-[#FFFFFF]/20">
      <svg className="w-3.5 h-3.5 text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      <span className="text-[11px] text-[#FFFFFF] font-semibold tracking-wide">E2E ENCRYPTED</span>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   REACTION PICKER
   ═══════════════════════════════════════════════════════════════════════════ */

function ReactionPicker({
  msgId,
  position,
  onClose,
}: {
  msgId: string
  position: { x: number; y: number; alignRight: boolean }
  onClose: () => void
}) {
  const { toggleReaction } = useDualPaneChat()
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler) }
  }, [onClose])

  return (
    <div
      ref={pickerRef}
      className={cn(
        'absolute z-50 flex items-center gap-0.5 px-1.5 py-1.5 rounded-full',
        'bg-[#000000] border border-white/[0.12] shadow-xl shadow-black/50',
        'animate-reaction-picker-in'
      )}
      style={{
        bottom: position.alignRight ? '100%' : '100%',
        right: position.alignRight ? 0 : 'auto',
        left: position.alignRight ? 'auto' : 0,
        transform: 'translateY(-6px)',
      }}
    >
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => { toggleReaction(msgId, emoji); onClose() }}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/[0.08] active:scale-125 transition-all duration-150 text-[18px] leading-none"
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   REACTIONS BAR
   ═══════════════════════════════════════════════════════════════════════════ */

function ReactionsBar({
  msgId,
  reactions,
  isMine,
}: {
  msgId: string
  reactions: MessageReaction[]
  isMine: boolean
}) {
  const { toggleReaction } = useDualPaneChat()
  if (reactions.length === 0) return null

  return (
    <div className={cn('flex flex-wrap gap-1 mt-1 px-1', isMine ? 'justify-end' : 'justify-start')}>
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={() => toggleReaction(msgId, r.emoji)}
          className={cn(
            'inline-flex items-center gap-1 pl-1.5 pr-2 py-[2px] rounded-full text-[13px] transition-all duration-200 border animate-scale-in',
            r.reacted
              ? isMine
                ? 'bg-[#000000]/20 border-black/30 text-black'
                : 'bg-[#FFFFFF]/15 border-[#FFFFFF]/25 text-[#FFFFFF]'
              : 'bg-white/[0.04] border-white/[0.06] text-[#94a3b8] hover:border-white/[0.12]'
          )}
        >
          <span className="text-[13px] leading-none">{r.emoji}</span>
          <span className="text-[11px] font-semibold">{r.count}</span>
        </button>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MESSAGE BUBBLE
   ═══════════════════════════════════════════════════════════════════════════ */

function MessageBubble({
  msg,
  onLongPress,
}: {
  msg: ChatMsg
  onLongPress: (msg: ChatMsg, rect: DOMRect) => void
}) {
  const { replyTo, setReplyTo, toggleReaction } = useDualPaneChat()
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lastClickRef = useRef(0)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const isMine = msg.isMine

  const handleClick = useCallback(() => {
    const now = Date.now()
    if (now - lastClickRef.current < 300) {
      toggleReaction(msg.id, '❤️')
    }
    lastClickRef.current = now
  }, [msg.id, toggleReaction])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const rect = bubbleRef.current?.getBoundingClientRect()
    if (rect) onLongPress(msg, rect)
  }, [msg, onLongPress])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    longPressTimer.current = setTimeout(() => {
      const rect = bubbleRef.current?.getBoundingClientRect()
      if (rect) onLongPress(msg, rect)
    }, 500)
  }, [msg, onLongPress])

  const handleTouchEnd = useCallback(() => { clearTimeout(longPressTimer.current) }, [])
  const handleTouchMove = useCallback(() => { clearTimeout(longPressTimer.current) }, [])

  return (
    <div
      ref={bubbleRef}
      className={cn('flex flex-col relative group', isMine ? 'items-end' : 'items-start')}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      <div className={cn(
        'max-w-[82%] animate-fade-in',
        isMine
          ? 'bg-gradient-to-br from-[#FFFFFF] to-[#D1D5DB] text-black rounded-2xl rounded-br-sm'
          : 'bg-white/[0.06] text-[#e7e9ea] rounded-2xl rounded-bl-sm border border-white/[0.06]'
      )}>
        {msg.replyTo && (
          <div className={cn(
            'mx-2 mt-2 mb-1 px-2.5 py-1.5 rounded-lg border-l-[3px]',
            isMine
              ? 'bg-[#000000]/10 border-l-black/40'
              : 'bg-white/[0.04] border-l-[#FFFFFF]/50'
          )}>
            <span className={cn('text-[11px] font-bold block leading-tight', isMine ? 'text-black/60' : 'text-[#FFFFFF]')}>
              {msg.replyTo.isMine ? 'You' : msg.replyTo.senderName}
            </span>
            <span className={cn('text-[12px] block leading-snug mt-0.5 line-clamp-1', isMine ? 'text-black/50' : 'text-[#64748b]')}>
              {msg.replyTo.content}
            </span>
          </div>
        )}
        <div className="px-3.5 py-2.5 text-[14px] leading-relaxed">
          {msg.content}
        </div>
      </div>

      <div className={cn('flex items-center gap-1 mt-0.5 px-1', isMine ? 'flex-row-reverse' : '')}>
        <span className="text-[10px] text-[#64748b]">{formatTime(msg.timestamp)}</span>
        {isMine && (
          <svg className="w-3.5 h-3.5 text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>

      <ReactionsBar msgId={msg.id} reactions={msg.reactions} isMine={isMine} />

      {/* Quick action buttons — hover (desktop) */}
      <div className={cn(
        'absolute top-0 flex items-center gap-0.5 px-1 py-0.5 rounded-full',
        'bg-[#000000]/95 border border-white/[0.08] shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none group-hover:pointer-events-auto',
        isMine ? '-left-[76px]' : '-right-[76px]'
      )}>
        <button
          onClick={(e) => { e.stopPropagation(); setReplyTo(msg) }}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/[0.08] transition-colors"
          title="Reply"
        >
          <svg className="w-3.5 h-3.5 text-[#94a3b8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/>
          </svg>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            const rect = bubbleRef.current?.getBoundingClientRect()
            if (rect) onLongPress(msg, rect)
          }}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/[0.08] transition-colors"
          title="React"
        >
          <svg className="w-3.5 h-3.5 text-[#f43f5e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
          </svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, '❤️') }}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/[0.08] transition-colors text-[14px]"
          title="Love"
        >
          ❤️
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   REPLY CONTEXT BAR
   ═══════════════════════════════════════════════════════════════════════════ */

function ReplyBar() {
  const { replyTo, setReplyTo } = useDualPaneChat()
  if (!replyTo) return null

  return (
    <div className="shrink-0 px-3 pt-2 bg-[#000000]/80 backdrop-blur-xl animate-reply-slide-in">
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-t-xl bg-white/[0.04] border-x border-t border-white/[0.06]">
        <div className="w-[3px] h-8 rounded-full bg-[#FFFFFF] shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-[12px] font-bold text-[#FFFFFF] block">
            {replyTo.isMine ? 'You' : replyTo.senderName}
          </span>
          <span className="text-[12px] text-[#64748b] block truncate">{replyTo.content}</span>
        </div>
        <button
          onClick={() => setReplyTo(null)}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors shrink-0"
        >
          <svg className="w-3.5 h-3.5 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHAT ITEM — 3-dot menu dropdown
   ═══════════════════════════════════════════════════════════════════════════ */

function ChatItemMenu({
  chatName,
  chatId,
  onSettings,
  onDelete,
}: {
  chatName: string
  chatId: string
  onSettings: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 10)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler) }
  }, [open])

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors"
      >
        <svg className="w-4 h-4 text-[#64748b]" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5"/>
          <circle cx="12" cy="12" r="1.5"/>
          <circle cx="12" cy="19" r="1.5"/>
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 z-50 bg-[#000000] border border-white/[0.1] rounded-xl shadow-xl shadow-black/50 overflow-hidden animate-fade-in">
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onSettings() }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.06] transition-colors"
          >
            <svg className="w-4 h-4 text-[#94a3b8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
            <span className="text-[14px] text-[#e7e9ea]">Settings</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete() }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.06] transition-colors"
          >
            <svg className="w-4 h-4 text-[#ef4444]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
            <span className="text-[14px] text-[#ef4444]">Delete</span>
          </button>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHAT SETTINGS SHEET
   ═══════════════════════════════════════════════════════════════════════════ */

function ChatSettingsSheet({
  chatId,
  chatName,
  onClose,
}: {
  chatId: string
  chatName: string
  onClose: () => void
}) {
  const { nuclearBlocked, toggleNuclearBlock, mutedChats, toggleMute } = useDualPaneChat()
  const isBlocked = nuclearBlocked[chatId] ?? false
  const isMuted = mutedChats[chatId] ?? false

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#000000]/60 backdrop-blur-sm" />
      {/* Sheet */}
      <div
        className="relative w-full max-w-lg bg-[#000000] rounded-t-2xl border-t border-white/[0.08] animate-slide-up-sheet max-h-[85vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-white/[0.15]" />
        </div>

        {/* Header */}
        <div className="px-5 pb-4">
          <h2 className="text-[18px] font-bold text-[#e7e9ea]">{chatName}</h2>
          <p className="text-[13px] text-[#64748b] mt-0.5">Chat settings and privacy</p>
        </div>

        <div className="border-t border-white/[0.06]" />

        {/* Settings sections */}
        <div className="py-2">
          {/* Nuclear Block */}
          <div className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.03] transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#ef4444]/10 flex items-center justify-center">
                <svg className="w-[18px] h-[18px] text-[#ef4444]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                </svg>
              </div>
              <div>
                <span className="text-[14px] text-[#e7e9ea] font-medium block">Nuclear Block</span>
                <span className="text-[12px] text-[#64748b]">Permanently block all communication</span>
              </div>
            </div>
            <button
              onClick={() => {
                toggleNuclearBlock(chatId)
                toast.success(isBlocked ? `${chatName} unblocked` : `${chatName} blocked`)
              }}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0',
                isBlocked ? 'bg-[#ef4444]' : 'bg-white/[0.15]'
              )}
            >
              <div className={cn(
                'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 shadow-sm',
                isBlocked ? 'translate-x-5' : 'translate-x-0'
              )} />
            </button>
          </div>

          {/* Mute Notifications */}
          <div className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.03] transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#f59e0b]/10 flex items-center justify-center">
                <svg className="w-[18px] h-[18px] text-[#f59e0b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
                </svg>
              </div>
              <div>
                <span className="text-[14px] text-[#e7e9ea] font-medium block">Mute Notifications</span>
                <span className="text-[12px] text-[#64748b]">Silence incoming messages</span>
              </div>
            </div>
            <button
              onClick={() => {
                toggleMute(chatId)
                toast.success(isMuted ? `${chatName} unmuted` : `${chatName} muted`)
              }}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0',
                isMuted ? 'bg-[#FFFFFF]' : 'bg-white/[0.15]'
              )}
            >
              <div className={cn(
                'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 shadow-sm',
                isMuted ? 'translate-x-5' : 'translate-x-0'
              )} />
            </button>
          </div>

          <div className="border-t border-white/[0.06] my-1" />

          {/* Clear Chat History */}
          <button
            onClick={() => {
              toast.success('Chat history cleared')
              onClose()
            }}
            className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.03] transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center">
              <svg className="w-[18px] h-[18px] text-[#94a3b8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </div>
            <div className="text-left">
              <span className="text-[14px] text-[#e7e9ea] font-medium block">Clear Chat History</span>
              <span className="text-[12px] text-[#64748b]">Delete all messages</span>
            </div>
          </button>

          <div className="border-t border-white/[0.06] my-1" />

          {/* Media, Links, and Docs */}
          <button className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.03] transition-colors">
            <div className="w-9 h-9 rounded-full bg-[#2a7fff]/10 flex items-center justify-center">
              <svg className="w-[18px] h-[18px] text-[#2a7fff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
            <div className="flex-1 text-left">
              <span className="text-[14px] text-[#e7e9ea] font-medium block">Media, Links, and Docs</span>
              <span className="text-[12px] text-[#64748b]">Shared files and media</span>
            </div>
            <svg className="w-4 h-4 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>

          {/* Disappearing Messages */}
          <button className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.03] transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#FFFFFF]/10 flex items-center justify-center">
                <svg className="w-[18px] h-[18px] text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div className="text-left">
                <span className="text-[14px] text-[#e7e9ea] font-medium block">Disappearing Messages</span>
                <span className="text-[12px] text-[#64748b]">Off — messages stay forever</span>
              </div>
            </div>
            <svg className="w-4 h-4 text-[#64748b] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>

          {/* Encryption */}
          <div className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.03] transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#FFFFFF]/10 flex items-center justify-center">
                <svg className="w-[18px] h-[18px] text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <div>
                <span className="text-[14px] text-[#e7e9ea] font-medium block">Encryption</span>
                <span className="text-[12px] text-[#FFFFFF]">End-to-end encrypted</span>
              </div>
            </div>
          </div>
        </div>

        {/* Safe area bottom spacer */}
        <div className="h-safe-area-bottom" />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHAT ROOM VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

function ChatRoomView() {
  const { messages, addMessage, typing, setTyping, replyTo, setReplyTo, selectedChatId, selectChat, setChatView, nuclearBlocked } = useDualPaneChat()
  const navigate = useAppStore((s) => s.navigate)
  const [text, setText] = useState('')
  const [reactionPicker, setReactionPicker] = useState<{
    msgId: string
    position: { x: number; y: number; alignRight: boolean }
  } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const headerMenuRef = useRef<HTMLDivElement>(null)

  const chatPartner = { id: selectedChatId || '', name: 'Chat', initial: '?', color: '#FFFFFF', online: false, lastMessage: '', lastMessageTime: 0, unreadCount: 0, verified: false }
  const isBlocked = nuclearBlocked[selectedChatId ?? ''] ?? false

  useEffect(() => {
    if (replyTo) inputRef.current?.focus()
  }, [replyTo])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  useEffect(() => {
    if (!headerMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderMenuOpen(false)
      }
    }
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 10)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler) }
  }, [headerMenuOpen])

  const handleSend = useCallback(() => {
    if (!text.trim()) return
    addMessage({
      id: `msg_${Date.now()}`,
      senderId: 'me', senderName: 'You', content: text.trim(),
      timestamp: Date.now(), isMine: true, read: true, reactions: [],
      replyTo: replyTo ? {
        id: replyTo.id, senderName: replyTo.senderName,
        content: replyTo.content, isMine: replyTo.isMine,
      } : undefined,
    })
    setText('')
    setReplyTo(null)
    inputRef.current?.focus()
  }, [text, addMessage, replyTo, setReplyTo])

  const handleLongPress = useCallback((msg: ChatMsg, rect: DOMRect) => {
    setReactionPicker({
      msgId: msg.id,
      position: { x: rect.left + rect.width / 2, y: rect.top, alignRight: msg.isMine },
    })
  }, [])

  if (isBlocked) {
    return (
      <div className="flex flex-col h-[calc(100vh-106px)] animate-fade-in">
        {/* Header */}
        <div className="shrink-0 h-[56px] px-4 flex items-center justify-between border-b border-white/[0.06] bg-[#000000]/60 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => selectChat(null)}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors"
            >
              <svg className="w-5 h-5 text-[#e7e9ea]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#ef4444]/50 to-[#7f1d1d] flex items-center justify-center text-white font-bold text-sm">
                {chatPartner.initial}
              </div>
            </div>
            <div>
              <span className="text-[14px] font-bold text-[#94a3b8]">{chatPartner.name}</span>
              <span className="block text-[11px] text-[#ef4444]">Blocked</span>
            </div>
          </div>
        </div>
        {/* Blocked view */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-16 h-16 rounded-full bg-[#ef4444]/10 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[#ef4444]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
          </div>
          <h3 className="text-[18px] font-bold text-[#e7e9ea] mb-1">Chat Blocked</h3>
          <p className="text-[14px] text-[#94a3b8] text-center max-w-[280px]">
            You have nuclear-blocked {chatPartner.name}. All communication has been permanently restricted.
          </p>
          <button
            onClick={() => {
              useDualPaneChat.getState().toggleNuclearBlock(selectedChatId!)
              toast.success(`${chatPartner.name} unblocked`)
            }}
            className="mt-6 px-6 py-2.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[14px] text-[#e7e9ea] font-semibold hover:bg-white/[0.1] transition-colors"
          >
            Unblock {chatPartner.name}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-106px)] animate-fade-in">
      {/* ─── Chat Header ─── */}
      <div className="shrink-0 h-[56px] px-4 flex items-center justify-between border-b border-white/[0.06] bg-[#000000]/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => selectChat(null)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors"
          >
            <svg className="w-5 h-5 text-[#e7e9ea]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div className="relative">
            <PAvatar name={chatPartner.name} size={36} verified={chatPartner.verified} />
            {chatPartner.online && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#10b981] border-2 border-black" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-bold text-white">{chatPartner.name}</span>
              {chatPartner.verified && <VerifiedBadge size={14} />}
            </div>
            <span className="text-[11px] text-[#FFFFFF]">{chatPartner.online ? 'Online' : 'Offline'}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Audio Call */}
          <button
            onClick={() => navigate('audio-call', { chatName: chatPartner.name })}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors"
          >
            <svg className="w-[18px] h-[18px] text-[#e7e9ea]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
            </svg>
          </button>
          {/* Video Call */}
          <button
            disabled
              className="w-9 h-9 rounded-full flex items-center justify-center opacity-50 cursor-not-allowed"
          >
            <svg className="w-[18px] h-[18px] text-[#e7e9ea]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          </button>
          {/* 3-dot menu */}
          <div className="relative" ref={headerMenuRef}>
            <button
              onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors"
            >
              <svg className="w-5 h-5 text-[#94a3b8]" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="1.5"/>
                <circle cx="12" cy="12" r="1.5"/>
                <circle cx="12" cy="19" r="1.5"/>
              </svg>
            </button>
            {headerMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 z-50 bg-[#000000] border border-white/[0.1] rounded-xl shadow-xl shadow-black/50 overflow-hidden animate-fade-in">
                <button
                  onClick={() => { setHeaderMenuOpen(false); setSettingsOpen(true) }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.06] transition-colors"
                >
                  <svg className="w-4 h-4 text-[#94a3b8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
                  </svg>
                  <span className="text-[14px] text-[#e7e9ea]">Chat Settings</span>
                </button>
                <button
                  onClick={() => { setHeaderMenuOpen(false); selectChat(null) }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.06] transition-colors"
                >
                  <svg className="w-4 h-4 text-[#94a3b8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                  </svg>
                  <span className="text-[14px] text-[#ef4444]">Clear Chat</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── E2EE Badge ─── */}
      <div className="shrink-0 flex justify-center py-2">
        <E2EEBadge />
      </div>

      {/* ─── Messages ─── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 no-scrollbar relative">
        {/* Date separator */}
        <div className="flex justify-center py-2">
          <span className="text-[11px] text-[#64748b] bg-white/[0.04] px-3 py-0.5 rounded-full">Today</span>
        </div>

        {messages.map((msg) => (
          <div key={msg.id} className="relative">
            <MessageBubble msg={msg} onLongPress={handleLongPress} />
            {reactionPicker && reactionPicker.msgId === msg.id && (
              <ReactionPicker
                msgId={msg.id}
                position={reactionPicker.position}
                onClose={() => setReactionPicker(null)}
              />
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {typing && (
          <div className="flex items-start animate-fade-in">
            <div className="bg-white/[0.06] border border-white/[0.06] rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex items-center gap-1">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ─── Reply Context Bar ─── */}
      <ReplyBar />

      {/* ─── Input Bar ─── */}
      <ChatInputBar
        value={text}
        onChange={setText}
        onSend={handleSend}
        inputRef={inputRef as React.RefObject<HTMLInputElement>}
        placeholder={replyTo ? `Replying to ${replyTo.isMine ? 'yourself' : replyTo.senderName}...` : 'Type a message'}
      />

      {/* ─── Chat Settings Sheet ─── */}
      {settingsOpen && (
        <ChatSettingsSheet
          chatId={selectedChatId!}
          chatName={chatPartner.name}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHAT LIST VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

function ChatListView() {
  const user = useAppStore((s) => s.user)
  const { selectChat, nuclearBlocked, mutedChats } = useDualPaneChat()
  const [fbChats, setFbChats] = useState<FbChat[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!user) return

    // Direct onSnapshot approach — no composite index required.
    // Both queries feed into the same merged map; changes are debounced
    // before enriching with other-user info and updating state.
    const chatsRef = collection(db, 'chats')
    const q1 = query(chatsRef, where('user1Id', '==', user.id))
    const q2 = query(chatsRef, where('user2Id', '==', user.id))

    const mergedDocs = new Map<string, FbChat>()
    let debounceTimer: ReturnType<typeof setTimeout>

    const enrichAndSet = async () => {
      try {
        const chats = Array.from(mergedDocs.values())
        const enriched = await Promise.all(
          chats.map(async (chat) => {
            const otherUserId = chat.user1Id === user.id ? chat.user2Id : chat.user1Id
            let otherUser
            try {
              otherUser = await getUser(otherUserId)
            } catch {
              otherUser = null
            }
            return { ...chat, otherUser: otherUser ?? undefined } as FbChat
          }),
        )
        // Sort by updatedAt descending (most recent first)
        enriched.sort((a, b) => {
          const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
          const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
          return tb - ta
        })
        setFbChats(enriched)
      } catch (err) {
        console.error('[ChatListView] enrichAndSet failed:', err)
      }
    }

    const handleSnapshot = (snap: any) => {
      let changed = false
      for (const change of snap.docChanges()) {
        if (change.type === 'removed') {
          if (mergedDocs.delete(change.doc.id)) changed = true
        } else {
          const d = change.doc.data()
          mergedDocs.set(change.doc.id, {
            id: change.doc.id,
            user1Id: d.user1Id ?? '',
            user2Id: d.user2Id ?? '',
            isPaidChat: d.isPaidChat ?? false,
            chatPrice: d.chatPrice ?? 0,
            isPaidBy: d.isPaidBy ?? null,
            isDeleted: d.isDeleted ?? false,
            unreadCount: d.unreadCount ?? 0,
            createdAt: tsToISO(d.createdAt),
            updatedAt: tsToISO(d.updatedAt),
          } as FbChat)
          changed = true
        }
      }
      if (changed) {
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(enrichAndSet, 300)
      }
    }

    const unsub1 = onSnapshot(q1, handleSnapshot)
    const unsub2 = onSnapshot(q2, handleSnapshot)

    return () => {
      unsub1()
      unsub2()
      clearTimeout(debounceTimer)
    }
  }, [user])

  const filteredFb = fbChats.filter((c) =>
    c.otherUser?.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex flex-col h-[calc(100vh-106px)] animate-fade-in">
      {/* ─── Header ─── */}
      <div className="shrink-0 px-4 pt-3 pb-2 flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#e7e9ea]">Messages</h2>
        <button
          disabled
          className="w-9 h-9 rounded-full flex items-center justify-center opacity-50 cursor-not-allowed"
          aria-label="Compose new message"
        >
          <svg className="w-5 h-5 text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </button>
      </div>

      {/* ─── Search Bar ─── */}
      <div className="shrink-0 px-4 pb-3">
        <div className="flex items-center gap-2.5 bg-white/[0.04] rounded-xl border border-white/[0.06] px-3.5 py-2.5">
          <svg className="w-4 h-4 text-[#64748b] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            className="flex-1 bg-transparent text-[14px] text-[#e7e9ea] placeholder-[#64748b] outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="shrink-0">
              <svg className="w-4 h-4 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ─── Chat List ─── */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="py-1">
          <div className="px-4 py-2">
            <span className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Recent</span>
          </div>

          {/* Firestore chats */}
          {filteredFb.map((chat) => (
            <div
              key={chat.id}
              onClick={() => {
                useAppStore.getState().navigate('chat-room', { chatId: chat.id })
              }}
              className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <div className="relative shrink-0">
                <PAvatar
                  src={chat.otherUser?.profileImage}
                  name={chat.otherUser?.displayName}
                  size={50}
                  verified={(chat.otherUser as any)?.isVerified}
                  badge={(chat.otherUser as any)?.badge}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {(chat.otherUser as any)?.isVerified && <VerifiedBadge size={13} badge={(chat.otherUser as any)?.badge} />}
                    <span className="font-bold text-[15px] text-[#e7e9ea] truncate">
                      {chat.otherUser?.displayName || 'User'}
                    </span>
                  </div>
                  <span className="text-[12px] text-[#64748b] shrink-0 ml-2">
                    {timeAgo(chat.updatedAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className={cn(
                    'text-[14px] truncate',
                    (chat.unreadCount ?? 0) > 0 ? 'text-[#e7e9ea] font-semibold' : 'text-[#94a3b8]'
                  )}>
                    {chat.lastMessage?.content || 'No messages yet'}
                  </p>
                </div>
              </div>
              {(chat.unreadCount ?? 0) > 0 && (
                <div className="w-5 h-5 rounded-full bg-[#FFFFFF] flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-black">{chat.unreadCount}</span>
                </div>
              )}
            </div>
          ))}

          {/* Empty state */}
          {filteredFb.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
              <div className="w-16 h-16 rounded-full bg-white/[0.04] flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="text-lg font-bold text-[#e7e9ea] mb-1">No conversations found</h3>
              <p className="text-[14px] text-[#94a3b8]">Start a new chat to begin messaging.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN MESSAGES VIEW — Switches between list, room, settings
   ═══════════════════════════════════════════════════════════════════════════ */

export function MessagesView() {
  const { chatView } = useDualPaneChat()

  if (chatView === 'room' || chatView === 'settings') {
    return <ChatRoomView />
  }

  return <ChatListView />
}
