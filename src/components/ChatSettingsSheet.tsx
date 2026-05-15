'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { PAvatar, VerifiedBadge } from '@/components/PAvatar'
import { toast } from 'sonner'

/* ── Types ────────────────────────────────────────────────────────────── */

interface ChatUser {
  id: string
  displayName: string
  username: string
  profileImage: string
}

interface ChatSettingsSheetProps {
  open: boolean
  onClose: () => void
  user: ChatUser
  /** Initial mute state — pass from parent to persist across sheet open/close */
  initialMuted?: boolean
  /** Called when the user triggers nuclear block */
  onNuclearBlock?: () => void
  /** Called when mute is toggled */
  onMuteToggle?: (muted: boolean) => void
  /** Called when clear chat is triggered */
  onClearChat?: () => void
  /** Called when report is triggered */
  onReport?: () => void
}

/* ── Menu row component ───────────────────────────────────────────────── */

function MenuRow({
  icon,
  label,
  labelColor = 'text-[#e7e9ea]',
  trailing,
  onClick,
  disabled = false,
}: {
  icon: React.ReactNode
  label: string
  labelColor?: string
  trailing?: React.ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-colors text-left',
        disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/[0.04] active:bg-white/[0.06]'
      )}
    >
      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0">
        {icon}
      </div>
      <span className={cn('flex-1 text-[15px]', labelColor)}>{label}</span>
      {trailing}
    </button>
  )
}

/* ── Toggle switch ────────────────────────────────────────────────────── */

function Toggle({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-11 h-6 rounded-full transition-colors relative shrink-0',
        checked ? 'bg-[#FFFFFF]' : 'bg-white/[0.15]'
      )}
    >
      <div
        className={cn(
          'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform duration-200',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        )}
      />
    </button>
  )
}

/* ── ChatSettingsSheet ────────────────────────────────────────────────── */

export function ChatSettingsSheet({
  open,
  onClose,
  user,
  initialMuted = false,
  onNuclearBlock,
  onMuteToggle,
  onClearChat,
  onReport,
}: ChatSettingsSheetProps) {
  const [muted, setMuted] = useState(initialMuted)
  const [showNuclearDialog, setShowNuclearDialog] = useState(false)
  const [nuclearConfirmed, setNuclearConfirmed] = useState(false)
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [showReportDialog, setShowReportDialog] = useState(false)

  // Sync muted state when sheet reopens with different initial value
  useEffect(() => {
    if (open) setMuted(initialMuted)
  }, [open, initialMuted])

  if (!open) return null

  const handleMuteToggle = () => {
    const next = !muted
    setMuted(next)
    onMuteToggle?.(next)
    toast.success(next ? 'Notifications muted' : 'Notifications unmuted')
  }

  const handleNuclearBlock = () => {
    setShowNuclearDialog(false)
    setNuclearConfirmed(false)
    onNuclearBlock?.()
    toast.success('Chat data has been permanently deleted.')
  }

  const handleClearChat = () => {
    setShowClearDialog(false)
    onClearChat?.()
    toast.success('Chat cleared.')
  }

  const handleReport = () => {
    setShowReportDialog(false)
    onReport?.()
    toast.success('Report submitted. We\'ll review it shortly.')
  }

  return (
    <>
      {/* ── Sheet overlay ──────────────────────────────────────────────── */}
      <div className="fixed inset-0 z-[100]">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-[#000000]/60 backdrop-blur-sm animate-fade-in"
          onClick={onClose}
        />

        {/* Sheet */}
        <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] flex flex-col bg-[#000000] border-t border-white/[0.08] rounded-t-2xl animate-comment-slide-up safe-area-bottom">
          {/* Handle bar */}
          <div className="flex justify-center pt-2.5 pb-1 shrink-0">
            <div className="w-9 h-1 rounded-full bg-white/[0.2]" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] shrink-0">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors"
            >
              <svg className="w-5 h-5 text-[#e7e9ea]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
              </svg>
            </button>
            <h3 className="text-[15px] font-bold text-[#e7e9ea]">Chat Settings</h3>
            <div className="w-8" />
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 no-scrollbar">
            {/* User info card */}
            <div className="flex items-center gap-3.5 px-3 py-2 mb-2">
              <PAvatar
                src={user.profileImage}
                name={user.displayName}
                size={52}
                verified={user.isVerified}
                badge={user.badge}
              />
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-[#e7e9ea] truncate flex items-center gap-1">
                  {user.displayName}
                  {(user.isVerified || !!user.badge) && <VerifiedBadge size={14} badge={user.badge} />}
                </p>
                <p className="text-[13px] text-[#94a3b8] truncate">
                  @{user.username}
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-white/[0.06] my-2" />

            {/* Nuclear Block */}
            <MenuRow
              icon={
                <svg className="w-[18px] h-[18px] text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M4.93 4.93l14.14 14.14" />
                </svg>
              }
              label="Nuclear Block"
              labelColor="text-red-400"
              onClick={() => setShowNuclearDialog(true)}
            />

            {/* Mute toggle */}
            <MenuRow
              icon={
                <svg className={cn('w-[18px] h-[18px]', muted ? 'text-[#FFFFFF]' : 'text-[#94a3b8]')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  {!muted && <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />}
                </svg>
              }
              label={muted ? 'Unmute' : 'Mute'}
              trailing={<Toggle checked={muted} onToggle={handleMuteToggle} />}
              onClick={handleMuteToggle}
            />

            {/* Search in Chat (disabled) */}
            <MenuRow
              icon={
                <svg className="w-[18px] h-[18px] text-[#94a3b8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              }
              label="Search in Chat"
              disabled
              trailing={
                <span className="text-[12px] text-[#64748b] px-2 py-0.5 rounded-full bg-white/[0.04]">
                  Soon
                </span>
              }
            />

            {/* Divider */}
            <div className="border-t border-white/[0.06] my-2" />

            {/* Clear Chat */}
            <MenuRow
              icon={
                <svg className="w-[18px] h-[18px] text-[#e7e9ea]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              }
              label="Clear Chat"
              onClick={() => setShowClearDialog(true)}
            />

            {/* Report */}
            <MenuRow
              icon={
                <svg className="w-[18px] h-[18px] text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                  <line x1="4" y1="22" x2="4" y2="15" />
                </svg>
              }
              label="Report"
              labelColor="text-red-400"
              onClick={() => setShowReportDialog(true)}
            />
          </div>
        </div>
      </div>

      {/* ── Nuclear Block Confirmation Dialog ───────────────────────────── */}
      {showNuclearDialog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center px-6">
          <div
            className="absolute inset-0 bg-[#000000]/70 backdrop-blur-sm animate-fade-in"
            onClick={() => { setShowNuclearDialog(false); setNuclearConfirmed(false) }}
          />
          <div className="relative bg-[#000000] border border-white/[0.08] rounded-2xl p-6 max-w-sm w-full animate-fade-in shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-[#e7e9ea]">Nuclear Block</h3>
            </div>
            <p className="text-[14px] text-[#94a3b8] leading-relaxed mb-4">
              This will <span className="text-red-400 font-semibold">permanently delete all chat data</span> with{' '}
              <span className="text-[#e7e9ea] font-medium">@{user.username}</span>. This cannot be undone.
            </p>
            <label className="flex items-start gap-2.5 mb-5 cursor-pointer group">
              <input
                type="checkbox"
                checked={nuclearConfirmed}
                onChange={(e) => setNuclearConfirmed(e.target.checked)}
                className="mt-0.5 accent-red-500"
              />
              <span className="text-[13px] text-[#94a3b8] group-hover:text-[#e7e9ea] transition-colors">
                I understand this action is permanent and cannot be undone.
              </span>
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowNuclearDialog(false); setNuclearConfirmed(false) }}
                className="flex-1 py-2.5 rounded-full border border-white/[0.12] text-[14px] font-bold text-[#e7e9ea] hover:bg-white/[0.04] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleNuclearBlock}
                disabled={!nuclearConfirmed}
                className={cn(
                  'flex-1 py-2.5 rounded-full text-[14px] font-bold transition-colors',
                  nuclearConfirmed
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-white/[0.06] text-[#64748b] cursor-not-allowed'
                )}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Clear Chat Confirmation Dialog ──────────────────────────────── */}
      {showClearDialog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center px-6">
          <div
            className="absolute inset-0 bg-[#000000]/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowClearDialog(false)}
          />
          <div className="relative bg-[#000000] border border-white/[0.08] rounded-2xl p-6 max-w-sm w-full animate-fade-in shadow-2xl">
            <h3 className="text-lg font-bold text-[#e7e9ea] mb-2">Clear Chat</h3>
            <p className="text-[14px] text-[#94a3b8] leading-relaxed mb-5">
              Are you sure you want to clear all messages with{' '}
              <span className="text-[#e7e9ea] font-medium">@{user.username}</span>? This will remove messages from your view.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearDialog(false)}
                className="flex-1 py-2.5 rounded-full border border-white/[0.12] text-[14px] font-bold text-[#e7e9ea] hover:bg-white/[0.04] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearChat}
                className="flex-1 py-2.5 rounded-full bg-[#e7e9ea] text-black text-[14px] font-bold hover:bg-gray-200 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Report Confirmation Dialog ──────────────────────────────────── */}
      {showReportDialog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center px-6">
          <div
            className="absolute inset-0 bg-[#000000]/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowReportDialog(false)}
          />
          <div className="relative bg-[#000000] border border-white/[0.08] rounded-2xl p-6 max-w-sm w-full animate-fade-in shadow-2xl">
            <h3 className="text-lg font-bold text-[#e7e9ea] mb-2">Report @{user.username}</h3>
            <p className="text-[14px] text-[#94a3b8] leading-relaxed mb-5">
              Report this user for violating community guidelines? Our team will review this report and take appropriate action.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowReportDialog(false)}
                className="flex-1 py-2.5 rounded-full border border-white/[0.12] text-[14px] font-bold text-[#e7e9ea] hover:bg-white/[0.04] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReport}
                className="flex-1 py-2.5 rounded-full bg-red-500 text-white text-[14px] font-bold hover:bg-red-600 transition-colors"
              >
                Report
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
