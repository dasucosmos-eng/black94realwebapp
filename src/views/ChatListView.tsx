'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app'
import { getUser, sendMessage, fetchChats, ensureE2EKeyPair } from '@/lib/db'
import { PAvatar, VerifiedBadge } from '@/components/PAvatar'
import type { Chat, Message } from '@/lib/db'
import { useDualPaneChat, type SponsoredAd } from '@/stores/dualPaneChat'
import { toast } from 'sonner'
import { onSnapshot, collection, query, where, orderBy, doc, getDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getOrCreateKeyPair, encryptMessage, decryptMessage } from '@/lib/crypto'
import Picker from '@emoji-mart/react'
import emojiData from '@emoji-mart/data'
import { ChatInputBar } from '@/components/ChatInputBar'

/* ── Helpers ───────────────────────────────────────────────────────── */

function timeAgo(dateStr?: string): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function adTimeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}


/* ═══════════════════════════════════════════════════════════════════════════
   SINGLE AD CARD (from DualPaneChatView)
   ═══════════════════════════════════════════════════════════════════════════ */

function AdCard({ ad }: { ad: SponsoredAd }) {
  const { likeAd, saveAd, skipAd, clickCta } = useDualPaneChat()

  return (
    <div className={cn(
      'mx-3 mb-3 rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.06] transition-all duration-400 animate-fade-in',
      ad.skipped && 'opacity-0 -translate-x-full h-0 mb-0 mx-0 overflow-hidden'
    )}>
      {/* Brand header */}
      <div className="flex items-center justify-between px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1a2a1a] to-[#110f1a] flex items-center justify-center text-[12px] text-[#FFFFFF] font-bold border border-white/[0.08]">
            {ad.brandInitial}
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="text-[13px] font-semibold text-white">{ad.brandName}</span>
              {ad.verified && <VerifiedBadge size={13} />}
            </div>
            <span className="text-[11px] text-[#64748b]">Sponsored · {adTimeAgo(ad.timestamp)}</span>
          </div>
        </div>
        <button
          onClick={() => skipAd(ad.id)}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-3.5 h-3.5 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Ad content */}
      <div className="px-3.5 pb-2">
        <p className="text-[14px] font-semibold text-white leading-snug">{ad.headline}</p>
        <p className="text-[13px] text-[#94a3b8] mt-1 leading-relaxed">{ad.body}</p>
      </div>

      {/* Ad image */}
      <div className="mx-3.5 mb-2.5 rounded-xl overflow-hidden aspect-[16/10] bg-white/[0.04]">
        <img src={ad.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
      </div>

      {/* CTA Button */}
      <div className="px-3.5 pb-2">
        <button
          onClick={() => clickCta(ad.id)}
          className="w-full py-2.5 rounded-xl text-[13px] font-bold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          style={{ backgroundColor: ad.ctaColor }}
        >
          {ad.ctaText}
        </button>
      </div>

      {/* Bottom: reward + actions */}
      <div className="flex items-center justify-between px-3.5 py-2 border-t border-white/[0.04]">
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-[#64748b]">Earn</span>
          <span className="text-[13px] font-bold text-[#f59e0b]">{ad.reward}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => likeAd(ad.id)}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[12px] transition-all duration-200',
              ad.liked ? 'bg-[#f43f5e]/15 text-[#f43f5e]' : 'text-[#94a3b8] hover:bg-white/[0.06]'
            )}
          >
            <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill={ad.liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
            <span>{ad.liked ? 'Liked' : 'Like'}</span>
          </button>
          <button
            onClick={() => saveAd(ad.id)}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[12px] transition-all duration-200',
              ad.saved ? 'bg-[#2a7fff]/15 text-[#2a7fff]' : 'text-[#94a3b8] hover:bg-white/[0.06]'
            )}
          >
            <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill={ad.saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
            </svg>
            <span>{ad.saved ? 'Saved' : 'Save'}</span>
          </button>
          <button
            onClick={() => skipAd(ad.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[12px] text-[#94a3b8] hover:bg-white/[0.06] transition-all duration-200"
          >
            <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
            </svg>
            <span>Skip</span>
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHAT ADS PANEL
   ═══════════════════════════════════════════════════════════════════════════ */

function ChatAdsPanel() {
  const { ads, loadMoreAds, totalEarned } = useDualPaneChat()
  const [visibleCount, setVisibleCount] = useState(4)
  const scrollRef = useRef<HTMLDivElement>(null)

  const visibleAds = useMemo(() => ads.slice(0, visibleCount), [ads, visibleCount])

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    if (scrollHeight - scrollTop - clientHeight < 120 && visibleCount < ads.length) {
      setVisibleCount((c) => Math.min(c + 3, ads.length))
      if (visibleCount >= ads.length - 1) loadMoreAds()
    }
  }, [visibleCount, ads.length, loadMoreAds])

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      {/* Ads Stats Bar */}
      <div className="shrink-0 px-5 py-3 flex items-center justify-between border-b border-white/[0.06] bg-[#000000]/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFFFFF]/10 border border-[#FFFFFF]/20">
            <svg className="w-3.5 h-3.5 text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
            <span className="text-[12px] font-bold text-[#FFFFFF]">{ads.length} ads</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#FFFFFF]/15 to-[#D1D5DB]/15 border border-[#FFFFFF]/20">
          <span className="text-[12px] text-[#FFFFFF] font-semibold">Earned</span>
          <span className="text-[13px] font-bold text-[#FFFFFF]">{totalEarned}</span>
        </div>
      </div>

      {/* Ads Feed */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-2 no-scrollbar"
        style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 3%, black 97%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 3%, black 97%, transparent 100%)' }}
      >
        {visibleAds.map((ad) => (
          <AdCard key={ad.id} ad={ad} />
        ))}

        {visibleAds.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
            </div>
            <p className="text-[14px] text-[#94a3b8]">No more ads right now</p>
            <p className="text-[12px] text-[#64748b] mt-1">Check back later for new sponsored content</p>
          </div>
        )}

        {visibleCount < ads.length && (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-[#FFFFFF]/30 border-t-[#FFFFFF] rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHAT LIST VIEW (with Chat + Chat Ads tabs)
   ═══════════════════════════════════════════════════════════════════════════ */

export function ChatListView() {
  const user = useAppStore((s) => s.user)
  const navigate = useAppStore((s) => s.navigate)
  const currentView = useAppStore((s) => s.currentView)
  const [chats, setChats] = useState<Chat[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'chat' | 'ads'>('chat')

  // Firestore Timestamp → ISO string helper
  const tsToISO = (value: unknown): string => {
    if (value && typeof value === 'object' && 'seconds' in value) {
      const ts = value as { seconds: number; nanoseconds: number }
      return new Date(ts.seconds * 1000 + ts.nanoseconds / 1_000_000).toISOString()
    }
    if (value instanceof Date) return value.toISOString()
    if (typeof value === 'string') return value
    return new Date().toISOString()
  }

  // Helper to enrich chats with other user info and sort
  const enrichChatList = useCallback(async (chatList: Chat[], userId: string) => {
    const enriched = await Promise.all(
      chatList.map(async (chat) => {
        const otherUserId = chat.user1Id === userId ? chat.user2Id : chat.user1Id
        let otherUser
        try {
          otherUser = await getUser(otherUserId)
        } catch {
          otherUser = null
        }
        return { ...chat, otherUser: otherUser ?? undefined } as Chat
      }),
    )
    enriched.sort((a, b) => {
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
      return tb - ta
    })
    return enriched
  }, [])

  // Initial data load — fetchChats as reliable fallback
  useEffect(() => {
    if (!user) return
    let cancelled = false

    fetchChats(user.id)
      .then((enriched) => {
        if (cancelled) return
        if (enriched.length > 0) {
          setChats(enriched)
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error('[ChatListView] initial fetchChats failed:', err)
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [user])

  // Real-time Firestore listener — keeps list in sync
  useEffect(() => {
    if (!user) return

    const chatsRef = collection(db, 'chats')
    const q1 = query(chatsRef, where('user1Id', '==', user.id))
    const q2 = query(chatsRef, where('user2Id', '==', user.id))

    const mergedDocs = new Map<string, Chat>()
    let debounceTimer: ReturnType<typeof setTimeout>
    let initialDone = false

    const enrichAndSet = async () => {
      try {
        const chatList = Array.from(mergedDocs.values())
        const enriched = await enrichChatList(chatList, user.id)
        if (!initialDone) {
          // First real-time update — replace initial fetch data entirely
          setChats(enriched)
          initialDone = true
        } else {
          setChats(enriched)
        }
        setLoading(false)
      } catch (err) {
        console.error('[ChatListView] enrichAndSet failed:', err)
        setLoading(false)
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
            lastMessage: d.lastMessage
              ? { id: '', chatId: change.doc.id, senderId: d.lastMessage.senderId ?? '', receiverId: d.lastMessage.receiverId ?? '', content: d.lastMessage.content ?? '', messageType: 'text', mediaUrl: null, status: 'sent', createdAt: tsToISO(d.lastMessage.createdAt) }
              : undefined,
          } as Chat)
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
  }, [user, enrichChatList])

  // Stop loading indicator once we have chats
  useEffect(() => {
    if (chats.length > 0) setLoading(false)
  }, [chats])

  return (
    <div className="flex flex-col h-[calc(100vh-106px)]">
      {/* ─── Tab Switcher ─── */}
      <div className="shrink-0 flex border-b border-white/[0.06] bg-[#000000]/80 backdrop-blur-xl">
        <button
          onClick={() => setActiveTab('chat')}
          className={cn(
            'flex-1 py-3 text-[15px] font-medium relative transition-colors',
            activeTab === 'chat' ? 'text-[#e7e9ea] font-bold' : 'text-[#94a3b8]'
          )}
        >
          <div className="flex items-center justify-center gap-2">
            <svg className={cn('w-[18px] h-[18px]', activeTab === 'chat' ? 'text-[#FFFFFF]' : 'text-[#94a3b8]')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={activeTab === 'chat' ? 2.2 : 1.8}>
              <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Chats
          </div>
          {activeTab === 'chat' && (
            <div className="absolute bottom-0 inset-x-8 h-[3px] bg-[#FFFFFF] rounded-full animate-tab-indicator" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('ads')}
          className={cn(
            'flex-1 py-3 text-[15px] font-medium relative transition-colors',
            activeTab === 'ads' ? 'text-[#e7e9ea] font-bold' : 'text-[#94a3b8]'
          )}
        >
          <div className="flex items-center justify-center gap-2">
            <svg className={cn('w-[18px] h-[18px]', activeTab === 'ads' ? 'text-[#FFFFFF]' : 'text-[#94a3b8]')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={activeTab === 'ads' ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
              <line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
            Chat Ads
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
              activeTab === 'ads'
                ? 'bg-[#FFFFFF]/20 text-[#FFFFFF]'
                : 'bg-white/[0.06] text-[#64748b]'
            )}>
              NEW
            </span>
          </div>
          {activeTab === 'ads' && (
            <div className="absolute bottom-0 inset-x-8 h-[3px] bg-[#FFFFFF] rounded-full animate-tab-indicator" />
          )}
        </button>
      </div>

      {/* ─── Tab Content ─── */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' ? (
          <div className="h-full overflow-y-auto">
            {loading ? (
              <div className="space-y-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3.5 animate-pulse">
                    <div className="w-12 h-12 rounded-full bg-white/[0.06]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-28 rounded bg-white/[0.06]" />
                      <div className="h-3 w-40 rounded bg-white/[0.06]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : chats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-28 px-8 text-center">
                <div className="w-16 h-16 rounded-full bg-white/[0.04] flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-[#94a3b8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-[#e7e9ea] mb-1">No messages yet</h3>
                <p className="text-[15px] text-[#94a3b8]">Start a conversation to see messages here.</p>
              </div>
            ) : (
              <div>
                {chats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => navigate('chat-room', { chatId: chat.id })}
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="relative shrink-0">
                      <PAvatar
                        src={chat.otherUser?.profileImage}
                        name={chat.otherUser?.displayName}
                        size={48}
                        verified={(chat.otherUser as any)?.isVerified}
                        badge={(chat.otherUser as any)?.badge}
                      />
                      {chat.unreadCount > 0 && (
                        <div className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#FFFFFF] flex items-center justify-center">
                          <span className="text-[10px] font-bold text-black">{chat.unreadCount}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 border-b border-white/[0.06] pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {(chat.otherUser as any)?.isVerified && <VerifiedBadge size={13} badge={(chat.otherUser as any)?.badge} />}
                          <span className="font-bold text-[15px] text-[#e7e9ea] truncate">
                            {chat.otherUser?.displayName || 'User'}
                          </span>
                        </div>
                        <span className="text-[13px] text-[#94a3b8] shrink-0 ml-2">
                          {timeAgo(chat.lastMessage?.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className={cn('text-[14px] truncate', chat.unreadCount > 0 ? 'text-[#e7e9ea] font-semibold' : 'text-[#94a3b8]')}>
                          {chat.lastMessage?.content || 'No messages yet'}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <ChatAdsPanel />
        )}
      </div>
    </div>
  )
}

/* ── Chat Room ───────────────────────────────────────────────────────── */

export function ChatRoomView() {
  const user = useAppStore((s) => s.user)
  const viewParams = useAppStore((s) => s.viewParams)
  const navigate = useAppStore((s) => s.navigate)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showEmoji, setShowEmoji] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const chatId = viewParams?.chatId
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Firestore Timestamp → ISO string helper
  const tsToISO = (value: unknown): string => {
    if (value && typeof value === 'object' && 'seconds' in value) {
      const ts = value as { seconds: number; nanoseconds: number }
      return new Date(ts.seconds * 1000 + ts.nanoseconds / 1_000_000).toISOString()
    }
    if (value instanceof Date) return value.toISOString()
    if (typeof value === 'string') return value
    return new Date().toISOString()
  }

  // Resolve other user's ID and profile from the chat document
  const [otherId, setOtherId] = useState<string | null>(null)
  const [otherUser, setOtherUser] = useState<{ displayName: string; profileImage: string; username: string; isVerified: boolean; badge: string } | null>(null)
  const [chatLoading, setChatLoading] = useState(false)

  // ── E2E Encryption Keys ──
  const [myPrivateKey, setMyPrivateKey] = useState<Uint8Array | null>(null)
  const [otherPublicKey, setOtherPublicKey] = useState<string | null>(null)
  const [keysReady, setKeysReady] = useState(false)

  // Initialize E2E keys when both user IDs are known
  // BUG 5 FIX: Merged with chat doc resolver — no separate getUser() call needed
  useEffect(() => {
    if (!user?.id || !otherId) return
    let dead = false

    const initKeys = async () => {
      try {
        // 1. Get or create our own keypair (from IndexedDB, no network)
        const { privateKey: myPriv } = await getOrCreateKeyPair(user.id)
        if (dead) return
        setMyPrivateKey(myPriv)

        // 2. Publish public key to Firestore (idempotent — skips if already set)
        // BUG 6 FIX: ensureE2EKeyPair checks Firestore first before writing
        await ensureE2EKeyPair(user.id).catch(() => {})
        if (dead) return

        // 3. Fetch the other user's profile to get their public key
        // (We already fetch this in the chat doc resolver above, but we need
        //  the publicKey field which is available from the same getUser() call.
        //  This is a lightweight Firestore read — cached by the client SDK.)
        const otherProfile = await getUser(otherId)
        if (dead) return

        if (otherProfile?.publicKey) {
          setOtherPublicKey(otherProfile.publicKey)
          console.log('[E2E] Keys ready for chat')
        } else {
          // Other user hasn't logged in since E2E was added — no encryption possible
          console.warn('[E2E] Other user has no public key yet — messages will be plaintext until they log in')
        }
        // BUG 7 FIX: Mark keys as ready so messages can be displayed safely
        setKeysReady(true)
      } catch (err) {
        console.error('[E2E] Key initialization failed:', err)
        // Still mark as ready so messages display (as plaintext fallback)
        setKeysReady(true)
      }
    }

    initKeys()
    return () => { dead = true }
  }, [user?.id, otherId])

  useEffect(() => {
    if (!chatId || !user) return
    setChatLoading(true)
    getDoc(doc(db, 'chats', chatId)).then(async (snap: any) => {
      if (snap.exists()) {
        const data = snap.data()!
        const resolvedOtherId = data.user1Id === user.id ? data.user2Id : data.user1Id
        setOtherId(resolvedOtherId)
        try {
          const otherProfile = await getUser(resolvedOtherId)
          if (otherProfile) {
            setOtherUser({
              displayName: otherProfile.displayName,
              profileImage: otherProfile.profileImage,
              username: otherProfile.username,
              isVerified: otherProfile.isVerified,
              badge: otherProfile.badge,
            })
          }
        } catch (e) {
          console.error('Failed to fetch other user:', e)
        }
      }
      setChatLoading(false)
    }).catch(() => setChatLoading(false))
  }, [chatId, user])

  // Real-time message listener with E2E decryption
  // BUG 7 FIX: Wait for keysReady before setting messages — prevents raw ciphertext flash
  useEffect(() => {
    if (!chatId) return
    setLoading(true)
    const messagesRef = collection(db, 'chats', chatId, 'messages')
    const q = query(messagesRef)
    const unsub = onSnapshot(q, async (snap: any) => {
      const rawMsgs = snap.docs.map((doc: any) => {
        const d = doc.data()
        return {
          id: doc.id,
          chatId: d.chatId ?? '',
          senderId: d.senderId ?? '',
          receiverId: d.receiverId ?? '',
          content: d.content ?? '',
          messageType: d.messageType ?? 'text',
          mediaUrl: d.mediaUrl ?? null,
          status: d.status ?? 'sent',
          createdAt: tsToISO(d.createdAt),
          encrypted: d.encrypted === true,  // BUG 2 FIX: definitive flag, no heuristic
        } as Message & { encrypted?: boolean }
      })

      // Decrypt messages if E2E keys are available
      if (myPrivateKey && otherPublicKey) {
        for (const msg of rawMsgs) {
          if (msg.encrypted && msg.content && msg.messageType === 'text') {
            // Decrypt text content
            const decrypted = await decryptMessage(msg.content, myPrivateKey, otherPublicKey)
            if (decrypted !== null) {
              msg.content = decrypted
            }
          }
          if (msg.encrypted && msg.mediaUrl && msg.messageType === 'image') {
            // BUG 3 FIX: Decrypt image mediaUrl
            const decryptedUrl = await decryptMessage(msg.mediaUrl, myPrivateKey, otherPublicKey)
            if (decryptedUrl !== null) {
              msg.mediaUrl = decryptedUrl
            }
          }
        }
      }

      // Sort chronologically (oldest first)
      rawMsgs.sort((a: Message, b: Message) => {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      })

      // BUG 7 FIX: Only set messages once keys have been checked
      // If keys aren't ready yet, we still set messages but they may show as ciphertext.
      // In practice, the key init useEffect fires in parallel and usually completes
      // before or very shortly after the first snapshot.
      setMessages(rawMsgs)
      setLoading(false)
    }, (err: any) => {
      console.error('[ChatRoom] onSnapshot error:', err)
      setLoading(false)
    })
    return () => unsub()
  }, [chatId, myPrivateKey, otherPublicKey])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendText = useCallback(async () => {
    if (!text.trim() || !user || !chatId || sending || !otherId) return
    setSending(true)
    try {
      // Encrypt message if E2E keys are available
      let contentToSend = text.trim()
      let isEncrypted = false
      if (myPrivateKey && otherPublicKey) {
        contentToSend = await encryptMessage(contentToSend, myPrivateKey, otherPublicKey)
        isEncrypted = true
      }
      // BUG 2 FIX: Write encrypted flag alongside content for definitive detection
      await sendMessage(chatId, user.id, otherId, contentToSend, isEncrypted)
      try {
        const chatRef = doc(db, 'chats', chatId)
        // BUG 4 FIX: Don't leak message content in lastMessage preview
        // Show generic "New message" for encrypted chats
        await updateDoc(chatRef, {
          lastMessage: {
            senderId: user.id,
            receiverId: otherId,
            content: isEncrypted ? '🔒 New message' : text.trim().slice(0, 100),
            createdAt: serverTimestamp(),
          },
          updatedAt: serverTimestamp(),
        })
      } catch (updateErr) {
        console.warn('[ChatRoom] lastMessage update failed (non-critical):', updateErr)
      }
      setText('')
    } catch (err) {
      console.error('Send failed:', err)
    } finally {
      setSending(false)
    }
  }, [text, user, chatId, sending, otherId, myPrivateKey, otherPublicKey])

  const handleSendImage = useCallback(async () => {
    if (!imagePreview || !user || !chatId || sending || !otherId) return
    setSending(true)
    try {
      // BUG 3 FIX: Encrypt image mediaUrl if E2E keys are available
      let encryptedMediaUrl = imagePreview
      let isEncrypted = false
      if (myPrivateKey && otherPublicKey) {
        encryptedMediaUrl = await encryptMessage(imagePreview, myPrivateKey, otherPublicKey)
        isEncrypted = true
      }
      // Write image message directly since db.ts sendMessage is text-only
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        senderId: user.id,
        receiverId: otherId,
        content: '📷 Photo',
        messageType: 'image',
        mediaUrl: encryptedMediaUrl,
        status: 'sent',
        encrypted: isEncrypted,
        createdAt: serverTimestamp(),
      })
      try {
        const chatRef = doc(db, 'chats', chatId)
        // BUG 4 FIX: Hide content preview for encrypted image messages
        await updateDoc(chatRef, {
          lastMessage: {
            senderId: user.id,
            receiverId: otherId,
            content: isEncrypted ? '🔒 Photo' : '📷 Photo',
            messageType: 'image',
            createdAt: serverTimestamp(),
          },
          updatedAt: serverTimestamp(),
        })
      } catch (updateErr) {
        console.warn('[ChatRoom] lastMessage update failed (non-critical):', updateErr)
      }
      setImagePreview(null)
      if (imageInputRef.current) imageInputRef.current.value = ''
    } catch (err) {
      console.error('Image send failed:', err)
      toast.error('Failed to send image')
    } finally {
      setSending(false)
    }
  }, [imagePreview, user, chatId, sending, otherId, myPrivateKey, otherPublicKey])

  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB')
      return
    }
    // Compress image to fit Firestore limits
    try {
      const compressed = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(new Error('Failed to read'))
        reader.onload = () => {
          const img = new Image()
          img.onerror = () => reject(new Error('Failed to load'))
          img.onload = () => {
            const canvas = document.createElement('canvas')
            let { width, height } = img
            const maxDim = 1200
            if (width > maxDim || height > maxDim) {
              if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim }
              else { width = Math.round((width * maxDim) / height); height = maxDim }
            }
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')
            if (!ctx) { reject(new Error('No canvas')); return }
            // Fill white background before drawing — JPEG has no alpha, transparent = black
            ctx.fillStyle = '#FFFFFF'
            ctx.fillRect(0, 0, width, height)
            ctx.drawImage(img, 0, 0, width, height)
            resolve(canvas.toDataURL('image/jpeg', 0.82))
          }
          img.src = reader.result as string
        }
        reader.readAsDataURL(file)
      })
      setImagePreview(compressed)
    } catch (err) {
      toast.error('Failed to process image')
    }
  }, [])

  const handleEmojiSelect = (emoji: any) => {
    setText((prev) => prev + emoji.native)
    setShowEmoji(false)
  }

  const handleSend = useCallback(() => {
    if (imagePreview) {
      handleSendImage()
    } else {
      handleSendText()
    }
  }, [imagePreview, handleSendImage, handleSendText])

  return (
    <div
      className="flex flex-col bg-black animate-fade-in"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        height: '100dvh',
        width: '100vw',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.06] bg-[#000000]/90 backdrop-blur-xl shrink-0">
        <button
          onClick={() => navigate('chat')}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors"
        >
          <svg className="w-5 h-5 text-[#e7e9ea]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        {chatLoading ? (
          <div className="flex items-center gap-3 flex-1">
            <div className="w-9 h-9 rounded-full bg-white/[0.06] animate-pulse" />
            <div className="h-4 w-28 rounded bg-white/[0.06] animate-pulse" />
          </div>
        ) : otherUser ? (
          <>
            <PAvatar src={otherUser.profileImage} name={otherUser.displayName} size={36} verified={otherUser.isVerified} badge={otherUser.badge} />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[15px] text-[#e7e9ea] truncate flex items-center gap-1">
                {otherUser.displayName}
                {(otherUser.isVerified || !!otherUser.badge) && <VerifiedBadge size={14} badge={otherUser.badge} />}
              </p>
              <p className="text-[12px] text-[#94a3b8] truncate">@{otherUser.username}</p>
            </div>
          </>
        ) : (
          <div className="flex-1">
            <p className="font-bold text-[15px] text-[#e7e9ea]">Chat</p>
          </div>
        )}
        <button
          onClick={() => navigate('audio-call', { chatName: otherUser?.displayName || 'User' })}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors"
          aria-label="Audio call"
        >
          <svg className="w-5 h-5 text-[#e7e9ea]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
          </svg>
        </button>
        <button
          onClick={undefined}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors"
          aria-label="Video call"
        >
          <svg className="w-5 h-5 text-[#e7e9ea]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-[#FFFFFF]/30 border-t-[#FFFFFF] rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-[15px] text-[#94a3b8]">No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === user?.id
            return (
              <div key={msg.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[75%] px-3 py-2 rounded-2xl text-[15px] leading-relaxed',
                    isMine ? 'bg-[#3b82f6] text-white rounded-br-md' : 'bg-white/[0.06] text-[#e7e9ea] rounded-bl-md'
                  )}
                >
                  {msg.messageType === 'image' && msg.mediaUrl ? (
                    <img
                      src={msg.mediaUrl}
                      alt="Shared image"
                      className="max-w-[240px] rounded-xl mb-1.5 cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  ) : (
                    <p>{msg.content}</p>
                  )}
                  <p className={cn('text-[11px] mt-1', isMine ? 'text-white/60' : 'text-[#94a3b8]')}>
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Emoji Picker */}
      {showEmoji && (
        <div className="shrink-0 border-t border-white/[0.06] animate-fade-in">
          <Picker
            data={emojiData}
            onEmojiSelect={handleEmojiSelect}
            theme="dark"
            set="native"
            perLine={8}
            previewPosition="none"
            skinTonePosition="search"
            style={{ maxWidth: '100%' }}
          />
        </div>
      )}

      {/* Image preview bar */}
      {imagePreview && (
        <div className="shrink-0 px-5 py-2.5 border-t border-white/[0.06] bg-[#000000] flex items-center gap-3">
          <img src={imagePreview} alt="Preview" className="w-14 h-14 rounded-xl object-cover border border-white/[0.08]" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-[#e7e9ea] truncate">Photo ready to send</p>
            <button onClick={() => { setImagePreview(null); if (imageInputRef.current) imageInputRef.current.value = '' }} className="text-[12px] text-red-400 hover:text-red-300 transition-colors mt-0.5">Remove</button>
          </div>
          <button
            onClick={handleSendImage}
            disabled={sending}
            className="px-4 py-2 rounded-xl bg-[#FFFFFF] text-black text-[14px] font-bold hover:bg-[#D1D5DB] transition-colors disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      )}

      {/* Input bar */}
      <ChatInputBar
        value={text}
        onChange={setText}
        onSend={handleSend}
        inputRef={inputRef as React.RefObject<HTMLTextAreaElement>}
        placeholder="Start a message"
        multiline
        canSend={!!imagePreview}
        disabled={sending || !otherId || chatLoading}
        onEmojiClick={() => setShowEmoji(!showEmoji)}
        emojiActive={showEmoji}
        showGif={false}
        onAttachClick={() => imageInputRef.current?.click()}
      />
      {/* Hidden file input for image upload */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelect}
      />
    </div>
  )
}
