'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app'
import { updateUser } from '@/lib/db'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore'
import { toast } from 'sonner'

/* ── Custom toggle switch ──────────────────────────────────────────────── */

function Toggle({ checked, onToggle, disabled }: { checked: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        'w-11 h-6 rounded-full transition-colors relative shrink-0',
        checked ? 'bg-[#FFFFFF]' : 'bg-white/[0.15]',
        disabled && 'opacity-50 cursor-not-allowed'
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

/* ── Segmented control (matches chat tabs pattern) ─────────────────────── */

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-[3px] p-[3px] rounded-full bg-white/[0.06] border border-white/[0.08]">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex-1 px-3 py-[6px] rounded-full text-[13px] font-semibold transition-all duration-300',
            value === opt.value
              ? 'bg-gradient-to-r from-[#FFFFFF] to-[#D1D5DB] text-black shadow-md shadow-[#FFFFFF]/20'
              : 'text-[#94a3b8] hover:text-[#c0c0c0]'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

/* ── PrivacySettingsView ───────────────────────────────────────────────── */

export function PrivacySettingsView() {
  const user = useAppStore((s) => s.user)
  const setUser = useAppStore((s) => s.setUser)
  const navigate = useAppStore((s) => s.navigate)

  const [nameVisibility, setNameVisibility] = useState<'public' | 'private'>(
    (user?.nameVisibility as 'public' | 'private') || 'public'
  )
  const [dmPermission, setDmPermission] = useState<'all' | 'followers' | 'paid'>(
    (user?.dmPermission as 'all' | 'followers' | 'paid') || 'all'
  )
  const [searchVisibility, setSearchVisibility] = useState<'public' | 'private'>(
    (user?.searchVisibility as 'public' | 'private') || 'public'
  )
  const [paidChatEnabled, setPaidChatEnabled] = useState(user?.paidChatEnabled || false)
  const [paidChatPrice, setPaidChatPrice] = useState(String(user?.paidChatPrice || 99))
  const [saving, setSaving] = useState(false)
  const [showNuclearDialog, setShowNuclearDialog] = useState(false)
  const [nuclearConfirmed, setNuclearConfirmed] = useState(false)

  // Paid chat available to all account types

  const persistSetting = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!user) return
      setSaving(true)
      try {
        await updateUser(user.id, patch)
        // Update local store
        setUser({ ...user, ...patch } as any)
        toast.success('Setting updated')
      } catch {
        toast.error('Failed to save setting')
      } finally {
        setSaving(false)
      }
    },
    [user, setUser]
  )

  const handleNameVisibility = (v: 'public' | 'private') => {
    setNameVisibility(v)
    persistSetting({ nameVisibility: v })
  }

  const handleDmPermission = (v: 'all' | 'followers' | 'paid') => {
    setDmPermission(v)
    persistSetting({ dmPermission: v })
  }

  const handleSearchVisibility = (v: 'public' | 'private') => {
    setSearchVisibility(v)
    persistSetting({ searchVisibility: v })
  }

  const handlePaidChatToggle = () => {
    const next = !paidChatEnabled
    setPaidChatEnabled(next)
    persistSetting({ paidChatEnabled: next })
  }

  const handlePaidChatPrice = () => {
    const price = Math.max(1, Math.min(99999, parseInt(paidChatPrice, 10) || 0))
    setPaidChatPrice(String(price))
    persistSetting({ paidChatPrice: price })
  }

  const handleNuclearBlock = useCallback(async () => {
    if (!user) return
    setShowNuclearDialog(false)
    setNuclearConfirmed(false)
    try {
      // 1. Find all chats where user is participant
      const chatsRef = collection(db, 'chats')
      const q1 = query(chatsRef, where('user1Id', '==', user.id))
      const q2 = query(chatsRef, where('user2Id', '==', user.id))
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)])
      const allChatIds = [...snap1.docs, ...snap2.docs].map(d => d.id)
      const uniqueChatIds = [...new Set(allChatIds)]

      // 2. Delete all messages in each chat (subcollection)
      for (const chatId of uniqueChatIds) {
        const msgsRef = collection(db, 'chats', chatId, 'messages')
        const msgSnap = await getDocs(msgsRef)
        const batchDeletes = msgSnap.docs.map(d => deleteDoc(doc(db, 'chats', chatId, 'messages', d.id)))
        await Promise.all(batchDeletes)
      }

      // 3. Delete the chat documents themselves
      const chatDeletes = uniqueChatIds.map(chatId => deleteDoc(doc(db, 'chats', chatId)))
      await Promise.all(chatDeletes)

      toast.success(`All chat data has been permanently deleted (${uniqueChatIds.length} conversations).`)
    } catch (err) {
      console.error('[NuclearBlock] Failed:', err)
      toast.error('Failed to delete chat data. Try again.')
    }
  }, [user])

  return (
    <div className="min-h-screen bg-[#000000]">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-[#000000]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate('settings')}
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
          <h1 className="text-lg font-bold text-[#e7e9ea]">Privacy &amp; Security</h1>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-32 space-y-6">
        {/* Name Visibility */}
        <section className="bg-[#000000] rounded-2xl p-4 space-y-3 border border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#FFFFFF]/10 flex items-center justify-center">
              <svg className="w-[18px] h-[18px] text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-[15px] font-bold text-[#e7e9ea]">Name Visibility</h3>
              <p className="text-[13px] text-[#94a3b8] mt-0.5">
                {nameVisibility === 'public'
                  ? 'Anyone can see your display name on your profile.'
                  : 'Only you can see your display name. Others see your username.'}
              </p>
            </div>
            <Toggle
              checked={nameVisibility === 'public'}
              onToggle={() => handleNameVisibility(nameVisibility === 'public' ? 'private' : 'public')}
            />
          </div>
          <div className="flex items-center gap-2 ml-12">
            <span className={cn('text-[12px] font-medium px-2.5 py-1 rounded-full', nameVisibility === 'public' ? 'bg-[#FFFFFF]/15 text-[#FFFFFF]' : 'text-[#94a3b8]')}>
              Public
            </span>
            <span className={cn('text-[12px] font-medium px-2.5 py-1 rounded-full', nameVisibility === 'private' ? 'bg-[#FFFFFF]/15 text-[#FFFFFF]' : 'text-[#94a3b8]')}>
              Private
            </span>
          </div>
        </section>

        {/* DM Permission */}
        <section className="bg-[#000000] rounded-2xl p-4 space-y-3 border border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#FFFFFF]/10 flex items-center justify-center">
              <svg className="w-[18px] h-[18px] text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-[15px] font-bold text-[#e7e9ea]">Private Messages</h3>
              <p className="text-[13px] text-[#94a3b8] mt-0.5">
                {dmPermission === 'all' && 'Anyone can send you messages.'}
                {dmPermission === 'followers' && 'Only your followers can message you.'}
                {dmPermission === 'paid' && 'Only users who pay can start a chat with you.'}
              </p>
            </div>
          </div>
          <div className="ml-12">
            <SegmentedControl<'all' | 'followers' | 'paid'>
              options={[
                { label: 'Everyone', value: 'all' },
                { label: 'Followers', value: 'followers' },
                { label: 'Paid Only', value: 'paid' },
              ]}
              value={dmPermission}
              onChange={handleDmPermission}
            />
          </div>
        </section>

        {/* Search Visibility */}
        <section className="bg-[#000000] rounded-2xl p-4 space-y-3 border border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#FFFFFF]/10 flex items-center justify-center">
              <svg className="w-[18px] h-[18px] text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-[15px] font-bold text-[#e7e9ea]">Search Visibility</h3>
              <p className="text-[13px] text-[#94a3b8] mt-0.5">
                {searchVisibility === 'public'
                  ? 'Your profile appears in search results and suggestions.'
                  : 'Your profile is hidden from search results and suggestions.'}
              </p>
            </div>
            <Toggle
              checked={searchVisibility === 'public'}
              onToggle={() => handleSearchVisibility(searchVisibility === 'public' ? 'private' : 'public')}
            />
          </div>
          <div className="flex items-center gap-2 ml-12">
            <span className={cn('text-[12px] font-medium px-2.5 py-1 rounded-full', searchVisibility === 'public' ? 'bg-[#FFFFFF]/15 text-[#FFFFFF]' : 'text-[#94a3b8]')}>
              Public
            </span>
            <span className={cn('text-[12px] font-medium px-2.5 py-1 rounded-full', searchVisibility === 'private' ? 'bg-[#FFFFFF]/15 text-[#FFFFFF]' : 'text-[#94a3b8]')}>
              Private
            </span>
          </div>
        </section>

        {/* Paid Chat */}
        <section className="bg-[#000000] rounded-2xl p-4 space-y-3 border border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#FFFFFF]/10 flex items-center justify-center">
                <svg className="w-[18px] h-[18px] text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-[15px] font-bold text-[#e7e9ea]">Paid Chat</h3>
                <p className="text-[13px] text-[#94a3b8] mt-0.5">
                  {paidChatEnabled
                    ? 'Users must pay to start a conversation with you.'
                    : 'Enable paid chat to charge users for messaging you.'}
                </p>
              </div>
              <Toggle checked={paidChatEnabled} onToggle={handlePaidChatToggle} />
            </div>

            {paidChatEnabled && (
              <div className="ml-12 animate-fade-in">
                <label className="text-[13px] text-[#94a3b8] mb-1.5 block">Chat price</label>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold text-[#FFFFFF]">₹</span>
                  <input
                    type="number"
                    min={1}
                    max={99999}
                    value={paidChatPrice}
                    onChange={(e) => setPaidChatPrice(e.target.value)}
                    onBlur={handlePaidChatPrice}
                    className="w-28 bg-transparent border border-white/[0.08] rounded-lg px-3 py-2 text-[15px] text-[#e7e9ea] outline-none focus:border-[#FFFFFF]/50 transition-colors"
                  />
                  <button
                    onClick={handlePaidChatPrice}
                    disabled={saving}
                    className="px-3 py-2 rounded-lg text-[13px] font-bold bg-[#FFFFFF]/15 text-[#FFFFFF] hover:bg-[#FFFFFF]/25 transition-colors disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </section>
        {/* ── Nuclear Block (Danger Zone) ──────────────────────────────── */}
        <section className="bg-[#000000] rounded-2xl p-4 space-y-3 border border-red-500/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg className="w-[18px] h-[18px] text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M4.93 4.93l14.14 14.14" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-[15px] font-bold text-red-400">Danger Zone</h3>
              <p className="text-[13px] text-[#94a3b8] mt-0.5">
                Permanently delete all your chat data. This action cannot be undone.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowNuclearDialog(true)}
            className="ml-12 w-full sm:w-auto px-5 py-2.5 rounded-full border border-red-500/40 text-red-400 text-[14px] font-bold hover:bg-red-500/10 transition-colors"
          >
            Nuclear Block
          </button>
        </section>

        {/* Saving indicator */}
        {saving && (
          <div className="flex items-center justify-center gap-2 animate-fade-in">
            <div className="w-4 h-4 border-2 border-[#FFFFFF]/30 border-t-[#FFFFFF] rounded-full animate-spin" />
            <span className="text-[13px] text-[#94a3b8]">Saving...</span>
          </div>
        )}
      </div>

      {/* ── Nuclear Block Confirmation Dialog ───────────────────────────── */}
      {showNuclearDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
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
              This will <span className="text-red-400 font-semibold">permanently delete all your chat data</span> —
              every conversation, message, and media attachment. This is irreversible.
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
                Delete All Chats
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
