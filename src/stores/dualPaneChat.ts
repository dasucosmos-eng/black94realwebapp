import { create } from 'zustand'

/* ── Types ────────────────────────────────────────────────────────── */

export interface MessageReaction {
  emoji: string
  count: number
  reacted: boolean   // whether current user reacted
}

export interface ChatMsg {
  id: string
  senderId: string
  senderName: string
  content: string
  timestamp: number
  isMine: boolean
  read: boolean
  replyTo?: {           // which message this is replying to
    id: string
    senderName: string
    content: string
    isMine: boolean
  }
  reactions: MessageReaction[]
}

export interface SponsoredAd {
  id: string
  brandName: string
  brandInitial: string
  verified: boolean
  headline: string
  body: string
  imageUrl: string
  ctaText: string
  ctaColor: string
  reward: string
  impressions: number
  liked: boolean
  saved: boolean
  skipped: boolean
  timestamp: number
}

export interface ChatListItem {
  id: string
  name: string
  initial: string
  color: string
  online: boolean
  lastMessage: string
  lastMessageTime: number
  unreadCount: number
  verified: boolean
}

export type ChatView = 'list' | 'room' | 'settings'

interface DualPaneState {
  /* ── Layout ──────────────────────────────────── */
  activeTab: 'chat' | 'ads'
  chatWidthPercent: number
  adsCollapsed: boolean
  mobileAdsOpen: boolean
  isMobile: boolean

  /* ── Chat Navigation ─────────────────────────── */
  selectedChatId: string | null
  chatView: ChatView
  setChatView: (view: ChatView) => void
  selectChat: (chatId: string | null) => void

  /* ── Chat List ────────────────────────────────── */
  nuclearBlocked: Record<string, boolean>
  toggleNuclearBlock: (chatId: string) => void
  mutedChats: Record<string, boolean>
  toggleMute: (chatId: string) => void

  /* ── Chat Messages ────────────────────────────── */
  messages: ChatMsg[]
  setMessages: (msgs: ChatMsg[]) => void
  addMessage: (msg: ChatMsg) => void
  typing: boolean
  setTyping: (t: boolean) => void

  /* ── Reactions ───────────────────────────────── */
  toggleReaction: (msgId: string, emoji: string) => void

  /* ── Reply ───────────────────────────────────── */
  replyTo: ChatMsg | null
  setReplyTo: (msg: ChatMsg | null) => void

  /* ── Sponsored Ads ───────────────────────────── */
  ads: SponsoredAd[]
  loadMoreAds: () => void
  likedAds: Set<string>
  savedAds: Set<string>
  totalEarned: number

  /* ── Ad interactions ─────────────────────────── */
  likeAd: (id: string) => void
  saveAd: (id: string) => void
  skipAd: (id: string) => void
  clickCta: (id: string) => void

  /* ── Layout actions ──────────────────────────── */
  setActiveTab: (tab: 'chat' | 'ads') => void
  setChatWidth: (pct: number) => void
  toggleAdsCollapse: () => void
  setMobileAdsOpen: (open: boolean) => void
  setIsMobile: (m: boolean) => void
  reset: () => void
}

/* ── Default data (populated from server) ──────────────────────────────────────────── */

const INITIAL_MESSAGES: Record<string, ChatMsg[]> = {}

/* ── Chat list (populated from server) ──────────────────────────────────────────── */

const INITIAL_CHAT_LIST: ChatListItem[] = []

/* ── Sponsored ads (populated from server) ──────────────────────────────────── */

const SPONSORED_ADS: SponsoredAd[] = []

const EXTRA_ADS: SponsoredAd[] = []

/* ════════════════════════════════════════════════════════════════════ */

export const useDualPaneChat = create<DualPaneState>((set, get) => ({
  /* ── Layout ──────────────────────────────────── */
  activeTab: 'chat' as 'chat' | 'ads',
  chatWidthPercent: 65,
  adsCollapsed: false,
  mobileAdsOpen: false,
  isMobile: false,

  /* ── Chat Navigation ─────────────────────────── */
  selectedChatId: null,
  chatView: 'list' as ChatView,
  setChatView: (view) => set({ chatView: view }),
  selectChat: (chatId) => {
    if (chatId) {
      set({ selectedChatId: chatId, chatView: 'room', messages: [] })
    } else {
      set({ selectedChatId: null, chatView: 'list' })
    }
  },

  /* ── Chat List ────────────────────────────────── */
  nuclearBlocked: {},
  toggleNuclearBlock: (chatId) => set((s) => ({
    nuclearBlocked: { ...s.nuclearBlocked, [chatId]: !s.nuclearBlocked[chatId] },
  })),
  mutedChats: {},
  toggleMute: (chatId) => set((s) => ({
    mutedChats: { ...s.mutedChats, [chatId]: !s.mutedChats[chatId] },
  })),

  /* ── Chat Messages ────────────────────────────── */
  messages: [],
  setMessages: (msgs) => set({ messages: msgs }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  typing: false,
  setTyping: (t) => set({ typing: t }),

  /* ── Reactions ───────────────────────────────── */
  toggleReaction: (msgId, emoji) => {
    set((s) => ({
      messages: s.messages.map((msg) => {
        if (msg.id !== msgId) return msg
        const existing = msg.reactions.find((r) => r.emoji === emoji)
        if (existing) {
          if (existing.reacted) {
            const newCount = existing.count - 1
            if (newCount <= 0) {
              return { ...msg, reactions: msg.reactions.filter((r) => r.emoji !== emoji) }
            }
            return {
              ...msg,
              reactions: msg.reactions.map((r) =>
                r.emoji === emoji ? { ...r, count: newCount, reacted: false } : r
              ),
            }
          } else {
            return {
              ...msg,
              reactions: msg.reactions.map((r) =>
                r.emoji === emoji ? { ...r, count: r.count + 1, reacted: true } : r
              ),
            }
          }
        } else {
          return {
            ...msg,
            reactions: [...msg.reactions, { emoji, count: 1, reacted: true }],
          }
        }
      }),
    }))
  },

  /* ── Reply ───────────────────────────────────── */
  replyTo: null,
  setReplyTo: (msg) => set({ replyTo: msg }),

  /* ── Sponsored Ads ───────────────────────────── */
  ads: [],
  loadMoreAds: () => {
    const { ads } = get()
    if (ads.length >= SPONSORED_ADS.length + EXTRA_ADS.length) return
    const nextBatch = EXTRA_ADS.slice(0, 4)
    set((s) => ({
      ads: [...s.ads, ...nextBatch.filter((a) => !s.ads.find((ea) => ea.id === a.id))],
    }))
  },
  likedAds: new Set(),
  savedAds: new Set(),
  totalEarned: 0,

  /* ── Ad interactions ─────────────────────────── */
  likeAd: (id) => {
    const { ads, likedAds, totalEarned } = get()
    const isLiked = likedAds.has(id)
    const newLiked = new Set(likedAds)
    if (isLiked) newLiked.delete(id)
    else newLiked.add(id)
    const earned = isLiked ? -1 : 1
    set({
      likedAds: newLiked,
      totalEarned: totalEarned + earned,
      ads: ads.map((a) => (a.id === id ? { ...a, liked: !isLiked } : a)),
    })
  },

  saveAd: (id) => {
    const { ads, savedAds } = get()
    const isSaved = savedAds.has(id)
    const newSaved = new Set(savedAds)
    if (isSaved) newSaved.delete(id)
    else newSaved.add(id)
    set({
      savedAds: newSaved,
      ads: ads.map((a) => (a.id === id ? { ...a, saved: !isSaved } : a)),
    })
  },

  skipAd: (id) => {
    const { ads } = get()
    set({
      ads: ads.map((a) => (a.id === id ? { ...a, skipped: true } : a)),
    })
    setTimeout(() => {
      set((s) => ({ ads: s.ads.filter((a) => a.id !== id) }))
    }, 400)
  },

  clickCta: (id) => {
    const { ads, totalEarned } = get()
    const reward = parseInt(ads.find((a) => a.id === id)?.reward.replace(/[^\d]/g, '') || '0', 10) || 2
    set({
      totalEarned: totalEarned + reward,
      ads: ads.map((a) =>
        a.id === id ? { ...a, impressions: a.impressions + 1 } : a
      ),
    })
  },

  /* ── Layout actions ──────────────────────────── */
  setActiveTab: (tab) => set({ activeTab: tab }),
  setChatWidth: (pct) => set({ chatWidthPercent: Math.max(55, Math.min(85, pct)) }),
  toggleAdsCollapse: () => set((s) => ({ adsCollapsed: !s.adsCollapsed })),
  setMobileAdsOpen: (open) => set({ mobileAdsOpen: open }),
  setIsMobile: (m) => set({ isMobile: m }),

  reset: () => set({
    activeTab: 'chat' as 'chat' | 'ads',
    chatWidthPercent: 65,
    adsCollapsed: false,
    mobileAdsOpen: false,
    selectedChatId: null,
    chatView: 'list' as ChatView,
    messages: [],
    typing: false,
    replyTo: null,
    ads: [],
    likedAds: new Set(),
    savedAds: new Set(),
    totalEarned: 0,
  }),
}))
