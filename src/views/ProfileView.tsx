'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app'
import { getUser, toggleFollow, getFollowerCount, getFollowingCount, checkIsFollowing } from '@/lib/db'
import { fetchUserPostsNoIndex, checkPostInteractions, togglePostLike, togglePostRepost, togglePostBookmark } from '@/lib/social'
import { deletePost } from '@/lib/db'
import { fetchBusinessProducts } from '@/lib/shop'
import { PAvatar, VerifiedBadge } from '@/components/PAvatar'
import { UserPostCard } from '@/components/UserPostCard'
import { ProductCard } from '@/components/ProductCard'
import type { Black94User } from '@/lib/db'
import { createOrGetChat } from '@/lib/chat'
import { toast } from 'sonner'

export function ProfileView() {
  const user = useAppStore((s) => s.user)
  const navigate = useAppStore((s) => s.navigate)
  const viewParams = useAppStore((s) => s.viewParams)

  const [profile, setProfile] = useState<Black94User | null>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'posts' | 'replies' | 'likes' | 'store'>('posts')
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [products, setProducts] = useState<any[]>([])
  const [messaging, setMessaging] = useState(false)
  const [productsLoading, setProductsLoading] = useState(false)
  const targetUserId = viewParams?.userId || user?.id
  const isOwnProfile = !viewParams?.userId || viewParams.userId === user?.id
  const isBusinessAccount = profile?.role === 'business'
  const showStoreTab = isBusinessAccount

  // Fetch profile + posts
  useEffect(() => {
    if (!targetUserId) return
    setLoading(true)
    Promise.all([
      getUser(targetUserId),
      fetchUserPostsNoIndex(targetUserId, 20),
    ])
      .then(async ([u, p]) => {
        if (u) setProfile(u)
        // Check interaction status BEFORE rendering — no flash
        if (user && p.length > 0) {
          try {
            const postIds = p.map((post: any) => post.id)
            const statusMap = await checkPostInteractions(postIds, user.id)
            const enriched = p.map((post: any) => {
              const status = statusMap[post.id]
              if (!status) return post
              return { ...post, isLiked: status.isLiked, isReposted: status.isReposted, isBookmarked: status.isBookmarked }
            })
            setPosts(enriched)
          } catch (err) {
            console.error('Failed to check interactions:', err)
            setPosts(p)
          }
        } else {
          setPosts(p)
        }
      })
      .catch((err) => {
        console.error('Failed to load profile:', err)
        setPosts([])
      })
      .finally(() => setLoading(false))
  }, [targetUserId, user])

  // Fetch products when store tab is active
  useEffect(() => {
    if (activeTab !== 'store' || !targetUserId) return
    setProductsLoading(true)
    fetchBusinessProducts(targetUserId, 20)
      .then(({ products: prods }) => setProducts(prods))
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false))
  }, [activeTab, targetUserId])

  const handleMessage = useCallback(async () => {
    if (!user || !targetUserId || targetUserId === user.id) return
    setMessaging(true)
    try {
      const chat = await createOrGetChat(user.id, targetUserId)
      navigate('chat-room', { chatId: chat.id })
    } catch (err) {
      console.error('Failed to start DM:', err)
      toast.error('Could not start message')
    } finally {
      setMessaging(false)
    }
  }, [user, targetUserId, navigate])

  const handleToggleFollow = useCallback(async () => {
    if (!user || !targetUserId || targetUserId === user.id) return
    try {
      const nowFollowing = await toggleFollow(user.id, targetUserId)
      setIsFollowing(nowFollowing)
    } catch (err) {
      console.error('Follow toggle failed:', err)
    }
  }, [user, targetUserId])

  const handleLike = useCallback(async (postId: string) => {
    if (!user) return
    try {
      await togglePostLike(postId, user.id)
      setPosts((prev) =>
        prev.map((p: any) =>
          p.id === postId
            ? { ...p, isLiked: !p.isLiked, likeCount: (p.likeCount ?? 0) + (p.isLiked ? -1 : 1) }
            : p
        )
      )
    } catch (err) {
      console.error('Like failed:', err)
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
      toast.error('Delete failed')
    }
  }, [user])

  // Enrich ALL posts on this profile page with the profile's live data
  // This ensures consistency: profile header and posts always show the same avatar/badge
  useEffect(() => {
    if (!profile || posts.length === 0) return
    setPosts((prev) => prev.map((p: any) => {
      // All posts on this profile page belong to this profile user
      return {
        ...p,
        authorProfileImage: profile.profileImage || p.authorProfileImage,
        authorIsVerified: profile.isVerified || p.authorIsVerified,
        authorBadge: profile.badge || p.authorBadge,
        authorDisplayName: profile.displayName || p.authorDisplayName,
        authorUsername: profile.username || p.authorUsername,
      }
    }))
  }, [profile?.profileImage, profile?.isVerified, profile?.badge, profile?.displayName, profile?.username])

  // Use profile data directly (never bleed logged-in user's data into other user's profile)
  const displayName = profile?.displayName || (isOwnProfile ? user?.displayName : null) || 'User'
  const username = profile?.username || (isOwnProfile ? user?.username : null) || 'user'
  const bio = profile?.bio || (isOwnProfile ? user?.bio : null) || ''
  const profileImage = profile?.profileImage || (isOwnProfile ? user?.profileImage : '') || ''
  const coverImage = profile?.coverImage || (isOwnProfile ? user?.coverImage : '') || ''
  const isVerified = profile?.isVerified ?? (isOwnProfile ? user?.isVerified : false) ?? false
  const badge = profile?.badge || (isOwnProfile ? user?.badge : '') || ''
  // Fetch real follower/following counts and follow status
  useEffect(() => {
    if (!targetUserId) return
    Promise.all([
      getFollowerCount(targetUserId),
      getFollowingCount(targetUserId),
      ...(user && targetUserId !== user.id ? [checkIsFollowing(user.id, targetUserId)] : [Promise.resolve(false)]),
    ]).then(([followers, following, following_status]) => {
      setFollowerCount(followers)
      setFollowingCount(following)
      setIsFollowing(following_status)
    }).catch(() => {})
  }, [targetUserId, user?.id])

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 p-4">
        <div className="h-32 bg-white/[0.06] rounded-xl" />
        <div className="flex gap-4">
          <div className="w-20 h-20 rounded-full bg-white/[0.06]" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-32 bg-white/[0.06] rounded" />
            <div className="h-4 w-48 bg-white/[0.06] rounded" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Cover */}
      <div className="h-32 bg-[#000000] relative overflow-hidden">
        {coverImage ? (
          <img src={coverImage} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1a2a1a] to-[#110f1a]" />
        )}
      </div>

      {/* Profile header */}
      <div className="px-5 pb-4 border-b border-white/[0.06]">
        <div className="flex items-end justify-between -mt-8 mb-3">
          <PAvatar
            src={profileImage}
            name={displayName}
            size={80}
            verified={isVerified}
            badge={badge}
            className="ring-4 ring-[#000000]"
          />
          {isOwnProfile ? (
            <button
              onClick={() => navigate('edit-profile')}
              className="px-5 py-1.5 rounded-full border border-[#64748b] text-[15px] font-bold text-[#e7e9ea] hover:bg-white/[0.06] transition-colors"
            >
              Edit profile
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleFollow}
                className={cn(
                  'px-6 py-2 rounded-full text-[15px] font-bold transition-colors',
                  isFollowing
                    ? 'border border-[#64748b] text-[#e7e9ea] hover:border-red-500 hover:text-red-500 hover:bg-red-500/10'
                    : 'bg-[#e7e9ea] text-black hover:bg-gray-200'
                )}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
              <button
                onClick={handleMessage}
                disabled={messaging}
                className="flex items-center gap-1.5 px-5 py-2 rounded-full border border-[#FFFFFF]/40 text-[15px] font-bold text-[#FFFFFF] hover:bg-[#FFFFFF]/10 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                {messaging ? (
                  <div className="w-4 h-4 border-2 border-[#FFFFFF]/30 border-t-[#FFFFFF] rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                  </svg>
                )}
                Message
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-[#e7e9ea]">{displayName}</h2>
          {(isVerified || !!badge) && <VerifiedBadge size={20} badge={badge} />}
        </div>
        <p className="text-[15px] text-[#94a3b8]">@{username}</p>
        {bio && (
          <p className="text-[15px] text-[#e7e9ea] mt-2 leading-relaxed">{bio}</p>
        )}

        <div className="flex items-center gap-5 mt-4 text-[14px]">
          <span className="text-[#e7e9ea]">
            <span className="font-bold">{followingCount}</span>{' '}
            <span className="text-[#94a3b8]">Following</span>
          </span>
          <span className="text-[#e7e9ea]">
            <span className="font-bold">{followerCount}</span>{' '}
            <span className="text-[#94a3b8]">Followers</span>
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-[53px] z-20 bg-[#000000] border-b border-white/[0.06]">
        <div className="flex">
          {(showStoreTab ? ['posts', 'store', 'likes'] : ['posts', 'replies', 'likes'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 py-3.5 text-[15px] font-medium relative transition-colors capitalize',
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

      {/* Tab Content */}
      {activeTab === 'store' ? (
        <>
          {productsLoading ? (
            <div className="grid grid-cols-2 gap-3 p-5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl bg-white/[0.06] aspect-square animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
              <svg className="w-12 h-12 text-[#94a3b8] mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 6h18" strokeLinecap="round" />
                <path d="M16 10a4 4 0 01-8 0" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-[15px] text-[#94a3b8]">No products listed yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 p-5">
              {products.map((p: any) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
          {isOwnProfile && (
            <div className="flex flex-col items-center gap-3 pt-4 pb-24">
              <button
                onClick={() => navigate('store-dashboard')}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#FFFFFF] to-[#D1D5DB] text-black font-bold text-[14px] shadow-lg shadow-[#FFFFFF]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 01-8 0" />
                </svg>
                Store Dashboard
              </button>
              <button
                onClick={() => navigate('add-product')}
                className="flex items-center gap-1.5 text-[13px] font-medium text-[#FFFFFF] hover:text-[#c4e899] transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add Product
              </button>
            </div>
          )}
        </>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
          <p className="text-[15px] text-[#94a3b8]">No posts yet</p>
        </div>
      ) : (
        posts.map((post: any) => (
          <UserPostCard
            key={post.id}
            post={post}
            onLike={handleLike}
            onRepost={handleRepost}
            onBookmark={handleBookmark}
            onDelete={handleDelete}
            onProfileTap={(uid: string) => navigate('user-profile', { userId: uid })}
            userId={user?.id}
            userDisplayName={user?.displayName || undefined}
            userUsername={user?.username || undefined}
            userProfileImage={user?.profileImage || undefined}
          />
        ))
      )}
    </div>
  )
}
