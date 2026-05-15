import { create } from 'zustand'

export type AppView = 
  | 'landing' | 'login' | 'signup' | 'feed' | 'explore' | 'chat' 
  | 'chat-room' | 'profile' | 'edit-profile' | 'article' | 'write-article'
  | 'notifications' | 'search' | 'settings' | 'business-dashboard' | 'premium-dashboard'
  | 'ads-manager' | 'create-ad' | 'crm-leads' | 'crm-deals' | 'crm-orders'
  | 'crm-analytics' | 'affiliates' | 'share-profile'
  | 'user-profile' | 'stories' | 'dual-pane-chat'
  | 'storefront' | 'product-detail' | 'cart' | 'checkout'
  | 'my-store' | 'add-product' | 'order-tracking' | 'business-orders'
  | 'store-dashboard' | 'audio-call'

export type AccountType = 'personal' | 'creator' | 'professional' | 'business'

export interface User {
  id: string
  email: string
  username: string
  displayName: string | null
  bio: string
  profileImage: string
  coverImage: string
  role: string
  badge: string
  subscription: string
  isVerified: boolean
  accountType: AccountType
  accountLocked: boolean // true once switched to business — cannot go back
  nameVisibility: string
  dmPermission: string
  searchVisibility: string
  paidChatEnabled: boolean
  paidChatPrice: number
  createdAt: string
  followerCount?: number
  followingCount?: number
}

export interface Message {
  id: string
  chatId: string
  senderId: string
  receiverId: string
  content: string
  messageType: string
  mediaUrl: string | null
  status: string
  createdAt: string
  sender?: { username: string; profileImage: string }
}

export interface Chat {
  id: string
  user1Id: string
  user2Id: string
  isPaidChat: boolean
  chatPrice: number
  isPaidBy: string | null
  isDeleted: boolean
  createdAt: string
  updatedAt: string
  otherUser?: User
  lastMessage?: Message
  unreadCount?: number
}

export interface Post {
  id: string
  authorId: string
  caption: string
  mediaUrls: string
  factCheck: string
  createdAt: string
  updatedAt: string
  author?: User
  likeCount?: number
  commentCount?: number
  isLiked?: boolean
  comments?: Comment[]
}

export interface Comment {
  id: string
  postId: string
  authorId: string
  content: string
  createdAt: string
  author?: User
}

export interface Article {
  id: string
  authorId: string
  title: string
  content: string
  coverImage: string
  factCheck: string
  isPublished: boolean
  views: number
  createdAt: string
  updatedAt: string
  author?: User
}

export interface Lead {
  id: string
  businessId: string
  name: string
  email: string
  phone: string
  source: 'Ad' | 'Organic' | 'Referral' | 'Chat'
  status: 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Lost'
  value: number
  notes: string
  aiScore: number
  createdAt: string
  updatedAt: string
}

export interface Notification {
  id: string
  userId: string
  type: string
  title: string
  content: string
  isRead: boolean
  createdAt: string
}

export interface ThreadReply {
  id: string
  content: string
  authorId: string
  author?: User
  createdAt: string
}

export interface Thread {
  id: string
  chatId: string
  originalMessageId: string
  originalMessage: Message
  replies: ThreadReply[]
  createdAt: string
  updatedAt: string
}

export interface ChatAd {
  id: string
  advertiserName: string
  headline: string
  body: string
  ctaText: string
  ctaUrl: string
  imageUrl: string
  revenue: number
  impressions: number
  clicks: number
  createdAt: string
}

interface AppState {
  // Auth
  token: string | null
  user: User | null
  setToken: (token: string | null) => void
  setUser: (user: User | null) => void
  logout: () => void

  // Navigation
  currentView: AppView
  viewParams: Record<string, string>
  navigate: (view: AppView, params?: Record<string, string>) => void
  previousView: AppView
  restoreViewFromHash: () => void

  // Chat
  selectedChat: Chat | null
  setSelectedChat: (chat: Chat | null) => void
  messages: Message[]
  setMessages: (messages: Message[]) => void
  addMessage: (message: Message) => void

  // Notifications
  unreadNotificationCount: number
  setUnreadNotificationCount: (count: number) => void

  // UI
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  isDarkMode: boolean
  toggleDarkMode: () => void
  isLoading: boolean
  setLoading: (loading: boolean) => void
  fabVisible: boolean
  setFabVisible: (visible: boolean) => void
  composeOpen: boolean
  setComposeOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // Auth
  token: typeof window !== 'undefined' ? localStorage.getItem('black94_token') : null,
  user: null,
  setToken: (token) => {
    if (typeof window !== 'undefined') {
      if (token) localStorage.setItem('black94_token', token)
      else localStorage.removeItem('black94_token')
    }
    set({ token })
  },
  setUser: (user) => set({ user }),
  logout: () => {
    if (typeof window !== 'undefined') localStorage.removeItem('black94_token')
    set({ token: null, user: null, currentView: 'landing' })
  },

  // Navigation
  currentView: 'landing',
  viewParams: {},
  previousView: 'landing',
  navigate: (view, params = {}) => {
    const prev = get().currentView
    set({ currentView: view, viewParams: params, previousView: prev })
    // Persist to URL hash for refresh persistence
    if (typeof window !== 'undefined') {
      const hash = params ? `${view}?${new URLSearchParams(params).toString()}` : view
      window.history.replaceState(null, '', '#' + hash)
    }
  },
  // Restore view from URL (hash or pathname) on init — supports ALL navigable views
  restoreViewFromHash: () => {
    if (typeof window === 'undefined') return
    // Check hash first, then pathname (for direct URL access like /chat)
    const hash = window.location.hash.replace('#', '')
    const pathname = window.location.pathname.replace(/^\/index\.html$/, '').replace(/^\//, '')
    const route = hash || (pathname && pathname !== '' ? pathname : '')
    if (!route) {
      // No route in URL — default to feed if still on landing
      if (get().currentView === 'landing') set({ currentView: 'feed' })
      return
    }
    const [view, query] = route.split('?')
    const allViews: string[] = ['feed','explore','chat','chat-room','profile','edit-profile','user-profile','notifications','search','settings','stories','dual-pane-chat','business-dashboard','premium-dashboard','ads-manager','create-ad','crm-leads','crm-deals','crm-orders','crm-analytics','privacy-settings','share-profile','write-article','article','affiliates','salary','performance','storefront','product-detail','cart','checkout','my-store','add-product','order-tracking','business-orders','store-dashboard','audio-call']
    if (allViews.includes(view)) {
      const params: Record<string, string> = {}
      if (query) new URLSearchParams(query).forEach((v, k) => { params[k] = v })
      // Only update if view actually changed (avoid unnecessary re-renders)
      if (get().currentView !== view) {
        set({ currentView: view as AppView, viewParams: params })
      }
    }
  },

  // Chat
  selectedChat: null,
  setSelectedChat: (chat) => set({ selectedChat: chat }),
  messages: [],
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),

  // Notifications
  unreadNotificationCount: 0,
  setUnreadNotificationCount: (count) => set({ unreadNotificationCount: count }),

  // UI
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  isDarkMode: typeof window !== 'undefined' 
    ? document.documentElement.classList.contains('dark') 
    : false,
  toggleDarkMode: () => set((state) => {
    const newMode = !state.isDarkMode
    if (typeof window !== 'undefined') {
      document.documentElement.classList.toggle('dark', newMode)
    }
    return { isDarkMode: newMode }
  }),
  isLoading: false,
  setLoading: (loading) => set({ isLoading: loading }),
  fabVisible: true,
  setFabVisible: (visible) => set({ fabVisible: visible }),
  composeOpen: false,
  setComposeOpen: (open) => set({ composeOpen: open }),
}))
