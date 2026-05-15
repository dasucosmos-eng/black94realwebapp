'use client'

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { useAppStore, type AppView, type User as StoreUser } from '@/stores/app'
import { auth, authReady, signIn, signOutUser, onAuthStateChanged, requestNotificationPermission, saveFCMToken, setupFCMListener } from '@/lib/firebase'
import { createUserFromGoogle, fetchNotifications, markNotificationRead, ensureE2EKeyPair } from '@/lib/db'
import { onSnapshot, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { type User as FirebaseUser } from 'firebase/auth'
import { MobileNav } from '@/components/MobileNav'
import { Sidebar } from '@/components/Sidebar'
import { MobileHeader } from '@/components/MobileHeader'
import { ComposeDialog } from '@/components/ComposeDialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

/* ─── Lazy-loaded views for performance (code splitting) ──────────────────── */
const FeedView = lazy(() => import('@/views/FeedView').then(m => ({ default: m.FeedView })))
const ChatListView = lazy(() => import('@/views/ChatListView').then(m => ({ default: m.ChatListView })))
const ChatRoomView = lazy(() => import('@/views/ChatListView').then(m => ({ default: m.ChatRoomView })))
const NotificationsView = lazy(() => import('@/views/NotificationsView').then(m => ({ default: m.NotificationsView })))
const SearchView = lazy(() => import('@/views/SearchView').then(m => ({ default: m.SearchView })))
const ExploreView = lazy(() => import('@/views/ExploreView').then(m => ({ default: m.ExploreView })))
const ProfileView = lazy(() => import('@/views/ProfileView').then(m => ({ default: m.ProfileView })))
const SettingsView = lazy(() => import('@/views/SettingsView').then(m => ({ default: m.SettingsView })))
const StoriesView = lazy(() => import('@/views/StoriesView').then(m => ({ default: m.StoriesView })))
const MessagesView = lazy(() => import('@/views/MessagesView').then(m => ({ default: m.MessagesView })))
const AudioCallView = lazy(() => import('@/views/AudioCallView').then(m => ({ default: m.AudioCallView })))
const BusinessDashboardView = lazy(() => import('@/views/BusinessDashboardView').then(m => ({ default: m.BusinessDashboardView })))
const PremiumDashboardView = lazy(() => import('@/views/PremiumDashboardView').then(m => ({ default: m.PremiumDashboardView })))
const AdsManagerView = lazy(() => import('@/views/AdsManagerView').then(m => ({ default: m.AdsManagerView })))
const CreateAdView = lazy(() => import('@/views/CreateAdView').then(m => ({ default: m.CreateAdView })))
const CrmLeadsView = lazy(() => import('@/views/CrmLeadsView').then(m => ({ default: m.CrmLeadsView })))
const CrmDealsView = lazy(() => import('@/views/CrmDealsView').then(m => ({ default: m.CrmDealsView })))
const CrmOrdersView = lazy(() => import('@/views/CrmOrdersView').then(m => ({ default: m.CrmOrdersView })))
const CrmAnalyticsView = lazy(() => import('@/views/CrmAnalyticsView').then(m => ({ default: m.CrmAnalyticsView })))
const PrivacySettingsView = lazy(() => import('@/views/PrivacySettingsView').then(m => ({ default: m.PrivacySettingsView })))
const ShareProfileView = lazy(() => import('@/views/ShareProfileView').then(m => ({ default: m.ShareProfileView })))
const WriteArticleView = lazy(() => import('@/views/WriteArticleView').then(m => ({ default: m.WriteArticleView })))
const ArticleView = lazy(() => import('@/views/ArticleView').then(m => ({ default: m.ArticleView })))
const AffiliatesView = lazy(() => import('@/views/AffiliatesView').then(m => ({ default: m.AffiliatesView })))
const SalaryView = lazy(() => import('@/views/SalaryView').then(m => ({ default: m.SalaryView })))
const PerformanceView = lazy(() => import('@/views/PerformanceView').then(m => ({ default: m.PerformanceView })))
const StorefrontView = lazy(() => import('@/views/StorefrontView').then(m => ({ default: m.StorefrontView })))
const ProductDetailView = lazy(() => import('@/views/ProductDetailView').then(m => ({ default: m.ProductDetailView })))
const CartView = lazy(() => import('@/views/CartView').then(m => ({ default: m.CartView })))
const CheckoutView = lazy(() => import('@/views/CheckoutView').then(m => ({ default: m.CheckoutView })))
const MyStoreView = lazy(() => import('@/views/MyStoreView').then(m => ({ default: m.MyStoreView })))
const AddProductView = lazy(() => import('@/views/AddProductView').then(m => ({ default: m.AddProductView })))
const OrderTrackingView = lazy(() => import('@/views/OrderTrackingView').then(m => ({ default: m.OrderTrackingView })))
const BusinessOrdersView = lazy(() => import('@/views/BusinessOrdersView').then(m => ({ default: m.BusinessOrdersView })))
const StoreDashboardView = lazy(() => import('@/views/StoreDashboardView').then(m => ({ default: m.StoreDashboardView })))

/* ─── User data cache key ───────────────────────────────────────────────── */
const USER_CACHE_KEY = 'black94_user_cache'

/* ─── View loading fallback ───────────────────────────────────────────────────── */
function ViewLoader() {
  return (
    <div className="flex items-center justify-center h-[40vh]">
      <div className="w-6 h-6 border-2 border-[#FFFFFF]/30 border-t-[#FFFFFF] rounded-full animate-spin" />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   AUTH LOGIC — DO NOT TOUCH (LOCKED)
   ═══════════════════════════════════════════════════════════════════════════ */

type Screen = 'loading' | 'login' | 'app'

function toStoreUser(fb: FirebaseUser, db: Awaited<ReturnType<typeof createUserFromGoogle>>): StoreUser {
  return {
    id: fb.uid, email: fb.email ?? '', username: db.username,
    displayName: db.displayName || fb.displayName || '', bio: db.bio,
    profileImage: db.profileImage || fb.photoURL || '', coverImage: db.coverImage,
    role: db.role, badge: db.badge, subscription: db.subscription, isVerified: db.isVerified,
    accountType: db.role === 'business' ? 'business' : db.role === 'creator' ? 'creator' : 'personal',
    accountLocked: false, nameVisibility: db.nameVisibility, dmPermission: db.dmPermission,
    searchVisibility: db.searchVisibility, paidChatEnabled: db.paidChatEnabled,
    paidChatPrice: db.paidChatPrice, createdAt: db.createdAt,
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

function LoginScreen({ onSignIn, busy }: { onSignIn: () => void; busy: boolean }) {
  return (
    <div className="min-h-screen bg-[#000000] flex flex-col items-center justify-center relative overflow-hidden">
      <div className="relative z-10 flex flex-col items-center px-6 max-w-[420px] w-full animate-fade-in">
        <div className="mb-8 flex flex-col items-center">
          <img src="/logo.png" alt="Black94" className="w-20 h-20 object-contain mb-5" />
          <h1 className="text-3xl font-bold text-white tracking-tight">Black94</h1>
          <p className="text-sm text-[#94a3b8] mt-2 text-center">
            Connect, share, and grow with your community.
          </p>
        </div>

        <button
          onClick={onSignIn}
          disabled={busy}
          className="w-full max-w-[320px] h-[52px] rounded-full bg-white hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 flex items-center justify-center gap-3 shadow-lg hover:scale-[1.02] active:scale-[0.98] group disabled:opacity-60 disabled:pointer-events-none"
        >
          {busy ? (
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
          )}
          <span className="text-[15px] font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">
            {busy ? 'Signing in...' : 'Sign in with Google'}
          </span>
        </button>
        <p className="mt-6 text-[11px] text-[#64748b] text-center leading-relaxed">
          By signing in, you agree to our{' '}
          <a href="/terms-of-service.html" className="text-[#FFFFFF] hover:text-[#a78bfa] underline underline-offset-2">Terms of Service</a>
          {' '}and{' '}
          <a href="/privacy-policy.html" className="text-[#FFFFFF] hover:text-[#a78bfa] underline underline-offset-2">Privacy Policy</a>.
        </p>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOADING SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#000000] flex flex-col items-center justify-center">
      <img src="/logo.png" alt="Black94" className="w-14 h-14 object-contain animate-pulse" />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   VIEW ROUTER — with persistent view caching for instant tab switching
   ═══════════════════════════════════════════════════════════════════════════
   Main tab views (Home, Search, Chat, Alerts, Stories) stay MOUNTED
   in the DOM but hidden with CSS display:none. This means:
   - Zero re-fetching when switching between tabs
   - Firestore real-time listeners persist
   - Scroll position is preserved
   - No engagement engine restart on Feed tab switch
   - Chat list stays in sync in the background
   Secondary views (chat-room, profile, settings, etc.) still mount/unmount
   normally to avoid wasting memory on rarely-visited pages.
   ═══════════════════════════════════════════════════════════════════════════ */

// The 6 main bottom-nav tabs that should stay mounted for instant switching
const PERSISTENT_VIEWS = ['feed', 'search', 'chat', 'notifications', 'stories'] as const

function ViewRouter() {
  const currentView = useAppStore((s) => s.currentView)
  const isPersistent = PERSISTENT_VIEWS.includes(currentView as any)

  // All view components mapped by view name
  const views: Record<string, React.ReactNode> = {
    feed: <FeedView />,
    explore: <ExploreView />,
    chat: <ChatListView />,
    'chat-room': <ChatRoomView />,
    profile: <ProfileView />,
    'user-profile': <ProfileView />,
    'edit-profile': <SettingsView />,
    notifications: <NotificationsView />,
    search: <SearchView />,
    settings: <SettingsView />,
    stories: <StoriesView />,
    'dual-pane-chat': <MessagesView />,
    'audio-call': <AudioCallView />,
    'business-dashboard': <BusinessDashboardView />,
    'premium-dashboard': <PremiumDashboardView />,
    'ads-manager': <AdsManagerView />,
    'create-ad': <CreateAdView />,
    'crm-leads': <CrmLeadsView />,
    'crm-deals': <CrmDealsView />,
    'crm-orders': <CrmOrdersView />,
    'crm-analytics': <CrmAnalyticsView />,
    'privacy-settings': <PrivacySettingsView />,
    'share-profile': <ShareProfileView />,
    'write-article': <WriteArticleView />,
    'article': <ArticleView />,
    'affiliates': <AffiliatesView />,
    'salary': <SalaryView />,
    'performance': <PerformanceView />,
    'storefront': <StorefrontView />,
    'product-detail': <ProductDetailView />,
    'cart': <CartView />,
    'checkout': <CheckoutView />,
    'my-store': <MyStoreView />,
    'add-product': <AddProductView />,
    'order-tracking': <OrderTrackingView />,
    'business-orders': <BusinessOrdersView />,
    'store-dashboard': <StoreDashboardView />,
  }

  return (
    <>
      {/* Persistent views: always mounted, CSS toggles visibility */}
      {PERSISTENT_VIEWS.map((view) => (
        <div
          key={view}
          style={{ display: currentView === view ? 'block' : 'none' }}
        >
          <Suspense fallback={<ViewLoader />}>{views[view]}</Suspense>
        </div>
      ))}
      {/* Non-persistent views: mount only when active (saves memory) */}
      {!isPersistent && (
        <Suspense fallback={<ViewLoader />}>{views[currentView] || views['feed']}</Suspense>
      )}
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════════════════ */

export default function Black94App() {
  const [screen, setScreen] = useState<Screen>('loading')
  const [busy, setBusy] = useState(false)
  const { user, setUser, setToken, navigate, currentView, composeOpen, setComposeOpen, logout, restoreViewFromHash } = useAppStore()

  /* ── Scroll-based header hide/show + FAB ──────────────────────────────── */
  const [headerState, setHeaderState] = useState<'visible' | 'hiding' | 'hidden'>('visible')
  const [fabVisible, setFabVisible] = useState(true)
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const lastY = useRef(0)

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      const d = y - lastY.current

      if (y <= 0) {
        setHeaderState('visible')
        setFabVisible(true)
      } else if (d > 6) {
        setHeaderState('hiding')
        setFabVisible(false)
        clearTimeout(scrollTimerRef.current)
        scrollTimerRef.current = setTimeout(() => setHeaderState('hidden'), 180)
      } else if (d < -3) {
        setHeaderState('visible')
        setFabVisible(true)
        clearTimeout(scrollTimerRef.current)
      }

      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(scrollTimerRef.current) }
  }, [])

  /* ── Auth refs ────────────────────────────────────────────────────────── */
  const setUserRef = useRef(setUser)
  setUserRef.current = setUser
  const setTokenRef = useRef(setToken)
  setTokenRef.current = setToken
  const setScreenRef = useRef(setScreen)
  setScreenRef.current = setScreen
  const setBusyRef = useRef(setBusy)
  setBusyRef.current = setBusy

  /* ── Restore view + cached user instantly on mount ───────────────────── */
  useEffect(() => {
    if (typeof window === 'undefined') return
    // Restore view from URL hash/pathname FIRST (before any render)
    useAppStore.getState().restoreViewFromHash()
    // Then restore cached user for instant app display
    try {
      const cached = localStorage.getItem(USER_CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed?.id) {
          console.log('[Auth] Restoring from cache:', parsed.username)
          useAppStore.getState().setUser(parsed)
          useAppStore.getState().setToken(parsed.id)
          setScreenRef.current('app')
        }
      }
    } catch {}
  }, [])

  /* ── Service Worker Registration ─────────────────────────────────────── */
  useEffect(() => {
    if (typeof window === 'undefined') return
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  /* ── Disable pull-to-refresh and overscroll in standalone mode ────── */
  useEffect(() => {
    if (typeof window === 'undefined') return
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone
    if (!isStandalone) return
    const preventPullRefresh = (e: TouchEvent) => {
      if (document.scrollingElement && document.scrollingElement.scrollTop <= 0) {
        e.preventDefault()
      }
    }
    document.body.addEventListener('touchmove', preventPullRefresh, { passive: false })
    return () => { document.body.removeEventListener('touchmove', preventPullRefresh) }
  }, [])

  /* ── Prefetch common views shortly after mount ──────────────────────── */
  useEffect(() => {
    if (typeof window === 'undefined') return
    const timer = setTimeout(() => {
      import('@/views/FeedView').catch(() => {})
      import('@/views/ChatListView').catch(() => {})
      import('@/views/NotificationsView').catch(() => {})
      import('@/views/SearchView').catch(() => {})
      import('@/views/ExploreView').catch(() => {})
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  /* ── Hashchange + popstate listener for browser back/forward ────────── */
  useEffect(() => {
    const onUrlChange = () => useAppStore.getState().restoreViewFromHash()
    window.addEventListener('hashchange', onUrlChange)
    window.addEventListener('popstate', onUrlChange)
    return () => {
      window.removeEventListener('hashchange', onUrlChange)
      window.removeEventListener('popstate', onUrlChange)
    }
  }, [])

  /* ── Auth listener — DO NOT MODIFY core logic ─────────────────────────── */
  useEffect(() => {
    let dead = false
    let unsub: (() => void) | null = null

    const handleUser = async (fbUser: FirebaseUser) => {
      if (dead) return
      try {
        console.log('[Auth] Processing:', fbUser.uid, fbUser.email)
        const dbUser = await createUserFromGoogle(fbUser)
        if (dead) return
        const storeUser = toStoreUser(fbUser, dbUser)
        setUserRef.current(storeUser)
        setTokenRef.current(fbUser.uid)
        setScreenRef.current('app')
        setBusyRef.current(false)
        // Cache user for instant restore on next refresh
        if (typeof window !== 'undefined') {
          try { localStorage.setItem(USER_CACHE_KEY, JSON.stringify(storeUser)) } catch {}
        }
        console.log('[Auth] Logged in:', storeUser.username)
        // Ensure E2E encryption keypair exists (fire-and-forget, non-blocking)
        ensureE2EKeyPair(fbUser.uid).catch((err) => {
          console.warn('[Auth] E2E key setup failed (non-critical):', err)
        })
      } catch (err) {
        console.error('[Auth] createUserFromGoogle failed:', err)
        setBusyRef.current(false)
        setScreenRef.current('login')
      }
    }

    authReady.then(() => {
      if (dead) return
      unsub = onAuthStateChanged(auth, (fbUser) => {
        if (dead) return
        if (fbUser) handleUser(fbUser)
        else {
          console.log('[Auth] No user — showing login')
          try { localStorage.removeItem(USER_CACHE_KEY) } catch {}
          setScreenRef.current('login')
        }
      })
    })

    return () => { dead = true; if (unsub) unsub() }
  }, [])

  /* ── Sign In ──────────────────────────────────────────────────────────── */
  const handleSignIn = useCallback(async () => {
    setBusy(true)
    try {
      console.log('[Auth] Opening popup...')
      const result = await signIn()
      if (result.user) {
        console.log('[Auth] Popup succeeded:', result.user.uid)
        setScreen('loading')
        const dbUser = await createUserFromGoogle(result.user)
        const storeUser = toStoreUser(result.user, dbUser)
        setUser(storeUser)
        setToken(result.user.uid)
        setScreen('app')
        setBusy(false)
        // Restore previous view from URL hash
        restoreViewFromHash()
      }
    } catch (err: unknown) {
      setBusy(false)
      const code = (err as { code?: string })?.code
      if (code === 'auth/popup-closed-by-user') return
      console.error('[Auth] signIn error:', err)
      toast.error('Sign in failed. Try again.')
    }
  }, [setUser, setToken, restoreViewFromHash])

  /* ── Sign Out ─────────────────────────────────────────────────────────── */
  const handleSignOut = useCallback(async () => {
    try {
      await signOutUser()
      logout()
      try { localStorage.removeItem(USER_CACHE_KEY) } catch {}
      setScreen('login')
      toast.success('Signed out')
    } catch {
      toast.error('Sign out failed')
    }
  }, [logout])

  /* ── Real-time unread notification count ─────────────────────────── */
  const setUnreadNotificationCount = useAppStore((s) => s.setUnreadNotificationCount)
  useEffect(() => {
    if (screen !== 'app' || !user?.id) return
    try {
      const notifsRef = collection(db, 'notifications')
      const q = query(notifsRef, where('userId', '==', user.id), where('read', '==', false))
      const unsubscribe = onSnapshot(q, (snap) => {
        setUnreadNotificationCount(snap.size)
      }, (err) => {
        console.warn('[Notifications] Listener error:', err)
      })
      return () => unsubscribe()
    } catch (err) {
      console.warn('[Notifications] Failed to set up listener:', err)
    }
  }, [screen, user?.id, setUnreadNotificationCount])

  /* ── FCM Push Notification Setup ───────────────────────────────── */
  useEffect(() => {
    if (screen !== 'app' || !user?.id) return
    const setupFCM = async () => {
      try {
        // Setup foreground message listener
        await setupFCMListener()
        // Request permission and get token (only if not already granted)
        const token = await requestNotificationPermission()
        if (token && user?.id) {
          await saveFCMToken(user.id, token)
        }
      } catch (err) {
        console.warn('[FCM] Setup failed:', err)
      }
    }
    setupFCM()
  }, [screen, user?.id])

  /* ── Mark notifications read when viewing notifications ──────────── */
  useEffect(() => {
    if (screen !== 'app' || !user?.id || currentView !== 'notifications') return
    // Mark all unread as read
    const markAllRead = async () => {
      try {
        const notifsRef = collection(db, 'notifications')
        const q = query(notifsRef, where('userId', '==', user.id), where('read', '==', false))
        const snap = await getDocs(q)
        for (const docSnap of snap.docs) {
          await markNotificationRead(docSnap.id)
        }
      } catch (err) {
        console.warn('[Notifications] markAllRead error:', err)
      }
    }
    markAllRead()
  }, [screen, user?.id, currentView])

  /* ── Render ───────────────────────────────────────────────────────────── */

  if (screen === 'loading') return <LoadingScreen />
  if (screen === 'login') return <LoginScreen onSignIn={handleSignIn} busy={busy} />

  // Hide chrome for full-screen views
  const showChrome = !['chat-room', 'edit-profile', 'write-article', 'checkout', 'store-dashboard', 'audio-call'].includes(currentView)
  const isHomeFeed = currentView === 'feed'

  // Title for header
  const viewTitles: Record<string, string> = {
    chat: 'Messages',
    search: 'Search',
    notifications: 'Notifications',
    settings: 'Edit Profile',
    explore: 'Explore',
    stories: 'Stories',
    'business-dashboard': 'Business',
    'premium-dashboard': 'Dashboard',
    'ads-manager': 'Ad Manager',
    'create-ad': 'Create Ad',
    'crm-leads': 'Leads',
    'crm-deals': 'Deals',
    'crm-orders': 'Orders',
    'crm-analytics': 'Analytics',
    'privacy-settings': 'Privacy',
    'share-profile': 'Share Profile',
    'write-article': 'Write Article',
    'article': 'Article',
    'affiliates': 'Affiliates',
    'salary': 'Salary',
    'performance': 'Performance',
    'storefront': 'Store',
    'product-detail': 'Product',
    'cart': 'Cart',
    'my-store': 'My Store',
    'add-product': 'Add Product',
    'order-tracking': 'My Orders',
    'business-orders': 'Orders',
    'store-dashboard': 'Store Dashboard',
    'dual-pane-chat': 'Messages',
  }

  const headerTitle = viewTitles[currentView]

  return (
    <div className="min-h-screen bg-[#000000]">
      {/* ─── Sidebar ─── */}
      <Sidebar />
      {/* ─── Header (mobile only — desktop uses sidebar) ─── */}
      {showChrome && (
        <div className="md:hidden">
          <MobileHeader
            user={user ? { displayName: user.displayName || 'User', username: user.username, profileImage: user.profileImage } : null}
            showBack={!!headerTitle}
            onBack={() => navigate('feed')}
            onProfileClick={() => navigate('profile')}
            onSettingsClick={() => useAppStore.getState().setSidebarOpen(true)}
            onSignOut={handleSignOut}
            onLogoClick={() => navigate('feed')}
            headerState={isHomeFeed ? headerState : 'visible'}
            title={headerTitle}
          />
        </div>
      )}

      {/* ─── Views ─── */}
      <main className="md:ml-[260px] lg:ml-[260px]"><ViewRouter /></main>

      {/* ─── FAB — compose button (mobile only) ─── */}
      {isHomeFeed && (
        <button
          onClick={() => setComposeOpen(true)}
          className={cn(
            'fixed bottom-[62px] right-4 z-30 w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-lg transition-all duration-300',
            'hover:bg-white/90 active:scale-90',
            'md:hidden',
            fabVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-75 pointer-events-none'
          )}
          aria-label="Create new post"
        >
          <svg className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}

      {/* ─── Compose Dialog ─── */}
      <ComposeDialog open={composeOpen} onClose={() => setComposeOpen(false)} />

      {/* ─── Bottom Nav (mobile only — desktop uses sidebar) ─── */}
      {showChrome && (
        <div className="md:hidden">
          <MobileNav
            currentView={currentView}
            onNavigate={(view) => navigate(view as AppView)}
          />
        </div>
      )}
    </div>
  )
}
