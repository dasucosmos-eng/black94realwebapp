'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app'
import { fetchFeedPosts, docToPost } from '@/lib/db'
import { checkPostInteractions, togglePostLike, togglePostRepost, togglePostBookmark } from '@/lib/social'
import { deletePost } from '@/lib/db'
import { useEngagementEngine, fetchRankedFeedPosts } from '@/lib/useEngagementEngine'
import { getPostScore } from '@/lib/engagement-engine'
import { UserPostCard } from '@/components/UserPostCard'
import { toast } from 'sonner'
import { getDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { DocumentSnapshot, DocumentData } from 'firebase/firestore'
import type { TrendingLabel } from '@/lib/engagement-engine'

/* ── Skeleton loader ─────────────────────────────────────────────────── */

function FeedSkeleton() {
  return (
    <div className="border-b border-white/[0.06] px-5 py-4">
      <div className="flex gap-3">
        <div className="w-11 h-11 rounded-full bg-white/[0.06] shimmer relative overflow-hidden" />
        <div className="flex-1 space-y-2.5">
          <div className="flex gap-2">
            <div className="h-4 w-24 rounded-2xl bg-white/[0.06] shimmer relative overflow-hidden" />
            <div className="h-4 w-16 rounded-2xl bg-white/[0.06] shimmer relative overflow-hidden" />
          </div>
          <div className="h-4 w-full rounded-2xl bg-white/[0.06] shimmer relative overflow-hidden" />
          <div className="h-4 w-3/4 rounded-2xl bg-white/[0.06] shimmer relative overflow-hidden" />
          <div className="flex gap-8 pt-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 w-8 rounded bg-white/[0.06] shimmer relative overflow-hidden" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Feed Tabs ───────────────────────────────────────────────────────── */

const TABS = ['Discover', 'Network'] as const
type Tab = (typeof TABS)[number]

/* ── Feed View ───────────────────────────────────────────────────────── */

export function FeedView() {
  const user = useAppStore((s) => s.user)
  const navigate = useAppStore((s) => s.navigate)
  const setComposeOpen = useAppStore((s) => s.setComposeOpen)

  const [activeTab, setActiveTab] = useState<Tab>('Discover')
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [allLoaded, setAllLoaded] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Filter out empty/invisible posts to prevent stray action bars
  const visiblePosts = useMemo(() =>
    posts.filter((p: any) => {
      const hasCaption = p.caption && p.caption.trim().length > 0
      const mu = p.mediaUrls
      const hasMedia = Array.isArray(mu) ? mu.length > 0 : !!String(mu || '').trim()
      return hasCaption || hasMedia
    }),
  [posts])

  // Engagement engine: trending labels per post
  const [trendingMap, setTrendingMap] = useState<Map<string, TrendingLabel>>(new Map())

  // CRITICAL: Keep a ref to the latest user object so enrichment functions
  // always read the CURRENT user data, not a stale closure value.
  // This fixes the race condition where loadPosts fires before user is available.
  const userRef = useRef(user)
  userRef.current = user

  const lastDocRef = useRef<DocumentSnapshot<DocumentData> | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const postsLoadedRef = useRef(false)
  const rankedPostIdsRef = useRef<string[]>([])
  const userIdRef = useRef(user?.id)
  // Track if the initial load already happened to prevent double-load when user refreshes
  const initialLoadDoneRef = useRef(false)

  // ── Start engagement engine on mount ──
  useEngagementEngine(!!user)

  // Fetch trending labels for posts
  const fetchTrendingLabels = useCallback(async (postsList: any[]) => {
    const realPosts = postsList
    if (realPosts.length === 0) return
    try {
      const results = await Promise.all(
        realPosts.map(async (p: any) => {
          const score = await getPostScore(p.id)
          return { id: p.id, label: score.trendingLabel }
        })
      )
      const map = new Map<string, TrendingLabel>()
      results.forEach(({ id, label }) => { if (label) map.set(id, label) })
      setTrendingMap(map)
    } catch (err) {
      console.error('Failed to fetch trending labels:', err)
    }
  }, [])

  /**
   * Enrich posts that belong to the current user with their live profile data.
   * This ensures posts created BEFORE the user upgraded/trialed still show the
   * correct verified badge.
   */
  const enrichWithLiveProfile = useCallback((postsList: any[]) => {
    // ALWAYS use ref — reads the latest user data at call time, not closure time
    const u = userRef.current
    if (!u) return postsList
    const profileImage = u.profileImage
    const isVerified = u.isVerified
    const badge = u.badge
    // If user has no enrichable data, nothing to do
    if (!profileImage && !isVerified && !badge) return postsList
    return postsList.map((p: any) => {
      if (p.authorId === u.id) {
        return {
          ...p,
          // Always use latest profile image for own posts
          authorProfileImage: profileImage || p.authorProfileImage,
          authorIsVerified: isVerified || p.authorIsVerified,
          authorBadge: badge || p.authorBadge,
        }
      }
      return p
    })
  }, []) // Stable reference — no deps needed, reads from ref

  // Check interactions for a batch of posts and return enriched posts
  const enrichWithInteractions = useCallback(async (postsList: any[]) => {
    const u = userRef.current
    if (!u) return postsList
    const realPosts = postsList
    if (realPosts.length === 0) return postsList
    try {
      const postIds = realPosts.map((p: any) => p.id)
      const statusMap = await checkPostInteractions(postIds, u.id)
      return postsList.map((p: any) => {
        const status = statusMap[p.id]
        if (!status) return p
        return { ...p, isLiked: status.isLiked, isReposted: status.isReposted, isBookmarked: status.isBookmarked }
      })
    } catch (err) {
      console.error('Failed to check interactions:', err)
      return postsList
    }
  }, []) // Stable reference — reads from ref

  // Fetch posts — stable reference, no state dependencies
  const loadPosts = useCallback(async (reset = false) => {
    if (reset) {
      lastDocRef.current = null
      setAllLoaded(false)
      rankedPostIdsRef.current = []
    }

    try {
      if (reset) setLoading(true)
      else setLoadingMore(true)

      // For "Discover" tab: try ranked feed first, fall back to chronological
      let fetchedPosts: any[] = []
      if (reset && activeTab === 'Discover') {
        try {
          const ranked = await fetchRankedFeedPosts(20)
          if (ranked.length > 0) {
            rankedPostIdsRef.current = ranked.map((r) => r.postId)
            // Fetch ONLY the 20 ranked posts by ID — no need to fetch 50 and filter
            const postResults = await Promise.all(
              ranked.map((r) => getDoc(doc(db, 'posts', r.postId)))
            )
            fetchedPosts = postResults
              .filter((snap) => snap.exists())
              .map((snap) => docToPost(snap))
            // Extract trending labels from ranked results (already fetched during scoring)
            const tMap = new Map<string, TrendingLabel>()
            ranked.forEach((r) => { if (r.trendingLabel) tMap.set(r.postId, r.trendingLabel) })
            setTrendingMap(tMap)
          }
        } catch (err) {
          console.error('[Feed] Ranked fetch failed, falling back:', err)
        }
      }

      // Fallback: chronological fetch
      if (fetchedPosts.length === 0) {
        const result = await fetchFeedPosts(10, lastDocRef.current ?? undefined)
        if (result.posts.length === 0) {
          if (reset) setPosts([])
          setAllLoaded(true)
          if (reset) setLoading(false)
          setLoadingMore(false)
          setRefreshing(false)
          return
        }
        lastDocRef.current = result.lastDoc
        fetchedPosts = result.posts
      }

      if (reset) {
        // Enrich with live profile data THEN interaction status BEFORE rendering — no flash
        const profileEnriched = enrichWithLiveProfile(fetchedPosts)
        const enriched = await enrichWithInteractions(profileEnriched)
        setPosts(enriched)
        postsLoadedRef.current = true
      } else {
        // For infinite scroll, also check interactions on new batch
        const profileEnriched = enrichWithLiveProfile(fetchedPosts)
        const enriched = await enrichWithInteractions(profileEnriched)
        setPosts((prev) => [...prev, ...enriched])
      }
    } catch (err) {
      console.error('Failed to fetch posts:', err)
      if (reset) setPosts([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
      setRefreshing(false)
    }
  }, [enrichWithInteractions, enrichWithLiveProfile, activeTab])

  // Initial load — only once, skip if already loaded (prevents double-load on user refresh)
  useEffect(() => {
    if (initialLoadDoneRef.current) return
    initialLoadDoneRef.current = true
    loadPosts(true)
  }, [loadPosts])

  // Re-enrich existing posts when user changes (from cache to Firebase) without re-fetching
  useEffect(() => {
    if (!user || posts.length === 0 || userIdRef.current === user.id) return
    userIdRef.current = user.id
    // Re-check interactions with fresh user ID, don't re-fetch posts
    enrichWithInteractions(posts).then(enriched => setPosts(enriched)).catch(() => {})
  }, [user?.id])

  // CRITICAL: Re-enrich posts when current user's profile data changes DURING this session
  // (e.g., user uploads new avatar, gets verified, changes display name)
  // Uses functional setPosts so it always operates on latest posts state.
  useEffect(() => {
    if (!user) return
    setPosts((prev) => {
      if (prev.length === 0) return prev
      return prev.map((p: any) => {
        if (p.authorId === user.id) {
          return {
            ...p,
            authorProfileImage: user.profileImage || p.authorProfileImage,
            authorIsVerified: user.isVerified || p.authorIsVerified,
            authorBadge: user.badge || p.authorBadge,
            authorDisplayName: user.displayName || p.authorDisplayName,
            authorUsername: user.username || p.authorUsername,
          }
        }
        return p
      })
    })
  }, [user?.id, user?.isVerified, user?.badge, user?.profileImage, user?.displayName, user?.username])

  // NOTE: Trending labels are already fetched during the ranked feed load.
  // No need for a periodic refetch — they stay fresh from the scoring cycle.

  // Pull-to-refresh
  const handleRefresh = useCallback(() => {
    if (refreshing) return
    setRefreshing(true)
    loadPosts(true)
  }, [refreshing, loadPosts])

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()
    if (allLoaded) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && !loading) {
          loadPosts(false)
        }
      },
      { rootMargin: '400px' }
    )

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current)
    }

    return () => observerRef.current?.disconnect()
  }, [allLoaded, loadingMore, loading, loadPosts])

  const handleLike = useCallback(async (postId: string) => {
    if (!user) return
    try {
      const nowLiked = await togglePostLike(postId, user.id)
      setPosts((prev) =>
        prev.map((p: any) =>
          p.id === postId
            ? { ...p, isLiked: nowLiked, likeCount: (p.likeCount ?? 0) + (nowLiked ? 1 : -1) }
            : p
        )
      )
    } catch (err) {
      console.error('Like failed:', err)
      toast.error(err instanceof Error ? err.message : 'Like failed')
    }
  }, [user])

  const handleRepost = useCallback(async (postId: string) => {
    if (!user) return
    try {
      const isReposted = await togglePostRepost(postId, user.id)
      setPosts((prev) =>
        prev.map((p: any) =>
          p.id === postId
            ? { ...p, isReposted, repostCount: (p.repostCount ?? 0) + (isReposted ? 1 : -1) }
            : p
        )
      )
    } catch (err) {
      console.error('Repost failed:', err)
      toast.error(err instanceof Error ? err.message : 'Repost failed')
    }
  }, [user])

  const handleBookmark = useCallback(async (postId: string) => {
    if (!user) return
    try {
      const isBookmarked = await togglePostBookmark(postId, user.id)
      setPosts((prev) =>
        prev.map((p: any) =>
          p.id === postId ? { ...p, isBookmarked } : p
        )
      )
    } catch (err) {
      console.error('Bookmark failed:', err)
      toast.error(err instanceof Error ? err.message : 'Bookmark failed')
    }
  }, [user])

  const handleDelete = useCallback(async (postId: string) => {
    if (!user) return
    try {
      await deletePost(postId)
      setPosts((prev) => prev.filter((p: any) => p.id !== postId))
      toast.success('Post deleted')
    } catch (err) {
      console.error('Delete failed:', err)
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }, [user])

  return (
    <div className="mx-auto max-w-[600px]">
      {/* Tabs */}
      <div className="sticky top-[56px] z-20 bg-[#000000] border-b border-white/[0.06]">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 py-4 text-[15px] font-medium relative transition-colors',
                activeTab === tab ? 'text-[#e7e9ea] font-bold' : 'text-[#94a3b8]'
              )}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 inset-x-6 h-1 bg-[#FFFFFF] rounded-full animate-tab-indicator" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Refreshing indicator */}
      {refreshing && (
        <div className="flex items-center justify-center py-2">
          <div className="w-5 h-5 border-2 border-[#FFFFFF]/30 border-t-[#FFFFFF] rounded-full animate-spin" />
        </div>
      )}

      {/* Posts */}
      {loading ? (
        <div>
          {Array.from({ length: 5 }).map((_, i) => (
            <FeedSkeleton key={i} />
          ))}
        </div>
      ) : visiblePosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
          <div className="w-20 h-20 rounded-full bg-white/[0.04] flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-[#94a3b8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 className="text-lg font-bold text-[#e7e9ea] mb-1">No posts yet</h3>
          <p className="text-[15px] text-[#94a3b8]">When people post, their posts will show up here.</p>
        </div>
      ) : (
        <div>
          {visiblePosts.map((post: any) => (
            <UserPostCard
              key={post.id}
              post={post}
              onLike={handleLike}
              onRepost={handleRepost}
              onBookmark={handleBookmark}
              onDelete={handleDelete}
              onProfileTap={(uid: string) => {
                navigate('user-profile', { userId: uid })
              }}
              userId={user?.id}
              userDisplayName={user?.displayName || undefined}
              userUsername={user?.username || undefined}
              userProfileImage={user?.profileImage || undefined}
              trendingLabel={trendingMap.get(post.id)}
            />
          ))}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-1" />

          {/* Loading more */}
          {loadingMore && (
            <div className="py-4 space-y-0">
              <FeedSkeleton />
              <FeedSkeleton />
            </div>
          )}

          {/* End of feed */}
          {allLoaded && visiblePosts.length > 0 && (
            <div className="border-t border-white/[0.06] py-12 text-center">
              <p className="text-[15px] text-[#94a3b8]">You&apos;re all caught up</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
